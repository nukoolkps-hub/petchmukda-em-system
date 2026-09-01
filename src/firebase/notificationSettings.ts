/* ─── LINE Notification Settings ───────────────────────────────
   Admin toggle เปิด-ปิดการแจ้งเตือนรายประเภท เก็บใน `config/notifications`

   Default semantic: missing field / true → enabled.
   เฉพาะ `=== false` เท่านั้นที่ถือว่า disabled — กัน Cloud Functions
   ที่ deploy ใหม่ทำงานไม่ได้ก่อน admin จะกดเปิด/สร้าง config doc            */

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  type DailySummaryGroupConfig,
  normalizeDailySummaryGroups,
} from "../utils/dailySummaryGroups";
import { db, functions } from "./config";

export interface NotificationSettings {
  dailySummaryEnabled?: boolean;
  advanceRequestEnabled?: boolean;
  advanceApprovalEnabled?: boolean;
  /** แจ้งพนักงานเมื่อ admin สร้างเงินกู้ใหม่ (พร้อมสลิปการโอน ถ้ามี) */
  loanCreatedEnabled?: boolean;
  /** ตามแจ้ง 08:30 เฉพาะคนที่กดลาหลังสรุปเช้า (ไม่มีใคร = ไม่ส่ง) */
  lateLeaveNoticeEnabled?: boolean;
  /** กลุ่ม LINE ที่รับ "สรุปประจำวัน 07:30" — ADMIN ตั้งเองในหน้า LINE BOT
   *  · field หายไป = ยังไม่เคยตั้ง → Cloud Function ใช้ค่าเดิมในโค้ดแล้ว seed
   *  ให้ครั้งแรก · array ว่าง = ตั้งใจไม่ส่งเลย */
  dailySummaryGroups?: DailySummaryGroupConfig[];
  updatedAt?: unknown;
  updatedBy?: string;
}

const ref = doc(db, "config", "notifications");

export function subscribeNotificationSettings(
  onChange: (settings: NotificationSettings) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    ref,
    (snap) => {
      onChange((snap.data() as NotificationSettings) || {});
    },
    (err) => {
      console.error("[NotificationSettings] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
  updatedBy: string,
) {
  await setDoc(
    ref,
    { ...patch, updatedAt: serverTimestamp(), updatedBy },
    { merge: true },
  );
}

/** บันทึกรายชื่อกลุ่มที่รับสรุปเช้า — normalize ก่อนเขียนเสมอ (ตัด ID ผิด
 *  รูปแบบ/ซ้ำ) ให้ตรงกับที่ Cloud Function อ่าน                            */
export async function updateDailySummaryGroups(
  groups: DailySummaryGroupConfig[],
  updatedBy: string,
) {
  await updateNotificationSettings(
    { dailySummaryGroups: normalizeDailySummaryGroups(groups) },
    updatedBy,
  );
}

/** โหลด "กลุ่มเริ่มต้น" (ค่าที่ฝังไว้ในโค้ดฝั่ง Cloud Functions) ลง Firestore
 *  ทันที — ปกติ seed เกิดเองตอนสรุปเช้ารอบถัดไป ปุ่มนี้ให้ admin เห็นกลุ่ม
 *  จริงเลยโดยไม่ต้องรอ · idempotent (มีอยู่แล้วไม่ทับ)                     */
export async function seedDailySummaryGroupsNow(): Promise<number> {
  const fn = httpsCallable<undefined, { ok: boolean; count: number }>(
    functions,
    "seedDailySummaryGroupsNow",
  );
  const res = await fn();
  return res.data?.count ?? 0;
}
