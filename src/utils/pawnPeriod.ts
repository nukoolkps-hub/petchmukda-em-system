/* ─── ระยะเวลาจำนำ — "เดือนเต็ม + วันเศษ" ─────────────────────────────
   นับจาก **จำนวนวันที่ผ่านไป** หลังวันเริ่มจำนำ · **ไม่นับวันที่เริ่มจำนำ**
   (หลักเดียวกับการคิดดอกเบี้ยของธนาคารทั่วไป)
   - จำนำวันที่ 9 ไถ่วันที่ 10 = 1 วัน · จำนำ 10 พ.ย. ไถ่ 25 พ.ย. = 15 วัน
   - **เดือนเต็ม** = calendar month (ครบวันที่เดิมของเดือนถัดไป):
     10 พ.ย. → 10 ธ.ค. = 1 เดือน 0 วัน · 10 พ.ย. → 25 ธ.ค. = 1 เดือน 15 วัน ·
     เดือนปลายทางไม่มีวันที่นั้น (31 ม.ค. → ก.พ.) ใช้วันสุดท้ายของเดือน
   - จำนำ-ไถ่วันเดียวกัน = 0 วัน (ดอกเบี้ยขั้นต่ำ 30 ฿ ยังใช้ตามปกติ)      */

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
  // วันที่ผ่านไป (ไม่นับวันเริ่ม) · Math.round กัน DST/ชั่วโมงเพี้ยน
  // (ไทยไม่มี DST แต่เครื่องผู้ใช้อาจตั้งโซนอื่น)
  const days = Math.round((e.getTime() - intermediate.getTime()) / 86_400_000);
  return { months, days };
}
