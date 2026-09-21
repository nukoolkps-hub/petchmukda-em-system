/* ─── แก้ชุดข้อสอบ — logic ล้วน (ไม่แตะ Firebase/React) ────────────────
   ใช้โดยหน้า "ตั้งค่าข้อสอบ" · แยกออกมาเพราะกฎพวกนี้พังแล้วเจ็บ:
   ผิดที่ `id` ทีเดียว คำตอบของคนที่สอบไปแล้วไปโผล่ผิดข้อทั้งชุด            */

import type { QuizQuestion, QuizSet } from "../content/quiz/basicExam";

/** สถานะของชุด — `published` แล้วแก้ไม่ได้อีก (firestore.rules บังคับ) */
export type QuizSetStatus = "draft" | "published";

export interface EditableQuizSet extends QuizSet {
  status: QuizSetStatus;
  createdAt: number;
  createdBy: string;
  publishedAt?: number | null;
  publishedBy?: string | null;
}

/** id ถัดไปของกลุ่มนั้น — ไล่จากเลขสูงสุดที่เคยใช้ **ไม่ใช่จำนวนข้อ**
 *
 *  ถ้าใช้ `items.length + 1` แล้วมีคนลบข้อกลางๆ ออกไป id จะชนของเดิมทันที
 *  (ลบ m15 เหลือ 29 ข้อ → ข้อใหม่ได้ m30 ซึ่งมีอยู่แล้ว) · คำตอบสองข้อจะ
 *  เขียนทับกันใน Firestore โดยไม่มีอะไรฟ้อง                                */
export function nextQuestionId(items: QuizQuestion[], prefix: string): string {
  let max = 0;
  for (const q of items) {
    if (!q.id.startsWith(prefix)) continue;
    const n = Number(q.id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

/** ย้ายข้อขึ้น/ลง — คืน array ใหม่ (นอกช่วง = คืนตัวเดิม ไม่ throw) */
export function moveQuestion<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface QuizSetProblem {
  field: string;
  message: string;
}

/** เช็คก่อนเผยแพร่ — เผยแพร่แล้วแก้ไม่ได้อีก ต้องจับให้ครบตรงนี้
 *
 *  คืน array ว่าง = ผ่าน · ไม่ throw เพื่อให้ UI โชว์ได้ทุกข้อพร้อมกัน
 *  ไม่ใช่เด้งทีละอัน                                                       */
export function validateQuizSet(quiz: {
  title: string;
  durationMinutes: number;
  passPercent: number;
  main: QuizQuestion[];
  general: QuizQuestion[];
}): QuizSetProblem[] {
  const problems: QuizSetProblem[] = [];

  if (!quiz.title.trim()) {
    problems.push({ field: "title", message: "ต้องตั้งชื่อชุดข้อสอบ" });
  }
  if (!Number.isFinite(quiz.durationMinutes) || quiz.durationMinutes < 1) {
    problems.push({
      field: "durationMinutes",
      message: "เวลาทำข้อสอบต้องมากกว่า 0 นาที",
    });
  }
  if (
    !Number.isFinite(quiz.passPercent) ||
    quiz.passPercent < 1 ||
    quiz.passPercent > 100
  ) {
    problems.push({
      field: "passPercent",
      message: "เกณฑ์ผ่านต้องอยู่ระหว่าง 1-100%",
    });
  }
  if (quiz.main.length === 0) {
    problems.push({ field: "main", message: "ต้องมีข้อสอบอย่างน้อย 1 ข้อ" });
  }

  const all = [...quiz.main, ...quiz.general];
  for (const q of all) {
    if (!q.text.trim()) {
      problems.push({ field: q.id, message: `ข้อ ${q.id} ยังไม่มีโจทย์` });
    }
  }

  // id ซ้ำ = คำตอบสองข้อเขียนทับกันใน Firestore · ต้องกันตั้งแต่ก่อนเผยแพร่
  const seen = new Set<string>();
  for (const q of all) {
    if (seen.has(q.id)) {
      problems.push({ field: q.id, message: `id "${q.id}" ซ้ำ` });
    }
    seen.add(q.id);
  }

  return problems;
}

/** ทำสำเนาชุดที่เผยแพร่แล้วเป็นร่างใหม่ — **คง `question.id` เดิมไว้ทุกข้อ**
 *
 *  ชุดใหม่มี id ของตัวเอง ใบเก่าจึงยังผูกกับชุดเก่าอยู่ · id ของข้อที่ซ้ำกัน
 *  ข้ามชุดไม่เป็นปัญหา เพราะการอ่านคำตอบวิ่งผ่าน `attempt.quizId` เสมอ     */
export function duplicateAsDraft(
  source: QuizSet,
  newId: string,
  newTitle: string,
): QuizSet {
  return {
    id: newId,
    title: newTitle,
    durationMinutes: source.durationMinutes,
    passPercent: source.passPercent,
    rules: [...source.rules],
    main: source.main.map((q) => ({ ...q })),
    general: source.general.map((q) => ({ ...q })),
  };
}

/** id ของชุดใหม่จากชื่อที่ตั้ง — ตัวพิมพ์เล็ก ขีดกลาง กัน id ชนของเดิม
 *
 *  ภาษาไทยใช้เป็น doc id ได้ แต่เจอใน URL/log แล้วอ่านยาก → ถ้าชื่อไม่มี
 *  อักขระ ASCII ที่ใช้ได้เลย ให้ตกไปใช้ `quiz-<เวลา>` แทน                   */
export function makeQuizSetId(title: string, now: number): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `${slug}-${now}` : `quiz-${now}`;
}
