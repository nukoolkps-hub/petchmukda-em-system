import { describe, expect, it } from "vitest";
import { BUSINESS_RULES } from "../constants";
import type { StoreCalendar } from "../types";
import {
  canCancelLeave,
  countWeekdayLeaves,
  getOverQuotaDays,
  leaveCancelDeadlineText,
  leaveCancelHint,
  leaveCreatedAtMs,
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

/* ─── canCancelLeave — เส้นตายยกเลิกใบลาของพนักงาน ───────────────────
   invariant: ใบลาที่ทีมรับรู้ไปแล้ว (พ้น 09:00 ของวันแรกที่ลา) พนักงานลบเอง
   ไม่ได้ — ไม่งั้นวันลาหายจากระบบแล้วโควต้า/โบนัสขยัน/เงินเดือนเพี้ยน
   ยกเว้นใบที่ "เพิ่งกดยื่นเอง" ภายใน 10 นาที (กันกดผิดวัน)               */
describe("canCancelLeave — เส้นตาย 09:00 ของวันแรกที่ลา", () => {
  const LEAVE_DAY = "2026-06-09"; // อังคาร 9 มิ.ย. 2026
  /** ใบลาเก่า (ไม่มี createdAtServer/createdAt) → ไม่มีช่วงผ่อนผันมาปน */
  const plain = { start: LEAVE_DAY };

  it("ยกเลิกได้ตลอด ถ้าใบลายังไม่ถึงวัน", () => {
    expect(canCancelLeave(plain, new Date(2026, 5, 8, 23, 59))).toBe(true);
    expect(canCancelLeave(plain, new Date(2026, 5, 1, 12, 0))).toBe(true);
  });

  it("วันที่ลา: ก่อน 09:00 ยังยกเลิกได้ (เปลี่ยนใจมาทำงาน ทันร้านเปิด)", () => {
    expect(canCancelLeave(plain, new Date(2026, 5, 9, 0, 0))).toBe(true);
    expect(canCancelLeave(plain, new Date(2026, 5, 9, 8, 59, 59))).toBe(true);
  });

  it("วันที่ลา: 09:00 ตรง เป็นต้นไป ล็อก", () => {
    expect(canCancelLeave(plain, new Date(2026, 5, 9, 9, 0, 0))).toBe(false);
    expect(canCancelLeave(plain, new Date(2026, 5, 9, 9, 0, 1))).toBe(false);
    expect(canCancelLeave(plain, new Date(2026, 5, 9, 23, 59))).toBe(false);
  });

  it("ใบลาที่ผ่านไปแล้ว ล็อกเสมอ", () => {
    expect(canCancelLeave(plain, new Date(2026, 5, 10, 0, 0))).toBe(false);
    expect(canCancelLeave(plain, new Date(2026, 6, 1, 0, 0))).toBe(false);
  });

  it("ใบลาหลายวัน: ยึด 09:00 ของ *วันแรก* — เริ่มแล้วยกเลิกไม่ได้แม้ยังไม่จบ", () => {
    expect(canCancelLeave(plain, new Date(2026, 5, 10, 8, 0))).toBe(false);
  });

  it("วันที่ผิดรูป → ยกเลิกไม่ได้ (ปล่อยให้ admin จัดการ)", () => {
    expect(canCancelLeave({ start: "" }, new Date(2026, 5, 1))).toBe(false);
    expect(canCancelLeave({ start: "2026-6-9" }, new Date(2026, 5, 1))).toBe(
      false,
    );
    expect(canCancelLeave({ start: "ไม่ใช่วันที่" }, new Date(2026, 5, 1))).toBe(
      false,
    );
  });
});

/* ─── ช่วงผ่อนผัน "เพิ่งกดยื่นผิด" ─────────────────────────────────── */
describe("canCancelLeave — ช่วงผ่อนผันหลังกดยื่น", () => {
  const LEAVE_DAY = "2026-06-09";
  const GRACE_MS = BUSINESS_RULES.LEAVE_CANCEL_GRACE_MINUTES * 60_000;
  // บ่ายวันที่ลา = เลยเส้นตาย 09:00 ไปแล้ว · เหลือแต่ช่วงผ่อนผัน
  const AFTERNOON = new Date(2026, 5, 9, 14, 0, 0);
  const stamp = (ms: number) => ({ toMillis: () => ms });

  it("เพิ่งยื่นไม่เกิน 10 นาที → ยกเลิกได้แม้เลย 09:00 (แก้เคสกดผิดวัน)", () => {
    const leave = {
      start: LEAVE_DAY,
      createdAtServer: stamp(AFTERNOON.getTime() - 60_000),
    };
    expect(canCancelLeave(leave, AFTERNOON)).toBe(true);
  });

  it("พ้น 10 นาทีแล้ว → ล็อกตามเส้นตายปกติ", () => {
    const leave = {
      start: LEAVE_DAY,
      createdAtServer: stamp(AFTERNOON.getTime() - GRACE_MS),
    };
    expect(canCancelLeave(leave, AFTERNOON)).toBe(false);
    // ขอบพอดี: 1 ms ก่อนครบ ยังได้
    expect(
      canCancelLeave(
        {
          start: LEAVE_DAY,
          createdAtServer: stamp(AFTERNOON.getTime() - GRACE_MS + 1),
        },
        AFTERNOON,
      ),
    ).toBe(true);
  });

  it("ใบที่ ADMIN เพิ่มให้ ไม่ได้ช่วงผ่อนผัน (ไม่ใช่พนักงานกดผิดเอง)", () => {
    const leave = {
      start: LEAVE_DAY,
      createdAtServer: stamp(AFTERNOON.getTime() - 60_000),
      createdByAdmin: true,
    };
    expect(canCancelLeave(leave, AFTERNOON)).toBe(false);
  });

  it("ใบเก่าที่ไม่มีเวลาสร้างเลย → ไม่มีช่วงผ่อนผัน", () => {
    expect(canCancelLeave({ start: LEAVE_DAY }, AFTERNOON)).toBe(false);
  });

  it("ช่วงผ่อนผันขยายเวลาเท่านั้น ไม่ตัดสิทธิ์ใบลาวันข้างหน้า", () => {
    // ใบลาวันข้างหน้าที่ยื่นไว้นานแล้ว → ยังยกเลิกได้ตามเส้นตายปกติ
    const leave = {
      start: "2026-07-01",
      createdAtServer: stamp(new Date(2026, 4, 1).getTime()),
    };
    expect(canCancelLeave(leave, new Date(2026, 5, 20))).toBe(true);
  });

  it("leaveCreatedAtMs: ใช้เวลา server ก่อน · ตกมาที่นาฬิกาเครื่องเมื่อไม่มี", () => {
    expect(
      leaveCreatedAtMs({
        start: LEAVE_DAY,
        createdAt: 111,
        createdAtServer: stamp(999),
      }),
    ).toBe(999);
    expect(leaveCreatedAtMs({ start: LEAVE_DAY, createdAt: 111 })).toBe(111);
    expect(leaveCreatedAtMs({ start: LEAVE_DAY })).toBeUndefined();
  });
});

/* ─── ข้อความที่พนักงานเห็น — ต้องบอกวัน-เวลาเจาะจง ไม่ใช่กฎลอยๆ ─────── */
describe("ข้อความเส้นตายยกเลิก", () => {
  const LEAVE_DAY = "2026-06-09";

  it("บอกนาทีสุดท้ายที่ยังกดได้ + วันแรกที่ลา (ไม่ต้องตีความ 'ก่อน 09:00' เอง)", () => {
    const text = leaveCancelDeadlineText(LEAVE_DAY);
    expect(text).toContain("08:59 น.");
    expect(text).toContain("9 มิ.ย. 2569"); // พ.ศ. + เดือนไทย ตาม convention
  });

  it("ยังยกเลิกได้ → บอกว่าเหลือถึงเมื่อไหร่", () => {
    const hint = leaveCancelHint(
      { start: LEAVE_DAY },
      new Date(2026, 5, 8, 10),
    );
    expect(hint.tone).toBe("ok");
    expect(hint.text).toContain("08:59 น.");
  });

  it("หมดเวลาแล้ว → บอกว่าให้แจ้ง ADMIN", () => {
    const hint = leaveCancelHint(
      { start: LEAVE_DAY },
      new Date(2026, 5, 9, 14),
    );
    expect(hint.tone).toBe("locked");
    expect(hint.text).toContain("ADMIN");
  });

  it("อยู่ในช่วงผ่อนผัน → บอกว่าเหลือแค่ช่วงผ่อนผัน", () => {
    const now = new Date(2026, 5, 9, 14);
    const hint = leaveCancelHint(
      {
        start: LEAVE_DAY,
        createdAtServer: { toMillis: () => now.getTime() - 60_000 },
      },
      now,
    );
    expect(hint.tone).toBe("grace");
    expect(hint.text).toContain(
      String(BUSINESS_RULES.LEAVE_CANCEL_GRACE_MINUTES),
    );
  });
});
