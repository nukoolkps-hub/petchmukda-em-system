/**
 * backfillLeaveNicknames — fill in employeeNickname snapshot on legacy leaves
 *
 * ก่อนหน้านี้ leave doc ไม่มี employeeNickname field · ฝั่งพนักงานอ่าน
 * employee doc ของเพื่อนไม่ได้ (rules) → ดึง nickname เพื่อนมาแสดงไม่ได้ →
 * fall back เป็นชื่อเต็ม
 *
 * Callable admin เรียกครั้งเดียวเพื่อ backfill ใบลาเก่า · ใบลาที่
 * createdAt ใหม่ๆ (หลัง feature ship) จะมี employeeNickname อยู่แล้ว
 * และจะถูก skip · idempotent · ปลอดภัยจะรันซ้ำ
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore } from "../helpers/config.js";

interface EmployeeDoc {
	id: string;
	nickname?: string;
}

interface LeaveDoc {
	id: string;
	employeeId?: string;
	employeeNickname?: string;
}

export const backfillLeaveNicknames = onCall(async (request) => {
	if (!request.auth?.token?.admin) {
		throw new HttpsError("permission-denied", "admin เท่านั้น");
	}
	try {
		const db = getAppFirestore();
		const [employeesSnap, leavesSnap] = await Promise.all([
			db.collection("employees").get(),
			db.collection("leaves").get(),
		]);

		const nickById = new Map<string, string>();
		for (const d of employeesSnap.docs) {
			const data = d.data() as EmployeeDoc;
			if (data.nickname) nickById.set(d.id, data.nickname);
		}

		const targets: { id: string; nickname: string }[] = [];
		for (const d of leavesSnap.docs) {
			const data = d.data() as LeaveDoc;
			if (data.employeeNickname) continue; // already set — skip
			if (!data.employeeId) continue;
			const nickname = nickById.get(data.employeeId);
			if (!nickname) continue; // employee ไม่มี nickname ตั้งไว้
			targets.push({ id: d.id, nickname });
		}

		// batch write — Firestore limit 500 ops/batch
		const BATCH_SIZE = 400;
		let written = 0;
		for (let i = 0; i < targets.length; i += BATCH_SIZE) {
			const slice = targets.slice(i, i + BATCH_SIZE);
			const batch = db.batch();
			for (const t of slice) {
				batch.update(db.collection("leaves").doc(t.id), {
					employeeNickname: t.nickname,
				});
			}
			await batch.commit();
			written += slice.length;
		}

		console.log(
			`[backfillLeaveNicknames] updated ${written}/${leavesSnap.size} leaves`,
		);
		return { ok: true, updated: written, total: leavesSnap.size };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[backfillLeaveNicknames] error:", msg);
		throw new HttpsError("internal", msg);
	}
});
