/* ─── หนังสือรับรองเงินเดือน — เพดานยอดที่พนักงานระบุเองได้ ───────────
   พนักงานพิมพ์ใบรับรองเองได้ และ "ระบุยอดเอง" ได้ในกล่องก่อนพิมพ์

   เพดาน = เงินเดือนพื้นฐานปัจจุบัน × (1 + CERT_MAX_OVER_BASE)
   ระบุต่ำกว่าได้เสมอ · ไม่มีขั้นต่ำ

   ทำไมยอมให้เกิน: พนักงานขายมีค่าคอมกองกลาง + โบนัสรายเดือน ซึ่งไม่นับอยู่ใน
   `baseSalary` → ยอดพื้นฐานล้วนๆ ต่ำกว่ารายได้จริงที่เขาได้รับ

   **ต้องเป็น single source** — เพดานนี้ถูกบังคับ 3 ที่ (กล่องใน UI · ตัวพิมพ์
   HTML · ตัว build PDF) ถ้าใครสักที่ clamp ไม่ตรงกัน ใบที่ออกมาจะไม่ตรงกับ
   ที่ UI บอกไว้                                                            */

import { BUSINESS_RULES } from "../constants";

/** ยอดสูงสุดที่ระบุในใบรับรองได้ · base ≤ 0 → 0 (ไม่มีข้อมูลเงินเดือน) */
export function certSalaryCeiling(effectiveBase: number): number {
  const base = Number(effectiveBase);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * (1 + BUSINESS_RULES.CERT_MAX_OVER_BASE));
}

/** ยอดที่จะพิมพ์จริง — clamp คำขอของพนักงานให้อยู่ในเพดาน
 *  · ไม่ระบุ / ระบุ 0 / ค่าพัง → ใช้เงินเดือนพื้นฐานปัจจุบัน (พฤติกรรมเดิม) */
export function clampCertSalary(
  requested: unknown,
  effectiveBase: number,
): number {
  const base = Number(effectiveBase) || 0;
  const asked = Number(requested);
  if (!Number.isFinite(asked) || asked <= 0) return base;
  return Math.min(asked, certSalaryCeiling(base));
}

/** ระบุเกินเพดานไหม — UI ใช้ขึ้นเตือนสีแดง (ไม่ใช่ตัวตัดสินยอดที่พิมพ์) */
export function exceedsCertCeiling(
  requested: unknown,
  effectiveBase: number,
): boolean {
  const asked = Number(requested);
  if (!Number.isFinite(asked) || asked <= 0) return false;
  return asked > certSalaryCeiling(effectiveBase);
}
