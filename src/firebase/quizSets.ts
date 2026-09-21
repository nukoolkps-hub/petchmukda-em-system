/* ─── ชุดข้อสอบที่ admin แก้เองได้ ─────────────────────────────────────
   Collection: `quizSets/{quizId}` · ตัวที่ใช้งานอยู่: `/config/quizActive`

   **ร่าง → เผยแพร่ → ล็อกถาวร**
   - `status: "draft"` แก้ได้อิสระ (ยังไม่มีใครสอบด้วยชุดนี้)
   - กดเผยแพร่ → `status: "published"` แล้ว `firestore.rules` ไม่ให้ update
     อีกเลย · จะแก้ต้อง "ทำสำเนาเป็นชุดใหม่"
   นี่คือสิ่งที่ทำให้ผลสอบเก่าไม่เปลี่ยนย้อนหลัง — ใบที่สอบไปแล้วอ้าง
   `attempt.quizId` ไปที่ชุดที่ถูกแช่แข็งไว้

   **ห้ามลบชุดที่เผยแพร่แล้ว** (rules บล็อกไว้) ตราบใดที่ยังมีใบสอบอ้างถึง
   ลบแล้วใบนั้นจะอ่านชุดผิดเวอร์ชัน · ชุดที่ไม่มีใบไหนอ้างถึงเลยลบได้ แต่ต้อง
   ผ่าน Cloud Function `deleteQuizSet` ที่นับใบสอบให้ก่อน (rules query ข้าม
   collection ไม่ได้ จึงเช็คในนี้ไม่ได้)                                    */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { QuizQuestion, QuizSet } from "../content/quiz/basicExam";
import type { EditableQuizSet } from "../utils/quizSetEdit";
import { db, functions } from "./config";

const COL = "quizSets";
const ACTIVE_PATH = "config/quizActive";

function toQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const q = r as { id?: unknown; text?: unknown };
      return { id: String(q.id ?? ""), text: String(q.text ?? "") };
    })
    .filter((q) => q.id.length > 0);
}

function toQuizSet(id: string, data: Record<string, unknown>): EditableQuizSet {
  return {
    id,
    title: String(data.title ?? ""),
    durationMinutes: Number(data.durationMinutes ?? 0),
    passPercent: Number(data.passPercent ?? 0),
    rules: Array.isArray(data.rules) ? data.rules.map(String) : [],
    main: toQuestions(data.main),
    general: toQuestions(data.general),
    status: data.status === "published" ? "published" : "draft",
    createdAt: Number(data.createdAt ?? 0),
    createdBy: String(data.createdBy ?? ""),
    publishedAt: (data.publishedAt as number | null) ?? null,
    publishedBy: (data.publishedBy as string | null) ?? null,
  };
}

/** ทุกชุดที่เก็บไว้ (ร่าง + เผยแพร่แล้ว) — เรียงใหม่→เก่า */
export function subscribeQuizSets(
  onChange: (sets: EditableQuizSet[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    collection(db, COL),
    (snap) => {
      const sets = snap.docs.map((d) => toQuizSet(d.id, d.data()));
      sets.sort((a, b) => b.createdAt - a.createdAt);
      onChange(sets);
    },
    (err) => {
      console.error("[quizSets] subscribe error:", err);
      onError?.(err);
    },
  );
}

/** id ของชุดที่กด "ใช้งาน" ไว้ — ว่าง = ยังไม่เคยตั้ง (ใช้ชุดที่ฝังมากับโค้ด) */
export function subscribeActiveQuizId(
  onChange: (quizId: string) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, ACTIVE_PATH),
    (snap) => onChange(String(snap.data()?.quizId ?? "")),
    (err) => {
      console.error("[quizSets] subscribe(active) error:", err);
      onError?.(err);
    },
  );
}

/** สร้างชุดใหม่เป็น "ร่าง" — เผยแพร่แล้วถึงจะเอาไปใช้สอบได้ */
export async function createQuizDraft(
  quiz: QuizSet,
  createdBy: string,
): Promise<void> {
  await setDoc(doc(db, COL, quiz.id), {
    title: quiz.title,
    durationMinutes: quiz.durationMinutes,
    passPercent: quiz.passPercent,
    rules: quiz.rules,
    main: quiz.main,
    general: quiz.general,
    status: "draft",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
    createdBy,
  });
}

/** บันทึกร่าง — rules ปฏิเสธถ้าชุดนี้ถูกเผยแพร่ไปแล้ว */
export async function saveQuizDraft(quiz: QuizSet): Promise<void> {
  await updateDoc(doc(db, COL, quiz.id), {
    title: quiz.title,
    durationMinutes: quiz.durationMinutes,
    passPercent: quiz.passPercent,
    rules: quiz.rules,
    main: quiz.main,
    general: quiz.general,
  });
}

/** เผยแพร่ + ตั้งเป็นชุดที่ใช้สอบ — **ทางเดียว ย้อนไม่ได้**
 *
 *  เขียน 2 doc แยกกัน (ไม่ใช่ transaction) เพราะถ้า publish สำเร็จแต่ตั้ง
 *  active ไม่สำเร็จ ผลคือ "มีชุดใหม่แต่ยังไม่ได้ใช้" ซึ่งปลอดภัยและกดซ้ำได้
 *  ตรงข้ามกับการ active ชุดที่ยังไม่ freeze ซึ่งเปิดช่องให้แก้ทีหลัง        */
export async function publishQuizSet(
  quizId: string,
  publishedBy: string,
): Promise<void> {
  await updateDoc(doc(db, COL, quizId), {
    status: "published",
    publishedAt: Date.now(),
    publishedAtServer: serverTimestamp(),
    publishedBy,
  });
  await setActiveQuizId(quizId, publishedBy);
}

/** เลือกชุดที่จะใช้สอบ (ต้องเป็นชุดที่เผยแพร่แล้ว — UI บังคับอีกชั้น) */
export async function setActiveQuizId(
  quizId: string,
  updatedBy: string,
): Promise<void> {
  await setDoc(doc(db, ACTIVE_PATH), {
    quizId,
    updatedAt: Date.now(),
    updatedBy,
  });
}

/** ลบร่างทิ้ง — rules ไม่ให้ลบชุดที่เผยแพร่แล้ว (ใบสอบอ้างถึงอยู่) */
export async function deleteQuizDraft(quizId: string): Promise<void> {
  await deleteDoc(doc(db, COL, quizId));
}

/** ลบชุดที่เผยแพร่แล้ว — ผ่าน Cloud Function เพราะต้องนับใบสอบก่อน
 *
 *  function จะปฏิเสธถ้าชุดนี้ยังใช้สอบอยู่ หรือมี `quizAttempts` ใบไหน
 *  อ้างถึง · UI เช็คด้วย `quizSetDeletion` ไว้อีกชั้นเพื่อบอกเหตุผลก่อนกด
 *  แต่คำตัดสินจริงอยู่ที่ฝั่ง server ซึ่งนับจาก Firestore ตรงๆ             */
export async function deletePublishedQuizSet(quizId: string): Promise<void> {
  const call = httpsCallable<{ quizId: string }, { deleted: boolean }>(
    functions,
    "deleteQuizSet",
  );
  await call({ quizId });
}
