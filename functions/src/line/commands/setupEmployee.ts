import { getAuth } from "firebase-admin/auth";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAppFirestore } from "../../helpers/config.js";
import type { LineConfig } from "../../types.js";
import { getMentionees, isAddressedToBot } from "../core/message.js";
import { replyText } from "../core/reply.js";
import {
	invalid,
	type LineCommand,
	type LineEvent,
	type LineMentionee,
	matched,
	notMatched,
} from "../core/types.js";

const SETUP_EMPLOYEE_USAGE =
	"กรุณาใช้รูปแบบ @BOT setup employee @EMPLOYEE หรือ @BOT setup employee @EMPLOYEE ชื่อพนักงาน และ mention พนักงานจริงในกลุ่ม";

interface SetupCommand {
	targetLineUserId: string;
	targetMentionText: string;
	employeeKey: string;
}

interface EmployeeRecord {
	id: string;
	name: string;
	lineUserId?: string;
}

type EmployeeLookupResult =
	| { status: "found"; employee: EmployeeRecord }
	| { status: "not-found" }
	| { status: "ambiguous"; employees: EmployeeRecord[] };

export const setupEmployeeCommand: LineCommand<SetupCommand> = {
	name: "setup-employee",
	parse({ event }) {
		const setupCommand = parseSetupEmployeeCommand(event);
		if (setupCommand) return matched(setupCommand);

		const text = event.message?.text;
		if (text && hasSetupEmployeePhrase(text) && isAddressedToBot(event)) {
			return invalid(SETUP_EMPLOYEE_USAGE);
		}

		return notMatched();
	},
	async handle({ config, event, signatureOk }, setupCommand) {
		await handleSetupEmployeeCommand({
			config,
			event,
			setupCommand,
			signatureOk,
		});
	},
};

async function handleSetupEmployeeCommand({
	config,
	event,
	setupCommand,
	signatureOk,
}: {
	config: LineConfig;
	event: LineEvent;
	setupCommand: SetupCommand;
	signatureOk: boolean;
}): Promise<void> {
	if (!signatureOk) {
		await replyText(
			config,
			event.replyToken,
			"ยังไม่ได้ตั้งค่า LINE_CHANNEL_SECRET จึงไม่สามารถใช้คำสั่ง setup employee ได้",
		);
		return;
	}

	const senderLineUserId = event.source?.userId;
	if (!senderLineUserId) {
		await replyText(config, event.replyToken, "ไม่พบ LINE user ID ของผู้ส่งคำสั่ง");
		return;
	}

	const admin = await isAuthorizedLineAdmin(senderLineUserId, config);
	if (!admin) {
		await replyText(config, event.replyToken, "คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบเท่านั้น");
		return;
	}

	const db = getAppFirestore();
	const existingLinkedEmployee = await findEmployeeByLineUserId(
		db,
		setupCommand.targetLineUserId,
	);
	const employeeResult = await findEmployeeByKey(db, setupCommand.employeeKey);

	if (employeeResult.status === "not-found") {
		if (existingLinkedEmployee) {
			await replyText(
				config,
				event.replyToken,
				`LINE account นี้ถูกเชื่อมกับ ${existingLinkedEmployee.name} แล้ว`,
			);
			return;
		}

		await ensureLineAuthUser(
			setupCommand.targetLineUserId,
			setupCommand.employeeKey,
		);

		const employeeRef = db.collection("employees").doc();
		await employeeRef.set({
			name: setupCommand.employeeKey,
			role: "-",
			roleId: "",
			avatar: makeAvatarText(setupCommand.employeeKey),
			avatarType: "text",
			avatarImageUrl: null,
			lineUserId: setupCommand.targetLineUserId,
			balance: { personal: 15, sick: 15 },
			used: { personal: 0, sick: 0 },
			lineLinkedAt: FieldValue.serverTimestamp(),
			lineLinkedBy: senderLineUserId,
			lineLinkedFromGroup:
				event.source?.groupId || event.source?.roomId || null,
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		});

		await replyText(
			config,
			event.replyToken,
			`เพิ่มพนักงานและเปิดสิทธิ์ LINE Login ให้ ${setupCommand.employeeKey} เรียบร้อย\n${setupCommand.targetMentionText}: ${setupCommand.targetLineUserId}`,
		);
		return;
	}

	if (employeeResult.status === "ambiguous") {
		await replyText(
			config,
			event.replyToken,
			`พบพนักงานใกล้เคียงหลายคน: ${employeeResult.employees
				.map((employee) => employee.name)
				.join(", ")}\nกรุณาพิมพ์ชื่อเต็มหรือ employee id`,
		);
		return;
	}

	const employee = employeeResult.employee;
	if (existingLinkedEmployee && existingLinkedEmployee.id !== employee.id) {
		await replyText(
			config,
			event.replyToken,
			`LINE account นี้ถูกเชื่อมกับ ${existingLinkedEmployee.name} แล้ว`,
		);
		return;
	}

	if (
		employee.lineUserId &&
		employee.lineUserId !== setupCommand.targetLineUserId
	) {
		await replyText(
			config,
			event.replyToken,
			`${employee.name} ถูกเชื่อมกับ LINE account อื่นแล้ว`,
		);
		return;
	}

	await ensureLineAuthUser(setupCommand.targetLineUserId, employee.name);

	await db
		.collection("employees")
		.doc(employee.id)
		.set(
			{
				lineUserId: setupCommand.targetLineUserId,
				lineLinkedAt: FieldValue.serverTimestamp(),
				lineLinkedBy: senderLineUserId,
				lineLinkedFromGroup:
					event.source?.groupId || event.source?.roomId || null,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);

	await replyText(
		config,
		event.replyToken,
		`เชื่อม LINE และเปิดสิทธิ์ LINE Login ให้ ${employee.name} เรียบร้อย\n${setupCommand.targetMentionText}: ${setupCommand.targetLineUserId}`,
	);
}

function parseSetupEmployeeCommand(event: LineEvent): SetupCommand | null {
	const text = event.message?.text;
	if (!text) return null;

	const setupMatch = getSetupEmployeeMatch(text);
	if (!setupMatch) return null;

	const mentionees = getMentionees(event);
	if (!isAddressedToBot(event)) return null;

	const commandEnd = setupMatch.index + setupMatch[0].length;
	const targetMention =
		mentionees.find(
			(mentionee) =>
				mentionee.type === "user" &&
				mentionee.isSelf !== true &&
				!!mentionee.userId &&
				mentionee.index >= commandEnd,
		) ||
		mentionees.find(
			(mentionee) =>
				mentionee.type === "user" &&
				mentionee.isSelf !== true &&
				!!mentionee.userId,
		);

	if (!targetMention?.userId) return null;

	const textWithoutMentions = removeMentionRanges(text, mentionees);
	const strippedSetupMatch = /(?:^|\s)setup\s+employee(?:\s|$)/i.exec(
		textWithoutMentions,
	);
	const explicitEmployeeKey = strippedSetupMatch
		? normalizeSpaces(
				textWithoutMentions.slice(
					strippedSetupMatch.index + strippedSetupMatch[0].length,
				),
			)
		: "";
	const targetMentionText = cleanMentionText(
		getMentionText(text, targetMention),
	);
	const employeeKey = explicitEmployeeKey || targetMentionText;

	if (!employeeKey) return null;

	return {
		targetLineUserId: targetMention.userId,
		targetMentionText,
		employeeKey,
	};
}

function hasSetupEmployeePhrase(text: string): boolean {
	return !!getSetupEmployeeMatch(text);
}

function getSetupEmployeeMatch(text: string): RegExpExecArray | null {
	return /(?:^|\s)setup\s+employee(?:\s|$)/i.exec(text);
}

function removeMentionRanges(
	text: string,
	mentionees: LineMentionee[],
): string {
	return mentionees
		.map((mentionee) => ({
			start: mentionee.index,
			end: mentionee.index + mentionee.length,
		}))
		.filter((range) => range.start >= 0 && range.end <= text.length)
		.sort((a, b) => b.start - a.start)
		.reduce(
			(result, range) => result.slice(0, range.start) + result.slice(range.end),
			text,
		);
}

function getMentionText(text: string, mentionee: LineMentionee): string {
	return text.slice(mentionee.index, mentionee.index + mentionee.length);
}

function cleanMentionText(value: string): string {
	return normalizeSpaces(value.replace(/^@/, ""));
}

function normalizeSpaces(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function normalizeLookupKey(value: string): string {
	return normalizeSpaces(value).normalize("NFKC").toLocaleLowerCase();
}

function makeAvatarText(name: string): string {
	const letters = Array.from(name.replace(/\s+/g, ""));
	return letters.slice(0, 2).join("") || "-";
}

async function ensureLineAuthUser(
	lineUserId: string,
	displayName: string,
): Promise<void> {
	const auth = getAuth();
	try {
		await auth.getUser(lineUserId);
		return;
	} catch (error) {
		if ((error as { code?: string }).code !== "auth/user-not-found") {
			throw error;
		}
	}

	await auth.createUser({
		uid: lineUserId,
		displayName,
	});
}

async function findEmployeeByKey(
	db: Firestore,
	key: string,
): Promise<EmployeeLookupResult> {
	const normalizedKey = normalizeLookupKey(key);
	const snapshot = await db.collection("employees").get();
	const employees = snapshot.docs.map((doc) => {
		const data = doc.data() as { name?: unknown; lineUserId?: unknown };
		return {
			id: doc.id,
			name: typeof data.name === "string" ? data.name : doc.id,
			lineUserId:
				typeof data.lineUserId === "string" ? data.lineUserId : undefined,
		};
	});

	const exactMatches = employees.filter(
		(employee) =>
			normalizeLookupKey(employee.id) === normalizedKey ||
			normalizeLookupKey(employee.name) === normalizedKey,
	);
	if (exactMatches.length === 1) {
		return { status: "found", employee: exactMatches[0] };
	}
	if (exactMatches.length > 1) {
		return { status: "ambiguous", employees: exactMatches };
	}

	const looseMatches = employees.filter((employee) =>
		normalizeLookupKey(employee.name).includes(normalizedKey),
	);
	if (looseMatches.length === 1) {
		return { status: "found", employee: looseMatches[0] };
	}
	if (looseMatches.length > 1) {
		return { status: "ambiguous", employees: looseMatches.slice(0, 5) };
	}

	return { status: "not-found" };
}

async function findEmployeeByLineUserId(
	db: Firestore,
	lineUserId: string,
): Promise<EmployeeRecord | null> {
	const snapshot = await db
		.collection("employees")
		.where("lineUserId", "==", lineUserId)
		.limit(1)
		.get();
	if (snapshot.empty) return null;

	const doc = snapshot.docs[0];
	const data = doc.data() as { name?: unknown; lineUserId?: unknown };
	return {
		id: doc.id,
		name: typeof data.name === "string" ? data.name : doc.id,
		lineUserId:
			typeof data.lineUserId === "string" ? data.lineUserId : undefined,
	};
}

async function isAuthorizedLineAdmin(
	lineUserId: string,
	config: LineConfig,
): Promise<boolean> {
	if (isConfiguredAdminLineUser(lineUserId, config.ADMIN_LINE_USER_ID)) {
		return true;
	}

	try {
		const user = await getAuth().getUser(lineUserId);
		return user.customClaims?.admin === true;
	} catch (error) {
		if ((error as { code?: string }).code === "auth/user-not-found") {
			return false;
		}
		throw error;
	}
}

function isConfiguredAdminLineUser(
	lineUserId: string,
	configValue: string | undefined,
): boolean {
	return (
		configValue
			?.split(/[,\s]+/)
			.map((value) => value.trim())
			.filter(Boolean)
			.includes(lineUserId) || false
	);
}
