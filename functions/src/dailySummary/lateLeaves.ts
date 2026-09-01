/**
 * lateLeaves — "คนกดลาหลังสรุปเช้า"
 *
 * สรุปเช้า 07:30 ถ่ายภาพคนหยุด ณ ตอนนั้น · ใครกดลาหลังจากนั้นจะไม่โผล่
 * ในกล่องเช้าเลย ทีมงานเลยไม่รู้ว่าวันนี้ขาดคนเพิ่ม → รอบ 08:30 ตามอีกครั้ง
 * เฉพาะ "คนที่ตกหล่น" (ไม่ใช่ส่งซ้ำทั้งหมด) · ไม่มีใครตกหล่น = ไม่ส่งเลย
 *
 * "ตกหล่น" ตัดสินจาก `leave.createdAt` (epoch ms · เขียนตอน addLeave)
 * เทียบกับ cutoff = เวลาที่สรุปเช้าเริ่มทำงานวันนั้น
 */

import type { Firestore } from "firebase-admin/firestore";
import { fetchTodayLeaveDocs, type LeaveItem, toLeaveItems } from "./leaves.js";

/** เวลาที่สรุปเช้า "ควรจะ" ส่ง ถ้าอ่าน dailySummarySent ไม่ได้ */
const MORNING_FALLBACK_TIME = "07:30:00";

/** ใบลานี้ถูกกดหลัง cutoff ไหม (= ตกหล่นจากสรุปเช้า)
 *
 *  ไม่มี `createdAt` → **ไม่ใช่** ของตกหล่น · doc เก่าก่อนมี field นี้ ถ้าเดา
 *  ว่าใหม่จะกลายเป็นสแปมชื่อเดิมซ้ำทุกวันที่คนนั้นลายาว                     */
export function isLateLeave(
	leave: Record<string, unknown>,
	cutoffMs: number,
): boolean {
	const createdAt = leave.createdAt;
	if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) {
		return false;
	}
	return createdAt > cutoffMs;
}

/** cutoff ของวันนั้น — ยึดเวลาที่สรุปเช้า "claim" คิวไว้ (ก่อนไปอ่าน leaves)
 *
 *  ใช้ claimedAt ไม่ใช่ sentAt เพราะ claim เกิดก่อนอ่านข้อมูล → คนที่กดลา
 *  ระหว่าง claim กับตอนอ่านอาจถูกแจ้งซ้ำ ซึ่งไม่เสียหาย · กลับกันถ้ายึด
 *  sentAt (หลังส่งเสร็จ) คนที่กดลาช่วงนั้นจะหายไปเงียบๆ = บั๊กที่กำลังแก้
 *
 *  ไม่มี doc (สรุปเช้าไม่ได้ส่ง — เสาร์/ปิด toggle) → ใช้ 07:30 ของวันนั้น  */
export function resolveLateCutoffMs(
	ymd: string,
	morningDoc?: Record<string, unknown> | null,
): number {
	const stamp = morningDoc?.claimedAt ?? morningDoc?.sentAt;
	if (typeof stamp === "string") {
		const parsed = Date.parse(stamp);
		if (Number.isFinite(parsed)) return parsed;
	}
	return Date.parse(`${ymd}T${MORNING_FALLBACK_TIME}+07:00`);
}

/** ใบลาที่ครอบวันนี้ + ถูกกดหลัง cutoff → ชื่อเล่น + ประเภทลา */
export async function fetchLateLeaves(
	db: Firestore,
	ymd: string,
	cutoffMs: number,
): Promise<LeaveItem[]> {
	const todayLeaves = await fetchTodayLeaveDocs(db, ymd);
	const late = todayLeaves.filter((leave) => isLateLeave(leave, cutoffMs));
	return toLeaveItems(db, late);
}
