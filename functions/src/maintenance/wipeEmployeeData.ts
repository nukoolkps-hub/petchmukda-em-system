/**
 * wipeEmployeeData — ลบข้อมูลของพนักงานเฉพาะคน (1 หรือหลายคน)
 *
 * สำหรับเคส: admin อยากเอาพนักงานเก่าออก แต่ไม่ต้องการล้างทั้งระบบ
 *
 * แต่ละคน — ลบ:
 *   - salaries/{id}/months/* (สลิปทุกเดือนของคนนั้น) ผ่าน subcollection
 *   - employees/{id} (doc ตัวเอง)
 *   - leaves ที่ employeeId == id
 *   - advances ที่ employeeId == id
 *   - employeeLoans ที่ employeeId == id
 *   - poolSnapshots/{ym} — ลบ key employeeId ออก (merge FieldValue.delete)
 *
 * ไม่แตะ: /config/* · /roles · /duties · payrollConfirms (summary รายเดือน) ·
 *   certCounters (running number รายปี พ.ศ. — ไม่ผูกกับพนักงาน)
 *
 * Guard:
 *   - admin custom claim
 *   - data.confirm === "ล้างข้อมูล"
 *   - data.employeeIds: string[] (1+ items)
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore } from "../helpers/config.js";

async function deleteQueryByField(
	db: Firestore,
	collectionName: string,
	field: string,
	value: string,
): Promise<number> {
	const snap = await db
		.collection(collectionName)
		.where(field, "==", value)
		.get();
	if (snap.empty) return 0;
	const writer = db.bulkWriter();
	for (const doc of snap.docs) writer.delete(doc.ref);
	await writer.close();
	return snap.size;
}

async function deleteSubcollection(
	db: Firestore,
	parentPath: string,
	subName: string,
): Promise<number> {
	const snap = await db.collection(`${parentPath}/${subName}`).get();
	if (snap.empty) return 0;
	const writer = db.bulkWriter();
	for (const doc of snap.docs) writer.delete(doc.ref);
	await writer.close();
	return snap.size;
}

/** ลบ key employeeId ออกจาก poolSnapshots/{ym} ทุก doc · ใช้ FieldValue.delete */
async function purgeEmployeeFromPoolSnapshots(
	db: Firestore,
	employeeId: string,
): Promise<number> {
	const snap = await db.collection("poolSnapshots").get();
	if (snap.empty) return 0;
	let touched = 0;
	const writer = db.bulkWriter();
	for (const doc of snap.docs) {
		const data = doc.data() as Record<string, unknown>;
		if (employeeId in data) {
			writer.update(doc.ref, {
				[employeeId]: FieldValue.delete(),
				updatedAt: Date.now(),
			});
			touched++;
		}
	}
	await writer.close();
	return touched;
}

interface PerEmployeeStats {
	employeeId: string;
	months: number;
	leaves: number;
	advances: number;
	loans: number;
	poolSnapshotMonthsTouched: number;
	employeeDoc: number;
}

interface WipeEmployeeResult {
	ok: boolean;
	totalDeleted: number;
	stats: PerEmployeeStats[];
}

export const wipeEmployeeData = onCall(
	// ลูปลบแบบ sequential ต่อพนักงาน (หลาย round-trip/คน) — ตั้ง timeout สูง
	// กันค้างกลางทางตอนเลือกหลายคน (default 60s ไม่พอเมื่อ ~20+ คน)
	{ timeoutSeconds: 540 },
	async (req): Promise<WipeEmployeeResult> => {
		const isAdmin = req.auth?.token?.admin === true;
		if (!isAdmin) {
			throw new HttpsError("permission-denied", "admin only");
		}
		const data = (req.data ?? {}) as {
			employeeIds?: string[];
			confirm?: string;
		};
		if (data.confirm !== "ล้างข้อมูล") {
			throw new HttpsError(
				"invalid-argument",
				"confirm token mismatch — ต้องส่ง { confirm: 'ล้างข้อมูล' }",
			);
		}
		const ids = (data.employeeIds ?? []).filter(
			(id): id is string => typeof id === "string" && id.length > 0,
		);
		if (ids.length === 0) {
			throw new HttpsError("invalid-argument", "employeeIds ต้องไม่ว่าง");
		}
		if (ids.length > 50) {
			throw new HttpsError(
				"invalid-argument",
				"ลบได้ครั้งละไม่เกิน 50 คน",
			);
		}

		const db = getAppFirestore();
		const stats: PerEmployeeStats[] = [];
		let totalDeleted = 0;

		for (const id of ids) {
			// สลิปอยู่ที่ salaries/{id}/months — ไม่ใช่ employees/{id}/months
			const months = await deleteSubcollection(db, `salaries/${id}`, "months");
			const leaves = await deleteQueryByField(db, "leaves", "employeeId", id);
			const advances = await deleteQueryByField(
				db,
				"advances",
				"employeeId",
				id,
			);
			const loans = await deleteQueryByField(
				db,
				"employeeLoans",
				"employeeId",
				id,
			);
			const poolSnapshotMonthsTouched = await purgeEmployeeFromPoolSnapshots(
				db,
				id,
			);
			const empRef = db.doc(`employees/${id}`);
			const empSnap = await empRef.get();
			let employeeDoc = 0;
			if (empSnap.exists) {
				await empRef.delete();
				employeeDoc = 1;
			}

			const s: PerEmployeeStats = {
				employeeId: id,
				months,
				leaves,
				advances,
				loans,
				poolSnapshotMonthsTouched,
				employeeDoc,
			};
			stats.push(s);
			totalDeleted += months + leaves + advances + loans + employeeDoc;
		}

		console.log("[wipeEmployeeData] complete", { stats, totalDeleted });
		return { ok: true, totalDeleted, stats };
	},
);
