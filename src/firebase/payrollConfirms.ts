/* ─── Payroll Confirmations ────────────────────────────────────
   เก็บ summary ว่า admin ยืนยันยอดเงินเดือนของเดือนใดแล้ว
   doc id: "{yearMonth}" เช่น "2026-04"                                  */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.PAYROLL_CONFIRMS);

export function subscribePayrollConfirms(onChange, onError) {
  return onSnapshot(
    ref,
    (snap) => {
      const result = {};
      snap.docs.forEach((d) => {
        result[d.id] = d.data();
      });
      onChange(result);
    },
    (err) => {
      console.error("[PayrollConfirms] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function getAllPayrollConfirms() {
  const snap = await getDocs(ref);
  const result = {};
  snap.docs.forEach((d) => {
    result[d.id] = d.data();
  });
  return result;
}

export async function setPayrollConfirm(yearMonth, summary) {
  await setDoc(doc(ref, yearMonth), {
    yearMonth,
    confirmedAt: summary.confirmedAt,
    totalAmount: summary.totalAmount,
    employeeCount: summary.employeeCount,
    breakdownSig: summary.breakdownSig ?? null,
    // ล็อกถาวร: firstConfirmedAt = ยืนยันครั้งแรก (ไม่รีเซ็ต) ·
    // lockAtMs = เวลาที่เดือนนี้จะแก้ไม่ได้ (firstConfirmedAt + 7 วัน)
    // ใช้ทั้ง UI และ firestore.rules (เทียบ request.time.toMillis())
    firstConfirmedAt: summary.firstConfirmedAt ?? summary.confirmedAt,
    lockAtMs: summary.lockAtMs ?? null,
    updatedAt: Date.now(),
  });
}
