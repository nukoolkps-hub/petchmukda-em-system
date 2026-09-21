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

/** ตัดส่วนต่อท้ายที่ระบบเคยเติมออก เหลือ "ชื่อฐาน"
 *
 *  จับทั้ง ` v<เลข>` ที่ใช้อยู่ตอนนี้ และ ` (สำเนา)` ของเดิม (ซ้อนกี่ชั้นก็ตัด)
 *  — ชุดที่ตั้งชื่อไว้ก่อนมีระบบเวอร์ชันจะได้กลับมาสะอาดตอนทำสำเนาครั้งถัดไป */
function baseQuizTitle(title: string): string {
  let base = title.trim();
  let prev = "";
  while (prev !== base) {
    prev = base;
    base = base
      .replace(/\s*\(สำเนา\)\s*$/u, "")
      .replace(/\s+v\d+\s*$/iu, "")
      .trim();
  }
  return base;
}

/** ชื่อชุดใหม่ตอนทำสำเนา — `ชื่อฐาน v<เลขถัดไป>`
 *
 *  **ไม่ต่อท้ายไปเรื่อยๆ** — ของเดิมใช้ `${title} (สำเนา)` ซึ่งทำสำเนาจาก
 *  สำเนาแล้วได้ "(สำเนา) (สำเนา) (สำเนา)" ยาวขึ้นทุกครั้งจนอ่านไม่ออก
 *  · ความยาวคงที่ · เรียงได้ว่าอันไหนใหม่กว่า · การ์ดโชว์วันที่/จำนวนข้อ
 *  อยู่แล้ว ชื่อจึงแค่ต้องแยกให้ออกก็พอ
 *
 *  นับจาก**เลขสูงสุดที่เคยใช้กับชื่อฐานเดียวกัน** ไม่ใช่จำนวนชุด — ลบชุด
 *  กลางๆ ทิ้งแล้วต้องไม่ได้ชื่อที่ชนของเดิม (เหตุผลเดียวกับ nextQuestionId)
 *  · ชื่อที่ยังไม่มี v = นับเป็น v1                                        */
export function nextQuizTitle(
  sourceTitle: string,
  existingTitles: string[],
): string {
  const base = baseQuizTitle(sourceTitle) || "ชุดข้อสอบ";
  const versionOf = (title: string): number => {
    const m = title.trim().match(/\sv(\d+)\s*$/i);
    return m ? Number(m[1]) : 1; // ไม่มี v = ตัวแรก
  };
  // เริ่มจากเวอร์ชันของตัวต้นทางเสมอ — ทำสำเนาจาก v3 ต้องไม่ได้ v2 กลับมา
  // แม้ลิสต์ที่ส่งมาจะยังไม่มีชุดนั้น (เช่น ชุดที่ฝังมากับโค้ด)
  let max = versionOf(sourceTitle);
  for (const title of existingTitles) {
    if (baseQuizTitle(title) !== base) continue;
    const n = versionOf(title);
    if (n > max) max = n;
  }
  return `${base} v${max + 1}`;
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

/** จำนวนใบสอบที่อ้างถึงแต่ละชุด — key = `attempt.quizId` */
export function countAttemptsByQuiz(
  attempts: { quizId: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of attempts) {
    if (!a.quizId) continue;
    counts[a.quizId] = (counts[a.quizId] ?? 0) + 1;
  }
  return counts;
}

export interface QuizSetDeletion {
  canDelete: boolean;
  /** เหตุผลที่ลบไม่ได้ — ว่างเมื่อลบได้ */
  reason: string;
}

/** ลบชุดนี้ได้ไหม — **ตัวเดียวกับที่ Cloud Function `deleteQuizSet` เช็คซ้ำ**
 *
 *  ชุดที่เผยแพร่แล้วถูกแช่แข็งไว้เพราะ `attempt.quizId` ชี้มาที่มัน · ลบทิ้ง
 *  แล้วหน้าตรวจจะอ่านโจทย์/เกณฑ์ของใบนั้นไม่ได้อีก (ตกไปใช้ชุดปัจจุบัน
 *  พร้อมกล่องแดงเตือน) — แต่ถ้า **ไม่มีใบไหนอ้างถึงเลย** ลบได้ ไม่มีอะไรเสีย
 *
 *  ฝั่ง client เช็คไว้เพื่อบอกเหตุผลก่อนกด · ตัวตัดสินจริงอยู่ที่ function
 *  (นับจาก Firestore ตรงๆ) — ลิสต์ฝั่ง client ค้างก็ยังลบผิดไม่ได้           */
export function quizSetDeletion(
  quizId: string,
  activeQuizId: string,
  attemptCount: number,
): QuizSetDeletion {
  if (activeQuizId && quizId === activeQuizId) {
    return {
      canDelete: false,
      reason: "ชุดนี้ใช้สอบอยู่ — เปลี่ยนไปใช้ชุดอื่นก่อนถึงจะลบได้",
    };
  }
  if (attemptCount > 0) {
    return {
      canDelete: false,
      reason: `มีใบสอบอ้างถึง ${attemptCount} ใบ — ลบแล้วใบพวกนั้นจะอ่านโจทย์เดิมไม่ได้`,
    };
  }
  return { canDelete: true, reason: "" };
}
