/**
 * lateLeaves — "คนกดลาหลังสรุปเช้า" (ส่วนที่คุยกับ Firestore)
 *
 * สรุปเช้า 07:30 ถ่ายภาพคนหยุด ณ ตอนนั้น · ใครกดลาหลังจากนั้นจะไม่โผล่
 * ในกล่องเช้าเลย ทีมงานเลยไม่รู้ว่าวันนี้ขาดคนเพิ่ม → รอบ 08:30 ตามอีกครั้ง
 * เฉพาะ "คนที่ตกหล่น" (ไม่ใช่ส่งซ้ำทั้งหมด) · ไม่มีใครตกหล่น = ไม่ส่งเลย
 *
 * ⚠️ กฎการคัดใบลาอยู่ที่ `leaveRules.ts` (pure · ไม่ import อะไรเลย) เพราะ
 * เทสต์ฝั่ง `src/` import ข้ามมา — ไฟล์นี้แตะ firebase-admin ได้ ไฟล์นั้นห้าม
 */

import type { Firestore } from "firebase-admin/firestore";
import { pickLateLeaveDocs } from "./leaveRules.js";
import { fetchTodayLeaveDocs, type LeaveItem, toLeaveItems } from "./leaves.js";

export {
	isLateLeave,
	pickLateLeaveDocs,
	resolveLateCutoffMs,
} from "./leaveRules.js";

/** ใบลาที่ครอบวันนี้ + ถูกกดหลัง cutoff → ชื่อเล่น + ประเภทลา */
export async function fetchLateLeaves(
	db: Firestore,
	ymd: string,
	cutoffMs: number,
): Promise<LeaveItem[]> {
	const todayLeaves = await fetchTodayLeaveDocs(db, ymd);
	return toLeaveItems(db, pickLateLeaveDocs(todayLeaves, ymd, cutoffMs));
}
