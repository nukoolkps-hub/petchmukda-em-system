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

/** cutoff ของรอบตามแจ้ง — ยึด claimedAt ของ "รอบล่าสุดที่ประกาศไปแล้ว"
 *
 *  ส่ง docs เรียงจากรอบที่ใหม่ที่สุดไปเก่าที่สุด แล้วเอาตัวแรกที่มีเวลาจริง
 *  - รอบ 08:30 → [สรุปเช้า]
 *  - รอบ 09:30 → [รอบ 08:30, สรุปเช้า] · ต้องนับต่อจาก 08:30 ไม่งั้นประกาศ
 *    ชื่อเดิมซ้ำ · แต่รอบ 08:30 สร้าง doc เฉพาะตอนมีคนตกหล่นจริง (ไม่มีใคร
 *    = ไม่ส่ง = ไม่มี doc) จึงตกมาใช้ของสรุปเช้า ซึ่งถูกต้องเพราะคนที่กดลา
 *    ช่วง 07:30-09:30 ยังไม่เคยถูกประกาศเลย
 *
 *  ใช้ claimedAt ไม่ใช่ sentAt เพราะ claim เกิดก่อนอ่านข้อมูล → คนที่กดลา
 *  ระหว่าง claim กับตอนอ่านอาจถูกแจ้งซ้ำ ซึ่งไม่เสียหาย · กลับกันถ้ายึด
 *  sentAt (หลังส่งเสร็จ) คนที่กดลาช่วงนั้นจะหายไปเงียบๆ = บั๊กที่กำลังแก้
 *
 *  ไม่มี doc สักตัว (ปิด toggle สรุปเช้า/เสาร์) → 07:30 ของวันนั้นเสมอ แม้
 *  เป็นรอบ 09:30 — ถ้าใช้ 08:30 คนที่กดลาช่วง 07:30-08:30 จะหายเงียบ       */
export function resolveRoundCutoffMs(
	ymd: string,
	docs: (Record<string, unknown> | null | undefined)[],
): number {
	for (const doc of docs) {
		const stamp = doc?.claimedAt ?? doc?.sentAt;
		if (typeof stamp !== "string") continue;
		const parsed = Date.parse(stamp);
		if (Number.isFinite(parsed)) return parsed;
	}
	return Date.parse(`${ymd}T${MORNING_FALLBACK_TIME}+07:00`);
}

/** cutoff ของรอบ 08:30 — นับต่อจากสรุปเช้าอย่างเดียว (wrapper เดิม) */
export function resolveLateCutoffMs(
	ymd: string,
	morningDoc?: Record<string, unknown> | null,
): number {
	return resolveRoundCutoffMs(ymd, [morningDoc]);
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
