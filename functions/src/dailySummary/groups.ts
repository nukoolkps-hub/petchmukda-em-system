/**
 * กลุ่มปลายทางของ "สรุปประจำวัน 07:30" — อ่านจาก Firestore ก่อน hardcode
 *
 * เดิม list อยู่ใน `DAILY_SUMMARY_GROUPS` (config.ts) ต้องแก้โค้ด + deploy
 * ทุกครั้งที่เปลี่ยนกลุ่ม · ตอนนี้ ADMIN ตั้งเองได้ที่
 * /admin → LINE BOT → การแจ้งเตือน → "กลุ่มที่รับสรุปเข้า"
 * (เก็บที่ `config/notifications.dailySummaryGroups`)
 *
 * ลำดับความสำคัญ:
 * 1. field เป็น array → ใช้ค่านั้น (แม้เป็น array ว่าง = ADMIN ตั้งใจไม่ส่ง)
 * 2. field ไม่มีเลย → ใช้ hardcode เดิม **แล้ว seed ลง Firestore ให้ครั้งเดียว**
 *    → ครั้งถัดไป ADMIN เห็นกลุ่มจริงในหน้า UI แล้วแก้/ลบต่อได้
 *    (backward compatible: ระบบที่ยังไม่เคยตั้งค่า ส่งเหมือนเดิมทุกประการ)
 */

import type { Firestore } from "firebase-admin/firestore";
import { DAILY_SUMMARY_GROUPS, type DailySummaryGroup } from "./config.js";

/** ⚠️ ต้องตรงกับ `src/utils/dailySummaryGroups.ts` (LINE_TARGET_ID_PATTERN) */
const LINE_TARGET_ID_PATTERN = /^[CRU][0-9a-f]{32}$/;

interface StoredGroup {
	lineTargetId?: unknown;
	name?: unknown;
	calendarId?: unknown;
	sendAiTip?: unknown;
	includeLeaves?: unknown;
	sendScheduledImage?: unknown;
}

/** map ค่าที่ ADMIN ตั้ง → shape ที่ runDailySummary ใช้ · ตัดตัวที่ ID ผิด
 *  รูปแบบ/ซ้ำทิ้ง (กัน push ไป target มั่ว หรือส่งซ้ำกลุ่มเดิม) */
function fromStored(raw: unknown): DailySummaryGroup[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: DailySummaryGroup[] = [];
	for (const item of raw as StoredGroup[]) {
		const id =
			typeof item?.lineTargetId === "string" ? item.lineTargetId.trim() : "";
		if (!LINE_TARGET_ID_PATTERN.test(id) || seen.has(id)) continue;
		seen.add(id);
		out.push({
			lineTargetId: id,
			name:
				(typeof item?.name === "string" ? item.name.trim() : "") ||
				id.slice(0, 8),
			calendarId:
				typeof item?.calendarId === "string" ? item.calendarId.trim() : "",
			sendAiTip: item?.sendAiTip === true,
			includeLeaves: item?.includeLeaves === true,
			sendScheduledImage: item?.sendScheduledImage === true,
		});
	}
	return out;
}

/** shape ที่เขียนลง Firestore ตอน seed — ตรงกับที่ UI อ่าน */
function toStored(groups: DailySummaryGroup[]) {
	return groups.map((g) => ({
		lineTargetId: g.lineTargetId,
		name: g.name,
		calendarId: g.calendarId || "",
		sendAiTip: !!g.sendAiTip,
		includeLeaves: !!g.includeLeaves,
		sendScheduledImage: !!g.sendScheduledImage,
	}));
}

export async function resolveDailySummaryGroups(
	db: Firestore,
): Promise<DailySummaryGroup[]> {
	let data: Record<string, unknown> | undefined;
	try {
		data = (await db.doc("config/notifications").get()).data();
	} catch (err) {
		// อ่านไม่ได้ → ใช้ค่าเดิมในโค้ด (ยังส่งได้ · ไม่เงียบหาย)
		console.warn("[dailySummaryGroups] read failed, using hardcoded:", err);
		return DAILY_SUMMARY_GROUPS;
	}
	if (Array.isArray(data?.dailySummaryGroups)) {
		return fromStored(data.dailySummaryGroups);
	}
	// ยังไม่เคยตั้งค่า → seed ค่าเดิมลง Firestore ให้ ADMIN เห็นในหน้า UI
	try {
		await db.doc("config/notifications").set(
			{
				dailySummaryGroups: toStored(DAILY_SUMMARY_GROUPS),
				dailySummaryGroupsSeededAt: new Date().toISOString(),
			},
			{ merge: true },
		);
		console.log(
			`[dailySummaryGroups] seeded ${DAILY_SUMMARY_GROUPS.length} กลุ่ม จากค่าเดิมในโค้ด`,
		);
	} catch (err) {
		console.warn("[dailySummaryGroups] seed failed (ส่งต่อด้วยค่าเดิม):", err);
	}
	return DAILY_SUMMARY_GROUPS;
}
