/**
 * notifyAdvanceRejected — แจ้งพนักงาน (ปฏิเสธ)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COLOR, getLineConfig, TH_NUM } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import type { AdvanceRejectedData } from "../types.js";

export const notifyAdvanceRejected = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

	const {
		empLineUserId,
		empName,
		amount,
		reason,
		month,
		rejectedAt,
		requestId,
	} = request.data as AdvanceRejectedData;
	if (!empLineUserId)
		throw new HttpsError("invalid-argument", "missing empLineUserId");

	const config = await getLineConfig();
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE config not set");
		return { ok: true, skipped: true };
	}

	const dt = new Date(rejectedAt || Date.now());
	const dtStr = dt.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const flex = {
		type: "flex" as const,
		altText: `❌ คำขอเบิกเงินล่วงหน้าไม่ได้รับอนุมัติ — ฿${TH_NUM(amount)}`,
		contents: {
			type: "bubble",
			size: "mega",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLOR.red,
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
						text: `สวัสดี คุณ${empName}`,
						size: "md",
						weight: "bold",
						color: COLOR.text,
					},
					{
						type: "text",
						text: "เสียใจด้วย คำขอเบิกเงินล่วงหน้าของคุณไม่ได้รับอนุมัติในครั้งนี้",
						size: "sm",
						color: COLOR.textMid,
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
								color: COLOR.textMid,
							},
							{
								type: "text",
								text: `฿${TH_NUM(amount)}`,
								size: "xl",
								weight: "bold",
								color: COLOR.red,
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
						text: `⏰ ปฏิเสธเมื่อ: ${dtStr}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
					{ type: "separator", margin: "md" },
					{
						type: "text",
						text: "💬 หากมีข้อสงสัย กรุณาติดต่อ Admin โดยตรง",
						size: "xs",
						color: COLOR.textMid,
						align: "center",
						wrap: true,
					},
				],
			},
		},
	};

	await pushLineMessage(config.LINE_CHANNEL_ACCESS_TOKEN, empLineUserId, flex);
	return { ok: true, requestId };
});
