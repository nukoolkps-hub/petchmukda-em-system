/**
 * ให้ AI ช่วยตรวจแบบทดสอบความรู้พื้นฐาน — callable (admin เท่านั้น)
 *
 * **เป็นข้อเสนอ ไม่ใช่คำตัดสิน** ผลลง field `aiGrades` ซึ่งแยกจาก `grades`
 * ที่ ADMIN กดเอง · ฟังก์ชันนี้ไม่เคยแตะ `grades` เลย — ถ้าเขียนทับได้
 * เมื่อไหร่ การกด "ตรวจด้วย AI" ซ้ำจะลบคำตัดสินของคนทิ้งเงียบๆ
 *
 * ข้อสอบเป็นอัตนัยที่ต้อง "แสดงวิธีคิด" ด้วย ไม่ใช่แค่ตอบเลขให้ตรง — การ
 * เทียบตัวเลขเฉยๆ จึงตรวจไม่ได้ · ส่งโจทย์ + คำตอบ + เอกสารอ้างอิง (กฎของ
 * ห้าง + ราคาที่ตรึงไว้ตอนสอบ) ให้ Claude อ่านแล้วบอกผ่าน/ไม่ผ่านรายข้อ
 * พร้อมเหตุผลสั้นๆ ให้ ADMIN อ่านประกอบ
 *
 * `reference` มาจาก client เพราะเนื้อหา "ความรู้ต่างๆ" อยู่ฝั่ง frontend
 * (มี React icon + compute เป็นฟังก์ชัน) functions import ตรงไม่ได้ ·
 * callable นี้ admin-only อยู่แล้ว และผลเป็นแค่ข้อเสนอที่ ADMIN ต้องกดยืนยัน
 * อีกชั้น — reference เพี้ยนอย่างมากก็ได้ข้อเสนอที่ ADMIN ปัดทิ้ง
 */

// type-only — SDK ตัวจริง import แบบ lazy (ทุก function แชร์ module graph
// เดียวกัน · top-level import ทำให้ทุก instance cold start ช้า)
import type Anthropic from "@anthropic-ai/sdk";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore, getLineConfig } from "../helpers/config.js";

/** ตรวจ 30+ ข้ออัตนัยที่ต้องคำนวณเองทั้งหมด — ต้องใช้ตัวที่คิดเลขแม่น */
const GRADING_MODEL = "claude-opus-5";
/** เหตุผลรายข้อ 36 ข้อ + เผื่อ thinking */
const GRADING_MAX_TOKENS = 32_000;
/** กัน payload บวมจนเกิน context (client ตัดมาแล้วชั้นหนึ่ง นี่คือกันพลาด) */
const MAX_REFERENCE_CHARS = 80_000;
/** คำตอบต่อข้อยาวเกินนี้ถือว่าผิดปกติ — ตัดกัน prompt ระเบิด */
const MAX_ANSWER_CHARS = 4_000;

interface QuizQuestionLite {
	id: string;
	text: string;
	/** นับคะแนนไหม — ความรู้รอบตัวไม่เข้าเกณฑ์ แต่ยังให้ AI อ่านและแนะนำได้ */
	scored: boolean;
}

interface AiGrade {
	pass: boolean;
	reason: string;
}

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยตรวจข้อสอบของห้างเพชรทองมุกดา (ร้านทอง)

หน้าที่: อ่านคำตอบของพนักงานแต่ละข้อ แล้วบอกว่า "ผ่าน" หรือ "ไม่ผ่าน" พร้อมเหตุผลสั้นๆ ภาษาไทย

เกณฑ์การตรวจ:
1. **ตัวเลขต้องถูก** — คำนวณจากราคาและกฎในเอกสารอ้างอิงที่ให้มาเท่านั้น ห้ามใช้ราคาทองหรือกฎจากที่อื่น
2. **ต้องแสดงวิธีคิด** — กติกาข้อสอบบังคับให้แสดงวิธีคำนวณ ตอบเลขถูกแต่ไม่มีวิธีคิดเลย = ไม่ผ่าน
3. **คลาดเคลื่อนจากการปัดเศษเล็กน้อยถือว่าผ่าน** (ต่างกันไม่เกิน ~50 บาท จากการปัดเศษคนละจังหวะ)
4. ข้อที่ถามเรื่องการพูดกับลูกค้า/อธิบาย/เสนอโปรโมชัน ไม่มีคำตอบตายตัว — ผ่านถ้าสมเหตุสมผล สุภาพ และไม่ให้ข้อมูลผิด
5. ไม่ได้ตอบ หรือตอบไม่เกี่ยวกับคำถาม = ไม่ผ่าน

สำคัญ:
- ถ้าเอกสารอ้างอิงไม่มีข้อมูลพอจะตัดสินข้อนั้น ให้ตอบ pass=false แล้วเขียนเหตุผลว่า "ตรวจอัตโนมัติไม่ได้: <เหตุผล>" เพื่อให้คนมาตรวจเอง — อย่าเดา
- เหตุผลเขียนสั้น 1-2 ประโยค บอกให้ชัดว่าผิดตรงไหนหรือถูกเพราะอะไร
- ต้องตอบครบทุกข้อที่ให้มา ใช้ id ตรงตามที่ระบุ`;

/** สคีมาผลตรวจ — บังคับให้ตอบกลับเป็น JSON ที่ parse ได้เสมอ */
const OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		grades: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string" },
					pass: { type: "boolean" },
					reason: { type: "string" },
				},
				required: ["id", "pass", "reason"],
				additionalProperties: false,
			},
		},
	},
	required: ["grades"],
	additionalProperties: false,
} as const;

function buildUserPrompt(
	questions: QuizQuestionLite[],
	answers: Record<string, string>,
	reference: string,
): string {
	const items = questions
		.map((q) => {
			const raw = (answers[q.id] ?? "").trim();
			const answer = raw ? raw.slice(0, MAX_ANSWER_CHARS) : "(ไม่ได้ตอบ)";
			const tag = q.scored ? "" : " [ความรู้รอบตัว — ไม่นับเกณฑ์ผ่าน]";
			return `--- id: ${q.id}${tag}\nโจทย์: ${q.text}\nคำตอบของพนักงาน:\n${answer}`;
		})
		.join("\n\n");

	return `${reference.slice(0, MAX_REFERENCE_CHARS)}

# คำตอบที่ต้องตรวจ (${questions.length} ข้อ)

${items}`;
}

/** ดึง JSON ที่ structured output การันตีไว้ออกจาก response */
function parseGrades(message: Anthropic.Message): Record<string, AiGrade> {
	const text = message.content
		.filter((b): b is Anthropic.TextBlock => b.type === "text")
		.map((b) => b.text)
		.join("");
	if (!text.trim()) return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new HttpsError(
			"internal",
			"AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ — ลองใหม่อีกครั้ง",
		);
	}

	const rows = (parsed as { grades?: unknown }).grades;
	if (!Array.isArray(rows)) return {};

	const grades: Record<string, AiGrade> = {};
	for (const row of rows) {
		const r = row as { id?: unknown; pass?: unknown; reason?: unknown };
		if (typeof r.id !== "string" || typeof r.pass !== "boolean") continue;
		grades[r.id] = {
			pass: r.pass,
			reason: typeof r.reason === "string" ? r.reason : "",
		};
	}
	return grades;
}

export const gradeQuizWithAI = onCall(
	// ตรวจ 36 ข้อในครั้งเดียว + thinking → ใช้เวลาได้หลายนาที
	{ timeoutSeconds: 540, memory: "512MiB" },
	async (req): Promise<{ graded: number }> => {
		if (req.auth?.token?.admin !== true) {
			throw new HttpsError("permission-denied", "admin only");
		}
		const data = (req.data ?? {}) as {
			attemptId?: string;
			reference?: string;
			questions?: QuizQuestionLite[];
		};
		const attemptId = (data.attemptId ?? "").trim();
		const reference = (data.reference ?? "").trim();
		const questions = data.questions ?? [];
		if (!attemptId) {
			throw new HttpsError("invalid-argument", "ต้องระบุ attemptId");
		}
		if (!reference) {
			throw new HttpsError("invalid-argument", "ไม่มีเอกสารอ้างอิงให้ตรวจ");
		}
		if (!Array.isArray(questions) || questions.length === 0) {
			throw new HttpsError("invalid-argument", "ไม่มีโจทย์ให้ตรวจ");
		}

		const { ANTHROPIC_API_KEY } = await getLineConfig();
		if (!ANTHROPIC_API_KEY) {
			throw new HttpsError(
				"failed-precondition",
				"ยังไม่ได้ตั้ง ANTHROPIC_API_KEY ใน config/secrets",
			);
		}

		const db = getAppFirestore();
		const ref = db.doc(`quizAttempts/${attemptId}`);
		const snap = await ref.get();
		if (!snap.exists) {
			throw new HttpsError("not-found", "ไม่พบชุดข้อสอบนี้");
		}
		const attempt = snap.data() as {
			answers?: Record<string, string>;
			submittedAt?: number | null;
			cancelledAt?: number | null;
		};
		// ตรวจก่อนส่ง = ตรวจคำตอบที่ยังพิมพ์ไม่เสร็จ แล้วผลจะค้างอยู่ให้เข้าใจผิด
		if (!attempt.submittedAt) {
			throw new HttpsError(
				"failed-precondition",
				attempt.cancelledAt
					? "ชุดนี้ถูกยกเลิก ไม่มีผลสอบให้ตรวจ"
					: "ยังไม่ได้ส่งข้อสอบ — ตรวจได้หลังส่งแล้วเท่านั้น",
			);
		}

		const { default: AnthropicSDK } = await import("@anthropic-ai/sdk");
		const client = new AnthropicSDK({ apiKey: ANTHROPIC_API_KEY });

		let grades: Record<string, AiGrade>;
		try {
			// stream — ตรวจ 36 ข้อพร้อม thinking กินเวลาเกิน HTTP timeout ของ
			// non-streaming ได้ง่าย
			const stream = client.messages.stream({
				model: GRADING_MODEL,
				max_tokens: GRADING_MAX_TOKENS,
				thinking: { type: "adaptive" },
				output_config: {
					effort: "high",
					format: { type: "json_schema", schema: OUTPUT_SCHEMA },
				},
				// system + เอกสารอ้างอิงคงที่ทุกใบในวันเดียวกัน → cache ได้
				system: [
					{
						type: "text",
						text: SYSTEM_PROMPT,
						cache_control: { type: "ephemeral" },
					},
				],
				messages: [
					{
						role: "user",
						content: buildUserPrompt(
							questions,
							attempt.answers ?? {},
							reference,
						),
					},
				],
			});
			const message = await stream.finalMessage();

			if (message.stop_reason === "refusal") {
				throw new HttpsError("internal", "AI ปฏิเสธที่จะตรวจชุดนี้ — ต้องตรวจเอง");
			}
			console.log(
				`[gradeQuizWithAI] ${attemptId} in=${message.usage.input_tokens} out=${message.usage.output_tokens} cache=${message.usage.cache_read_input_tokens || 0}`,
			);
			grades = parseGrades(message);
		} catch (err) {
			// เก็บ error ลง doc ด้วย — ไม่งั้น UI เห็นแค่ toast แล้วหายไป
			// ไม่รู้ว่ารอบที่แล้วพังเพราะอะไร
			const msg = err instanceof Error ? err.message : "ตรวจด้วย AI ไม่สำเร็จ";
			await ref.update({ aiGradeError: msg, aiGradedAt: Date.now() });
			if (err instanceof HttpsError) throw err;
			throw new HttpsError("internal", msg);
		}

		await ref.update({
			aiGrades: grades,
			aiGradedAt: Date.now(),
			aiGradeError: "",
		});
		return { graded: Object.keys(grades).length };
	},
);
