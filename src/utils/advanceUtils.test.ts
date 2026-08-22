import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeAdvancesOfMonth,
  advanceLimitPercent,
  findBlockingAdvance,
  tenureFullYears,
} from "./advanceUtils";

// tenure math reads `new Date()` — pin the clock so tests are deterministic.
// Fixed "now" = 15 June 2026 (local time).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("tenureFullYears", () => {
  it("returns 0 for null / invalid / malformed input", () => {
    expect(tenureFullYears(null)).toBe(0);
    expect(tenureFullYears(undefined)).toBe(0);
    expect(tenureFullYears("")).toBe(0);
    expect(tenureFullYears("2020")).toBe(0);
    expect(tenureFullYears("2020-13-01")).toBe(0); // not matching YYYY-MM
    expect(tenureFullYears("not-a-date")).toBe(0);
  });

  it("counts whole years, rounding down", () => {
    // started June 2023 → exactly 3 years on June 2026
    expect(tenureFullYears("2023-06")).toBe(3);
    // started July 2023 → not yet 3 full years in June 2026 (month diff < 0)
    expect(tenureFullYears("2023-07")).toBe(2);
    // started Jan 2026 → under a year
    expect(tenureFullYears("2026-01")).toBe(0);
  });

  it("never returns a negative tenure for future start dates", () => {
    expect(tenureFullYears("2030-01")).toBe(0);
  });
});

describe("advanceLimitPercent", () => {
  it("defaults to 50% with no/invalid start date", () => {
    expect(advanceLimitPercent(null)).toBe(0.5);
    expect(advanceLimitPercent(undefined)).toBe(0.5);
    expect(advanceLimitPercent("bad")).toBe(0.5);
  });

  it("maps each tenure tier to its ceiling percentage", () => {
    expect(advanceLimitPercent("2026-01")).toBe(0.5); // 0y
    expect(advanceLimitPercent("2024-06")).toBe(0.5); // 2y
    expect(advanceLimitPercent("2023-06")).toBe(0.6); // 3y
    expect(advanceLimitPercent("2022-06")).toBe(0.7); // 4y
    expect(advanceLimitPercent("2021-06")).toBe(0.8); // 5y
    expect(advanceLimitPercent("2020-06")).toBe(1.0); // 6y
    expect(advanceLimitPercent("2010-06")).toBe(1.0); // far past → capped at 100%
  });

  it("treats exactly 3.0 years as the 60% tier, not 70%", () => {
    // boundary guard: 3y full → tier {minYears:3} = 60%
    expect(tenureFullYears("2023-06")).toBe(3);
    expect(advanceLimitPercent("2023-06")).toBe(0.6);
  });
});

/* ─── กฎ "เบิกได้ครั้งเดียวต่อเดือน" ─────────────────────────────────
   helper ตัวเดียวกันนี้ใช้ทั้งฝั่งฟอร์ม (ปิดปุ่ม) และตอนเขียนจริงใน
   `submitAdvance` (อ่านสดจาก server ก่อน addDoc) — เดิมกฎอยู่แค่ในฟอร์ม
   ทำให้ยื่นซ้ำได้เมื่อ client ยังไม่เห็นคำขอเดิม                          */
const YM = "2026-06";
const req = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  month: YM,
  status: "pending",
  amount: 1000,
  ...over,
});

describe("findBlockingAdvance — 1 ครั้ง/เดือน", () => {
  it("ไม่มีคำขอเดือนนี้ → ยื่นได้", () => {
    expect(findBlockingAdvance([], YM)).toBeNull();
    expect(findBlockingAdvance([req({ month: "2026-05" })], YM)).toBeNull();
  });

  it("มีคำขอรออนุมัติ → บล็อก", () => {
    expect(findBlockingAdvance([req()], YM)?.id).toBe("a1");
  });

  it("คำขอที่อนุมัติแล้ว → บล็อก (เคสที่หลุดจริง)", () => {
    expect(findBlockingAdvance([req({ status: "approved" })], YM)?.id).toBe(
      "a1",
    );
  });

  it("ถูกปฏิเสธ → ยื่นใหม่ได้ในเดือนเดียวกัน", () => {
    expect(findBlockingAdvance([req({ status: "rejected" })], YM)).toBeNull();
  });

  it("auto-carry (ระบบสร้างให้ตอน net ติดลบ) → ไม่กินสิทธิ์ยื่น", () => {
    const list = [req({ status: "approved", autoCarryFromMonth: "2026-05" })];
    expect(findBlockingAdvance(list, YM)).toBeNull();
    // ...แต่ยังกินวงเงิน tier ตามจริง
    expect(activeAdvancesOfMonth(list, YM)).toHaveLength(1);
  });

  it("auto-carry + คำขอที่พนักงานยื่นเอง → บล็อกที่ตัวที่ยื่นเอง", () => {
    const list = [
      req({ id: "carry", status: "approved", autoCarryFromMonth: "2026-05" }),
      req({ id: "mine" }),
    ];
    expect(findBlockingAdvance(list, YM)?.id).toBe("mine");
  });

  it("activeAdvancesOfMonth: rejected ไม่นับวงเงิน · เดือนอื่นไม่นับ", () => {
    const list = [
      req({ id: "r", status: "rejected", amount: 5000 }),
      req({ id: "old", month: "2026-05", amount: 5000 }),
      req({ id: "ok", status: "approved", amount: 1500 }),
    ];
    const active = activeAdvancesOfMonth(list, YM);
    expect(active.map((a) => a.id)).toEqual(["ok"]);
    expect(active.reduce((s, a) => s + a.amount, 0)).toBe(1500);
  });

  it("ทนต่อข้อมูลไม่ครบ (list ว่าง/undefined field)", () => {
    expect(findBlockingAdvance([{}], YM)).toBeNull();
    expect(activeAdvancesOfMonth([{}], YM)).toHaveLength(0);
  });
});
