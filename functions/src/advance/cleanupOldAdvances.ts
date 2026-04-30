/**
 * cleanupOldAdvances — ลบ advances เกิน 6 เดือน (runs 1st of every month)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";

export const cleanupOldAdvances = onSchedule(
  { schedule: "0 2 1 * *", timeZone: "Asia/Bangkok" },
  async () => {
    const db = getFirestore();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);

    const snap = await db
      .collection("advances")
      .where("status", "in", ["approved", "rejected"])
      .where("submittedAt", "<", cutoff.toISOString())
      .get();

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[cleanupOldAdvances] Deleted ${snap.size} old advances`);
  },
);
