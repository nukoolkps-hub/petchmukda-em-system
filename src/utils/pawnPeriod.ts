/* ─── ระยะเวลาจำนำ — "เดือนเต็ม + วันเศษ" ─────────────────────────────
   - **เดือนเต็ม** = calendar month แบบเดิม (ครบวันที่เดิมของเดือนถัดไป):
     10 พ.ย. → 10 ธ.ค. = 1 เดือนเต็ม · เดือนปลายทางไม่มีวันที่นั้น
     (31 ม.ค. → ก.พ.) ใช้วันสุดท้ายของเดือน
   - **วันเศษ นับวันเริ่มด้วย (+1)** — กติกาหน้าร้าน: จำนำ 10 พ.ย. ไถ่ 25 พ.ย.
     = 16 วัน (ไม่ใช่ 15) · 10 พ.ย. → 25 ธ.ค. = 1 เดือน 16 วัน
   - ครบเดือนพอดี (วันเศษ 0) → ไม่บวก · 10 พ.ย. → 10 ธ.ค. = 1 เดือน 0 วัน
   - จำนำ-ไถ่วันเดียวกัน = 1 วัน (วันเศษล้วน นับวันเริ่ม)                 */

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
  // วันเศษนับวันเริ่มด้วย · ครบเดือนพอดีไม่มีวันเศษ (ไม่บวก)
  const days = rawDays > 0 || months === 0 ? rawDays + 1 : 0;
  return { months, days };
}
