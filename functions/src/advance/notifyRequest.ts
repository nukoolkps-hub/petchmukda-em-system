/**
 * notifyAdvanceRequest — แจ้ง Admin (คำขอเบิกใหม่)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
	COLORS,
	formatThaiNumber,
	getAppFirestore,
	getLineConfig,
} from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { parseNotifyAdvanceRequestPayload } from "../helpers/payload.js";

export const notifyAdvanceRequest = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

	const uid = request.auth.uid;
	const employeeSnap = await getAppFirestore()
		.collection("employees")
		.where("lineUserId", "==", uid)
		.limit(1)
		.get();
	if (employeeSnap.empty) {
		throw new HttpsError("permission-denied", "ไม่พบข้อมูลพนักงาน");
	}
	const verifiedEmployee = employeeSnap.docs[0].data() as {
		name?: string;
		bank?: string;
		bankAccountNumber?: string;
	};

	const {
		amount,
		reason,
		month,
		submittedAt,
		requestId,
	} = parseNotifyAdvanceRequestPayload(request.data);

	const employeeName = verifiedEmployee.name || "-";
	const bank = verifiedEmployee.bank;
	const bankAccountNumber = verifiedEmployee.bankAccountNumber;

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
		},
	};

	await pushLineMessage(
		config.LINE_CHANNEL_ACCESS_TOKEN,
		config.ADMIN_LINE_USER_ID,
		flex,
	);
	return { ok: true, requestId };
});
