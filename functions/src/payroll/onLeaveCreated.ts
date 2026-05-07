/**
 * onLeaveCreated — update leave stats when a new leave document is created
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
	FIRESTORE_DATABASE_ID,
	getAppFirestore,
} from "../helpers/config.js";

export const onLeaveCreated = onDocumentCreated(
	{ document: "leaves/{leaveId}", database: FIRESTORE_DATABASE_ID },
	async (event) => {
		const leave = event.data?.data();
		if (!leave?.start) return;

		const db = getAppFirestore();
		const yearMonth = (leave.start as string).substring(0, 7);
		const statsRef = db.doc(`stats/${yearMonth}`);

		await db.runTransaction(async (tx) => {
			const stats = await tx.get(statsRef);
			const current = (stats.data()?.leaveCount as number) || 0;
			tx.set(statsRef, { leaveCount: current + 1 }, { merge: true });
		});

		console.log(`[onLeaveCreated] Updated stats for ${yearMonth}`);
	},
);
