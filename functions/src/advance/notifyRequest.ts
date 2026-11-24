/**
 * notifyAdvanceRequest — แจ้ง Admin (คำขอเบิกใหม่)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
	getAppFirestore,
	getLineConfig,
	isNotificationEnabled,
} from "../helpers/config.js";
import { parseNotifyAdvanceRequestPayload } from "../helpers/payload.js";
import { notifyAdminsAboutAdvance } from "./adminNotify.js";

export const notifyAdvanceRequest = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

	// Admin toggle: /admin → LINE BOT → การแจ้งเตือน
	if (!(await isNotificationEnabled("advanceRequestEnabled"))) {
		console.log("[notifyAdvanceRequest] disabled in admin config, skipping");
		return { ok: true, skipped: true };
	}

	const uid = request.auth.uid;
	const db = getAppFirestore();

	type EmployeeData = {
		name?: string;
		bank?: string;
		bankAccountNumber?: string;
		lineUserId?: string;
	};

	// lookup employee · primary path: where("lineUserId", "==", uid)
	let verifiedEmployee: EmployeeData | null = null;
	const employeeSnap = await db
		.collection("employees")
		.where("lineUserId", "==", uid)
		.limit(1)
		.get();
	if (!employeeSnap.empty) {
		verifiedEmployee = employeeSnap.docs[0].data() as EmployeeData;
	}

	const payload = parseNotifyAdvanceRequestPayload(request.data);
	const { amount, reason, month, submittedAt, requestId } = payload;

	// self-heal: ถ้าหาไม่เจอด้วย lineUserId · ลองใช้ requestId เข้าหา advance doc
	// → อ่าน employeeId · เปิด employee doc · update lineUserId ให้ตรงกับ uid
	// ตอนนี้ (เพื่อให้รอบหน้าใช้ verified path ได้) · นี่ทำให้ field สะอาดขึ้น
	// อัตโนมัติเมื่อพนักงานยื่นเบิกครั้งแรกหลังเชื่อม LINE
	if (!verifiedEmployee && requestId) {
		try {
			const advanceRef = db.collection("advances").doc(String(requestId));
			const advanceSnap = await advanceRef.get();
			const employeeId = (
				advanceSnap.data() as { employeeId?: string } | undefined
			)?.employeeId;
			if (employeeId) {
				const empRef = db.collection("employees").doc(employeeId);
				const empSnap = await empRef.get();
				if (empSnap.exists) {
					const empData = empSnap.data() as EmployeeData;
					verifiedEmployee = empData;
					if (empData.lineUserId !== uid) {
						await empRef.update({ lineUserId: uid });
						console.log(
							`[notifyAdvanceRequest] self-healed lineUserId for employee ${employeeId} (was=${empData.lineUserId ?? "<empty>"}, now=${uid})`,
						);
					}
				}
			}
		} catch (err) {
			console.warn(
				"[notifyAdvanceRequest] self-heal lookup failed:",
				err instanceof Error ? err.message : err,
			);
		}
	}

	if (!verifiedEmployee) {
		console.warn(
			`[notifyAdvanceRequest] no employee match for uid=${uid} · falling back to payload data`,
		);
	}

	const employeeName = verifiedEmployee?.name || payload.employeeName || "-";
	const bank = verifiedEmployee?.bank ?? payload.bank;
	const bankAccountNumber =
		verifiedEmployee?.bankAccountNumber ?? payload.bankAccountNumber;

	const config = await getLineConfig();
	if (!config.LINE_CHANNEL_ACCESS_TOKEN || !config.ADMIN_LINE_USER_ID) {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}

	console.log(
		`[notifyAdvanceRequest] pushing to admin · employee=${employeeName} amount=${amount} requestId=${requestId ?? "-"}`,
	);
	const outcome = await notifyAdminsAboutAdvance(
		config,
		requestId ? String(requestId) : undefined,
		{
			employeeName,
			amount,
			reason,
			month,
			bank,
			bankAccountNumber,
			submittedAt,
		},
	);
	if (outcome.status === "not_configured") {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}
	// ไม่มี admin คนไหนได้รับเลย → throw ให้พนักงานเห็น toast ตามจริง
	// (ล้มบางคน = ยังมี admin รู้ · ป้ายแดงในแอปบอก admin ที่เหลือแล้ว)
	if (outcome.status === "failed") {
		throw new HttpsError(
			"unavailable",
			`LINE push failed: ${outcome.errors[0] ?? "unknown"}`,
		);
	}
	return { ok: true, requestId, sent: outcome.sent, total: outcome.total };
});
