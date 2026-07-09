/* ─── Daily Summary Images ──────────────────────────────────────
   รูปที่ admin อัปโหลด + ตั้งวันส่ง เพื่อแนบไปกับสรุปประจำวัน 07:30
   (กลุ่ม we r mukda) · ส่งครั้งเดียวในวันที่กำหนด

   Collection: `dailySummaryImages/{id}`
   - imageUrl : Firebase Storage download URL
   - date     : "YYYY-MM-DD" (Bangkok) วันที่ต้องการส่ง
   - note     : ป้ายกำกับให้ admin (ไม่ส่งเข้า LINE)
   - sentAt   : ISO timestamp เมื่อ Cloud Function ส่งจริงแล้ว (undefined = ยังไม่ส่ง)
   - createdAt/createdBy

   อ่าน/เขียน: admin เท่านั้น (firestore.rules) · Cloud Function ส่งผ่าน Admin SDK */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./config";
import { uploadDailySummaryImage } from "./storage";

export interface DailySummaryImage {
  id: string;
  imageUrl: string;
  date: string;
  note?: string | null;
  sentAt?: string | null;
  createdAt?: number;
  createdBy?: string;
}

const col = collection(db, "dailySummaryImages");

export function subscribeDailySummaryImages(
  onChange: (images: DailySummaryImage[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    query(col),
    (snap) => {
      const images = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<DailySummaryImage, "id">),
      }));
      // เรียงตามวันส่ง (ใกล้สุดก่อน) → เวลาสร้าง
      images.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.createdAt ?? 0) - (b.createdAt ?? 0),
      );
      onChange(images);
    },
    (err) => {
      console.error("[dailySummaryImages] subscribe error:", err);
      onError?.(err);
    },
  );
}

/** สร้างรายการรูปใหม่ — อัปโหลด dataUrl ขึ้น Storage ก่อน แล้วเขียน doc */
export async function addDailySummaryImage(
  input: { date: string; imageDataUrl: string; note?: string },
  createdBy: string,
): Promise<string> {
  // pre-generate id เพื่อใช้เป็น path ของ Storage
  const ref = doc(col);
  const imageUrl = await uploadDailySummaryImage(ref.id, input.imageDataUrl);
  await setDoc(ref, {
    imageUrl,
    date: input.date,
    note: input.note?.trim() || null,
    sentAt: null,
    createdAt: Date.now(),
    createdBy,
  });
  return ref.id;
}

export async function deleteDailySummaryImage(id: string): Promise<void> {
  await deleteDoc(doc(col, id));
}
