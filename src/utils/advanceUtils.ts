/* ─── advanceUtils — สิทธิ์เบิกเงินล่วงหน้าตามอายุงาน ───────────────
   เพดานเบิกล่วงหน้า = % ของเงินเดือนพื้นฐาน · ขึ้นกับอายุงาน:
   - 0 - <3 ปี:  50%
   - 3 - <4 ปี:  60%
   - 4 - <5 ปี:  70%
   - 5 - <6 ปี:  80%
   - 6 ปี ขึ้นไป: 100%
   อายุงานยังไม่ครบ 1 ปี (เพิ่งเริ่ม) ก็ได้ 50% ตามขั้นแรก
   ไม่มี startWorkMonth → fallback 50% (default)                       */

import { BUSINESS_RULES } from "../constants";

export interface AdvanceLimitTier {
  /** จำนวนปีขั้นต่ำของอายุงาน (years >= minYears) */
  minYears: number;
  /** เพดาน % ของเงินเดือนพื้นฐาน (0.5 = 50%) */
  percent: number;
}

/** ตาราง tier — เรียงจากสูงไปต่ำเพื่อจับ tier แรกที่ match · single source */
export const ADVANCE_LIMIT_TIERS: AdvanceLimitTier[] = [
  { minYears: 6, percent: 1.0 },
  { minYears: 5, percent: 0.8 },
  { minYears: 4, percent: 0.7 },
  { minYears: 3, percent: 0.6 },
  { minYears: 0, percent: 0.5 },
];

/** อายุงานเต็มปี (integer · ปัดลง) จาก startWorkMonth = "YYYY-MM"
 *  · null/invalid → 0 (ถือว่าเพิ่งเริ่มงาน · ใช้ tier ขั้นแรก 50%)      */
export function tenureFullYears(startWorkMonth?: string | null): number {
  if (!startWorkMonth || !/^\d{4}-\d{2}$/.test(startWorkMonth)) return 0;
  const [y, m] = startWorkMonth.split("-").map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  const months = now.getMonth() - (m - 1);
  if (months < 0) years -= 1;
  return Math.max(0, years);
}

/** เพดาน % ของเงินเดือนพื้นฐานที่พนักงานเบิกล่วงหน้าได้ ตามอายุงาน
 *  return 0.5 - 1.0                                                    */
export function advanceLimitPercent(startWorkMonth?: string | null): number {
  const years = tenureFullYears(startWorkMonth);
  const tier = ADVANCE_LIMIT_TIERS.find((t) => years >= t.minYears);
  return tier?.percent ?? 0.5;
}

/* ─── กฎ "จำนวนครั้งที่เบิกได้ต่อเดือน" ─────────────────────────────
   single source ของกฎนี้ — ใช้ทั้งฝั่ง UI (ปิดปุ่ม) และตอน "เขียนจริง"
   (`submitAdvance` อ่านสดจาก server ก่อน addDoc) เพื่อไม่ให้ 2 ที่ตีความ
   ต่างกัน · เดิมกฎอยู่แค่ใน modal → ถ้า client ยังโหลด advances ไม่เสร็จ /
   subscription error / เครื่องอื่นค้าง snapshot เก่า → ปุ่มเปิด ยื่นซ้ำได้

   จำนวนครั้งอยู่ที่ `BUSINESS_RULES.ADVANCE_MAX_PER_MONTH` · เพดาน "ยอดรวม"
   ต่อเดือนคุมแยกด้วย % ตามอายุงาน (advanceLimitPercent) — ต้องผ่านทั้ง 2 ด่าน */

export interface AdvanceLike {
  status?: string | null;
  month?: string | null;
  /** advance ที่ระบบสร้างให้ตอนเงินสุทธิติดลบ (ไม่ใช่พนักงานยื่นเอง) */
  autoCarryFromMonth?: string | null;
  /** เบิกฉุกเฉิน — ADMIN เบิกให้เอง (ไม่ใช่พนักงานยื่น) · ไม่นับโควต้าจำนวนครั้ง */
  emergency?: boolean | null;
}

/** คำขอของเดือนนั้นที่ "ยังมีผล" (pending + approved · rejected ไม่นับ)
 *  — ใช้รวมเป็นยอดที่กินวงเงิน % ของเดือน (รวม auto-carry ด้วย)        */
export function activeAdvancesOfMonth<T extends AdvanceLike>(
  advances: T[],
  yearMonth: string,
): T[] {
  return (advances || []).filter(
    (a) => a?.month === yearMonth && a?.status !== "rejected",
  );
}

/** คำขอที่ "พนักงานยื่นเอง" และยังมีผลในเดือนนั้น — ตัวที่นับโควต้าจำนวนครั้ง
 *  · rejected ไม่นับ (ADMIN ปฏิเสธแล้วยื่นใหม่ได้ในเดือนเดียวกัน)
 *  · auto-carry ไม่นับ (ระบบสร้างให้ตอน net ติดลบ พนักงานไม่ได้ยื่นเอง)
 *  · เบิกฉุกเฉินไม่นับ (ADMIN เบิกให้เอง — มีไว้สำหรับคนที่ครบโควต้าแล้ว)    */
export function userAdvancesOfMonth<T extends AdvanceLike>(
  advances: T[],
  yearMonth: string,
): T[] {
  return activeAdvancesOfMonth(advances, yearMonth).filter(
    (a) => !a.autoCarryFromMonth && !a.emergency,
  );
}

export interface AdvanceQuota {
  /** ยื่นไปแล้วกี่ครั้งในเดือนนี้ (นับเฉพาะที่ยังมีผล) */
  used: number;
  /** โควต้าต่อเดือน */
  limit: number;
  /** เหลืออีกกี่ครั้ง */
  left: number;
  /** ครบโควต้าแล้ว = ยื่นใหม่ไม่ได้ */
  reachedLimit: boolean;
}

/** โควต้าจำนวนครั้งของเดือนนั้น · `limit` override ได้ (เทสต์/อนาคตปรับต่อคน) */
export function advanceQuotaOfMonth<T extends AdvanceLike>(
  advances: T[],
  yearMonth: string,
  limit: number = BUSINESS_RULES.ADVANCE_MAX_PER_MONTH,
): AdvanceQuota {
  const used = userAdvancesOfMonth(advances, yearMonth).length;
  return {
    used,
    limit,
    left: Math.max(0, limit - used),
    reachedLimit: used >= limit,
  };
}

/* ─── เบิกฉุกเฉิน (ADMIN เบิกให้เอง) — "เบิกได้อีกกี่บาท" ──────────────
   ข้ามทั้งโควต้าจำนวนครั้งและเพดาน % ตามอายุงาน (ADMIN ตัดสินใจเอง) ·
   ตัวเลขที่ช่วย ADMIN ตัดสินคือ "เงินสุทธิที่ยังเหลือของเดือนนี้" =
   เงินสุทธิประมาณการ (หักเบิกที่อนุมัติแล้วไปแล้ว) − คำขอที่ยังรออนุมัติ
   เบิกเกินกว่านี้ = เงินสุทธิติดลบ → ตอนยืนยันยอดระบบยกไปหักเดือนถัดไป
   (auto-carry) · จึงเตือน ไม่บล็อก — ชิ้นงาน/ค่าคอมอาจยังไม่ได้กรอกครบกลางเดือน
   ทำให้ตัวเลขประมาณการต่ำกว่าจริง                                        */
export interface EmergencyAdvanceRoom {
  /** เงินสุทธิประมาณการเดือนนี้ (หักเบิกที่อนุมัติแล้ว) · null = ยังไม่มีข้อมูลเงินเดือน */
  netSalary: number | null;
  /** ยอดคำขอที่ยังรออนุมัติของเดือนนี้ (จะถูกหักถ้าอนุมัติ) */
  pendingTotal: number;
  /** เบิกได้อีกกี่บาทก่อนเงินสุทธิติดลบ (ปัดลงเป็นบาท · ไม่ต่ำกว่า 0) · null = ประมาณไม่ได้ */
  room: number | null;
}

export function emergencyAdvanceRoom<
  T extends AdvanceLike & { amount?: number | null },
>(args: {
  netSalary: number | null | undefined;
  advances: T[];
  yearMonth: string;
}): EmergencyAdvanceRoom {
  const pendingTotal = (args.advances || [])
    .filter((a) => a?.month === args.yearMonth && a?.status === "pending")
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const net =
    typeof args.netSalary === "number" && Number.isFinite(args.netSalary)
      ? args.netSalary
      : null;
  return {
    netSalary: net,
    pendingTotal,
    room: net === null ? null : Math.max(0, Math.floor(net - pendingTotal)),
  };
}
