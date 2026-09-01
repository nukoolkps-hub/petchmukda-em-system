/* ─── เพดานยอดในหนังสือรับรองเงินเดือน ──────────────────────────────
   invariant: กฎนี้ถูกบังคับ 3 ที่ (UI · พิมพ์ HTML · build PDF) ทั้งหมดเรียก
   `clampCertSalary` ตัวเดียวกัน → ใบที่ออกมาต้องตรงกับที่กล่องใน UI บอกเสมอ

   เอกสารนี้ใช้ยื่นกู้/สมัครงาน — เพดานคือสิ่งที่กันไม่ให้ยอดหลุดไปไกลจากจริง
   จึงต้องมีเทสต์คุมทุกขอบ                                                   */

import { describe, expect, it } from "vitest";
import { BUSINESS_RULES } from "../constants";
import {
  certSalaryCeiling,
  clampCertSalary,
  exceedsCertCeiling,
} from "./certSalary";

const BASE = 20000;
const CEIL = 26000; // 20,000 × 1.3

describe("certSalaryCeiling", () => {
  it("เพดาน = เงินเดือนพื้นฐาน + 30%", () => {
    expect(BUSINESS_RULES.CERT_MAX_OVER_BASE).toBe(0.3);
    expect(certSalaryCeiling(BASE)).toBe(CEIL);
    expect(certSalaryCeiling(17500)).toBe(22750);
  });

  it("ปัดเป็นจำนวนเต็ม (ไม่มีเศษสตางค์ในใบรับรอง)", () => {
    expect(certSalaryCeiling(12345)).toBe(16049); // 16048.5 → 16049
    expect(Number.isInteger(certSalaryCeiling(9999))).toBe(true);
  });

  it("ไม่มีข้อมูลเงินเดือน → 0 (ไม่ใช่ NaN)", () => {
    expect(certSalaryCeiling(0)).toBe(0);
    expect(certSalaryCeiling(-5)).toBe(0);
    expect(certSalaryCeiling(Number.NaN)).toBe(0);
  });
});

describe("clampCertSalary", () => {
  it("ไม่ระบุ → ใช้เงินเดือนพื้นฐานปัจจุบัน (พฤติกรรมเดิม)", () => {
    expect(clampCertSalary(undefined, BASE)).toBe(BASE);
    expect(clampCertSalary(0, BASE)).toBe(BASE);
    expect(clampCertSalary(null, BASE)).toBe(BASE);
    expect(clampCertSalary(-1, BASE)).toBe(BASE);
    expect(clampCertSalary("ไม่ใช่ตัวเลข", BASE)).toBe(BASE);
  });

  it("ระบุต่ำกว่าจริง → ได้ตามที่ระบุ (ไม่มีขั้นต่ำ)", () => {
    expect(clampCertSalary(15000, BASE)).toBe(15000);
    expect(clampCertSalary(1, BASE)).toBe(1);
  });

  it("ระบุสูงกว่าพื้นฐานแต่ไม่เกินเพดาน → ได้ตามที่ระบุ", () => {
    expect(clampCertSalary(23000, BASE)).toBe(23000);
    expect(clampCertSalary(CEIL, BASE)).toBe(CEIL);
  });

  it("ระบุเกินเพดาน → ถูกตัดลงมาที่เพดาน ไม่ใช่ค่าที่ขอ", () => {
    expect(clampCertSalary(CEIL + 1, BASE)).toBe(CEIL);
    expect(clampCertSalary(999_999, BASE)).toBe(CEIL);
  });

  it("ไม่มีเงินเดือนพื้นฐาน → ระบุอะไรก็ได้ 0 (กันสร้างใบจากอากาศ)", () => {
    expect(clampCertSalary(50000, 0)).toBe(0);
  });
});

describe("exceedsCertCeiling — ใช้ขึ้นเตือนสีแดงใน UI", () => {
  it("เตือนเฉพาะตอนเกินเพดานจริงๆ", () => {
    expect(exceedsCertCeiling(CEIL, BASE)).toBe(false);
    expect(exceedsCertCeiling(CEIL + 1, BASE)).toBe(true);
  });

  it("สูงกว่าเงินเดือนพื้นฐานแต่ยังไม่เกินเพดาน → ไม่เตือน", () => {
    expect(exceedsCertCeiling(BASE + 1, BASE)).toBe(false);
  });

  it("ช่องว่าง / ค่าพัง → ไม่เตือน (ยังไม่ได้พิมพ์อะไร)", () => {
    expect(exceedsCertCeiling(Number.NaN, BASE)).toBe(false);
    expect(exceedsCertCeiling(0, BASE)).toBe(false);
  });
});

describe("invariant: ยอดที่พิมพ์ไม่มีทางเกินเพดาน", () => {
  it("สุ่มยอดขอ 1,000 ค่า — clamp ต้องอยู่ในเพดานเสมอ", () => {
    for (let i = 0; i < 1000; i++) {
      const base = Math.round(Math.random() * 100_000);
      const asked = Math.round(Math.random() * 500_000);
      const printed = clampCertSalary(asked, base);
      expect(printed).toBeLessThanOrEqual(certSalaryCeiling(base));
      expect(printed).toBeGreaterThanOrEqual(0);
    }
  });
});
