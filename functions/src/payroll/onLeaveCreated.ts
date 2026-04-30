/**
 * onLeaveCreated — update leave stats when a new leave document is created
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

export const onLeaveCreated = onDocumentCreated(
  "leaves/{leaveId}",
  async (event) => {
    const leave = event.data?.data();
    if (!leave?.start) return;

    const db = getFirestore();
    const ym = (leave.start as string).substring(0, 7);
    const statsRef = db.doc(`stats/${ym}`);

    await db.runTransaction(async (tx) => {
      const stats = await tx.get(statsRef);
      const current = (stats.data()?.leaveCount as number) || 0;
      tx.set(statsRef, { leaveCount: current + 1 }, { merge: true });
    });

    console.log(`[onLeaveCreated] Updated stats for ${ym}`);
  },
);
