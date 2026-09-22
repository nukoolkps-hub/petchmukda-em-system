/**
 * ทำข้อสอบจากมือถือตัวเองผ่าน QR — **ไม่ต้อง login** (callable 3 ตัว)
 *
 * ADMIN กด "เปิดรอบสอบ" ในหน้าแบบทดสอบ → ได้รหัสรอบ + QR · พนักงานสแกน
 * แล้วพิมพ์ชื่อ เริ่มทำได้เลย ไม่ต้องมีบัญชีในระบบ
 *
 * **ทำไมต้องผ่าน Cloud Function ทั้งหมด ไม่ให้เขียน Firestore ตรงๆ:**
 * คนทำข้อสอบไม่ได้ login → ถ้าจะให้เขียน `quizAttempts` เองต้องเปิด
 * `firestore.rules` ให้คนที่ไม่มีตัวตนเขียนได้ ซึ่งลากคนนอกเข้ามาอ่าน/เขียน
 * ข้อมูลส่วนอื่นด้วย (rules ตัดสินจาก "signed-in" เป็นหลัก) · ให้ทุกอย่าง
 * วิ่งผ่าน Admin SDK ตรงนี้แทน rules เดิมจึงไม่ต้องแตะเลยสักบรรทัด
 *
 * ของแถมที่ได้มาด้วย — เวลาทั้งหมดมาจากนาฬิกา server:
 * - `startedAt` ปลอมไม่ได้ (ถ้าให้ client ส่งมา ตั้งเวลาอนาคตแล้วยืดเวลาสอบเอง)
 * - หมดเวลาแล้วเขียนคำตอบเพิ่มไม่ได้ ต่อให้แก้นาฬิกาเครื่องตัวเอง
 * - คืน `serverNow` ให้ทุกครั้ง client จึงนับถอยหลังด้วยเวลาที่ตรงกับ server
 *   (มือถือที่ตั้งเวลาเพี้ยนไม่งั้นจะเห็นเวลาเหลือมั่ว)
 */

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore } from "../helpers/config.js";

/** ชื่อผู้สอบยาวเกินนี้ถือว่าผิดปกติ */
const MAX_NAME_CHARS = 60;
/** คำตอบต่อข้อ — เท่ากับเพดานที่ AI ช่วยตรวจใช้ */
const MAX_ANSWER_CHARS = 4_000;
/** กันยิงคำตอบมั่วเป็นพันคีย์จน doc บวมเกิน 1MB ของ Firestore */
const MAX_ANSWER_KEYS = 200;
/** กันคนที่ได้รหัสรอบไปแล้วยิงสร้างใบสอบรัว — 1 รอบสอบจริงไม่เกินนี้แน่ */
const MAX_ATTEMPTS_PER_ROUND = 80;

interface QuizQuestion {
	id: string;
	text: string;
}

interface QuizSetLite {
	id: string;
	title: string;
	durationMinutes: number;
	passPercent: number;
	rules: string[];
	main: QuizQuestion[];
	general: QuizQuestion[];
}

interface PriceSnapshot {
	goldSellPerBaht: number;
	goldBuyPerBaht: number;
	silverSellPerGram: number;
	silverBuyPerGram: number;
	changeRates: Record<string, number>;
	changeRatesForPrice: number;
	capturedAt: number;
	priceUpdatedAt: number;
}

/** state ที่ฝั่งหน้าทำข้อสอบต้องใช้ — ไม่มี `grades` ติดไปด้วยเด็ดขาด
 *  (คนทำข้อสอบต้องไม่เห็นผลตรวจของ ADMIN ผ่าน response ของตัวเอง) */
interface GuestState {
	attemptId: string;
	startedAt: number;
	durationMinutes: number;
	submittedAt: number | null;
	cancelledAt: number | null;
	autoSubmitted: boolean;
	answers: Record<string, string>;
	employeeName: string;
	priceSnapshot: PriceSnapshot | null;
	/** เวลาปัจจุบันฝั่ง server — client เอาไปหักลบกับนาฬิกาตัวเอง */
	serverNow: number;
	quiz?: QuizSetLite;
}

/** ตอน join เท่านั้นที่ได้ `token` กลับไป — ครั้งต่อไปใช้ตัวที่เก็บไว้ */
interface GuestJoinResult extends GuestState {
	token: string;
}

function toQuestions(raw: unknown): QuizQuestion[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((r) => {
			const q = r as { id?: unknown; text?: unknown };
			return { id: String(q.id ?? ""), text: String(q.text ?? "") };
		})
		.filter((q) => q.id.length > 0);
}

/** ตัดช่องว่างหัว-ท้าย + ยุบช่องว่างซ้อน แล้วเทียบแบบไม่สนตัวพิมพ์
 *  — **ต้องตรงกับ `normalizeName` ใน `src/utils/quizAttempt.ts`** ไม่งั้น
 *  ใบที่ทำผ่าน QR กับใบที่ ADMIN เปิดให้ทำจะจับคู่พนักงานคนละแบบ */
function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** ชื่อที่พิมพ์ → `employeeId` · **ชนกันหลายคน = คืนค่าว่าง ไม่เดา**
 *  (กฎเดียวกับ `resolveExamineeId` ฝั่ง client — ผูกผิดคนแย่กว่าไม่ผูก) */
async function resolveEmployeeId(
	db: FirebaseFirestore.Firestore,
	typedName: string,
): Promise<string> {
	const target = normalizeName(typedName);
	if (!target) return "";
	const snap = await db.collection("employees").get();
	const hits = snap.docs.filter((d) => {
		const data = d.data() as { name?: unknown; nickname?: unknown };
		return (
			normalizeName(String(data.nickname ?? "")) === target ||
			normalizeName(String(data.name ?? "")) === target
		);
	});
	return hits.length === 1 ? hits[0].id : "";
}

/** ราคาทองที่ตรึงไว้ตอนกดเริ่ม — กติกาข้อสอบคือ "ทุกข้ออ้างอิงราคา ณ วันที่สอบ"
 *  ไม่ตรึง = ตรวจวันถัดไปเฉลยคิดจากราคาใหม่ คำตอบที่ถูกกลายเป็นผิดทั้งกระดาน */
async function readPriceSnapshot(
	db: FirebaseFirestore.Firestore,
	now: number,
): Promise<PriceSnapshot> {
	const snap = await db.doc("config/goldPrice").get();
	const g = (snap.data() ?? {}) as Record<string, unknown>;
	const num = (v: unknown): number =>
		typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
	const sell = num(g.pricePerBaht);
	const updatedAt = num(g.updatedAt);
	// ยังไม่เคยดึงราคาสำเร็จ → ห้ามเริ่ม (ฝั่ง admin ก็ disable ปุ่มด้วยกฎเดียวกัน)
	if (sell <= 0 || updatedAt <= 0) {
		throw new HttpsError(
			"failed-precondition",
			"ระบบยังไม่มีราคาทองของวันนี้ — เริ่มสอบไม่ได้ (แจ้ง ADMIN ให้กดรีเฟรชราคา)",
		);
	}
	const rates: Record<string, number> = {};
	const raw = g.changeRates;
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
			if (typeof v === "number" && Number.isFinite(v) && v > 0) rates[k] = v;
		}
	}
	return {
		goldSellPerBaht: sell,
		goldBuyPerBaht: num(g.buyPrice),
		silverSellPerGram: num(g.silverSellPerGram),
		silverBuyPerGram: num(g.silverBuyPerGram),
		changeRates: rates,
		changeRatesForPrice: num(g.changeRatesForPrice),
		capturedAt: now,
		priceUpdatedAt: updatedAt,
	};
}

/** คำตอบที่ส่งมา → ของที่เขียนลง Firestore ได้จริง (ตัดขยะ/จำกัดขนาด) */
function sanitizeAnswers(raw: unknown): Record<string, string> {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const out: Record<string, string> = {};
	let keys = 0;
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (keys >= MAX_ANSWER_KEYS) break;
		if (typeof v !== "string") continue;
		out[k] = v.slice(0, MAX_ANSWER_CHARS);
		keys += 1;
	}
	return out;
}

function toState(
	attemptId: string,
	data: FirebaseFirestore.DocumentData,
	now: number,
	quiz?: QuizSetLite,
): GuestState {
	return {
		attemptId,
		startedAt: Number(data.startedAt ?? 0),
		durationMinutes: Number(data.durationMinutes ?? 0),
		submittedAt: (data.submittedAt as number | null) ?? null,
		cancelledAt: (data.cancelledAt as number | null) ?? null,
		autoSubmitted: data.autoSubmitted === true,
		answers: (data.answers as Record<string, string>) ?? {},
		employeeName: String(data.employeeName ?? ""),
		priceSnapshot: (data.priceSnapshot as PriceSnapshot | null) ?? null,
		serverNow: now,
		quiz,
	};
}

function endOf(data: FirebaseFirestore.DocumentData): number {
	return (
		Number(data.startedAt ?? 0) + Number(data.durationMinutes ?? 0) * 60_000
	);
}

/** ข้อมูลรอบสอบสำหรับหน้าก่อนกดเริ่ม — **ไม่มีโจทย์ติดไปด้วย**
 *  (โจทย์ออกไปพร้อมกับการเริ่มจับเวลาเท่านั้น ไม่งั้นเปิดดูล่วงหน้าได้) */
interface GuestRoundInfo {
	open: boolean;
	/** เหตุผลที่เริ่มไม่ได้ (ว่าง = เริ่มได้) */
	reason: string;
	quizTitle: string;
	rules: string[];
	durationMinutes: number;
	mainCount: number;
	generalCount: number;
}

/**
 * ดูว่ารหัสจาก QR ใช้ได้ไหม + กติกา/เวลา — **ยังไม่เริ่มจับเวลา**
 *
 * แยกจาก `quizGuestJoin` เพราะกติกาต้องอ่านก่อนกดเริ่ม ถ้าเอาไปโชว์หลัง
 * join เวลาสอบจะเดินไปแล้วระหว่างที่ยังอ่านกติกาอยู่
 */
export const quizGuestInfo = onCall(async (req): Promise<GuestRoundInfo> => {
	const code = String((req.data as { code?: unknown } | undefined)?.code ?? "")
		.trim()
		.toUpperCase();
	const blank: GuestRoundInfo = {
		open: false,
		reason: "รหัสรอบสอบไม่ถูกต้อง",
		quizTitle: "",
		rules: [],
		durationMinutes: 0,
		mainCount: 0,
		generalCount: 0,
	};
	if (!code) return blank;

	const db = getAppFirestore();
	const now = Date.now();
	const roundSnap = await db.doc("config/quizRound").get();
	const round = (roundSnap.data() ?? {}) as Record<string, unknown>;
	if (String(round.code ?? "").toUpperCase() !== code) return blank;
	if (round.closedAt) return { ...blank, reason: "รอบสอบนี้ปิดไปแล้ว" };
	if (Number(round.closesAt ?? 0) <= now) {
		return { ...blank, reason: "รอบสอบนี้หมดเวลาแล้ว" };
	}

	const quizSnap = await db.doc(`quizSets/${String(round.quizId ?? "")}`).get();
	if (!quizSnap.exists) {
		return { ...blank, reason: "ไม่พบชุดข้อสอบของรอบนี้ — แจ้ง ADMIN" };
	}
	const q = quizSnap.data() as Record<string, unknown>;
	return {
		open: true,
		reason: "",
		quizTitle: String(q.title ?? ""),
		rules: Array.isArray(q.rules) ? q.rules.map(String) : [],
		durationMinutes: Number(q.durationMinutes ?? 0),
		mainCount: toQuestions(q.main).length,
		generalCount: toQuestions(q.general).length,
	};
});

/**
 * เข้าร่วมรอบสอบด้วยรหัสจาก QR แล้วเริ่มจับเวลา
 *
 * รอบต้องเปิดอยู่จริง ณ เวลา server — กฎเดียวกับ `isRoundOpen` ฝั่ง UI
 * (`src/utils/quizRound.ts`) แต่ตัวที่บังคับจริงคือตรงนี้
 */
export const quizGuestJoin = onCall(async (req): Promise<GuestJoinResult> => {
	const data = (req.data ?? {}) as { code?: unknown; name?: unknown };
	const code = String(data.code ?? "")
		.trim()
		.toUpperCase();
	const name = String(data.name ?? "")
		.trim()
		.slice(0, MAX_NAME_CHARS);
	if (!code) throw new HttpsError("invalid-argument", "ต้องระบุรหัสรอบสอบ");
	if (!name) throw new HttpsError("invalid-argument", "ต้องกรอกชื่อผู้ทำข้อสอบ");

	const db = getAppFirestore();
	const now = Date.now();

	const roundSnap = await db.doc("config/quizRound").get();
	const round = (roundSnap.data() ?? {}) as Record<string, unknown>;
	const roundCode = String(round.code ?? "").toUpperCase();
	if (!roundCode || roundCode !== code) {
		throw new HttpsError("not-found", "รหัสรอบสอบไม่ถูกต้อง");
	}
	if (round.closedAt) {
		throw new HttpsError("failed-precondition", "รอบสอบนี้ปิดไปแล้ว");
	}
	if (Number(round.closesAt ?? 0) <= now) {
		throw new HttpsError("failed-precondition", "รอบสอบนี้หมดเวลาแล้ว");
	}

	const quizId = String(round.quizId ?? "");
	const quizSnap = await db.doc(`quizSets/${quizId}`).get();
	if (!quizSnap.exists) {
		throw new HttpsError("not-found", "ไม่พบชุดข้อสอบของรอบนี้ — แจ้ง ADMIN");
	}
	const q = quizSnap.data() as Record<string, unknown>;
	const quiz: QuizSetLite = {
		id: quizId,
		title: String(q.title ?? ""),
		durationMinutes: Number(q.durationMinutes ?? 0),
		passPercent: Number(q.passPercent ?? 0),
		rules: Array.isArray(q.rules) ? q.rules.map(String) : [],
		main: toQuestions(q.main),
		general: toQuestions(q.general),
	};
	if (quiz.main.length === 0 || quiz.durationMinutes <= 0) {
		throw new HttpsError("failed-precondition", "ชุดข้อสอบของรอบนี้ไม่สมบูรณ์");
	}

	const used = await db
		.collection("quizAttempts")
		.where("roundCode", "==", roundCode)
		.count()
		.get();
	if (used.data().count >= MAX_ATTEMPTS_PER_ROUND) {
		throw new HttpsError(
			"resource-exhausted",
			"รอบนี้มีใบสอบเต็มแล้ว — แจ้ง ADMIN ให้เปิดรอบใหม่",
		);
	}

	const priceSnapshot = await readPriceSnapshot(db, now);
	const employeeId = await resolveEmployeeId(db, name);
	const token = randomBytes(24).toString("hex");

	const ref = db.collection("quizAttempts").doc();
	await ref.set({
		quizId,
		// **ไม่มีเจ้าของที่เป็น auth uid** — ใบนี้แก้ได้ผ่าน function นี้เท่านั้น
		// (`firestore.rules` เทียบ `request.auth.uid == resource.data.uid` ซึ่ง
		// ไม่มีทางตรงกับค่าว่าง → client คนไหนก็เขียนทับไม่ได้)
		uid: "",
		guestToken: token,
		roundCode,
		viaGuestLink: true,
		employeeId,
		employeeName: name,
		startedAt: now,
		startedAtServer: FieldValue.serverTimestamp(),
		durationMinutes: quiz.durationMinutes,
		answers: {},
		submittedAt: null,
		cancelledAt: null,
		priceSnapshot,
	});

	console.log(
		`[quizGuestJoin] ${ref.id} round=${roundCode} name=${name} emp=${employeeId || "-"}`,
	);
	const snap = await ref.get();
	// token คืนครั้งเดียวตอนเริ่ม — client เก็บไว้ใช้เขียนคำตอบต่อ
	return { ...toState(ref.id, snap.data() ?? {}, now, quiz), token };
});

/**
 * บันทึกคำตอบ / ส่ง / ยกเลิก / ดึงสถานะกลับมาทำต่อ — ใช้ตัวเดียวทุกกรณี
 *
 * ตัวยืนยันตัวตนคือ `attemptId` + `token` ที่ได้ตอน join (เก็บใน localStorage
 * ของเครื่องผู้สอบ) → รีเฟรช/เน็ตหลุดแล้วกลับมาทำต่อได้ โดยไม่ต้อง login
 */
export const quizGuestSync = onCall(
	async (req): Promise<GuestState & { expired: boolean }> => {
		const data = (req.data ?? {}) as {
			attemptId?: unknown;
			token?: unknown;
			answers?: unknown;
			submit?: unknown;
			cancel?: unknown;
			includeQuiz?: unknown;
		};
		const attemptId = String(data.attemptId ?? "").trim();
		const token = String(data.token ?? "").trim();
		if (!attemptId || !token) {
			throw new HttpsError("invalid-argument", "ต้องระบุใบสอบ + token");
		}

		const db = getAppFirestore();
		const now = Date.now();
		const ref = db.doc(`quizAttempts/${attemptId}`);
		const snap = await ref.get();
		if (!snap.exists) throw new HttpsError("not-found", "ไม่พบใบสอบนี้");
		const attempt = snap.data() ?? {};
		// ใบที่ ADMIN เปิดให้ทำ (ไม่มี guestToken) ต้องเข้าทางนี้ไม่ได้เลย
		if (!attempt.guestToken || attempt.guestToken !== token) {
			throw new HttpsError("permission-denied", "token ไม่ถูกต้อง");
		}

		let quiz: QuizSetLite | undefined;
		if (data.includeQuiz === true) {
			const quizSnap = await db.doc(`quizSets/${attempt.quizId}`).get();
			if (quizSnap.exists) {
				const q = quizSnap.data() as Record<string, unknown>;
				quiz = {
					id: String(attempt.quizId ?? ""),
					title: String(q.title ?? ""),
					durationMinutes: Number(q.durationMinutes ?? 0),
					passPercent: Number(q.passPercent ?? 0),
					rules: Array.isArray(q.rules) ? q.rules.map(String) : [],
					main: toQuestions(q.main),
					general: toQuestions(q.general),
				};
			}
		}

		// ส่งแล้ว/ยกเลิกแล้ว = จบ ไม่รับเขียนอะไรอีก (กดซ้ำ/หน้าค้างก็ไม่พัง)
		if (attempt.submittedAt || attempt.cancelledAt) {
			return { ...toState(attemptId, attempt, now, quiz), expired: false };
		}

		const answers = sanitizeAnswers(data.answers);
		const hasAnswers = data.answers !== undefined;
		const expired = now >= endOf(attempt);

		if (data.cancel === true) {
			await ref.update({
				cancelledAt: now,
				cancelledAtServer: FieldValue.serverTimestamp(),
			});
		} else if (expired) {
			// **หมดเวลาแล้วส่งให้เลย** — เขียนคำตอบชุดสุดท้ายที่ส่งมาด้วย
			// (คนที่เน็ตหลุดตอนใกล้หมดเวลาต้องไม่เสียคำตอบที่พิมพ์ไว้)
			await ref.update({
				...(hasAnswers ? { answers } : {}),
				submittedAt: now,
				submittedAtServer: FieldValue.serverTimestamp(),
				autoSubmitted: true,
			});
		} else if (data.submit === true) {
			await ref.update({
				...(hasAnswers ? { answers } : {}),
				submittedAt: now,
				submittedAtServer: FieldValue.serverTimestamp(),
				autoSubmitted: false,
			});
		} else if (hasAnswers) {
			await ref.update({ answers });
		}

		const after = await ref.get();
		return { ...toState(attemptId, after.data() ?? {}, now, quiz), expired };
	},
);
