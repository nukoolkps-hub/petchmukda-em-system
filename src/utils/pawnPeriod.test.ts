import { describe, expect, it } from "vitest";
import { pawnPeriod } from "./pawnPeriod";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("pawnPeriod — นับวันที่เริ่มจำนำเป็นวันแรก", () => {
  it("เคสจริง: 10 พ.ย. → 25 พ.ย. = 16 วัน (ไม่ใช่ 15)", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 25))).toEqual({
      months: 0,
      days: 16,
    });
  });

  it("จำนำแล้วไถ่วันเดียวกัน = 1 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 10))).toEqual({
      months: 0,
      days: 1,
    });
  });

  it("10 พ.ย. → 9 ธ.ค. = 1 เดือนเต็มพอดี · 10 ธ.ค. = 1 เดือน 1 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 9))).toEqual({
      months: 1,
      days: 0,
    });
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 10))).toEqual({
      months: 1,
      days: 1,
    });
  });

  it("ข้ามปี: 15 ธ.ค. 2026 → 27 ก.พ. 2027 = 2 เดือน 13 วัน", () => {
    expect(pawnPeriod(d(2026, 12, 15), d(2027, 2, 27))).toEqual({
      months: 2,
      days: 13,
    });
  });

  it("เริ่มวันที่ 1 → สิ้นเดือน = 1 เดือนเต็ม", () => {
    expect(pawnPeriod(d(2026, 2, 1), d(2026, 2, 28))).toEqual({
      months: 1,
      days: 0,
    });
  });

  it("31 ม.ค. → เดือนที่ไม่มีวันที่ 31 ใช้วันสุดท้ายของเดือน (ไม่พัง)", () => {
    const r = pawnPeriod(d(2026, 1, 31), d(2026, 3, 5));
    expect(r).not.toBeNull();
    expect(r?.months).toBe(1);
    expect(r?.days).toBeGreaterThan(0);
  });

  it("วันสิ้นสุดอยู่ก่อนวันเริ่ม → null", () => {
    expect(pawnPeriod(d(2026, 11, 25), d(2026, 11, 10))).toBeNull();
  });
});
