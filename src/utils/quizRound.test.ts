/* ─── รอบสอบ (QR) ──────────────────────────────────────────────────────
   พังเงียบ: รอบเปิดค้าง = ใครก็เข้ามาเริ่มจับเวลาเล่นได้ตลอด โดยไม่ต้อง login
   invariant:
   1. ปิดเอง / หมดอายุ / ยังไม่เคยเปิด → เริ่มสอบไม่ได้ทั้งหมด
   2. รหัสรอบต้องไม่มีตัวที่อ่านสับสน (I O 0 1) เพราะต้องพิมพ์ตามจอได้
   3. ลิงก์ต้องมี `#` (HashRouter) ไม่งั้นสแกนแล้วเปิดไม่ติด               */

import { describe, expect, it } from "vitest";
import {
  EMPTY_QUIZ_ROUND,
  examLink,
  isRoundOpen,
  makeRoundCode,
  normalizeRoundCode,
  type QuizRound,
  roundRemainingMs,
} from "./quizRound";

const NOW = 1_700_000_000_000;

const round = (over: Partial<QuizRound> = {}): QuizRound => ({
  ...EMPTY_QUIZ_ROUND,
  code: "AB12CD",
  quizId: "basic-2569",
  quizTitle: "แบบทดสอบความรู้พื้นฐาน",
  openedAt: NOW - 60_000,
  openedBy: "admin",
  closesAt: NOW + 2 * 3_600_000,
  closedAt: null,
  ...over,
});

describe("isRoundOpen", () => {
  it("รอบที่เพิ่งเปิด = เปิดอยู่", () => {
    expect(isRoundOpen(round(), NOW)).toBe(true);
  });

  it("**ADMIN กดปิด = เริ่มใหม่ไม่ได้ทันที** แม้ยังไม่ถึงเวลาหมดอายุ", () => {
    expect(isRoundOpen(round({ closedAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("**หมดอายุแล้ว = เริ่มไม่ได้** (กันรอบเปิดค้างข้ามวัน)", () => {
    expect(isRoundOpen(round({ closesAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("ยังไม่เคยเปิดรอบ / ไม่มี doc → ไม่เปิด", () => {
    expect(isRoundOpen(EMPTY_QUIZ_ROUND, NOW)).toBe(false);
    expect(isRoundOpen(null, NOW)).toBe(false);
    expect(isRoundOpen(undefined, NOW)).toBe(false);
  });

  it("รอบที่ไม่มีชุดข้อสอบผูกไว้ = ใช้ไม่ได้ (ไม่รู้จะให้ทำชุดไหน)", () => {
    expect(isRoundOpen(round({ quizId: "" }), NOW)).toBe(false);
  });
});

describe("roundRemainingMs", () => {
  it("นับถอยหลังจนถึงเวลาปิด", () => {
    expect(roundRemainingMs(round({ closesAt: NOW + 90_000 }), NOW)).toBe(
      90_000,
    );
  });

  it("ปิดแล้ว/หมดแล้ว = 0 ไม่ติดลบ", () => {
    expect(roundRemainingMs(round({ closedAt: NOW }), NOW)).toBe(0);
    expect(roundRemainingMs(round({ closesAt: NOW - 5_000 }), NOW)).toBe(0);
  });
});

describe("makeRoundCode", () => {
  it("ยาว 6 ตัว", () => {
    expect(makeRoundCode(() => 0.5)).toHaveLength(6);
  });

  it("**ไม่มี I O 0 1** — ต้องอ่านจากจอแล้วพิมพ์ตามได้ไม่สับสน", () => {
    // ไล่ทุกตำแหน่งในชุดตัวอักษร
    for (let i = 0; i < 40; i += 1) {
      const code = makeRoundCode(() => i / 40);
      expect(code).not.toMatch(/[IO01]/);
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
    }
  });

  it("rand คืนค่าสูงสุด (0.999…) ต้องไม่หลุดออกนอกชุดตัวอักษร", () => {
    expect(makeRoundCode(() => 0.999999)).toMatch(/^[A-Z2-9]{6}$/);
  });
});

describe("normalizeRoundCode", () => {
  it("พิมพ์ตัวเล็ก/มีช่องว่าง ก็ต้องตรงกับรหัสเดิม", () => {
    expect(normalizeRoundCode(" ab 12cd ")).toBe("AB12CD");
  });
});

describe("examLink", () => {
  it("**มี `#` เสมอ** (HashRouter) + รหัสเป็นตัวใหญ่", () => {
    expect(examLink("https://petchmukda-bot.web.app", "ab12cd")).toBe(
      "https://petchmukda-bot.web.app/#/exam/AB12CD",
    );
  });

  it("origin ที่มี / ท้าย ต้องไม่ได้ `//`", () => {
    expect(examLink("https://x.app/", "AB12CD")).toBe(
      "https://x.app/#/exam/AB12CD",
    );
  });
});
