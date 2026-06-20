/* ─── advanceUtils — สิทธิ์เบิกเงินล่วงหน้าตามอายุงาน ───────────────
   เพดานเบิกล่วงหน้า = % ของเงินเดือนพื้นฐาน · ขึ้นกับอายุงาน:
   - 0 - <3 ปี:  50%
   - 3 - <4 ปี:  60%
   - 4 - <5 ปี:  70%
   - 5 - <6 ปี:  80%
   - 6 ปี ขึ้นไป: 100%
   อายุงานยังไม่ครบ 1 ปี (เพิ่งเริ่ม) ก็ได้ 50% ตามขั้นแรก
   ไม่มี startWorkMonth → fallback 50% (default)                       */

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
