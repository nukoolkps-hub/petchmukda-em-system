/**
 * notifyAdvanceRejected — แจ้งพนักงาน (ปฏิเสธ)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLORS, formatThaiNumber, getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { parseNotifyAdvanceRejectedPayload } from "../helpers/payload.js";

export const notifyAdvanceRejected = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");
	if (!(request.auth.token as { admin?: boolean }).admin) {
		throw new HttpsError("permission-denied", "Caller is not admin");
	}

	const {
		employeeLineUserId,
		employeeName,
		amount,
		requestReason,
		rejectionReason,
		month,
		rejectedAt,
		requestId,
	} = parseNotifyAdvanceRejectedPayload(request.data);

	const config = await getLineConfig();
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}

	const date = new Date(rejectedAt || Date.now());
	const dateText = date.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const flex = {
		type: "flex" as const,
		altText: `❌ คำขอเบิกเงินล่วงหน้าไม่ได้รับอนุมัติ — ฿${formatThaiNumber(amount)}`,
		contents: {
			type: "bubble",
			size: "mega",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLORS.red,
				paddingAll: "16px",
				contents: [
					{
						type: "text",
						text: "❌ คำขอไม่ได้รับอนุมัติ",
						color: "#FFF",
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: "เบิกเงินล่วงหน้า · ห้างเพชรทองมุกดา",
						color: "#FCD9D9",
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
						type: "text",
						text: `สวัสดี คุณ${employeeName}`,
						size: "md",
						weight: "bold",
						color: COLORS.text,
					},
					{
						type: "text",
						text: "เสียใจด้วย คำขอเบิกเงินล่วงหน้าของคุณไม่ได้รับอนุมัติในครั้งนี้",
						size: "sm",
						color: COLORS.textMedium,
						wrap: true,
					},
					{
						type: "box",
						layout: "vertical",
						backgroundColor: "#FDECEA",
						cornerRadius: "8px",
						paddingAll: "12px",
						margin: "md",
						contents: [
							{
								type: "text",
								text: "จำนวนที่ขอ",
								size: "xs",
								color: COLORS.textMedium,
							},
							{
								type: "text",
								text: `฿${formatThaiNumber(amount)}`,
								size: "xl",
								weight: "bold",
								color: COLORS.red,
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
								text: "📝 คำขอเดิม",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: requestReason,
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
								text: "⚠️ เหตุผลปฏิเสธ",
								size: "sm",
								color: COLORS.textMedium,
								flex: 2,
							},
							{
								type: "text",
								text: rejectionReason || "-",
								size: "sm",
								color: COLORS.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{
						type: "text",
						text: `⏰ ปฏิเสธเมื่อ: ${dateText}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
					{ type: "separator", margin: "md" },
					{
						type: "text",
						text: "💬 หากมีข้อสงสัย กรุณาติดต่อ Admin โดยตรง",
						size: "xs",
						color: COLORS.textMedium,
						align: "center",
						wrap: true,
					},
				],
			},
		},
	};

	await pushLineMessage(
		config.LINE_CHANNEL_ACCESS_TOKEN,
		employeeLineUserId,
		flex,
	);
	return { ok: true, requestId };
});
