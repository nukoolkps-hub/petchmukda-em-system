import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_RULES } from "../constants";
import {
  activeAdvancesOfMonth,
  advanceLimitPercent,
  advanceQuotaOfMonth,
  tenureFullYears,
  userAdvancesOfMonth,
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

/* ─── กฎ "เบิกได้ N ครั้งต่อเดือน" ──────────────────────────────────
   helper ตัวเดียวกันนี้ใช้ทั้งฝั่งฟอร์ม (ปิดปุ่ม) และตอนเขียนจริงใน
   `submitAdvance` (อ่านสดจาก server ก่อน addDoc) — เดิมกฎอยู่แค่ในฟอร์ม
   ทำให้ยื่นเกินโควต้าได้เมื่อ client ยังไม่เห็นคำขอเดิม                    */
const YM = "2026-06";
const req = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  month: YM,
  status: "pending",
  amount: 1000,
  ...over,
});
/** คำขอ n ใบที่ยังมีผล (พนักงานยื่นเอง) */
const reqs = (n: number, over: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => req({ id: `a${i + 1}`, ...over }));

describe("advanceQuotaOfMonth — โควต้าจำนวนครั้ง/เดือน", () => {
  it("โควต้าเริ่มต้นมาจาก BUSINESS_RULES (ปัจจุบัน 3 ครั้ง/เดือน)", () => {
    expect(BUSINESS_RULES.ADVANCE_MAX_PER_MONTH).toBe(3);
    expect(advanceQuotaOfMonth([], YM).limit).toBe(3);
  });

  it("ยังไม่เคยยื่น → ยื่นได้", () => {
    const q = advanceQuotaOfMonth([], YM);
    expect(q).toMatchObject({ used: 0, left: 3, reachedLimit: false });
  });

  it("ยื่นครบ 3 ครั้ง → บล็อก · ครั้งที่ 1-2 ยังยื่นได้", () => {
    expect(advanceQuotaOfMonth(reqs(1), YM).reachedLimit).toBe(false);
    expect(advanceQuotaOfMonth(reqs(2), YM)).toMatchObject({
      used: 2,
      left: 1,
      reachedLimit: false,
    });
    expect(advanceQuotaOfMonth(reqs(3), YM)).toMatchObject({
      used: 3,
      left: 0,
      reachedLimit: true,
    });
  });

  it("อนุมัติแล้วก็ยังนับโควต้า (เคสที่หลุดจริง — approved ไม่บล็อก)", () => {
    const list = reqs(3, { status: "approved" });
    expect(advanceQuotaOfMonth(list, YM).reachedLimit).toBe(true);
  });

  it("ถูกปฏิเสธ → ไม่นับโควต้า ยื่นใหม่ได้", () => {
    const list = [...reqs(2), req({ id: "r", status: "rejected" })];
    expect(advanceQuotaOfMonth(list, YM)).toMatchObject({
      used: 2,
      reachedLimit: false,
    });
  });

  it("auto-carry ไม่นับโควต้า แต่ยังกินวงเงินยอดรวม", () => {
    const list = [
      req({ id: "carry", status: "approved", autoCarryFromMonth: "2026-05" }),
      ...reqs(3),
    ];
    expect(advanceQuotaOfMonth(list, YM).used).toBe(3);
    expect(userAdvancesOfMonth(list, YM)).toHaveLength(3);
    // ยอดรวมที่กินวงเงิน % รวม auto-carry ด้วย
    expect(activeAdvancesOfMonth(list, YM)).toHaveLength(4);
  });

  it("เดือนอื่นไม่นับรวม", () => {
    const list = [...reqs(3, { month: "2026-05" }), req({ id: "now" })];
    expect(advanceQuotaOfMonth(list, YM)).toMatchObject({
      used: 1,
      reachedLimit: false,
    });
  });

  it("ปรับ limit ต่อการเรียกได้ (เผื่อกฎเปลี่ยน/ต่อคนในอนาคต)", () => {
    expect(advanceQuotaOfMonth(reqs(1), YM, 1).reachedLimit).toBe(true);
    expect(advanceQuotaOfMonth(reqs(4), YM, 5).left).toBe(1);
  });

  it("ทนต่อข้อมูลไม่ครบ (list ว่าง/field หาย)", () => {
    expect(advanceQuotaOfMonth([{}], YM).used).toBe(0);
    expect(activeAdvancesOfMonth([{}], YM)).toHaveLength(0);
  });

  it("activeAdvancesOfMonth: rejected ไม่นับยอด · เดือนอื่นไม่นับ", () => {
    const list = [
      req({ id: "r", status: "rejected", amount: 5000 }),
      req({ id: "old", month: "2026-05", amount: 5000 }),
      req({ id: "ok", status: "approved", amount: 1500 }),
    ];
    const active = activeAdvancesOfMonth(list, YM);
    expect(active.map((a) => a.id)).toEqual(["ok"]);
    expect(active.reduce((s, a) => s + a.amount, 0)).toBe(1500);
  });
});
