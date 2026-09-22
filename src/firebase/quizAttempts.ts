/* ─── Quiz attempts — การทำแบบทดสอบความรู้พื้นฐาน ────────────────────
   Collection: `quizAttempts/{attemptId}`

   **คำตอบถูกบันทึกระหว่างทำ ไม่ใช่ตอนกดส่ง** — ข้อสอบยาว 100 นาที ถ้าเก็บ
   ไว้ใน state อย่างเดียวแล้วเน็ตหลุด/แบตหมด/เผลอปิดแท็บ = เสียทั้งชุด
   `saveAnswers` จึง debounce เขียนลง Firestore ระหว่างพิมพ์ · เปิดใหม่แล้ว
   ทำต่อได้จากที่ค้างไว้ พร้อมเวลาที่เหลือถูกต้อง (นับจาก `startedAt`)

   **`startedAtServer` = serverTimestamp ที่ rules บังคับว่าต้องเท่า
   request.time** — `startedAt` มาจากนาฬิกาเครื่องผู้ใช้ ตั้งเป็นอนาคตแล้ว
   ยืดเวลาสอบเองได้ · ฝั่ง UI ใช้ `startedAt` นับถอยหลัง (ไม่ต้องรอ server
   ตอบกลับ) แต่ ADMIN เทียบ 2 ค่านี้ตอนตรวจได้ว่าตรงกันไหม

   **`uid` = เจ้าของ (auth uid) · `employeeId` = id ของ doc ใน `employees`**
   สองตัวนี้ไม่ใช่ตัวเดียวกัน — rules ตัดสินสิทธิ์จาก `uid` ส่วน `employeeId`
   มีไว้ให้ระบบอื่น join (เช่น ล้างข้อมูลรายคน ที่ค้นด้วย employee doc id)

   สิทธิ์ (firestore.rules):
   - สร้าง/แก้คำตอบ/ส่ง/ยกเลิก: เจ้าของ attempt เท่านั้น และเฉพาะตอนยังไม่ส่ง
   - ให้คะแนน (`grades`/`gradedAt`/`gradedBy`/`note`): admin เท่านั้น
   - อ่าน: เจ้าของ หรือ admin                                              */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { QuizSet } from "../content/quiz/basicExam";
import type {
  QuizAiGrade,
  QuizAttempt,
  QuizPriceSnapshot,
} from "../utils/quizAttempt";
import { db, functions } from "./config";

const col = collection(db, "quizAttempts");

function toAttempt(id: string, data: Record<string, unknown>): QuizAttempt {
  return {
    id,
    quizId: String(data.quizId ?? ""),
    uid: String(data.uid ?? ""),
    employeeId: String(data.employeeId ?? ""),
    employeeName: String(data.employeeName ?? ""),
    startedAt: Number(data.startedAt ?? 0),
    durationMinutes: Number(data.durationMinutes ?? 0),
    answers: (data.answers as Record<string, string>) ?? {},
    submittedAt: (data.submittedAt as number | null) ?? null,
    autoSubmitted: data.autoSubmitted === true,
    cancelledAt: (data.cancelledAt as number | null) ?? null,
    priceSnapshot: (data.priceSnapshot as QuizPriceSnapshot | null) ?? null,
    aiGrades: (data.aiGrades as Record<string, QuizAiGrade>) ?? {},
    aiGradedAt: (data.aiGradedAt as number | null) ?? null,
    aiGradeError: String(data.aiGradeError ?? ""),
    grades: (data.grades as Record<string, boolean>) ?? {},
    gradedAt: (data.gradedAt as number | null) ?? null,
    gradedBy: (data.gradedBy as string | null) ?? null,
    note: String(data.note ?? ""),
  };
}

function sortNewestFirst(attempts: QuizAttempt[]): QuizAttempt[] {
  return [...attempts].sort((a, b) => b.startedAt - a.startedAt);
}

/** ทุก attempt (admin — ใช้ในหน้าตรวจข้อสอบ) */
export function subscribeAllQuizAttempts(
  onChange: (attempts: QuizAttempt[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    query(col),
    (snap) => {
      onChange(
        sortNewestFirst(snap.docs.map((d) => toAttempt(d.id, d.data()))),
      );
    },
    (err) => {
      console.error("[quizAttempts] subscribe error:", err);
      onError?.(err);
    },
  );
}

/** attempt ของคนคนเดียว — พนักงานอ่านได้เฉพาะของตัวเอง (scoped query
 *  ต้องตรงกับ rules ไม่งั้น onSnapshot โดน permission-denied ทั้งก้อน
 *  · กรองด้วย `uid` ไม่ใช่ `employeeId` เพราะ rules ตัดสินจาก uid) */
export function subscribeMyQuizAttempts(
  uid: string,
  onChange: (attempts: QuizAttempt[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    query(col, where("uid", "==", uid)),
    (snap) => {
      onChange(
        sortNewestFirst(snap.docs.map((d) => toAttempt(d.id, d.data()))),
      );
    },
    (err) => {
      console.error("[quizAttempts] subscribe(mine) error:", err);
      onError?.(err);
    },
  );
}

/** เริ่มทำข้อสอบ — สร้าง doc พร้อมเวลาเริ่ม แล้วคืน id
 *
 *  เวลาเริ่มถูกตรึงตั้งแต่ตรงนี้ ไม่ใช่ตอน render → ปิดแท็บแล้วเปิดใหม่
 *  นาฬิกาเดินต่อจากเดิม ไม่ได้เวลาเพิ่ม                                    */
export async function startQuizAttempt(
  quiz: QuizSet,
  uid: string,
  employeeId: string,
  employeeName: string,
  priceSnapshot: QuizPriceSnapshot,
): Promise<string> {
  const ref = doc(col);
  await setDoc(ref, {
    quizId: quiz.id,
    uid,
    employeeId,
    employeeName,
    startedAt: Date.now(),
    startedAtServer: serverTimestamp(),
    durationMinutes: quiz.durationMinutes,
    answers: {},
    submittedAt: null,
    // ตรึงราคาไว้ตั้งแต่ตรงนี้ — ตรวจย้อนหลังต้องใช้ราคาของ "วันที่สอบ"
    // ไม่ใช่ราคาวันที่ตรวจ (ดู QuizPriceSnapshot)
    priceSnapshot,
  });
  return ref.id;
}

/** บันทึกคำตอบระหว่างทำ (เรียกแบบ debounce จาก UI) */
export async function saveQuizAnswers(
  attemptId: string,
  answers: Record<string, string>,
): Promise<void> {
  await updateDoc(doc(col, attemptId), { answers });
}

/** ส่งข้อสอบ — `auto` = หมดเวลาแล้วระบบส่งให้เอง ไม่ได้กดเอง
 *
 *  เขียน answers ไปด้วยเสมอ กันเคสที่ debounce ยังไม่ทันวิ่งตอนหมดเวลา
 *  (คำตอบที่พิมพ์ไว้วินาทีสุดท้ายต้องไม่หาย)                               */
export async function submitQuizAttempt(
  attemptId: string,
  answers: Record<string, string>,
  auto: boolean,
): Promise<void> {
  await updateDoc(doc(col, attemptId), {
    answers,
    submittedAt: Date.now(),
    submittedAtServer: serverTimestamp(),
    autoSubmitted: auto,
  });
}

/** ยกเลิกการทำข้อสอบกลางคัน — ชุดนี้ไม่นับเป็นผลสอบ + ทำต่อไม่ได้
 *
 *  **ไม่ลบ doc ทิ้ง** — ประวัติต้องเห็นว่าเคยเริ่มแล้วเลิก ไม่ใช่หายไปเฉยๆ
 *  เหมือนไม่เคยมีอะไรเกิดขึ้น (ข้อสอบใช้วัดคน ร่องรอยสำคัญ) · คำตอบที่พิมพ์
 *  ไว้ยังติดอยู่ใน doc ตามเดิม เผื่อต้องย้อนดู                              */
export async function cancelQuizAttempt(attemptId: string): Promise<void> {
  await updateDoc(doc(col, attemptId), {
    cancelledAt: Date.now(),
    cancelledAtServer: serverTimestamp(),
  });
}

/** ADMIN ลบใบสอบทิ้ง — **ลบแล้วไม่มีทางกู้คืน** (คำตอบ + ผลตรวจหายทั้งใบ)
 *
 *  ใช้ล้างใบที่ลองระบบ/เริ่มผิดคน · ต่างจาก "ยกเลิกการทำข้อสอบ" ที่ยัง
 *  เก็บ doc ไว้ให้เห็นว่าเคยเริ่มแล้วเลิก — อันนั้นคือประวัติ อันนี้คือลบจริง
 *
 *  ลบใบที่ยัง "กำลังทำ" ได้ด้วย (เครื่องผู้สอบจะเจอว่าใบหาย แล้วเด้งกลับไป
 *  หน้ากรอกชื่อเอง) — เป็นทางออกเวลามีใบค้างที่เจ้าตัวเข้าไม่ถึงแล้ว        */
export async function deleteQuizAttempt(attemptId: string): Promise<void> {
  await deleteDoc(doc(col, attemptId));
}

/** ADMIN ให้คะแนน — ผ่าน/ไม่ผ่านรายข้อ + โน้ต (ตรวจไม่ครบก็บันทึกได้
 *  ค้างไว้ตรวจต่อทีหลัง · `scoreAttempt` จะคืน passed=null จนกว่าจะครบ) */
export async function gradeQuizAttempt(
  attemptId: string,
  grades: Record<string, boolean>,
  note: string,
  gradedBy: string,
): Promise<void> {
  await updateDoc(doc(col, attemptId), {
    grades,
    note,
    gradedBy,
    gradedAt: Date.now(),
  });
}

/** ให้ AI ช่วยตรวจ — เรียก Cloud Function แล้วผลจะไหลกลับมาทาง onSnapshot
 *
 *  **เป็นแค่ข้อเสนอ** ผลลง `aiGrades` ซึ่งแยกจาก `grades` ที่ ADMIN กดเอง
 *  ADMIN ยังต้องกดตัดสินเองทุกข้อ — ระบบไม่เคยให้คะแนนแทน
 *
 *  `reference` = เนื้อหา "ความรู้ต่างๆ" ที่ฝั่ง client ประกอบให้ · ส่งจาก
 *  client เพราะ `src/content/knowledge` เป็นไฟล์ฝั่ง frontend (มี React icon)
 *  functions import ตรงไม่ได้ · ถ้า copy ไปไว้ฝั่ง functions จะกลายเป็น 2 ชุด
 *  ที่ drift หากันเงียบๆ — ส่งจากที่เดียวที่ render จริงปลอดภัยกว่า           */
export interface QuizGradingQuestion {
  id: string;
  text: string;
  /** นับคะแนนไหม — ความรู้รอบตัวส่งไปด้วยแต่ไม่เข้าเกณฑ์ผ่าน */
  scored: boolean;
}

export async function requestAiGrading(
  attemptId: string,
  reference: string,
  questions: QuizGradingQuestion[],
): Promise<{ graded: number }> {
  const call = httpsCallable<
    {
      attemptId: string;
      reference: string;
      questions: QuizGradingQuestion[];
    },
    { graded: number }
  >(functions, "gradeQuizWithAI");
  const res = await call({ attemptId, reference, questions });
  return res.data;
}
