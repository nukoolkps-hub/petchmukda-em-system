/* ─── Certificate Ref Number — Firestore-backed running counter ────
   เก็บ counter ที่ certCounters/{พ.ศ.} ใช้ atomic transaction increment
   เพื่อให้ ref number เรียงตามลำดับจริง รีเซ็ตทุกปี (พ.ศ.)
   เลขออกมาในรูป "พทม. 001/2569"                                    */

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

const PREFIX = "พทม.";

export async function getNextCertRefNumber(): Promise<string> {
  const buddhistYear = new Date().getFullYear() + 543;
  const counterRef = doc(db, "certCounters", String(buddhistYear));

  const nextCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().count as number) || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, {
      count: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  });

  return `${PREFIX} ${String(nextCount).padStart(3, "0")}/${buddhistYear}`;
}
