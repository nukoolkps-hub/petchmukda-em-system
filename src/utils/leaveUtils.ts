/* ─── Leave counting helpers ───────────────────────────────────── */
import { BUSINESS_RULES } from "../constants";
import type { StoreCalendar } from "../types";
import { fmtShortWithWeekday } from "./dateUtils";
import { dateToYmd, isQuotaCountableDay, isStoreClosed } from "./storeCalendar";

const {
  WEEKDAY_LEAVE_QUOTA,
  LEAVE_CANCEL_CUTOFF_HOUR,
  LEAVE_CANCEL_GRACE_MINUTES,
} = BUSINESS_RULES;

/* ─── เส้นตาย "ยกเลิกใบลาเอง" ของพนักงาน ─────────────────────────
   กฎเดียวกันถูกบังคับ 2 ชั้น — UI เรียกฟังก์ชันในไฟล์นี้ (ซ่อนปุ่ม + กันตอนกด)
   และ `firestore.rules` (`canSelfCancelLeave`) ตัดสินซ้ำด้วยเวลาไทยฝั่ง server
   → หน้าที่เปิดค้างข้ามเส้นตาย หรือ client ที่แก้นาฬิกาเครื่อง ก็ลบไม่ได้จริง */

/** ฟิลด์เท่าที่กฎยกเลิกต้องใช้ — รับเป็น subset เพื่อเรียกจากที่ไหนก็ได้ */
export interface CancellableLeave {
  /** วันแรกที่ลา "YYYY-MM-DD" */
  start: string;
  /** epoch ms จากนาฬิกาเครื่อง (แสดงผล · ปลอมได้) */
  createdAt?: number;
  /** serverTimestamp() ตอนสร้าง — เกณฑ์จริงของช่วงผ่อนผัน */
  createdAtServer?: { toMillis: () => number } | null;
  /** ใบที่ admin เพิ่มให้ — ไม่ได้ช่วงผ่อนผัน (ไม่ใช่ "พนักงานกดผิดเอง") */
  createdByAdmin?: boolean;
}

/** เวลาสร้างใบลาเป็น epoch ms — ใช้ `createdAtServer` ก่อนเสมอ ตกมาที่
 *  `createdAt` ของเครื่องเฉพาะใบเก่าที่ยังไม่มีฟิลด์ server (แสดงผลใกล้เคียง
 *  พอ · ตัวตัดสินจริงคือ firestore.rules ที่อ่าน `createdAtServer` อย่างเดียว) */
export function leaveCreatedAtMs(leave: CancellableLeave): number | undefined {
  const stamped = leave.createdAtServer;
  if (stamped && typeof stamped.toMillis === "function") {
    return stamped.toMillis();
  }
  return typeof leave.createdAt === "number" ? leave.createdAt : undefined;
}

/** เส้นตายปกติ: `LEAVE_CANCEL_CUTOFF_HOUR` (09:00) ของวันแรกที่ลา */
function cutoffOf(startYmd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return null;
  const [y, m, d] = startYmd.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d, LEAVE_CANCEL_CUTOFF_HOUR, 0, 0, 0);
}

/** อยู่ในช่วงผ่อนผัน "เพิ่งกดยื่นผิด" ไหม (นับจากเวลาสร้างใบลา) */
function withinGrace(leave: CancellableLeave, now: Date): boolean {
  if (leave.createdByAdmin) return false;
  const created = leaveCreatedAtMs(leave);
  if (created === undefined) return false;
  return now.getTime() < created + LEAVE_CANCEL_GRACE_MINUTES * 60_000;
}

/** พนักงาน "ยกเลิก (ลบ) ใบลาของตัวเอง" ใบนี้ได้อยู่ไหม ณ เวลา `now`
 *
 *  ได้ ถ้าเข้าข้อใดข้อหนึ่ง:
 *  1. ยังไม่ถึง 09:00 ของ **วันแรกที่ลา** (ใบลาวันข้างหน้าจึงยกเลิกได้ตลอด ·
 *     ใบลาของวันนี้ยกเลิกได้ถึง 08:59 — แปลว่า "เปลี่ยนใจมาทำงาน" ทันร้านเปิด)
 *  2. เพิ่งยื่นเองไม่เกิน `LEAVE_CANCEL_GRACE_MINUTES` นาที (กันกดผิดวัน —
 *     ใบที่เพิ่งสร้างยังไม่เคยเข้ากล่องประกาศเช้า ลบแล้วไม่มีใครเข้าใจผิด)
 *
 *  **admin ไม่อยู่ใต้กฎนี้** — ลบให้ได้จนกว่าเดือนนั้นจะปิดรอบ (7 วัน)          */
export function canCancelLeave(
  leave: CancellableLeave,
  now: Date = new Date(),
): boolean {
  const cutoff = cutoffOf(leave.start);
  if (!cutoff) return false;
  return now.getTime() < cutoff.getTime() || withinGrace(leave, now);
}

/** "08:59 น. ของ จ. 7 ก.ย. 2569" — เส้นตายของใบลาใบนี้แบบเจาะจงวัน
 *  (บอกนาทีสุดท้ายที่ยังกดได้ ไม่ใช่ "ก่อน 09:00" ที่ต้องตีความเอง)         */
export function leaveCancelDeadlineText(startYmd: string): string {
  const lastMinute = `${String(LEAVE_CANCEL_CUTOFF_HOUR - 1).padStart(2, "0")}:59 น.`;
  if (!cutoffOf(startYmd)) return lastMinute;
  return `${lastMinute} ของ ${fmtShortWithWeekday(startYmd)}`;
}

/** ข้อความสถานะการยกเลิกของใบลาใบนี้ — ใช้ทั้งใต้รายการและใน toast
 *  คืน `null` ถ้าไม่ต้องอธิบายอะไร (ใบลาที่ผ่านไปแล้ว — เห็นชัดอยู่แล้ว)     */
export function leaveCancelHint(
  leave: CancellableLeave,
  now: Date = new Date(),
): { tone: "ok" | "grace" | "locked"; text: string } {
  const deadline = leaveCancelDeadlineText(leave.start);
  const cutoff = cutoffOf(leave.start);
  if (cutoff && now.getTime() < cutoff.getTime()) {
    return { tone: "ok", text: `ยกเลิกใบลานี้เองได้ถึง ${deadline}` };
  }
  if (withinGrace(leave, now)) {
    return {
      tone: "grace",
      text: `เลย ${deadline} มาแล้ว — เหลือแค่ช่วงผ่อนผัน ยกเลิกเองได้ภายใน ${LEAVE_CANCEL_GRACE_MINUTES} นาทีแรกหลังกดยื่นเท่านั้น`,
    };
  }
  return {
    tone: "locked",
    text: `หมดเวลายกเลิกเองแล้ว (ยกเลิกได้ถึง ${deadline}) — ถ้าต้องลบใบลานี้ ให้แจ้ง ADMIN`,
  };
}

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
