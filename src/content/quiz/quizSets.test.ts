/* ─── ทะเบียนชุดข้อสอบ (หลายเวอร์ชัน) ──────────────────────────────────
   พังเงียบ: ถ้าใบเก่าถูกตรวจด้วยชุดปัจจุบัน การออกข้อสอบชุดใหม่จะทำให้
   ผลสอบที่เก็บไว้เปลี่ยนย้อนหลัง โดยไม่มี error อะไรให้เห็น — รู้ตัวอีกที
   คือประวัติการสอบทั้งชุดเชื่อไม่ได้แล้ว

   invariant:
   1. ใบไหนอ้าง quizId ไหน ต้องได้ชุดนั้น
   2. ออกชุดใหม่ (ข้อเยอะขึ้น/เกณฑ์ต่างไป) ต้องไม่กระทบคะแนนของใบเก่า
   3. id ที่ไม่รู้จัก → ไม่พัง แต่ต้องบอกได้ว่าไม่รู้จัก (isKnownQuizId)
   4. ทุกชุดในทะเบียนต้องมี key ตรงกับ id ของตัวเอง                       */

import { describe, expect, it } from "vitest";
import { scoreAttempt } from "../../utils/quizAttempt";
import type { QuizSet } from "./basicExam";
import { BASIC_EXAM } from "./basicExam";
import {
  BUILT_IN_QUIZ,
  BUILT_IN_QUIZ_SETS,
  isKnownQuizId,
  mergeQuizSets,
  resolveActiveQuiz,
  resolveQuizSet,
} from "./index";

/** ชุดสมมติของ "ปีหน้า" — 31 ข้อ เกณฑ์ 90% (ต่างจากของจริงทั้งคู่) */
const NEXT_YEAR: QuizSet = {
  ...BASIC_EXAM,
  id: "basic-2570",
  durationMinutes: 120,
  passPercent: 90,
  main: [...BASIC_EXAM.main, { id: "m31", text: "ข้อใหม่ของปีหน้า" }],
};

describe("ทะเบียนชุดข้อสอบ", () => {
  it("key ของชุดที่ฝังมากับโค้ดต้องตรงกับ id ของชุดนั้น (ไม่งั้น lookup หลุด)", () => {
    for (const [key, quiz] of Object.entries(BUILT_IN_QUIZ_SETS)) {
      expect(quiz.id).toBe(key);
    }
  });

  it("ชุดตั้งต้นต้องอยู่ในทะเบียนที่ฝังมาด้วย", () => {
    expect(BUILT_IN_QUIZ_SETS[BUILT_IN_QUIZ.id]).toBe(BUILT_IN_QUIZ);
  });

  it("resolveQuizSet คืนชุดตาม quizId", () => {
    expect(resolveQuizSet(BASIC_EXAM.id)).toBe(BASIC_EXAM);
  });

  it("id ที่ไม่รู้จัก/ว่าง → ไม่พัง คืนชุดที่ใช้อยู่ แต่บอกได้ว่าไม่รู้จัก", () => {
    expect(resolveQuizSet("ไม่มีชุดนี้")).toBe(BUILT_IN_QUIZ);
    expect(resolveQuizSet(undefined)).toBe(BUILT_IN_QUIZ);
    expect(resolveQuizSet("")).toBe(BUILT_IN_QUIZ);

    expect(isKnownQuizId(BASIC_EXAM.id)).toBe(true);
    expect(isKnownQuizId("ไม่มีชุดนี้")).toBe(false);
    expect(isKnownQuizId(undefined)).toBe(false);
    expect(isKnownQuizId("")).toBe(false);
  });
});

describe("ชุดจาก Firestore (หน้าตั้งค่าข้อสอบ)", () => {
  const remote = { [NEXT_YEAR.id]: NEXT_YEAR };

  it("ชุดจาก Firestore เข้ามาอยู่ในทะเบียนร่วมกับชุดที่ฝังมากับโค้ด", () => {
    const all = mergeQuizSets(remote);
    expect(all[BASIC_EXAM.id]).toBe(BASIC_EXAM);
    expect(all[NEXT_YEAR.id]).toBe(NEXT_YEAR);
  });

  it("ใบเก่ายังอ่านชุดของตัวเองได้ แม้ admin จะออกชุดใหม่ไปแล้ว", () => {
    expect(resolveQuizSet(BASIC_EXAM.id, remote, NEXT_YEAR.id)).toBe(
      BASIC_EXAM,
    );
  });

  it("ชุดที่กด 'ใช้งาน' คือตัวที่ได้ตอนกดเริ่มสอบ", () => {
    expect(resolveActiveQuiz(remote, NEXT_YEAR.id)).toBe(NEXT_YEAR);
  });

  it("Firestore ว่าง/ต่อไม่ได้ → ยังเปิดข้อสอบได้ด้วยชุดที่ฝังมากับโค้ด", () => {
    expect(resolveActiveQuiz(null, null)).toBe(BUILT_IN_QUIZ);
    expect(resolveActiveQuiz({}, "")).toBe(BUILT_IN_QUIZ);
    expect(mergeQuizSets(null)[BASIC_EXAM.id]).toBe(BASIC_EXAM);
  });

  it("ชี้ไปชุดที่ถูกลบไปแล้ว → ถอยมาใช้ชุดที่ฝังมา ไม่ใช่ undefined", () => {
    expect(resolveActiveQuiz(remote, "ชุดที่ลบไปแล้ว")).toBe(BUILT_IN_QUIZ);
  });

  it("ชุดใน Firestore ที่ id ชนกับชุดที่ฝังมา → ของ Firestore ชนะ (admin แก้ทับได้)", () => {
    const override = { ...BASIC_EXAM, title: "แก้จากหน้า admin" };
    const all = mergeQuizSets({ [BASIC_EXAM.id]: override });
    expect(all[BASIC_EXAM.id].title).toBe("แก้จากหน้า admin");
  });
});

describe("ออกชุดใหม่แล้วใบเก่าต้องไม่เปลี่ยน", () => {
  // ใบเก่า: ตรวจครบ 30 ข้อของชุด 2569 · ผ่าน 24 ข้อ = 80% พอดี
  const oldAttempt = {
    grades: Object.fromEntries(
      BASIC_EXAM.main.map((q, i) => [q.id, i < 24]),
    ) as Record<string, boolean>,
  };

  it("ใบเก่าคิดด้วยชุดเก่า = ตรวจครบ + ผ่าน", () => {
    const score = scoreAttempt(oldAttempt, BASIC_EXAM);
    expect(score.total).toBe(30);
    expect(score.graded).toBe(30);
    expect(score.percent).toBe(80);
    expect(score.passed).toBe(true);
  });

  it("ถ้าเผลอคิดด้วยชุดใหม่ ใบเก่าจะกลายเป็น 'ตรวจไม่ครบ' — นี่คือสิ่งที่กันอยู่", () => {
    const wrong = scoreAttempt(oldAttempt, NEXT_YEAR);
    expect(wrong.total).toBe(31);
    expect(wrong.graded).toBe(30);
    expect(wrong.passed).toBeNull(); // ผลผ่าน/ไม่ผ่านหายไปเฉยๆ
  });

  it("เกณฑ์ผ่านที่ต่างกันต้องไม่ย้อนไปพลิกผลใบเก่า", () => {
    // ชุดใหม่ใช้เกณฑ์ 90% — ใบเก่าที่ได้ 80% จะตกทันทีถ้าใช้เกณฑ์ผิดชุด
    const sameCount = scoreAttempt(oldAttempt, {
      main: BASIC_EXAM.main,
      passPercent: NEXT_YEAR.passPercent,
    });
    expect(sameCount.passed).toBe(false);
    // แต่คิดด้วยชุดของตัวเอง ยังผ่านเหมือนเดิม
    expect(scoreAttempt(oldAttempt, BASIC_EXAM).passed).toBe(true);
  });

  it("lookup ด้วย quizId ของใบเก่าได้ชุดเก่าเสมอ แม้มีชุดใหม่ในทะเบียน", () => {
    const registry: Record<string, QuizSet> = {
      [BASIC_EXAM.id]: BASIC_EXAM,
      [NEXT_YEAR.id]: NEXT_YEAR,
    };
    const pick = (id: string) => registry[id] ?? NEXT_YEAR;

    expect(pick(BASIC_EXAM.id).main).toHaveLength(30);
    expect(pick(BASIC_EXAM.id).passPercent).toBe(80);
    expect(pick(NEXT_YEAR.id).main).toHaveLength(31);
    expect(pick(NEXT_YEAR.id).passPercent).toBe(90);
  });
});
