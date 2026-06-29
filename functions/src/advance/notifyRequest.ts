/**
 * notifyAdvanceRequest — แจ้ง Admin (คำขอเบิกใหม่)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
	COLORS,
	formatThaiNumber,
	getAppFirestore,
	getLineConfig,
	isNotificationEnabled,
} from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { parseNotifyAdvanceRequestPayload } from "../helpers/payload.js";

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

	const date = new Date(submittedAt || Date.now());
	const dateText = date.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const flex = {
		type: "flex" as const,
		altText: `💸 คำขอเบิกเงินล่วงหน้า — ${employeeName} ฿${formatThaiNumber(amount)}`,
		contents: {
			type: "bubble",
			size: "mega",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLORS.maroon,
				paddingAll: "16px",
				contents: [
					{
						type: "text",
						text: "💸 คำขอเบิกเงินล่วงหน้า",
						color: COLORS.goldLight,
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: "ห้างเพชรทองมุกดา",
						color: COLORS.goldLight,
						size: "xs",
						margin: "sm",
					},
				],
			},
			body: {
				type: "box",
				layout: "vertical",
				spacing: "md",
				contents: [
					{
						type: "box",
						layout: "vertical",
						backgroundColor: COLORS.goldPale,
						cornerRadius: "8px",
						paddingAll: "12px",
						contents: [
							{
								type: "text",
								text: "จำนวนเงิน",
								size: "xs",
								color: COLORS.textMedium,
							},
							{
								type: "text",
								text: `฿${formatThaiNumber(amount)}`,
								size: "xxl",
								weight: "bold",
								color: COLORS.maroon,
							},
						],
					},
					{
						type: "box",
						layout: "horizontal",
						spacing: "sm",
						contents: [
							{
								type: "text",
								text: "👤 พนักงาน",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: employeeName,
								size: "sm",
								weight: "bold",
								color: COLORS.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{
						type: "box",
						layout: "horizontal",
						spacing: "sm",
						contents: [
							{
								type: "text",
								text: "📅 เดือน",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: month || "-",
								size: "sm",
								color: COLORS.text,
								flex: 4,
							},
						],
					},
					{
						type: "box",
						layout: "horizontal",
						spacing: "sm",
						contents: [
							{
								type: "text",
								text: "📝 เหตุผล",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: reason || "-",
								size: "sm",
								color: COLORS.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{ type: "separator", margin: "md" },
					{
						type: "box",
						layout: "horizontal",
						spacing: "sm",
						contents: [
							{
								type: "text",
								text: "🏦 ธนาคาร",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: bank || "-",
								size: "sm",
								color: COLORS.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{
						type: "box",
						layout: "horizontal",
						spacing: "sm",
						contents: [
							{
								type: "text",
								text: "💳 เลขบัญชี",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: bankAccountNumber || "-",
								size: "sm",
								color: COLORS.text,
								flex: 4,
								weight: "bold",
							},
						],
					},
					{
						type: "text",
						text: `⏰ ส่งคำขอ: ${dateText}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
				],
			},
			// footer: ปุ่ม clipboard action ให้ admin กด copy เลขบัญชีในเฟล็กได้เลย
			// (LINE clipboard action: v14.6+ — ก่อนหน้านี้ปุ่มจะกดไม่ทำงาน)
			...(bankAccountNumber
				? {
						footer: {
							type: "box",
							layout: "vertical",
							spacing: "sm",
							paddingAll: "12px",
							contents: [
								{
									type: "button",
									style: "primary",
									color: COLORS.maroon,
									height: "sm",
									action: {
										type: "clipboard",
										label: "📋 คัดลอกเลขบัญชี",
										clipboardText: bankAccountNumber,
									},
								},
							],
						},
					}
				: {}),
		},
	};

	console.log(
		`[notifyAdvanceRequest] pushing to admin · employee=${employeeName} amount=${amount} requestId=${requestId ?? "-"}`,
	);
	try {
		await pushLineMessage(
			config.LINE_CHANNEL_ACCESS_TOKEN,
			config.ADMIN_LINE_USER_ID,
			[flex],
		);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		console.error("[notifyAdvanceRequest] pushLineMessage failed:", errMsg);
		// LINE คือช่องที่พัง → แจ้ง admin ทางอื่นไม่ได้ ฝากธงไว้ที่ advance doc
		// ให้ admin เห็น badge "แจ้ง LINE ไม่สำเร็จ" ในหน้าจัดการเบิกเงิน (in-app)
		if (requestId) {
			try {
				await db
					.collection("advances")
					.doc(String(requestId))
					.update({
						lineNotifyFailed: true,
						lineNotifyError: errMsg.slice(0, 500),
						lineNotifyFailedAt: new Date().toISOString(),
					});
			} catch (flagErr) {
				console.error(
					"[notifyAdvanceRequest] failed to flag advance doc:",
					flagErr instanceof Error ? flagErr.message : flagErr,
				);
			}
		}
		throw err;
	}
	return { ok: true, requestId };
});
