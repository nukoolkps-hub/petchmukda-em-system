/* ─── ทะเบียนชุดข้อสอบ (มีหลายเวอร์ชัน) ────────────────────────────────
   **ใบที่สอบไปแล้วต้องถูกตรวจด้วยชุดที่ใช้จริงตอนนั้น ไม่ใช่ชุดปัจจุบัน**

   ถ้าอ่านจากชุดปัจจุบันเสมอ (แบบเดิม) การแก้ข้อสอบวันนี้จะทำให้ผลสอบเก่า
   เปลี่ยนย้อนหลังแบบเงียบๆ — เพิ่มข้อที่ 31 แล้วใบเก่ากลายเป็น "ตรวจไม่ครบ
   30/31" ทั้งหมด · ลดเกณฑ์ผ่านแล้วใบที่เคยตก กลายเป็นผ่าน · หลักเดียวกับที่
   สลิปเงินเดือนตรึง roleId/เรท/วันลาไว้ในเดือนนั้น

   `attempt.quizId` ถูกเขียนไว้ตั้งแต่ตอนกดเริ่มอยู่แล้ว ตรงนี้แค่ทำให้มัน
   ถูกใช้จริง

   ─── ชุดข้อสอบมาจากไหน ──────────────────────────────────────────────
   admin แก้เองได้ที่ `/admin → ฝึกอบรม → ตั้งค่าข้อสอบ` (เก็บที่ `quizSets/{id}`)
   ไฟล์ `basicExam.ts` เหลือหน้าที่เป็น **ชุดตั้งต้นที่ seed ลง Firestore
   ครั้งแรก + fallback ถาวร** ถ้า Firestore ว่าง/ต่อไม่ได้

   ร่าง → เผยแพร่: ชุด `draft` แก้ได้อิสระ · กดเผยแพร่แล้ว **ล็อกถาวร**
   (`firestore.rules` ไม่ให้ update ชุดที่ published) จะแก้ต้องทำสำเนาเป็น
   ชุดใหม่ · ใบที่สอบไปแล้วจึงอ่านโจทย์/เกณฑ์ของตัวเองได้ตลอดไป              */

import type { QuizSet } from "./basicExam";
import { BASIC_EXAM } from "./basicExam";

/** ชุดที่ฝังมากับโค้ด — **fallback ถาวร** ถ้า Firestore ว่าง/ต่อไม่ได้
 *  ระบบต้องเปิดข้อสอบได้เสมอ ไม่ใช่จอขาวเพราะโหลด config ไม่ทัน */
export const BUILT_IN_QUIZ_SETS: Record<string, QuizSet> = {
  [BASIC_EXAM.id]: BASIC_EXAM,
};

/** ชุดตั้งต้น — ใช้ seed ลง Firestore ครั้งแรก + fallback ตอนยังไม่มีชุดไหนถูกเลือก */
export const BUILT_IN_QUIZ: QuizSet = BASIC_EXAM;

/** ทะเบียนที่ใช้จริง = ชุดจาก Firestore ทับชุดที่ฝังมากับโค้ด
 *
 *  admin แก้ผ่านหน้า "ตั้งค่าข้อสอบ" → เก็บลง `quizSets/{id}` · ตัวที่ฝังมา
 *  กับโค้ดยังอยู่เป็นตาข่ายรองรับ ไม่ได้ถูกแทนที่ทิ้ง                        */
export function mergeQuizSets(
  remote: Record<string, QuizSet> | undefined | null,
): Record<string, QuizSet> {
  return { ...BUILT_IN_QUIZ_SETS, ...(remote ?? {}) };
}

/** ชุดนี้มีอยู่จริงไหม — ใช้เตือนบน UI ว่าใบนี้กำลังอ่านชุดผิดเวอร์ชัน */
export function isKnownQuizId(
  quizId: string | undefined | null,
  remote?: Record<string, QuizSet> | null,
): boolean {
  return !!quizId && quizId in mergeQuizSets(remote);
}

/** `attempt.quizId` → ชุดข้อสอบของใบนั้น
 *
 *  ไม่รู้จัก id (ใบเก่ามากที่ยังไม่มี `quizId` หรือชุดถูกลบไปแล้ว) → คืนชุด
 *  ที่ใช้อยู่ตอนนี้ไปก่อน เพื่อให้หน้าจอยังเปิดดูคำตอบได้ ไม่ใช่พังทั้งหน้า
 *  · คู่กับ `isKnownQuizId` ที่ UI ใช้ขึ้นคำเตือนว่าเลขที่เห็นเชื่อไม่ได้ */
export function resolveQuizSet(
  quizId: string | undefined | null,
  remote?: Record<string, QuizSet> | null,
  activeQuizId?: string | null,
): QuizSet {
  const all = mergeQuizSets(remote);
  return (
    (quizId && all[quizId]) || resolveActiveQuiz(remote, activeQuizId ?? null)
  );
}

/** ชุดที่จะใช้เมื่อกด "เริ่มทำข้อสอบ" ตอนนี้
 *
 *  `activeQuizId` มาจาก `/config/quizActive` ที่ admin กดเลือก · ชี้ไปชุดที่
 *  ไม่มีอยู่ (เผลอลบ/ยังไม่ seed) → ถอยมาใช้ชุดที่ฝังมากับโค้ด              */
export function resolveActiveQuiz(
  remote: Record<string, QuizSet> | undefined | null,
  activeQuizId: string | undefined | null,
): QuizSet {
  const all = mergeQuizSets(remote);
  return (activeQuizId && all[activeQuizId]) || BUILT_IN_QUIZ;
}
