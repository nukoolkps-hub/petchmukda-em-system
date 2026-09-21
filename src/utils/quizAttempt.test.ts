/* ─── แบบทดสอบความรู้พื้นฐาน — เวลา + คะแนน ─────────────────────────
   invariant ที่ยึด:
   1. เวลาที่เหลือคำนวณจาก startedAt เสมอ — รีโหลด/ปิดแท็บแล้วกลับมาต้องได้
      เวลาเดิม ไม่ใช่เริ่มนับใหม่ (ถ้าพลาดตรงนี้ = ทุจริตได้ด้วยการรีเฟรช)
   2. หมดเวลาแล้วหมดเลย แม้ไม่มีใครเปิดหน้าอยู่
   3. คะแนนนับจากข้อหลักเท่านั้น — ความรู้รอบตัวไม่เข้าเกณฑ์ (ถ้านับรวม
      เกณฑ์ผ่านจะง่ายกว่าที่ห้างตั้งไว้)
   4. ตรวจไม่ครบ = ยังไม่ตัดสิน (null) ไม่ใช่ "ไม่ผ่าน"                    */

import { describe, expect, it } from "vitest";
import { BASIC_EXAM } from "../content/quiz/basicExam";
import {
  answeredCount,
  deadlineOf,
  formatCountdown,
  isAnswered,
  isExpired,
  remainingMs,
  scoreAttempt,
} from "./quizAttempt";

const START = Date.parse("2026-09-21T09:00:00+07:00");
const base = { startedAt: START, durationMinutes: 100, submittedAt: null };
const MIN = 60_000;

describe("นาฬิกาข้อสอบ", () => {
  it("เส้นตาย = เวลาเริ่ม + ระยะเวลา", () => {
    expect(deadlineOf(base)).toBe(START + 100 * MIN);
  });

  it("เหลือเวลาอิง startedAt — รีโหลดกลางคันได้เวลาเดิม ไม่เริ่มนับใหม่", () => {
    // ผ่านไป 30 นาที แล้วผู้ใช้รีเฟรช → ต้องเหลือ 70 ไม่ใช่ 100
    expect(remainingMs(base, START + 30 * MIN)).toBe(70 * MIN);
  });

  it("ไม่ติดลบ · เลยเส้นตายแล้วเหลือ 0", () => {
    expect(remainingMs(base, START + 500 * MIN)).toBe(0);
  });

  it("ส่งแล้วถือว่าเหลือ 0 แม้ยังไม่ถึงเส้นตาย", () => {
    const sent = { ...base, submittedAt: START + 10 * MIN };
    expect(remainingMs(sent, START + 20 * MIN)).toBe(0);
  });

  it("หมดเวลาแล้วหมดเลย แม้ไม่มีใครเปิดหน้าอยู่", () => {
    expect(isExpired(base, START + 99 * MIN)).toBe(false);
    expect(isExpired(base, START + 100 * MIN)).toBe(true);
    // ปิดแท็บทิ้งไว้ข้ามวันแล้วกลับมาเปิด
    expect(isExpired(base, START + 60 * 24 * MIN)).toBe(true);
  });

  it("ส่งแล้วไม่นับว่าหมดเวลา (จบด้วยการส่ง ไม่ใช่หมดเวลา)", () => {
    const sent = { ...base, submittedAt: START + 10 * MIN };
    expect(isExpired(sent, START + 500 * MIN)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("เกิน 1 ชม. โชว์ H:MM:SS · ต่ำกว่านั้น MM:SS", () => {
    expect(formatCountdown(100 * MIN)).toBe("1:40:00");
    expect(formatCountdown(59 * MIN)).toBe("59:00");
    expect(formatCountdown(65_000)).toBe("01:05");
  });

  it("ปัดขึ้นวินาที — 0.5 วิ ต้องยังไม่โชว์ 00:00", () => {
    expect(formatCountdown(500)).toBe("00:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });
});

describe("นับข้อที่ตอบแล้ว", () => {
  const answers = { m1: "คำตอบ", m2: "   ", m3: "" };

  it("ช่องว่าง/เว้นวรรคล้วน ไม่นับว่าตอบแล้ว", () => {
    expect(isAnswered(answers, "m1")).toBe(true);
    expect(isAnswered(answers, "m2")).toBe(false);
    expect(isAnswered(answers, "m3")).toBe(false);
    expect(isAnswered(answers, "m4")).toBe(false);
    expect(isAnswered(undefined, "m1")).toBe(false);
  });

  it("นับเฉพาะข้อที่ถาม", () => {
    expect(answeredCount(answers, ["m1", "m2", "m3", "m4"])).toBe(1);
  });
});

describe("scoreAttempt", () => {
  const quiz = { main: BASIC_EXAM.main, passPercent: 80 };
  const gradeAll = (correctCount: number) =>
    Object.fromEntries(BASIC_EXAM.main.map((q, i) => [q.id, i < correctCount]));

  it("ตรวจครบ 30 ข้อ ถูก 24 = 80% → ผ่านพอดี", () => {
    const s = scoreAttempt({ grades: gradeAll(24) }, quiz);
    expect(s).toMatchObject({ correct: 24, total: 30, graded: 30 });
    expect(s.percent).toBe(80);
    expect(s.passed).toBe(true);
  });

  it("ถูก 23 = 76.7% → ไม่ผ่าน (ต่ำกว่าเกณฑ์แม้นิดเดียว)", () => {
    const s = scoreAttempt({ grades: gradeAll(23) }, quiz);
    expect(s.percent).toBeCloseTo(76.7, 1);
    expect(s.passed).toBe(false);
  });

  it("ยังตรวจไม่ครบ → passed = null (ยังไม่ตัดสิน ไม่ใช่ตก)", () => {
    const partial = { m1: true, m2: true };
    const s = scoreAttempt({ grades: partial }, quiz);
    expect(s.graded).toBe(2);
    expect(s.passed).toBeNull();
  });

  it("ยังไม่ตรวจเลย → 0 ข้อ · passed = null", () => {
    const s = scoreAttempt({}, quiz);
    expect(s).toMatchObject({ correct: 0, graded: 0, passed: null });
  });

  it("ความรู้รอบตัวไม่เข้าเกณฑ์ — ตรวจผ่านหมดก็ไม่ดันคะแนนขึ้น", () => {
    const withGeneral = {
      ...gradeAll(24),
      ...Object.fromEntries(BASIC_EXAM.general.map((q) => [q.id, true])),
    };
    const s = scoreAttempt({ grades: withGeneral }, quiz);
    expect(s.total).toBe(30);
    expect(s.correct).toBe(24);
    expect(s.percent).toBe(80);
  });
});

describe("ชุดข้อสอบ BASIC_EXAM", () => {
  it("30 ข้อหลัก + 6 ข้อความรู้รอบตัว · 100 นาที · เกณฑ์ 80%", () => {
    expect(BASIC_EXAM.main).toHaveLength(30);
    expect(BASIC_EXAM.general).toHaveLength(6);
    expect(BASIC_EXAM.durationMinutes).toBe(100);
    expect(BASIC_EXAM.passPercent).toBe(80);
  });

  it("id ทุกข้อไม่ซ้ำ — id คือ key ของคำตอบใน Firestore", () => {
    const ids = [...BASIC_EXAM.main, ...BASIC_EXAM.general].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id ตรง pattern m1..m30 / g1..g6 (กันแทรกกลางแล้วเลื่อนเลข)", () => {
    expect(BASIC_EXAM.main.map((q) => q.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => `m${i + 1}`),
    );
    expect(BASIC_EXAM.general.map((q) => q.id)).toEqual(
      Array.from({ length: 6 }, (_, i) => `g${i + 1}`),
    );
  });

  it("ไม่มีข้อไหนข้อความว่าง", () => {
    for (const q of [...BASIC_EXAM.main, ...BASIC_EXAM.general]) {
      expect(q.text.trim().length).toBeGreaterThan(10);
    }
  });
});
