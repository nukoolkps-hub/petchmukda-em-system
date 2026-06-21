import { describe, expect, it } from "vitest";
import type { StoreCalendar } from "../types";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";

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
