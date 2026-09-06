import { describe, expect, it } from "vitest";
import type { StoreCalendar } from "../types";
import {
  canCancelLeave,
  countWeekdayLeaves,
  getOverQuotaDays,
  LEAVE_CANCEL_CUTOFF_TEXT,
  leaveOverlapsMonth,
} from "./leaveUtils";

// June 2026: Mon 08 → Fri 12 are five consecutive weekdays.
// Sat 06 / Sat 13 are Saturdays; Sun 07 / Sun 14 are Sundays.

describe("countWeekdayLeaves", () => {
  it("counts each weekday within a multi-day leave", () => {
    expect(
      countWeekdayLeaves([{ start: "2026-06-08", end: "2026-06-12" }]),
    ).toBe(5);
  });

  it("skips Saturdays (closed by default) and Sundays", () => {
    // Sat 06 + Sun 07 only
    expect(
      countWeekdayLeaves([{ start: "2026-06-06", end: "2026-06-07" }]),
    ).toBe(0);
  });

  it("counts a specially-opened Saturday as a weekday", () => {
    const cal = { extraOpenSaturdays: ["2026-06-06"] } as StoreCalendar;
    expect(
      countWeekdayLeaves([{ start: "2026-06-06", end: "2026-06-06" }], cal),
    ).toBe(1);
  });
});

describe("getOverQuotaDays", () => {
  it("gives the first 2 weekday leave days free", () => {
    // 2 weekdays → nothing over quota
    expect(
      getOverQuotaDays([{ start: "2026-06-08", end: "2026-06-09" }]),
    ).toEqual({ weekdays: 0, sundays: 0 });
  });

  it("charges weekday days beyond the 2-day quota", () => {
    // Mon–Fri = 5 weekdays → 5 - 2 = 3 over quota
    expect(
      getOverQuotaDays([{ start: "2026-06-08", end: "2026-06-12" }]),
    ).toEqual({ weekdays: 3, sundays: 0 });
  });

  it("counts a long single leave by DAY, not by entry (no full-month free ride)", () => {
    // one entry spanning 5 weekdays must still cost 3 over-quota days
    const res = getOverQuotaDays([{ start: "2026-06-08", end: "2026-06-12" }]);
    expect(res.weekdays).toBe(3);
  });

  it("dedupes overlapping leave entries so a day is not double-counted", () => {
    const res = getOverQuotaDays([
      { start: "2026-06-08", end: "2026-06-10" },
      { start: "2026-06-09", end: "2026-06-12" }, // overlaps 09–10
    ]);
    // union = Mon..Fri = 5 unique weekdays → 3 over quota
    expect(res).toEqual({ weekdays: 3, sundays: 0 });
  });

  it("charges every Sunday immediately (no quota) when the store is open", () => {
    const res = getOverQuotaDays([{ start: "2026-06-07", end: "2026-06-07" }]);
    expect(res).toEqual({ weekdays: 0, sundays: 1 });
  });

  it("does not charge a Sunday the admin marked as closed", () => {
    const cal = { extraClosedSundays: ["2026-06-07"] } as StoreCalendar;
    const res = getOverQuotaDays(
      [{ start: "2026-06-07", end: "2026-06-07" }],
      cal,
    );
    expect(res).toEqual({ weekdays: 0, sundays: 0 });
  });

  it("ignores closed Saturdays entirely", () => {
    const res = getOverQuotaDays([{ start: "2026-06-06", end: "2026-06-06" }]);
    expect(res).toEqual({ weekdays: 0, sundays: 0 });
  });

  it("separates weekday and Sunday charges across a week-long leave", () => {
    // Mon 08 → Sun 14: weekdays Mon-Fri (5) → 3 over quota; Sat 13 closed; Sun 14 charged
    const res = getOverQuotaDays([{ start: "2026-06-08", end: "2026-06-14" }]);
    expect(res).toEqual({ weekdays: 3, sundays: 1 });
  });
});

// ── Cross-month leave: clamp + overlap (bug fix) ──
// Leave Fri 29 May → Wed 03 Jun 2026:
//   May 29 Fri (weekday) · May 30 Sat (closed) · May 31 Sun (charged)
//   Jun 01 Mon · Jun 02 Tue · Jun 03 Wed (weekdays)
describe("cross-month leave clamping", () => {
  const crossLeave = [{ start: "2026-05-29", end: "2026-06-03" }];

  it("leaveOverlapsMonth matches both touched months, not others", () => {
    expect(leaveOverlapsMonth(crossLeave[0], "2026-05")).toBe(true);
    expect(leaveOverlapsMonth(crossLeave[0], "2026-06")).toBe(true);
    expect(leaveOverlapsMonth(crossLeave[0], "2026-04")).toBe(false);
    expect(leaveOverlapsMonth(crossLeave[0], "2026-07")).toBe(false);
  });

  it("countWeekdayLeaves clamps to the given month", () => {
    // May: only Fri 29 → 1
    expect(countWeekdayLeaves(crossLeave, null, "2026-05")).toBe(1);
    // June: Mon 01, Tue 02, Wed 03 → 3
    expect(countWeekdayLeaves(crossLeave, null, "2026-06")).toBe(3);
    // no clamp (legacy) → counts the whole range = 1 + 3 = 4
    expect(countWeekdayLeaves(crossLeave, null)).toBe(4);
  });

  it("getOverQuotaDays clamps to the given month (each month its own days)", () => {
    // May: 1 weekday (under 2-day quota) + Sun 31 charged
    expect(getOverQuotaDays(crossLeave, null, "2026-05")).toEqual({
      weekdays: 0,
      sundays: 1,
    });
    // June: 3 weekdays → 1 over quota, no Sunday
    expect(getOverQuotaDays(crossLeave, null, "2026-06")).toEqual({
      weekdays: 1,
      sundays: 0,
    });
  });
});

/* ─── canCancelLeave — เส้นตายยกเลิกใบลาของพนักงาน (09:00 ของวันที่ลา) ───
   invariant: ใบลาที่ทีมรับรู้ไปแล้ว (พ้น 09:00 ของวันแรกที่ลา) พนักงานลบเอง
   ไม่ได้ — ไม่งั้นวันลาหายจากระบบแล้วโควต้า/โบนัสขยัน/เงินเดือนเพี้ยน       */
describe("canCancelLeave", () => {
  // 09 มิ.ย. 2026 (อังคาร) เป็น "วันที่ลา" ในทุกเคสด้านล่าง
  const LEAVE_DAY = "2026-06-09";

  it("ยกเลิกได้ตลอด ถ้าใบลายังไม่ถึงวัน", () => {
    // เย็นวันก่อนหน้า
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 8, 23, 59))).toBe(true);
    // ล่วงหน้าหลายวัน
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 1, 12, 0))).toBe(true);
  });

  it("วันที่ลา: ก่อน 09:00 ยังยกเลิกได้ (เปลี่ยนใจมาทำงาน ทันร้านเปิด)", () => {
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 9, 0, 0))).toBe(true);
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 9, 8, 59, 59))).toBe(
      true,
    );
  });

  it("วันที่ลา: 09:00 ตรง เป็นต้นไป ล็อก", () => {
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 9, 9, 0, 0))).toBe(
      false,
    );
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 9, 9, 0, 1))).toBe(
      false,
    );
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 9, 23, 59))).toBe(false);
  });

  it("ใบลาที่ผ่านไปแล้ว ล็อกเสมอ", () => {
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 10, 0, 0))).toBe(false);
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 6, 1, 0, 0))).toBe(false);
  });

  it("ใบลาหลายวัน: ยึด 09:00 ของ *วันแรก* — เริ่มแล้วยกเลิกไม่ได้แม้ยังไม่จบ", () => {
    // ลา 09-11 มิ.ย. · สายวันที่ 10 (ยังอยู่ในช่วงลา) → ล็อกแล้ว
    expect(canCancelLeave(LEAVE_DAY, new Date(2026, 5, 10, 8, 0))).toBe(false);
  });

  it("วันที่ผิดรูป → ยกเลิกไม่ได้ (ปล่อยให้ admin จัดการ)", () => {
    expect(canCancelLeave("", new Date(2026, 5, 1))).toBe(false);
    expect(canCancelLeave("2026-6-9", new Date(2026, 5, 1))).toBe(false);
    expect(canCancelLeave("ไม่ใช่วันที่", new Date(2026, 5, 1))).toBe(false);
  });

  it("ข้อความเส้นตายอ่านชั่วโมงจาก BUSINESS_RULES (ไม่ hardcode ในข้อความ)", () => {
    expect(LEAVE_CANCEL_CUTOFF_TEXT).toContain("09:00");
  });
});
