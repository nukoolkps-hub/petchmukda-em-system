/* ─── Leave counting helpers ───────────────────────────────────── */
import { BUSINESS_RULES } from "../constants";
import type { StoreCalendar } from "../types";
import { dateToYmd, isQuotaCountableDay, isStoreClosed } from "./storeCalendar";

const { WEEKDAY_LEAVE_QUOTA, LEAVE_CANCEL_CUTOFF_HOUR } = BUSINESS_RULES;

/** พนักงาน "ยกเลิก (ลบ) ใบลาของตัวเอง" ใบนี้ได้อยู่ไหม ณ เวลา `now`
 *  = ยังไม่ถึง `LEAVE_CANCEL_CUTOFF_HOUR` (09:00) ของ **วันแรกที่ลา**
 *
 *  - ใบลาวันอนาคต → ยกเลิกได้ตลอด (ยังไม่ถึงเช้าวันนั้น)
 *  - ใบลาของวันนี้ → ยกเลิกได้ถึง 08:59 · 09:00 เป็นต้นไป ล็อก
 *  - ใบลาที่เริ่มไปแล้ว → ล็อก
 *
 *  **admin ไม่อยู่ใต้กฎนี้** — ลบให้ได้ตลอดจนกว่าเดือนนั้นจะปิดรอบ (7 วัน)
 *
 *  กฎเดียวกันถูกบังคับ 2 ชั้น: UI เรียกฟังก์ชันนี้ (ซ่อนปุ่ม + กัน submit) และ
 *  `firestore.rules` (`canSelfCancelLeave`) ตัดสินซ้ำฝั่ง server ด้วยเวลาไทย —
 *  หน้าที่เปิดค้างข้ามเส้นตายจึงลบไม่ได้จริง แม้ปุ่มจะยังค้างอยู่บนจอ           */
export function canCancelLeave(
  startYmd: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return false;
  const [y, m, d] = startYmd.split("-").map((v) => parseInt(v, 10));
  const cutoff = new Date(y, m - 1, d, LEAVE_CANCEL_CUTOFF_HOUR, 0, 0, 0);
  return now.getTime() < cutoff.getTime();
}

/** ข้อความอธิบายเส้นตายยกเลิกใบลา — ใช้ทั้ง toast และคำอธิบายใต้รายการ
 *  (อ่านชั่วโมงจาก BUSINESS_RULES ไม่ hardcode "9" ในข้อความ)              */
export const LEAVE_CANCEL_CUTOFF_TEXT = `ยกเลิกใบลาเองได้ถึงก่อน ${String(
  LEAVE_CANCEL_CUTOFF_HOUR,
).padStart(2, "0")}:00 ของวันแรกที่ลา`;

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

/** ใบลา (อาจคร่อมเดือน) "แตะ" เดือน yearMonth (YYYY-MM) ไหม
 *  ใช้คัดใบลาเข้าเดือนสำหรับ "คำนวณเงิน" — ใบลาคร่อม 2 เดือน (เช่น 30 พ.ค.
 *  → 3 มิ.ย.) ต้องนับเข้าทั้งสองเดือน (เดิมใช้ start.startsWith จับเฉพาะเดือน
 *  เริ่ม → เดือนปลายมองไม่เห็น เงินเพี้ยน) · ต้องใช้คู่กับ arg yearMonth ใน
 *  countWeekdayLeaves/getOverQuotaDays เพื่อ clamp ให้แต่ละเดือนนับเฉพาะวัน
 *  ของตัวเอง */
export function leaveOverlapsMonth(
  leave: { start: string; end: string },
  yearMonth: string,
): boolean {
  return (
    leave.start.slice(0, 7) <= yearMonth && leave.end.slice(0, 7) >= yearMonth
  );
}

/* นับเฉพาะวันลาที่ "ตรงกับวันทำงาน" (ใช้กับโบนัสขยัน + รวมเข้าโควต้า)
   - calendar = undefined → ใช้กฎเดิม (Mon-Fri นับ · เสาร์-อาทิตย์ข้าม)
   - yearMonth (YYYY-MM) → นับเฉพาะวันที่อยู่ในเดือนนั้น (clamp ใบลาคร่อมเดือน
     ให้แต่ละเดือนนับเฉพาะวันของตัวเอง) · undefined = นับทุกวันในช่วง (เดิม)  */
export function countWeekdayLeaves(
  monthLeaves: { start: string; end: string }[],
  calendar?: StoreCalendar | null,
  yearMonth?: string,
) {
  let n = 0;
  monthLeaves.forEach((lv) => {
    const s = new Date(`${lv.start}T00:00:00`);
    const e = new Date(`${lv.end}T00:00:00`);
    const c = new Date(s);
    while (c <= e) {
      if (
        (!yearMonth || dateToYmd(c).slice(0, 7) === yearMonth) &&
        isCountableWeekday(c, calendar)
      )
        n++;
      c.setDate(c.getDate() + 1);
    }
  });
  return n;
}

/* ─── Helper: นับวันลาที่ "ถูกหัก" ────────────────────────────────
   กฎ:
   - วันอาทิตย์ทุกวันที่ลา (ร้านเปิด) → ถูกหักทันที (× 1.5 ไม่ใช้โควต้า)
   - วันที่ร้านปิด (เสาร์ default + เสาร์ที่ไม่ได้ open + จ-ศ ปิดพิเศษ +
     อาทิตย์ปิดพิเศษ) → ไม่นับ ไม่หัก (ร้านปิดอยู่แล้ว — ลาไม่กระทบ)
   - วันทำงาน (เสาร์เปิดพิเศษ + จ-ศ ปกติ) → 2 "วัน" แรก (เรียงตามวัน)
     ไม่หัก, เกินจากนั้นค่อยหัก
   IMPORTANT: นับเป็น "วัน" ไม่ใช่ "ใบลา" · ใบเดียวยาว 3 วัน = 3 วัน
   (เดิมใช้ entries count ทำให้ใบลายาวๆ ใบเดียวฟรีทั้งใบ → store losing) */
export function getOverQuotaDays(
  monthLeaves: { start: string; end: string }[],
  calendar?: StoreCalendar | null,
  yearMonth?: string,
) {
  // เก็บวันที่ "วันทำงาน" ที่ลาทั้งหมด (chronological) · dedupe กันใบลาทับ
  const workDayDates: string[] = [];
  let sundays = 0;

  monthLeaves.forEach((lv) => {
    const s = new Date(`${lv.start}T00:00:00`);
    const e = new Date(`${lv.end}T00:00:00`);
    const c = new Date(s);
    while (c <= e) {
      // clamp ใบลาคร่อมเดือน — นับเฉพาะวันที่อยู่ในเดือน yearMonth (ถ้าระบุ)
      if (!yearMonth || dateToYmd(c).slice(0, 7) === yearMonth) {
        const dow = c.getDay();
        if (dow === 0) {
          // อาทิตย์ที่ร้านเปิด → หักทันที (× 1.5) · อาทิตย์ปิดพิเศษ → ข้าม ไม่หัก
          if (!isStoreClosed(dateToYmd(c), calendar)) sundays++;
        } else if (isCountableWeekday(c, calendar)) {
          workDayDates.push(
            `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`,
          );
        }
        // วันที่ร้านปิด → ข้าม ไม่นับ ไม่หัก
      }
      c.setDate(c.getDate() + 1);
    }
  });

  // dedupe กันใบลาทับซ้อน + คำนวณส่วนเกินโควต้า "เป็นวัน"
  const uniqueDays = new Set(workDayDates).size;
  const weekdays = Math.max(0, uniqueDays - WEEKDAY_LEAVE_QUOTA);
  return { weekdays, sundays };
}
