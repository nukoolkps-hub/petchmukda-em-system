import { describe, expect, it } from "vitest";
import { pawnPeriod } from "./pawnPeriod";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("pawnPeriod — เดือนเต็มแบบเดิม · วันเศษนับวันเริ่มด้วย", () => {
  it("เคสจริง: 10 พ.ย. → 25 พ.ย. = 16 วัน (ไม่ใช่ 15)", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 25))).toEqual({
      months: 0,
      days: 16,
    });
  });

  it("เดือนเต็มนับแบบเดิม: 10 พ.ย. → 10 ธ.ค. = 1 เดือน 0 วัน (ครบพอดีไม่บวก)", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 10))).toEqual({
      months: 1,
      days: 0,
    });
  });

  it("มีทั้งเดือนและวันเศษ: 10 พ.ย. → 25 ธ.ค. = 1 เดือน 16 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 25))).toEqual({
      months: 1,
      days: 16,
    });
  });

  it("ก่อนครบเดือน 1 วัน: 10 พ.ย. → 9 ธ.ค. = 0 เดือน 30 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 9))).toEqual({
      months: 0,
      days: 30,
    });
  });

  it("จำนำแล้วไถ่วันเดียวกัน = 1 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 10))).toEqual({
      months: 0,
      days: 1,
    });
  });

  it("ข้ามปี: 15 ธ.ค. 2026 → 27 ก.พ. 2027 = 2 เดือน 13 วัน", () => {
    expect(pawnPeriod(d(2026, 12, 15), d(2027, 2, 27))).toEqual({
      months: 2,
      days: 13,
    });
  });

  it("31 ม.ค. → 5 มี.ค. — เดือนปลายทางไม่มีวันที่ 31 ใช้วันสุดท้าย", () => {
    // ครบ 1 เดือน = 28 ก.พ. · วันเศษ 28 ก.พ.→5 มี.ค. = 5 + นับวันเริ่ม = 6
    expect(pawnPeriod(d(2026, 1, 31), d(2026, 3, 5))).toEqual({
      months: 1,
      days: 6,
    });
  });

  it("วันสิ้นสุดอยู่ก่อนวันเริ่ม → null", () => {
    expect(pawnPeriod(d(2026, 11, 25), d(2026, 11, 10))).toBeNull();
  });
});
