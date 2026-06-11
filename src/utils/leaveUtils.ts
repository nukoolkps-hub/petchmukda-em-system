/* ─── Leave counting helpers ───────────────────────────────────── */
import { BUSINESS_RULES } from "../constants";
import type { StoreCalendar } from "../types";
import { dateToYmd, isQuotaCountableDay } from "./storeCalendar";

const { WEEKDAY_LEAVE_QUOTA } = BUSINESS_RULES;

/** วันที่ลาควรนับเข้า "วันธรรมดา" (โควต้า) ไหม
 *  = ร้านเปิด AND ไม่ใช่อาทิตย์ (อาทิตย์คิดแยก × 1.5)
 *  - เสาร์ปิด default → ไม่นับ · เสาร์เปิดพิเศษ (อยู่ใน extraOpenSaturdays)
 *    → นับเหมือนวันธรรมดา
 *  - จ-ศ ปิดพิเศษ (อยู่ใน extraClosedWeekdays) → ไม่นับ                  */
function isCountableWeekday(
  date: Date,
  calendar?: StoreCalendar | null,
): boolean {
  return isQuotaCountableDay(dateToYmd(date), calendar);
}

/* นับเฉพาะวันลาที่ "ตรงกับวันทำงาน" (ใช้กับโบนัสขยัน + รวมเข้าโควต้า)
   - calendar = undefined → ใช้กฎเดิม (Mon-Fri นับ · เสาร์-อาทิตย์ข้าม)   */
export function countWeekdayLeaves(
  monthLeaves: { start: string; end: string }[],
  calendar?: StoreCalendar | null,
) {
  let n = 0;
  monthLeaves.forEach((lv) => {
    const s = new Date(`${lv.start}T00:00:00`);
    const e = new Date(`${lv.end}T00:00:00`);
    const c = new Date(s);
    while (c <= e) {
      if (isCountableWeekday(c, calendar)) n++;
      c.setDate(c.getDate() + 1);
    }
  });
  return n;
}

/* ─── Helper: นับวันลาที่ "ถูกหัก" ────────────────────────────────
   กฎ:
   - วันอาทิตย์ทุกวันที่ลา → ถูกหักทันที (× 1.5 ไม่ใช้โควต้า)
   - วันที่ร้านปิด (เสาร์ default + เสาร์ที่ไม่ได้ open + จ-ศ ปิดพิเศษ)
     → ไม่นับ ไม่หัก (ร้านปิดอยู่แล้ว — ลาไม่กระทบ)
   - วันทำงาน (เสาร์เปิดพิเศษ + จ-ศ ปกติ) → 2 ครั้งแรก (เรียงตามวัน)
     ไม่หัก, เกินจากนั้นค่อยหัก                                          */
export function getOverQuotaDays(
  monthLeaves: { start: string; end: string }[],
  calendar?: StoreCalendar | null,
) {
  const sorted = [...monthLeaves].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  let sundays = 0;
  let weekdays = 0;
  let weekdayLeaveCount = 0;

  sorted.forEach((lv) => {
    const s = new Date(`${lv.start}T00:00:00`);
    const e = new Date(`${lv.end}T00:00:00`);
    const c = new Date(s);
    let entryHasWeekday = false;
    let entryWeekdays = 0;
    while (c <= e) {
      const dow = c.getDay();
      if (dow === 0) {
        sundays++; // อาทิตย์ — หักทันที (× 1.5)
      } else if (isCountableWeekday(c, calendar)) {
        // วันทำงาน (เสาร์เปิด/จ-ศ ปกติ) → เข้าโควต้า
        entryWeekdays++;
        entryHasWeekday = true;
      }
      // วันที่ร้านปิด (เสาร์ปกติ/จ-ศ ปิดพิเศษ) → ข้าม ไม่นับ ไม่หัก
      c.setDate(c.getDate() + 1);
    }
    if (entryHasWeekday) {
      weekdayLeaveCount++;
      if (weekdayLeaveCount > WEEKDAY_LEAVE_QUOTA) weekdays += entryWeekdays;
    }
  });
  return { weekdays, sundays };
}
