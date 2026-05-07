/**
 * lineWebhook — LINE Messaging API webhook.
 *
 * Supported commands:
 * - "ID" replies with the sender LINE user ID.
 * - "@BOT setup employee @EMPLOYEE" links the mentioned LINE user to an
 *   employee document, when sent by an authorized admin.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { getAppFirestore, getLineConfig } from "../helpers/config.js";
import { replyLineMessage } from "../helpers/line.js";
import type { LineConfig } from "../types.js";

interface LineMentionee {
	index: number;
	length: number;
	userId?: string;
	type?: string;
	isSelf?: boolean;
}

interface LineTextMessage {
	type: "text";
	text: string;
	mention?: {
		mentionees?: LineMentionee[];
	};
}

interface LineSource {
	type?: "user" | "group" | "room";
	userId?: string;
	groupId?: string;
	roomId?: string;
}

interface LineEvent {
	type: string;
	replyToken?: string;
	message?: LineTextMessage;
	source?: LineSource;
}

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

interface LineHttpRequest {
	get(name: string): string | undefined;
	rawBody?: Buffer;
}

type EmployeeLookupResult =
	| { status: "found"; employee: EmployeeRecord }
	| { status: "not-found" }
	| { status: "ambiguous"; employees: EmployeeRecord[] };

export const lineWebhook = onRequest(async (request, res) => {
	if (request.method !== "POST") {
		res.status(405).send("Method Not Allowed");
		return;
	}

	try {
		const config = await getLineConfig();
		const signatureOk = verifyLineRequest(request, config);
		if (config.LINE_CHANNEL_SECRET && !signatureOk) {
			res.status(401).json({ ok: false, error: "invalid LINE signature" });
			return;
		}

		const body = request.body as { events?: LineEvent[] };
		const events = Array.isArray(body.events) ? body.events : [];

		for (const event of events) {
			if (event.type !== "message" || event.message?.type !== "text") continue;

			const text = event.message.text.trim();
			if (text.toUpperCase() === "ID") {
				await replyText(
					config,
					event.replyToken,
					`Your User ID:\n${event.source?.userId || "-"}\n\nนำไปใส่ในระบบเพื่อรับการแจ้งเตือน`,
				);
				continue;
			}

			const hasSetupCommand = hasSetupEmployeePhrase(event.message.text);
			const setupCommand = parseSetupEmployeeCommand(event);
			if (!setupCommand) {
				if (hasSetupCommand && isSetupCommandAddressedToBot(event)) {
					await replyText(
						config,
						event.replyToken,
						"กรุณาใช้รูปแบบ @BOT setup employee @EMPLOYEE และ mention พนักงานจริงในกลุ่ม",
					);
				}
				continue;
			}

			await handleSetupEmployeeCommand({
				config,
				event,
				setupCommand,
				signatureOk,
			});
		}

		res.json({ ok: true });
	} catch (err) {
		console.error("webhook error:", err);
		res.status(500).json({ ok: false });
	}
});

function verifyLineRequest(
	request: LineHttpRequest,
	config: LineConfig,
): boolean {
	if (!config.LINE_CHANNEL_SECRET) return false;

	const signature = request.get("x-line-signature");
	const rawBody = request.rawBody;
	if (!signature || !rawBody) return false;

	const expected = createHmac("sha256", config.LINE_CHANNEL_SECRET)
		.update(rawBody)
		.digest("base64");
	const expectedBuffer = Buffer.from(expected);
	const signatureBuffer = Buffer.from(signature);

	return (
		expectedBuffer.length === signatureBuffer.length &&
		timingSafeEqual(expectedBuffer, signatureBuffer)
	);
}

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
		await replyText(
			config,
			event.replyToken,
			`ไม่พบพนักงาน "${setupCommand.employeeKey}" ในระบบ`,
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
		`เชื่อม LINE ให้ ${employee.name} เรียบร้อย\n${setupCommand.targetMentionText}: ${setupCommand.targetLineUserId}`,
	);
}

function parseSetupEmployeeCommand(event: LineEvent): SetupCommand | null {
	const text = event.message?.text;
	if (!text) return null;

	const setupMatch = getSetupEmployeeMatch(text);
	if (!setupMatch) return null;

	const mentionees = event.message?.mention?.mentionees || [];
	if (!isSetupCommandAddressedToBot(event)) return null;

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

function isSetupCommandAddressedToBot(event: LineEvent): boolean {
	const isGroupOrRoom =
		event.source?.type === "group" || event.source?.type === "room";
	if (!isGroupOrRoom) return true;

	return (event.message?.mention?.mentionees || []).some(
		(mentionee) => mentionee.type === "user" && mentionee.isSelf === true,
	);
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

async function replyText(
	config: LineConfig,
	replyToken: string | undefined,
	text: string,
): Promise<void> {
	if (!replyToken) return;
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE_CHANNEL_ACCESS_TOKEN is not configured; cannot reply");
		return;
	}

	await replyLineMessage(config.LINE_CHANNEL_ACCESS_TOKEN, replyToken, {
		type: "text",
		text,
	});
}
