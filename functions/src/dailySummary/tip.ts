/**
 * เคล็ดลับมืออาชีพประจำวัน — Claude API + Firestore dedup
 *
 * - ดึง 30 เคล็ดลับล่าสุดจาก `recentTips`
 * - บอก Claude ว่า "ห้ามตอบซ้ำกับ list นี้"
 * - retry สูงสุด 3 ครั้ง ถ้าตอบซ้ำ
 * - บันทึก tip ใหม่ลง Firestore กันซ้ำในรอบถัดไป
 */

import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getAppFirestore } from "../helpers/config.js";
import { AI_MAX_TOKENS, AI_MODEL, RECENT_TIPS_LIMIT, TIP_RETRY_LIMIT } from "./config.js";

export interface DailyTip {
	description: string;
	summary: string;
	raw: string;
}

export async function generateDailyTip(
	anthropicApiKey: string,
): Promise<DailyTip> {
	const client = new Anthropic({ apiKey: anthropicApiKey });
	const recentTips = await getRecentTips();
	const systemPrompt = buildSystemPrompt();

	let lastResult: DailyTip | null = null;

	for (let attempt = 1; attempt <= TIP_RETRY_LIMIT; attempt++) {
		const userPrompt = buildUserPrompt(recentTips);

		const message = await client.messages.create({
			model: AI_MODEL,
			max_tokens: AI_MAX_TOKENS,
			// system prompt คงที่ → ถูก cache (ลดค่า input tokens 90%)
			system: [
				{
					type: "text",
					text: systemPrompt,
					cache_control: { type: "ephemeral" },
				},
			],
			messages: [{ role: "user", content: userPrompt }],
		});

		const rawText = extractTipText(message);
		const parsed = parseTipParts(rawText);

		console.log(
			`[generateDailyTip] attempt ${attempt} tokens in=${message.usage.input_tokens} out=${message.usage.output_tokens} cache=${message.usage.cache_read_input_tokens || 0}`,
		);

		if (rawText && !isDuplicateTip(rawText, recentTips)) {
			await saveRecentTip(rawText);
			return {
				description: parsed.description,
				summary: parsed.summary,
				raw: rawText,
			};
		}

		console.warn(
			`[generateDailyTip] duplicate/empty on attempt ${attempt}, retrying`,
		);
		lastResult = {
			description: parsed.description,
			summary: parsed.summary,
			raw: rawText,
		};
	}

	// ครบ retry แล้วยังซ้ำ → ใช้ผลล่าสุด (ดีกว่าไม่ได้อะไรเลย)
	console.warn("[generateDailyTip] retry limit reached — using last tip even if duplicate");
	if (lastResult?.raw) {
		await saveRecentTip(lastResult.raw);
		return lastResult;
	}
	throw new Error(
		`Failed to generate tip after ${TIP_RETRY_LIMIT} attempts`,
	);
}

export function parseTipParts(tipText: string): {
	description: string;
	summary: string;
} {
	const result = { description: "", summary: "" };
	if (!tipText) return result;

	const summaryMatch = tipText.match(/\[สรุป\]\s*([\s\S]+)/);
	if (summaryMatch) result.summary = summaryMatch[1].trim();

	const descMatch = tipText.match(/\[คำอธิบาย\]\s*([\s\S]*?)(?=\[สรุป\]|$)/);
	if (descMatch) {
		result.description = descMatch[1].trim();
	} else {
		result.description = tipText.replace(/\[สรุป\][\s\S]*/, "").trim();
	}

	if (!result.summary && result.description) {
		const firstLine = result.description.split("\n")[0];
		result.summary = firstLine.length > 30
			? `${firstLine.substring(0, 30)}…`
			: firstLine;
	}

	return result;
}

/* ─── private ──────────────────────────────────────────────── */

async function getRecentTips(): Promise<string[]> {
	try {
		const db = getAppFirestore();
		const snap = await db
			.collection("recentTips")
			.orderBy("createdAt", "desc")
			.limit(RECENT_TIPS_LIMIT)
			.get();
		return snap.docs
			.map((d) => d.data().text as string | undefined)
			.filter((t): t is string => Boolean(t));
	} catch (err) {
		console.error("[getRecentTips] error — returning empty list:", err);
		return [];
	}
}

async function saveRecentTip(tipText: string): Promise<void> {
	try {
		const db = getAppFirestore();
		await db.collection("recentTips").add({
			text: tipText,
			createdAt: FieldValue.serverTimestamp(),
		});
	} catch (err) {
		console.error("[saveRecentTip] error:", err);
	}
}

function isDuplicateTip(tip: string, recentTips: string[]): boolean {
	const normalized = normalizeTip(tip);
	return recentTips.some((t) => normalizeTip(t) === normalized);
}

function normalizeTip(text: string): string {
	return String(text)
		.replace(/\s+/g, " ")
		.replace(/[.!?]/g, "")
		.trim()
		.toLowerCase();
}

function extractTipText(message: Anthropic.Message): string {
	if (!message || !Array.isArray(message.content)) return "";
	const block = message.content.find((b) => b.type === "text");
	return block && block.type === "text" ? block.text : "";
}

function buildSystemPrompt(): string {
	return [
		"คุณคือเจ้าของร้านทองที่ใจดี สุภาพ และมีประสบการณ์จริงในสายงานร้านทอง",
		"หน้าที่ของคุณคือให้เคล็ดลับการทำงานที่ปฏิบัติได้จริงในร้านทอง วันละ 1 ข้อ สำหรับพนักงานร้านทอง",
		"",
		"หัวข้อที่เลือกได้ (เลือกหัวข้อใดหัวข้อหนึ่งต่อ 1 เคล็ดลับ):",
		"- เทคนิคการขายทอง เช่น วิธีแนะนำสินค้า การอ่านใจลูกค้า การปิดการขาย",
		"- การบริการลูกค้า เช่น วิธีรับมือลูกค้าลังเล วิธีสร้างความประทับใจ",
		"- ความปลอดภัยในร้าน เช่น วิธีสังเกตพฤติกรรมน่าสงสัย การจัดเก็บสินค้า",
		"- ความรอบคอบในการทำงาน เช่น การตรวจนับทอง การเช็คน้ำหนัก การออกใบเสร็จ",
		"- การทำงานเป็นทีม เช่น การสื่อสารกับเพื่อนร่วมงาน การแบ่งหน้าที่",
		"- การแก้ปัญหาเฉพาะหน้า เช่น ลูกค้าร้องเรียน สินค้าหาย ราคาผิดพลาด",
		"- การสร้างแรงจูงใจในการทำงาน เช่น การตั้งเป้าหมายประจำวัน",
		"",
		"รูปแบบการตอบ (สำคัญมาก ต้องตอบแบบนี้เท่านั้น 4 บรรทัด):",
		"[คำอธิบาย] <คำอธิบาย 1-2 ประโยคสั้น กระชับ ไม่เกิน 120 ตัวอักษร ยกตัวอย่างสถานการณ์จริงในร้านทอง>",
		"[สรุป] <สรุปสั้น 3-8 คำ>",
		"",
		"ตัวอย่างคำตอบที่ถูกต้อง:",
		"[คำอธิบาย] เมื่อลูกค้ายืนดูสร้อยคอเงียบๆ ให้เข้าหาแบบนุ่มนวล หยิบสินค้าให้ลอง บอกน้ำหนักและราคาพร้อมส่วนลดวันนี้ ช่วยลดความลังเลและปิดการขายเร็วขึ้น",
		"[สรุป] เข้าหาก่อน บอกข้อมูลครบ",
		"",
		"ข้อกำหนดเข้มงวด:",
		"- ตอบโดยตรงทันที ห้ามทักทาย ห้ามเกริ่น ห้ามขอบคุณ ห้ามถามต่อ",
		"- ห้ามตอบเป็น checklist หรือสรุปกฎ ต้องตอบเป็นเคล็ดลับที่ใช้ได้จริงเท่านั้น",
		"- เขียนภาษาไทย สุภาพ ใช้ครับ/ค่ะ",
		"- ต้องเป็นเคล็ดลับเฉพาะร้านทอง ไม่ใช่คำพูดทั่วๆ ไป มีตัวอย่างสถานการณ์ชัดเจน",
		"- ร้านนี้ไม่มีระบบกะการทำงาน (พนักงานทุกคนทำงานช่วงเวลาเดียวกันทั้งวัน) ห้ามพูดเรื่องการส่งกะ เปลี่ยนกะ รับช่วงต่อระหว่างกะ หรือทำงานข้ามกะ",
		"- หากกล่าวถึงน้ำหนักทอง 96.5% ต้องใช้หน่วยตามมาตรฐาน สคบ. พร้อมระบุกรัม เช่น 1 บาท (15.16 กรัม), 1 สลึง (3.79 กรัม), ครึ่งสลึง (1.89 กรัม) แต่ทอง 90% ใช้หน่วยใดก็ได้",
		"- ขึ้นต้นด้วย [คำอธิบาย] และจบด้วย [สรุป] เสมอ ห้ามมีข้อความอื่นนอกเหนือจากนี้",
	].join("\n");
}

function buildUserPrompt(recentTips: string[]): string {
	const lines = [
		"ให้เคล็ดลับมืออาชีพประจำวันนี้ 1 ข้อสำหรับพนักงานร้านทอง ตอบตามรูปแบบที่กำหนดเท่านั้น เริ่มด้วย [คำอธิบาย] ทันที",
	];
	if (recentTips.length > 0) {
		lines.push("");
		lines.push("ห้ามตอบซ้ำหรือคล้ายกับเคล็ดลับเหล่านี้ที่เคยให้ไปแล้ว:");
		recentTips.forEach((tip) => lines.push(`- ${tip}`));
	}
	return lines.join("\n");
}
