/* ─── ระยะเวลาจำนำ — "เดือนเต็ม + วันเศษ" ─────────────────────────────
   **นับวันที่เริ่มจำนำเป็นวันแรกด้วย** (inclusive) — กติกาหน้าร้าน:
   จำนำ 10 พ.ย. ไถ่ 25 พ.ย. = 16 วัน (10,11,…,25) ไม่ใช่ 15
   ทำโดยเลื่อนวันสิ้นสุด +1 วัน แล้วคิดแบบ calendar month ตามเดิม:
   - เดือนเต็ม = ครบวันที่เดิมของเดือนถัดไป → 10 พ.ย. ถึง 9 ธ.ค. = 1 เดือนเต็ม
     (นับ 10 พ.ย. เป็นวันแรก ครบ 1 เดือนพอดีวันที่ 9 ธ.ค.)
   - เดือนปลายทางไม่มีวันที่นั้น (31 ม.ค. → ก.พ.) → ใช้วันสุดท้ายของเดือน
   - จำนำแล้วไถ่วันเดียวกัน = 1 วัน                                      */

export interface PawnPeriod {
  months: number;
  days: number;
}

/** null = วันสิ้นสุดอยู่ก่อนวันเริ่ม (ข้อมูลผิด) */
export function pawnPeriod(start: Date, end: Date): PawnPeriod | null {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (e.getTime() < s.getTime()) return null;
  // inclusive: นับวันเริ่มด้วย → เลื่อนปลาย +1 วัน
  const endEx = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);

  let months =
    (endEx.getFullYear() - s.getFullYear()) * 12 +
    (endEx.getMonth() - s.getMonth());
  if (endEx.getDate() < s.getDate()) months--;
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
  const days = Math.round(
    (endEx.getTime() - intermediate.getTime()) / 86_400_000,
  );
  return { months, days };
}
