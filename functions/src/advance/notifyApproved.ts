/**
 * notifyAdvanceApproved — แจ้งพนักงาน (อนุมัติ + สลิป)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLOR, getLineConfig, TH_NUM } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { saveSlipToStorage } from "../helpers/storage.js";
import type { AdvanceApprovedData, LineMessage } from "../types.js";

export const notifyAdvanceApproved = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

	const {
		empLineUserId,
		empName,
		amount,
		reason,
		month,
		slipImg,
		approvedAt,
		requestId,
	} = request.data as AdvanceApprovedData;
	if (!empLineUserId)
		throw new HttpsError("invalid-argument", "missing empLineUserId");

	const config = await getLineConfig();
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}

	const dt = new Date(approvedAt || Date.now());
	const dtStr = dt.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const slipUrl = await saveSlipToStorage(slipImg, requestId || Date.now());

	const flex = {
		type: "flex" as const,
		altText: `✅ เบิกเงินล่วงหน้าได้รับการอนุมัติ — ฿${TH_NUM(amount)}`,
		contents: {
			type: "bubble",
			size: "mega",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLOR.green,
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
						text: `สวัสดี คุณ${empName}`,
						size: "md",
						weight: "bold",
						color: COLOR.text,
					},
					{
						type: "text",
						text: "เงินที่คุณขอเบิกได้รับการอนุมัติและโอนเข้าบัญชีเรียบร้อยแล้ว",
						size: "sm",
						color: COLOR.textMid,
						wrap: true,
					},
					{
						type: "box",
						layout: "vertical",
						backgroundColor: COLOR.greenLt,
						cornerRadius: "8px",
						paddingAll: "12px",
						margin: "md",
						contents: [
							{
								type: "text",
								text: "จำนวนที่โอน",
								size: "xs",
								color: COLOR.textMid,
							},
							{
								type: "text",
								text: `฿${TH_NUM(amount)}`,
								size: "xxl",
								weight: "bold",
								color: COLOR.green,
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
								color: COLOR.textMid,
								flex: 2,
							},
							{
								type: "text",
								text: month || "-",
								size: "sm",
								color: COLOR.text,
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
								color: COLOR.textMid,
								flex: 2,
							},
							{
								type: "text",
								text: reason || "-",
								size: "sm",
								color: COLOR.text,
								flex: 4,
								wrap: true,
							},
						],
					},
					{
						type: "text",
						text: `⏰ อนุมัติเมื่อ: ${dtStr}`,
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
						color: COLOR.textMid,
						align: "center",
					},
				],
			},
		},
	};

	const messages: LineMessage[] = [flex];
	if (slipUrl) {
		messages.push({
			type: "image",
			originalContentUrl: slipUrl,
			previewImageUrl: slipUrl,
		});
	}

	await pushLineMessage(
		config.LINE_CHANNEL_ACCESS_TOKEN,
		empLineUserId,
		messages,
	);
	return { ok: true, requestId, slipUrl };
});
