/* ─── ระยะเวลาจำนำ — "เดือนเต็ม + วันเศษ" ─────────────────────────────
   - **เดือนเต็ม** = calendar month (ครบวันที่เดิมของเดือนถัดไป):
     10 พ.ย. → 10 ธ.ค. = 1 เดือนเต็ม · เดือนปลายทางไม่มีวันที่นั้น
     (31 ม.ค. → ก.พ.) ใช้วันสุดท้ายของเดือน
   - **วันเศษไม่นับวันเริ่มจำนำ** (นับแบบเดิม): 10 → 25 พ.ย. = 15 วัน
   - **ยกเว้นไถ่วันเดียวกับที่จำนำ = 1 วัน** (ไม่ใช่ 0 — มีดอกเบี้ยขั้นต่ำ)
   (เคยลองนับวันเริ่มเป็นวันแรก #823 → ร้านขอกลับมาใช้แบบเดิม)             */

export interface PawnPeriod {
  months: number;
  days: number;
}

/** null = วันสิ้นสุดอยู่ก่อนวันเริ่ม (ข้อมูลผิด) */
export function pawnPeriod(start: Date, end: Date): PawnPeriod | null {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (e.getTime() < s.getTime()) return null;

  let months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months--;
  if (months < 0) months = 0;

  const intYear = s.getFullYear() + Math.floor((s.getMonth() + months) / 12);
  const intMonth = (s.getMonth() + months) % 12;
  const daysInIntMonth = new Date(intYear, intMonth + 1, 0).getDate();
  const intermediate = new Date(
    intYear,
    intMonth,
    Math.min(s.getDate(), daysInIntMonth),
  );
  // Math.round กัน DST/ชั่วโมงเพี้ยน (ไทยไม่มี DST แต่เครื่องผู้ใช้อาจตั้งโซนอื่น)
  const rawDays = Math.round(
    (e.getTime() - intermediate.getTime()) / 86_400_000,
  );
  // ไม่นับวันเริ่ม · ยกเว้นไถ่วันเดียวกัน (0 เดือน 0 วัน) นับเป็น 1 วัน
  const days = months === 0 && rawDays === 0 ? 1 : rawDays;
  return { months, days };
}
