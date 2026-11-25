import { describe, expect, it } from "vitest";
import { pawnPeriod } from "./pawnPeriod";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("pawnPeriod — นับวันที่ผ่านไป ไม่นับวันเริ่มจำนำ (แบบธนาคาร)", () => {
  it("เคสหลัก: จำนำวันที่ 9 ไถ่วันที่ 10 = 1 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 9), d(2026, 11, 10))).toEqual({
      months: 0,
      days: 1,
    });
  });

  it("10 พ.ย. → 25 พ.ย. = 15 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 25))).toEqual({
      months: 0,
      days: 15,
    });
  });

  it("ครบเดือนพอดี: 10 พ.ย. → 10 ธ.ค. = 1 เดือน 0 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 10))).toEqual({
      months: 1,
      days: 0,
    });
  });

  it("มีทั้งเดือนและวันเศษ: 10 พ.ย. → 25 ธ.ค. = 1 เดือน 15 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 25))).toEqual({
      months: 1,
      days: 15,
    });
  });

  it("ก่อนครบเดือน 1 วัน: 10 พ.ย. → 9 ธ.ค. = 0 เดือน 29 วัน", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 12, 9))).toEqual({
      months: 0,
      days: 29,
    });
  });

  it("จำนำแล้วไถ่วันเดียวกัน = 1 วัน (ข้อยกเว้น)", () => {
    expect(pawnPeriod(d(2026, 11, 10), d(2026, 11, 10))).toEqual({
      months: 0,
      days: 1,
    });
  });

  it("ข้ามปี: 15 ธ.ค. 2026 → 27 ก.พ. 2027 = 2 เดือน 12 วัน", () => {
    expect(pawnPeriod(d(2026, 12, 15), d(2027, 2, 27))).toEqual({
      months: 2,
      days: 12,
    });
  });

  it("31 ม.ค. → 5 มี.ค. — เดือนปลายทางไม่มีวันที่ 31 ใช้วันสุดท้าย", () => {
    // ครบ 1 เดือน = 28 ก.พ. · 28 ก.พ. → 5 มี.ค. ผ่านไป 5 วัน
    expect(pawnPeriod(d(2026, 1, 31), d(2026, 3, 5))).toEqual({
      months: 1,
      days: 5,
    });
  });

  it("วันสิ้นสุดอยู่ก่อนวันเริ่ม → null", () => {
    expect(pawnPeriod(d(2026, 11, 25), d(2026, 11, 10))).toBeNull();
  });
});
