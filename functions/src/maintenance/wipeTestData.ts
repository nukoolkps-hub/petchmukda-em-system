/**
 * wipeTestData — ลบข้อมูลพนักงานทั้งหมดเพื่อ start fresh ก่อนใช้จริง
 *
 * ลบ: employees + months subcollection · leaves · advances · employeeLoans ·
 *      payrollConfirms · poolSnapshots · poolAdjustments · dutyAssignmentsToday ·
 *      certCounters · recentTips · dailySummarySent
 *
 * ไม่แตะ: /config/* · /roles · /duties (config + master data)
 *
 * ป้องกัน:
 *   - admin custom claim
 *   - data.confirm === "ล้างข้อมูล" (จาก UI · กัน accidental trigger)
 */

import type { Firestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore } from "../helpers/config.js";

const TOP_LEVEL_COLLECTIONS = [
	"employees",
	"leaves",
	"advances",
	"employeeLoans",
	"payrollConfirms",
	"poolSnapshots",
	"poolAdjustments",
	"dutyAssignmentsToday",
	"certCounters",
	"recentTips",
	"dailySummarySent",
];

// subcollection ของ employees/{id}/months — เก็บสลิปเงินเดือนแยกตามเดือน
const COLLECTION_GROUPS = ["months"];

async function deleteCollection(
	db: Firestore,
	name: string,
): Promise<number> {
	const snap = await db.collection(name).get();
	if (snap.empty) return 0;
	const writer = db.bulkWriter();
	for (const doc of snap.docs) writer.delete(doc.ref);
	await writer.close();
	return snap.size;
}

async function deleteCollectionGroup(
	db: Firestore,
	name: string,
): Promise<number> {
	const snap = await db.collectionGroup(name).get();
	if (snap.empty) return 0;
	const writer = db.bulkWriter();
	for (const doc of snap.docs) writer.delete(doc.ref);
	await writer.close();
	return snap.size;
}

interface WipeResult {
	ok: boolean;
	stats: Record<string, number>;
	totalDeleted: number;
}

export const wipeTestData = onCall(async (req): Promise<WipeResult> => {
	const isAdmin = req.auth?.token?.admin === true;
	if (!isAdmin) {
		throw new HttpsError("permission-denied", "admin only");
	}
	const confirm = (req.data as { confirm?: string } | undefined)?.confirm;
	if (confirm !== "ล้างข้อมูล") {
		throw new HttpsError(
			"invalid-argument",
			"confirm token mismatch — ต้องส่ง { confirm: 'ล้างข้อมูล' }",
		);
	}
	const db = getAppFirestore();
	const stats: Record<string, number> = {};
	let totalDeleted = 0;
	for (const name of TOP_LEVEL_COLLECTIONS) {
		const count = await deleteCollection(db, name);
		stats[name] = count;
		totalDeleted += count;
	}
	for (const name of COLLECTION_GROUPS) {
		const count = await deleteCollectionGroup(db, name);
		stats[`${name} (subcollection)`] = count;
		totalDeleted += count;
	}
	console.log("[wipeTestData] complete", { stats, totalDeleted });
	return { ok: true, stats, totalDeleted };
});
