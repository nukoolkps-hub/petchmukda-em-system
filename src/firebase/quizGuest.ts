/* ─── ทำข้อสอบผ่าน QR โดยไม่ต้อง login — client ของ callable 3 ตัว ────
   ทุกการอ่าน/เขียนของผู้สอบวิ่งผ่าน Cloud Function (Admin SDK) ไม่แตะ
   Firestore ตรงๆ เลย เพราะเครื่องนี้ไม่มี auth user — ดู
   `functions/src/quiz/guestExam.ts` ว่าทำไมถึงไม่เปิด rules ให้แทน

   **`attemptId` + `token` = บัตรผ่านของใบสอบใบนั้น** เก็บใน localStorage
   ของเครื่องผู้สอบ → รีเฟรช/เน็ตหลุด/ปิดแท็บแล้วเปิดใหม่ ทำต่อได้ที่เดิม
   พร้อมเวลาที่เหลือถูกต้อง (นับจาก `startedAt` ที่ server ตรึงไว้)         */

import { httpsCallable } from "firebase/functions";
import type { QuizSet } from "../content/quiz/basicExam";
import type { QuizPriceSnapshot } from "../utils/quizAttempt";
import { functions } from "./config";

export interface GuestExamState {
  attemptId: string;
  startedAt: number;
  durationMinutes: number;
  submittedAt: number | null;
  cancelledAt: number | null;
  autoSubmitted: boolean;
  answers: Record<string, string>;
  employeeName: string;
  priceSnapshot: QuizPriceSnapshot | null;
  /** เวลาฝั่ง server ตอนตอบกลับ — ใช้ชดเชยนาฬิกาเครื่องที่ตั้งเพี้ยน */
  serverNow: number;
  quiz?: QuizSet;
}

export interface GuestJoinResult extends GuestExamState {
  token: string;
}

/** เก็บบัตรผ่านไว้ในเครื่อง — key ผูกกับ attempt ตัวเดียว (ทำทีละใบอยู่แล้ว) */
const STORE_KEY = "petchmukda-guest-exam";

export interface GuestTicket {
  attemptId: string;
  token: string;
}

export function loadGuestTicket(): GuestTicket | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<GuestTicket>;
    if (!t.attemptId || !t.token) return null;
    return { attemptId: t.attemptId, token: t.token };
  } catch {
    return null;
  }
}

export function saveGuestTicket(ticket: GuestTicket): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ticket));
  } catch {
    // โหมดส่วนตัว/ปิด storage → ทำข้อสอบต่อได้ แต่รีเฟรชแล้วกลับมาไม่ได้
    // (ไม่ใช่เหตุให้เริ่มสอบไม่ได้ จึงกลืน error ไว้)
  }
}

export function clearGuestTicket(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ไม่มีอะไรต้องทำ */
  }
}

export interface GuestRoundInfo {
  open: boolean;
  /** เหตุผลที่เริ่มไม่ได้ (ว่าง = เริ่มได้) */
  reason: string;
  quizTitle: string;
  rules: string[];
  durationMinutes: number;
  mainCount: number;
  generalCount: number;
}

/** เช็ครหัสจาก QR + ดึงกติกามาโชว์ก่อนกดเริ่ม — **ยังไม่เริ่มจับเวลา** */
export async function fetchGuestRoundInfo(
  code: string,
): Promise<GuestRoundInfo> {
  const call = httpsCallable<{ code: string }, GuestRoundInfo>(
    functions,
    "quizGuestInfo",
  );
  const res = await call({ code });
  return res.data;
}

/** เข้าร่วมรอบสอบ + เริ่มจับเวลา (server เป็นคนตรึงเวลาเริ่ม) */
export async function joinQuizRound(
  code: string,
  name: string,
): Promise<GuestJoinResult> {
  const call = httpsCallable<{ code: string; name: string }, GuestJoinResult>(
    functions,
    "quizGuestJoin",
  );
  const res = await call({ code, name });
  return res.data;
}

export interface GuestSyncInput {
  answers?: Record<string, string>;
  submit?: boolean;
  cancel?: boolean;
  /** ขอโจทย์กลับมาด้วย — ใช้ตอนเปิดหน้าใหม่แล้วทำต่อ */
  includeQuiz?: boolean;
}

/** บันทึกคำตอบ / ส่ง / ยกเลิก / ดึงสถานะกลับมาทำต่อ */
export async function syncGuestExam(
  ticket: GuestTicket,
  input: GuestSyncInput = {},
): Promise<GuestExamState & { expired: boolean }> {
  const call = httpsCallable<
    GuestSyncInput & GuestTicket,
    GuestExamState & { expired: boolean }
  >(functions, "quizGuestSync");
  const res = await call({ ...ticket, ...input });
  return res.data;
}
