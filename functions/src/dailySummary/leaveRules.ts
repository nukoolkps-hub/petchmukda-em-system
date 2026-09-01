/**
 * กฎการคัดใบลา — **ห้าม import อะไรเลย** (pure TS)
 *
 * เหตุผล: เทสต์อยู่ฝั่ง `src/utils/` ซึ่ง `tsc` ที่ root มองเห็นไฟล์นี้ผ่าน
 * import chain · CI รัน `npm ci` เฉพาะ root (ไม่ลง `functions/node_modules`)
 * → ถ้าไฟล์นี้แตะ `firebase-admin` typecheck จะพังบน CI ทั้งที่ผ่านบนเครื่อง
 * (เจอมาแล้ว) · pattern เดียวกับ `duty/dutyUtils.ts` ที่ถูก import ข้ามฝั่ง
 */

/** ใบลาใบนี้ครอบวันนั้นไหม (start ≤ ymd ≤ end · เทียบ string ได้เพราะ ISO) */
export function coversDay(
	leave: Record<string, unknown>,
	ymd: string,
): boolean {
	const start = String(leave.start || "");
	const end = String(leave.end || "");
	return start <= ymd && end >= ymd;
}

/** เวลาที่สรุปเช้า "ควรจะ" ส่ง ถ้าอ่าน dailySummarySent ไม่ได้ */
const MORNING_FALLBACK_TIME = "07:30:00";

/** ใบลานี้ถูกกดหลัง cutoff ไหม (= ตกหล่นจากสรุปเช้า)
 *
 *  ไม่มี `createdAt` → **ไม่ใช่** ของตกหล่น · doc เก่าก่อนมี field นี้ ถ้าเดา
 *  ว่าใหม่จะกลายเป็นสแปมชื่อเดิมซ้ำทุกวันตลอดช่วงที่คนนั้นลายาว             */
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

/** ใบลาที่ "ครอบวันนี้ + ถูกกดหลังสรุปเช้า" — หัวใจของรอบ 08:30 */
export function pickLateLeaveDocs(
	leaves: Record<string, unknown>[],
	ymd: string,
	cutoffMs: number,
): Record<string, unknown>[] {
	return leaves.filter(
		(leave) => coversDay(leave, ymd) && isLateLeave(leave, cutoffMs),
	);
}
