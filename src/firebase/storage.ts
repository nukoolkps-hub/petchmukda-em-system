/* ─── Firebase Storage uploads ───────────────────────────────── */

import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadString,
} from "firebase/storage";
import { storage } from "./config";

function safeSegment(value: string | number) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function uploadDataUrl(path: string, dataUrl: string) {
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, "data_url");
  return await getDownloadURL(fileRef);
}

export async function uploadAvatar(employeeId: string, dataUrl: string) {
  const id = safeSegment(employeeId);
  return await uploadDataUrl(`avatars/${id}/avatar-${Date.now()}.jpg`, dataUrl);
}

export async function uploadAdvanceSlip(
  advanceId: string | number,
  dataUrl: string,
) {
  const id = safeSegment(advanceId);
  return await uploadDataUrl(
    `advanceSlips/${id}/slip-${Date.now()}.jpg`,
    dataUrl,
  );
}

/* ─── Salary slip PDF (freeze ตอน Admin ยืนยันยอด) ──────────────
   Path คงที่ salarySlips/{employeeId}/{YYYY-MM}.pdf
   → ยืนยันยอดใหม่ทับไฟล์เดิม ไม่สะสมไฟล์ขยะ
   → Cloud Function cleanupOldSlips อ่าน YYYY-MM จากชื่อไฟล์เพื่อลบเกิน 5 ปี */
export async function uploadSalarySlip(
  employeeId: string,
  yearMonth: string,
  blob: Blob,
) {
  const id = safeSegment(employeeId);
  const ym = safeSegment(yearMonth);
  const fileRef = ref(storage, `salarySlips/${id}/${ym}.pdf`);
  await uploadBytes(fileRef, blob, { contentType: "application/pdf" });
  return await getDownloadURL(fileRef);
}
