/**
 * retryAdvanceAdminNotify — admin กด "ส่งแจ้งเตือนอีกครั้ง" บนป้ายแดง
 * "LINE แจ้งเตือนแอดมินไม่สำเร็จ" ใน AdminAdvancePanel
 *
 * อ่านคำขอจาก advance doc (ไม่เชื่อ payload จาก client) + ธนาคารจาก employee
 * doc แล้วส่ง flex เดิมซ้ำผ่าน `notifyAdminsAboutAdvance` · สำเร็จ = ล้างธง
 *
 * ไม่สน toggle `advanceRequestEnabled` — admin กดเองตรงๆ คือตั้งใจให้ส่ง
 * LINE ล้มอีก = คืน `{ ok: false, error }` (ไม่ throw) ให้ UI แปลสาเหตุเป็นไทย
 * ส่งซ้ำไปหา admin ทุกคน (คนที่ได้รับรอบแรกแล้วจะได้ซ้ำ — ยอมรับได้ ดีกว่า
 * เก็บ LINE ID ของ admin ลง advance doc ที่พนักงานเจ้าของอ่านได้)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore, getLineConfig } from "../helpers/config.js";
import { notifyAdminsAboutAdvance } from "./adminNotify.js";

export const retryAdvanceAdminNotify = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");
	if (!(request.auth.token as { admin?: boolean }).admin) {
		throw new HttpsError("permission-denied", "ADMIN only");
	}
	const advanceId = (request.data as { advanceId?: unknown } | null)?.advanceId;
	if (typeof advanceId !== "string" || advanceId.trim() === "") {
		throw new HttpsError("invalid-argument", "Missing advanceId");
	}

	const db = getAppFirestore();
	const snap = await db.collection("advances").doc(advanceId).get();
	if (!snap.exists) throw new HttpsError("not-found", "ไม่พบคำขอเบิกนี้");
	const adv = snap.data() as {
		employeeId?: string;
		employeeName?: string;
		amount?: number;
		reason?: string;
		month?: string;
		submittedAt?: string;
	};

	let employee: { name?: string; bank?: string; bankAccountNumber?: string } =
		{};
	if (adv.employeeId) {
		const empSnap = await db.collection("employees").doc(adv.employeeId).get();
		if (empSnap.exists) employee = empSnap.data() ?? {};
	}

	const outcome = await notifyAdminsAboutAdvance(
		await getLineConfig(),
		advanceId,
		{
			employeeName: employee.name || adv.employeeName || "-",
			amount: Number(adv.amount) || 0,
			reason: adv.reason,
			month: adv.month,
			bank: employee.bank,
			bankAccountNumber: employee.bankAccountNumber,
			submittedAt: adv.submittedAt,
		},
		{ clearFlagOnSuccess: true },
	);

	if (outcome.status === "not_configured") {
		return { ok: false, error: "not_configured" };
	}
	if (outcome.status === "sent") {
		return { ok: true, sent: outcome.sent, total: outcome.total };
	}
	return {
		ok: false,
		error: outcome.errors[0] ?? "unknown",
		sent: outcome.sent,
		total: outcome.total,
	};
});
