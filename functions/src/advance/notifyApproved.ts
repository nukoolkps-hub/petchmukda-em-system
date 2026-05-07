/**
 * notifyAdvanceApproved — แจ้งพนักงาน (อนุมัติ + สลิป)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLORS, formatThaiNumber, getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { parseNotifyAdvanceApprovedPayload } from "../helpers/payload.js";
import { saveSlipToStorage } from "../helpers/storage.js";
import type { LinePushMessage } from "../types.js";

export const notifyAdvanceApproved = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");
	if (!(request.auth.token as { admin?: boolean }).admin) {
		throw new HttpsError("permission-denied", "Caller is not admin");
	}

	const {
		employeeLineUserId,
		employeeName,
		amount,
		requestReason,
		month,
		slipImageUrl,
		slipImageDataUrl,
		approvedAt,
		requestId,
	} = parseNotifyAdvanceApprovedPayload(request.data);

	const config = await getLineConfig();
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}

	const date = new Date(approvedAt || Date.now());
	const dateText = date.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const finalSlipUrl =
		slipImageUrl ||
		(await saveSlipToStorage(
			slipImageDataUrl ?? undefined,
			requestId ?? Date.now(),
		));

	const flex = {
		type: "flex" as const,
		altText: `✅ เบิกเงินล่วงหน้าได้รับการอนุมัติ — ฿${formatThaiNumber(amount)}`,
		contents: {
			type: "bubble",
			size: "mega",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLORS.green,
				paddingAll: "16px",
				contents: [
					{
						type: "text",
						text: "✅ โอนเงินเรียบร้อยแล้ว",
						color: "#FFF",
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: "เบิกเงินล่วงหน้า · ห้างเพชรทองมุกดา",
						color: "#D4F0DD",
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
						text: "เงินที่คุณขอเบิกได้รับการอนุมัติและโอนเข้าบัญชีเรียบร้อยแล้ว",
						size: "sm",
						color: COLORS.textMedium,
						wrap: true,
					},
					{
						type: "box",
						layout: "vertical",
						backgroundColor: COLORS.greenLight,
						cornerRadius: "8px",
						paddingAll: "12px",
						margin: "md",
						contents: [
							{
								type: "text",
								text: "จำนวนที่โอน",
								size: "xs",
								color: COLORS.textMedium,
							},
							{
								type: "text",
								text: `฿${formatThaiNumber(amount)}`,
								size: "xxl",
								weight: "bold",
								color: COLORS.green,
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
								text: requestReason,
								size: "sm",
								color: COLORS.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{
						type: "text",
						text: `⏰ อนุมัติเมื่อ: ${dateText}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
				],
			},
			footer: {
				type: "box",
				layout: "vertical",
				spacing: "sm",
				contents: [
					{
						type: "text",
						text: "กรุณาตรวจสอบยอดในบัญชีของคุณ",
						size: "xs",
						color: COLORS.textMedium,
						align: "center",
					},
				],
			},
		},
	};

	const messages: LinePushMessage[] = [flex];
	if (finalSlipUrl) {
		messages.push({
			type: "image",
			originalContentUrl: finalSlipUrl,
			previewImageUrl: finalSlipUrl,
		});
	}

	await pushLineMessage(
		config.LINE_CHANNEL_ACCESS_TOKEN,
		employeeLineUserId,
		messages,
	);
	return { ok: true, requestId, slipImageUrl: finalSlipUrl };
});
