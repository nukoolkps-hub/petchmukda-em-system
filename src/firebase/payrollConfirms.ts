/* ─── Payroll Confirmations ────────────────────────────────────
   เก็บ summary ว่า admin ยืนยันยอดเงินเดือนของเดือนใดแล้ว
   doc id: "{yearMonth}" เช่น "2026-04"                                  */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import type { PayrollChangeLogEntry } from "../types";
import { COLLECTIONS, db } from "./config";

const CHANGE_LOG_CAP = 100; // เก็บประวัติล่าสุด N รายการ (กัน doc โต)

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
  // transaction — อ่าน doc server-side แล้ว "เขียนครั้งเดียว" (write-once) ให้
  // firstConfirmedAt/lockAtMs · กัน race 2 admin ยืนยันเดือนเดียวกันพร้อมกัน
  // (เดิม read client cache → ต่างคนต่างเขียน → เดดไลน์ล็อกเพี้ยน) · merge ฟิลด์
  // อื่น (เช่น changeLog ที่เขียนแยก) ไม่ถูก wipe
  const docRef = doc(ref, yearMonth);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const prev = snap.exists() ? snap.data() : null;
    // firstConfirmedAt + lockAtMs = ยืนยัน "ครั้งแรก" เท่านั้น — ถ้ามีอยู่แล้ว
    // (อีก session เขียนไปก่อน) ใช้ของเดิมเสมอ เพื่อให้เดดไลน์ล็อกอิงครั้งแรก
    const firstConfirmedAt =
      prev?.firstConfirmedAt ?? summary.firstConfirmedAt ?? summary.confirmedAt;
    const lockAtMs =
      typeof prev?.lockAtMs === "number"
        ? prev.lockAtMs
        : (summary.lockAtMs ?? null);
    tx.set(
      docRef,
      {
        yearMonth,
        confirmedAt: summary.confirmedAt,
        totalAmount: summary.totalAmount,
        employeeCount: summary.employeeCount,
        breakdownSig: summary.breakdownSig ?? null,
        // ใช้ทั้ง UI และ firestore.rules (เทียบ request.time.toMillis())
        firstConfirmedAt,
        lockAtMs,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
}

/** append 1 รายการลง changeLog ของเดือนนั้น (auto-settle หลังยืนยัน) ·
 *  transaction อ่าน-ต่อท้าย-ตัดให้เหลือ N ล่าสุด-เขียน (กัน race + doc โต)     */
export async function appendPayrollChangeLog(
  yearMonth: string,
  entry: PayrollChangeLogEntry,
): Promise<void> {
  const docRef = doc(ref, yearMonth);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    // doc ถูกลบไป (race: ยกเลิกยืนยันยอด) → no-op · ไม่สร้าง doc ที่ขาด confirm
    // fields (confirmedAt/lockAtMs) ขึ้นมาใหม่
    if (!snap.exists()) return;
    const prev = snap.data().changeLog ?? [];
    const next = [...prev, entry].slice(-CHANGE_LOG_CAP);
    tx.set(docRef, { changeLog: next, updatedAt: Date.now() }, { merge: true });
  });
}
