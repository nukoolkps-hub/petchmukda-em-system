/**
 * cleanupOldTips — ลบ recentTips ที่เก่ากว่า RECENT_TIPS_RETENTION_DAYS วัน
 *
 * รัน 03:00 ทุกวัน — กันไม่ให้ collection unbounded growth
 * (generateDailyTip add doc ทุกวัน — ถ้าไม่ลบจะใหญ่ + slow query เรื่อยๆ)
 */

import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { APP_TIMEZONE, RECENT_TIPS_RETENTION_DAYS } from "../dailySummary/config.js";
import { getAppFirestore } from "../helpers/config.js";

const BATCH_SIZE = 100;

export const cleanupOldTips = onSchedule(
	{ schedule: "0 3 * * *", timeZone: APP_TIMEZONE },
	async () => {
		const db = getAppFirestore();
		const cutoff = new Date(
			Date.now() - RECENT_TIPS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
		);
		const cutoffTs = Timestamp.fromDate(cutoff);

		let deleted = 0;
		while (true) {
			const snap = await db
				.collection("recentTips")
				.where("createdAt", "<", cutoffTs)
				.limit(BATCH_SIZE)
				.get();
			if (snap.empty) break;
			const batch = db.batch();
			snap.docs.forEach((doc) => batch.delete(doc.ref));
			await batch.commit();
			deleted += snap.size;
			if (snap.size < BATCH_SIZE) break;
		}
		console.log(`[cleanupOldTips] deleted ${deleted} tips older than ${cutoff.toISOString()}`);
	},
);
