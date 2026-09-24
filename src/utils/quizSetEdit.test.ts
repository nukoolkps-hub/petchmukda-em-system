/* ─── แก้ชุดข้อสอบผ่านหน้า "ตั้งค่าข้อสอบ" ─────────────────────────────
   พังเงียบ: id ของข้อคือ key ของคำตอบใน Firestore — ชนกันเมื่อไหร่ คำตอบ
   สองข้อเขียนทับกันโดยไม่มี error · เผยแพร่ไปแล้วย้อนไม่ได้

   invariant:
   1. id ใหม่ต้องไล่จากเลขสูงสุดที่เคยใช้ ไม่ใช่จำนวนข้อ (ลบข้อกลางแล้วต้องไม่ชน)
   2. เผยแพร่ไม่ได้ถ้ายังมีข้อว่าง / id ซ้ำ / เวลาหรือเกณฑ์ไม่สมเหตุสมผล
   3. ทำสำเนาต้องคง id ของข้อไว้ครบ (ชุดใหม่มี id ชุดของตัวเอง)            */

import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "../content/quiz/basicExam";
import {
  countAttemptsByQuiz,
  duplicateAsDraft,
  makeQuizSetId,
  moveQuestion,
  nextQuestionId,
  nextQuizTitle,
  quizSetDeletion,
  sanitizeQuizTitle,
  validateQuizSet,
} from "./quizSetEdit";

const q = (id: string, text = "โจทย์"): QuizQuestion => ({ id, text });

describe("nextQuestionId", () => {
  it("ไล่จากเลขสูงสุดที่เคยใช้", () => {
    expect(nextQuestionId([q("m1"), q("m2"), q("m3")], "m")).toBe("m4");
  });

  it("**ลบข้อกลางออกแล้วต้องไม่ชนของเดิม** (เคสที่ length+1 จะพัง)", () => {
    // ลบ m2 ทิ้ง เหลือ 2 ข้อ — ถ้าใช้ length+1 จะได้ m3 ซึ่งมีอยู่แล้ว
    const afterDelete = [q("m1"), q("m3")];
    expect(nextQuestionId(afterDelete, "m")).toBe("m4");
  });

  it("ว่างเปล่า → เริ่มที่ 1", () => {
    expect(nextQuestionId([], "m")).toBe("m1");
    expect(nextQuestionId([], "g")).toBe("g1");
  });

  it("นับเฉพาะ prefix ของตัวเอง — ข้อหลักกับความรู้รอบตัวไม่กวนกัน", () => {
    const mixed = [q("m1"), q("m9"), q("g1"), q("g2")];
    expect(nextQuestionId(mixed, "m")).toBe("m10");
    expect(nextQuestionId(mixed, "g")).toBe("g3");
  });

  it("id ที่ไม่ใช่รูปแบบตัวเลขไม่ทำให้พัง", () => {
    expect(nextQuestionId([q("m1"), q("mABC"), q("m5")], "m")).toBe("m6");
  });
});

describe("moveQuestion", () => {
  const items = ["a", "b", "c", "d"];

  it("ย้ายขึ้น/ลงได้", () => {
    expect(moveQuestion(items, 2, 0)).toEqual(["c", "a", "b", "d"]);
    expect(moveQuestion(items, 0, 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("ที่เดิม/นอกช่วง = คืนตัวเดิม ไม่พัง", () => {
    expect(moveQuestion(items, 1, 1)).toBe(items);
    expect(moveQuestion(items, -1, 2)).toBe(items);
    expect(moveQuestion(items, 0, 9)).toBe(items);
  });

  it("ไม่แก้ array เดิม", () => {
    const copy = [...items];
    moveQuestion(items, 0, 2);
    expect(items).toEqual(copy);
  });
});

describe("validateQuizSet", () => {
  const ok = {
    title: "แบบทดสอบความรู้พื้นฐาน",
    durationMinutes: 100,
    passPercent: 80,
    main: [q("m1")],
    general: [q("g1")],
  };

  it("ชุดที่ถูกต้อง = ไม่มีปัญหา", () => {
    expect(validateQuizSet(ok)).toEqual([]);
  });

  it("จับข้อที่ยังไม่มีโจทย์", () => {
    const problems = validateQuizSet({ ...ok, main: [q("m1", "  ")] });
    expect(problems.map((p) => p.field)).toContain("m1");
  });

  it("**จับ id ซ้ำ** — ปล่อยไปคำตอบสองข้อจะเขียนทับกัน", () => {
    const problems = validateQuizSet({
      ...ok,
      main: [q("m1"), q("m1", "อีกข้อ")],
    });
    expect(problems.some((p) => p.message.includes("ซ้ำ"))).toBe(true);
  });

  it("id ซ้ำข้ามกลุ่ม (ข้อหลัก ↔ ความรู้รอบตัว) ก็ต้องจับ", () => {
    const problems = validateQuizSet({
      ...ok,
      main: [q("x1")],
      general: [q("x1")],
    });
    expect(problems.some((p) => p.message.includes("ซ้ำ"))).toBe(true);
  });

  it("เวลา / เกณฑ์ผ่าน / ชื่อ ที่ไม่สมเหตุสมผล", () => {
    const fields = (o: Partial<typeof ok>) =>
      validateQuizSet({ ...ok, ...o }).map((p) => p.field);
    expect(fields({ durationMinutes: 0 })).toContain("durationMinutes");
    expect(fields({ passPercent: 0 })).toContain("passPercent");
    expect(fields({ passPercent: 101 })).toContain("passPercent");
    expect(fields({ title: "   " })).toContain("title");
    expect(fields({ main: [] })).toContain("main");
  });

  it("คืนทุกปัญหาพร้อมกัน ไม่หยุดที่อันแรก", () => {
    const problems = validateQuizSet({
      title: "",
      durationMinutes: 0,
      passPercent: 0,
      main: [],
      general: [],
    });
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});

describe("duplicateAsDraft", () => {
  const source = {
    id: "basic-2569",
    title: "ชุดเก่า",
    durationMinutes: 100,
    passPercent: 80,
    rules: ["กติกา 1"],
    main: [q("m1"), q("m2")],
    general: [q("g1")],
  };

  it("คง id ของข้อไว้ครบ · เปลี่ยนแค่ id/ชื่อของชุด", () => {
    const copy = duplicateAsDraft(source, "basic-2570", "ชุดใหม่");
    expect(copy.id).toBe("basic-2570");
    expect(copy.title).toBe("ชุดใหม่");
    expect(copy.main.map((x) => x.id)).toEqual(["m1", "m2"]);
    expect(copy.general.map((x) => x.id)).toEqual(["g1"]);
    expect(copy.durationMinutes).toBe(100);
    expect(copy.passPercent).toBe(80);
  });

  it("แก้สำเนาแล้วต้องไม่กระทบชุดต้นฉบับ (deep copy)", () => {
    const copy = duplicateAsDraft(source, "x", "x");
    copy.main[0].text = "เปลี่ยนแล้ว";
    copy.rules.push("กติกาใหม่");
    expect(source.main[0].text).toBe("โจทย์");
    expect(source.rules).toHaveLength(1);
  });
});

describe("makeQuizSetId", () => {
  const NOW = 1_700_000_000_000;

  it("ชื่ออังกฤษ → slug + เวลา (ไม่ชนของเดิม)", () => {
    expect(makeQuizSetId("Basic Exam 2570", NOW)).toBe(
      `basic-exam-2570-${NOW}`,
    );
  });

  it("ชื่อไทยล้วน → ตกไปใช้รูปแบบกลาง (อ่านใน log ได้)", () => {
    expect(makeQuizSetId("แบบทดสอบความรู้พื้นฐาน", NOW)).toBe(`quiz-${NOW}`);
  });

  it("ชื่อว่าง/อักขระพิเศษล้วน ก็ยังได้ id ที่ใช้ได้", () => {
    expect(makeQuizSetId("   ", NOW)).toBe(`quiz-${NOW}`);
    expect(makeQuizSetId("!!! ???", NOW)).toBe(`quiz-${NOW}`);
  });
});

describe("nextQuizTitle — ชื่อชุดตอนทำสำเนา", () => {
  const NAME = "แบบทดสอบความรู้พื้นฐาน";

  it("สำเนาแรกได้ v2 (ตัวต้นฉบับนับเป็น v1)", () => {
    expect(nextQuizTitle(NAME, [NAME])).toBe(`${NAME} v2`);
  });

  it("**ทำสำเนาซ้ำๆ ชื่อต้องไม่ยาวขึ้น** — ปัญหาเดิมของ (สำเนา)", () => {
    const v2 = nextQuizTitle(NAME, [NAME]);
    const v3 = nextQuizTitle(v2, [NAME, v2]);
    const v4 = nextQuizTitle(v3, [NAME, v2, v3]);
    expect(v3).toBe(`${NAME} v3`);
    expect(v4).toBe(`${NAME} v4`);
    // ความยาวโตแค่ตามจำนวนหลักของเลข ไม่ใช่ตามจำนวนครั้ง
    expect(v4.length).toBe(`${NAME} v4`.length);
  });

  it("ชื่อเก่าที่ติด (สำเนา) มาแล้วต้องถูกล้างให้สะอาด", () => {
    expect(nextQuizTitle(`${NAME} (สำเนา) (สำเนา)`, [])).toBe(`${NAME} v2`);
  });

  it("นับจากเลขสูงสุด ไม่ใช่จำนวนชุด — ลบชุดกลางทิ้งแล้วต้องไม่ชน", () => {
    // เหลือแค่ v1 กับ v5 (v2-v4 ถูกลบ) → ตัวถัดไปต้องเป็น v6 ไม่ใช่ v3
    expect(nextQuizTitle(NAME, [NAME, `${NAME} v5`])).toBe(`${NAME} v6`);
  });

  it("ชื่อฐานคนละอันไม่กวนเลขกัน", () => {
    const other = "แบบทดสอบพนักงานใหม่";
    expect(nextQuizTitle(other, [NAME, `${NAME} v7`, other])).toBe(
      `${other} v2`,
    );
  });

  it("ชื่อว่างก็ยังได้ชื่อที่ใช้ได้", () => {
    expect(nextQuizTitle("   ", [])).toBe("ชุดข้อสอบ v2");
  });
});

describe("ลบชุดข้อสอบเก่า", () => {
  const attempt = (quizId: string) => ({ quizId });

  it("นับใบสอบต่อชุด · ใบที่ไม่มี quizId ไม่นับ", () => {
    const counts = countAttemptsByQuiz([
      attempt("a"),
      attempt("b"),
      attempt("a"),
      attempt(""),
    ]);
    expect(counts).toEqual({ a: 2, b: 1 });
  });

  it("ชุดที่ไม่มีใบสอบอ้างถึงเลย = ลบได้", () => {
    expect(quizSetDeletion("old", "active", 0)).toEqual({
      canDelete: true,
      reason: "",
    });
  });

  it("**มีใบสอบอ้างถึง = ลบไม่ได้** — ลบแล้วใบนั้นอ่านโจทย์เดิมไม่ได้", () => {
    const d = quizSetDeletion("old", "active", 3);
    expect(d.canDelete).toBe(false);
    expect(d.reason).toContain("3");
  });

  it("ชุดที่ใช้สอบอยู่ = ลบไม่ได้ แม้ยังไม่มีใครสอบ", () => {
    const d = quizSetDeletion("active", "active", 0);
    expect(d.canDelete).toBe(false);
    expect(d.reason).toContain("ใช้สอบอยู่");
  });

  it("ยังไม่ได้ตั้งชุดที่ใช้สอบ (ใช้ชุดตั้งต้นในโค้ด) — id ว่างต้องไม่ล็อกทุกชุด", () => {
    expect(quizSetDeletion("", "", 0).canDelete).toBe(true);
    expect(quizSetDeletion("old", "", 0).canDelete).toBe(true);
  });
});

describe("sanitizeQuizTitle — เปลี่ยนชื่อชุด", () => {
  it("ตัดช่องว่างหัว-ท้าย + ยุบช่องว่างซ้อน", () => {
    expect(sanitizeQuizTitle("  ชุด   A  ")).toBe("ชุด A");
  });

  it("**ชื่อที่ยุบช่องว่างแล้วต้องนับเป็นชื่อฐานเดียวกันตอนทำสำเนา**", () => {
    const messy = sanitizeQuizTitle("แบบทดสอบ  พื้นฐาน");
    expect(nextQuizTitle(messy, [messy])).toBe("แบบทดสอบ พื้นฐาน v2");
  });

  it("ว่าง/มีแต่ช่องว่าง → คืนค่าว่าง (UI ต้องบล็อกไม่ให้บันทึก)", () => {
    expect(sanitizeQuizTitle("   ")).toBe("");
    expect(sanitizeQuizTitle("")).toBe("");
  });

  it("ยาวเกินไปถูกตัด — การ์ดในหน้า admin ต้องยังอ่านออก", () => {
    expect(sanitizeQuizTitle("ก".repeat(200))).toHaveLength(80);
  });
});
