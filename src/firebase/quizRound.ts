/* ─── รอบสอบ (QR) — `/config/quizRound` ────────────────────────────────
   ADMIN เปิด/ปิดรอบจากหน้า "แบบทดสอบ" · มีรอบเดียวในระบบ (เปิดใหม่ = ทับเก่า)

   **คนทำข้อสอบไม่ได้อ่าน doc นี้** — เขาไม่ได้ login จึงอ่าน Firestore ไม่ได้
   เลย · ตัวที่เช็คว่ารอบเปิดอยู่จริงคือ Cloud Function `quizGuestJoin`
   ที่อ่านด้วย Admin SDK · ฝั่งนี้มีไว้ให้ ADMIN เห็นสถานะ/กดปิด            */

import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import {
  EMPTY_QUIZ_ROUND,
  makeRoundCode,
  type QuizRound,
} from "../utils/quizRound";
import { db } from "./config";

const PATH = "config/quizRound";

export function subscribeQuizRound(
  onChange: (round: QuizRound) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, PATH),
    (snap) => {
      const d = (snap.data() ?? {}) as Partial<QuizRound>;
      onChange({
        code: String(d.code ?? ""),
        quizId: String(d.quizId ?? ""),
        quizTitle: String(d.quizTitle ?? ""),
        openedAt: Number(d.openedAt ?? 0),
        openedBy: String(d.openedBy ?? ""),
        closesAt: Number(d.closesAt ?? 0),
        closedAt: (d.closedAt as number | null) ?? null,
      });
    },
    (err) => {
      console.error("[quizRound] subscribe error:", err);
      onError?.(err);
      onChange(EMPTY_QUIZ_ROUND);
    },
  );
}

/** เปิดรอบใหม่ — ตรึง `quizId` ไว้กับรอบ
 *
 *  ถ้าปล่อยให้รอบอ่าน "ชุดที่ใช้สอบตอนนี้" ตอนที่คนสแกน การสลับชุดกลางรอบ
 *  จะทำให้คนที่สแกนทีหลังได้คนละชุดกับคนที่สแกนก่อนในรอบเดียวกัน           */
export async function openQuizRound(params: {
  quizId: string;
  quizTitle: string;
  hours: number;
  openedBy: string;
}): Promise<QuizRound> {
  const now = Date.now();
  const round: QuizRound = {
    code: makeRoundCode(),
    quizId: params.quizId,
    quizTitle: params.quizTitle,
    openedAt: now,
    openedBy: params.openedBy,
    closesAt: now + params.hours * 3_600_000,
    closedAt: null,
  };
  await setDoc(doc(db, PATH), round);
  return round;
}

/** ปิดรอบทันที — คนที่เริ่มไปแล้วยังทำต่อจนหมดเวลาของใบตัวเองได้
 *  (นาฬิกาของใบสอบอิง `startedAt` ของใบนั้น ไม่ใช่ของรอบ) */
export async function closeQuizRound(): Promise<void> {
  await updateDoc(doc(db, PATH), { closedAt: Date.now() });
}
