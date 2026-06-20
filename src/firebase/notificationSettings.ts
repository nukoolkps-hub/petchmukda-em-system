/* ─── LINE Notification Settings ───────────────────────────────
   Admin toggle เปิด-ปิดการแจ้งเตือนรายประเภท เก็บใน `config/notifications`

   Default semantic: missing field / true → enabled.
   เฉพาะ `=== false` เท่านั้นที่ถือว่า disabled — กัน Cloud Functions
   ที่ deploy ใหม่ทำงานไม่ได้ก่อน admin จะกดเปิด/สร้าง config doc            */

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface NotificationSettings {
  dailySummaryEnabled?: boolean;
  advanceRequestEnabled?: boolean;
  advanceApprovalEnabled?: boolean;
  /** แจ้งพนักงานเมื่อ admin สร้างเงินกู้ใหม่ (พร้อมสลิปการโอน ถ้ามี) */
  loanCreatedEnabled?: boolean;
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
