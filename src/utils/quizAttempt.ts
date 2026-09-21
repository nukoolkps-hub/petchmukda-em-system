/* ─── Quiz attempt — logic ล้วน (ไม่แตะ Firebase/React) ─────────────────
   เวลาและคะแนนอยู่ที่นี่ที่เดียว · UI แค่เรียกใช้

   **นาฬิกายึด `startedAt` ที่เก็บไว้ ไม่ใช่ตัวนับใน React** — ถ้านับถอยหลัง
   ด้วย state แล้วผู้ใช้ปิดจอ/รีเฟรช/สลับแท็บ (มือถือ throttle timer) เวลาจะ
   เดินไม่ตรงหรือรีเซ็ต · คำนวณจาก "เวลาเริ่ม + ระยะเวลา − ตอนนี้" ทุกครั้ง
   แทน → รีโหลดกลางคันก็ได้เวลาที่เหลือถูกต้องเสมอ

   หมดเวลา = หมดจริง ไม่ต้องรอ UI มากด — `isExpired` ตัดสินจากเวลา ดังนั้น
   คนที่ปิดแท็บทิ้งไว้ข้ามวันกลับมาเปิด จะเจอสถานะ "หมดเวลา" ทันที          */

import type { QuizSet } from "../content/quiz/basicExam";

export interface QuizAttempt {
  id: string;
  quizId: string;
  /** auth uid (LINE user id) — เจ้าของชุดนี้ · เป็นตัวที่ firestore.rules ใช้
   *  ตัดสินสิทธิ์ ต้องเท่ากับ `request.auth.uid` เสมอ */
  uid: string;
  /** id ของ doc ใน `employees` — ใช้ join กับระบบอื่น (เช่น ล้างข้อมูลรายคน)
   *  · ว่างได้ถ้าคนที่ทำไม่มี employee doc (เช่น ADMIN เปล่าๆ) */
  employeeId: string;
  employeeName: string;
  /** epoch ms ตอนกด "เริ่มทำข้อสอบ" */
  startedAt: number;
  durationMinutes: number;
  /** questionId → คำตอบ (ข้อที่ยังไม่ตอบจะไม่มี key) */
  answers: Record<string, string>;
  /** epoch ms ตอนส่ง · null = ยังทำอยู่ */
  submittedAt: number | null;
  /** ส่งเพราะหมดเวลา (ไม่ได้กดส่งเอง) */
  autoSubmitted?: boolean;

  /* ── ADMIN ตรวจทีหลัง (อัตนัยล้วน ระบบตรวจเองไม่ได้) ── */
  /** questionId → ผ่าน/ไม่ผ่าน · เฉพาะข้อหลัก · ข้อที่ยังไม่ตรวจไม่มี key */
  grades?: Record<string, boolean>;
  gradedAt?: number | null;
  gradedBy?: string | null;
  note?: string;
}

/** เวลาที่ข้อสอบชุดนี้ "ควรจะ" หมด (epoch ms) */
export function deadlineOf(attempt: {
  startedAt: number;
  durationMinutes: number;
}): number {
  return attempt.startedAt + attempt.durationMinutes * 60_000;
}

/** เหลือเวลาอีกกี่ ms (ไม่ติดลบ) — ส่งแล้วถือว่าเหลือ 0 */
export function remainingMs(
  attempt: Pick<QuizAttempt, "startedAt" | "durationMinutes" | "submittedAt">,
  now: number,
): number {
  if (attempt.submittedAt) return 0;
  return Math.max(0, deadlineOf(attempt) - now);
}

/** หมดเวลาแล้วไหม (ยังไม่ส่ง แต่เลยเส้นตาย) */
export function isExpired(
  attempt: Pick<QuizAttempt, "startedAt" | "durationMinutes" | "submittedAt">,
  now: number,
): boolean {
  return !attempt.submittedAt && now >= deadlineOf(attempt);
}

/** ms → "MM:SS" หรือ "H:MM:SS" เมื่อเกิน 1 ชม. (ปัดขึ้นวินาที ไม่ให้ค้าง 0:00) */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** ตอบข้อนี้แล้วไหม — ช่องว่าง/เว้นวรรคล้วนไม่นับ */
export function isAnswered(
  answers: Record<string, string> | undefined,
  questionId: string,
): boolean {
  return (answers?.[questionId] ?? "").trim().length > 0;
}

/** นับข้อที่ตอบแล้ว (ใช้โชว์ความคืบหน้าตอนทำข้อสอบ) */
export function answeredCount(
  answers: Record<string, string> | undefined,
  questionIds: string[],
): number {
  return questionIds.filter((id) => isAnswered(answers, id)).length;
}

export interface QuizScore {
  /** จำนวนข้อหลักที่ ADMIN กดผ่าน */
  correct: number;
  /** จำนวนข้อหลักทั้งหมด */
  total: number;
  /** จำนวนข้อหลักที่ตรวจแล้ว (ผ่าน + ไม่ผ่าน) */
  graded: number;
  /** % ของข้อหลัก (ปัดทศนิยม 1 ตำแหน่ง) */
  percent: number;
  /** ผ่านเกณฑ์ไหม — `null` ถ้ายังตรวจไม่ครบ (ตัดสินก่อนไม่ได้) */
  passed: boolean | null;
}

/** คะแนนจากผลตรวจของ ADMIN
 *
 *  **นับจาก `quiz.main` เท่านั้น** — ความรู้รอบตัวไม่เข้าเกณฑ์ตามกติกาใน
 *  ต้นฉบับ · ถ้าเผลอนับรวมจะได้เกณฑ์ผ่านที่ง่ายกว่าที่ห้างตั้งไว้
 *
 *  ยังตรวจไม่ครบ → `passed: null` ไม่ใช่ `false` · UI ต้องแยก "ยังไม่ตัดสิน"
 *  ออกจาก "ไม่ผ่าน" ไม่งั้นคนที่เพิ่งส่งจะขึ้นว่าตกทันที                   */
export function scoreAttempt(
  attempt: Pick<QuizAttempt, "grades">,
  quiz: Pick<QuizSet, "main" | "passPercent">,
): QuizScore {
  const grades = attempt.grades ?? {};
  const total = quiz.main.length;
  let correct = 0;
  let graded = 0;
  for (const q of quiz.main) {
    const g = grades[q.id];
    if (typeof g !== "boolean") continue;
    graded += 1;
    if (g) correct += 1;
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
  return {
    correct,
    total,
    graded,
    percent,
    passed: graded < total ? null : percent >= quiz.passPercent,
  };
}
