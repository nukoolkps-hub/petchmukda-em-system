/* ─── Payroll month lock ───────────────────────────────────────────
   หลัง "ยืนยันยอด" เดือนหนึ่งๆ จะแก้ไขได้อีก 7 วัน (grace) นับจาก
   "ยืนยันครั้งแรก" (ไม่รีเซ็ตเมื่อยืนยันใหม่) — พ้นกำหนดแล้วล็อกถาวร:
   ห้ามแก้ค่าคอม/เงินเดือน, ยื่น/ลบใบลา, เบิกเงิน ของเดือนนั้น

   single source of truth: ใช้ทั้งฝั่ง UI และ mirror ใน firestore.rules
   (rules เทียบ request.time.toMillis() > lockAtMs)                     */

export const PAYROLL_EDIT_GRACE_DAYS = 7;
export const PAYROLL_EDIT_GRACE_MS = PAYROLL_EDIT_GRACE_DAYS * 86_400_000;

interface PayrollConfirmDoc {
  confirmedAt?: string;
  firstConfirmedAt?: string;
  lockAtMs?: number;
}

export interface PayrollLockInfo {
  confirmed: boolean; // เดือนนี้ยืนยันยอดแล้วหรือยัง
  locked: boolean; // พ้น grace แล้ว → แก้ไม่ได้
  lockAtMs: number | null; // เวลาที่จะล็อก (epoch ms)
  msLeft: number; // เหลือเวลาแก้ได้กี่ ms (0 ถ้าล็อกแล้ว/ยังไม่ยืนยัน)
  daysLeft: number; // ปัดขึ้นเป็นวัน — ใช้โชว์ "เหลือ N วัน"
}

/**
 * คำนวณสถานะล็อกของเดือนจาก payrollConfirms doc
 * รองรับ doc เก่าที่ไม่มี firstConfirmedAt/lockAtMs (fallback → confirmedAt)
 */
export function getPayrollLock(
  confirm: PayrollConfirmDoc | null | undefined,
  now: number = Date.now(),
): PayrollLockInfo {
  if (!confirm?.confirmedAt) {
    return {
      confirmed: false,
      locked: false,
      lockAtMs: null,
      msLeft: 0,
      daysLeft: 0,
    };
  }
  const base = confirm.firstConfirmedAt || confirm.confirmedAt;
  const lockAtMs =
    typeof confirm.lockAtMs === "number"
      ? confirm.lockAtMs
      : new Date(base).getTime() + PAYROLL_EDIT_GRACE_MS;
  const msLeft = Math.max(0, lockAtMs - now);
  return {
    confirmed: true,
    locked: now > lockAtMs,
    lockAtMs,
    msLeft,
    daysLeft: Math.ceil(msLeft / 86_400_000),
  };
}

/** เดือน (YYYY-MM) นี้ถูกล็อกถาวรแล้วหรือยัง */
export function isMonthLocked(
  confirm: PayrollConfirmDoc | null | undefined,
  now: number = Date.now(),
): boolean {
  return getPayrollLock(confirm, now).locked;
}

/** "YYYY-MM-DD..." → "YYYY-MM" (เดือนของใบลา) */
export function monthOf(dateStr: string | undefined | null): string {
  return (dateStr || "").slice(0, 7);
}
