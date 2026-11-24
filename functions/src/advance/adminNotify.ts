/**
 * แจ้ง admin ทาง LINE ว่ามีคำขอเบิกใหม่ — ใช้ร่วมกัน 2 ทาง:
 *   1. `notifyAdvanceRequest` — ตอนพนักงานกดยื่น
 *   2. `retryAdvanceAdminNotify` — admin กด "ส่งแจ้งเตือนอีกครั้ง" บนป้ายแดง
 * flex ต้องหน้าตาเดียวกันทั้ง 2 ทาง จึงรวมไว้ที่นี่ที่เดียว
 *
 * ADMIN_LINE_USER_ID มีได้หลาย ID → push แยกทีละคน (`pushLineMessageToAll`)
 * ล้มแม้แค่คนเดียว = ติดธง `lineNotifyFailed` (admin คนที่ไม่ได้รับต้องรู้)
 */

import { FieldValue } from "firebase-admin/firestore";
import {
	COLORS,
	formatThaiNumber,
	getAppFirestore,
	parseAdminLineUserIds,
} from "../helpers/config.js";
import { type MultiPushResult, pushLineMessageToAll } from "../helpers/line.js";
import type { LineConfig } from "../types.js";

export interface AdvanceRequestFlexInput {
	employeeName: string;
	amount: number;
	reason?: string;
	month?: string;
	bank?: string;
	bankAccountNumber?: string;
	submittedAt?: string;
}

export function buildAdvanceRequestFlex({
	employeeName,
	amount,
	reason,
	month,
	bank,
	bankAccountNumber,
	submittedAt,
}: AdvanceRequestFlexInput) {
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
	return flex;
}

export type AdminNotifyOutcome =
	| { status: "not_configured" }
	| ({ status: "sent" | "partial" | "failed" } & MultiPushResult);

/**
 * push flex ไปหา admin ทุกคน แล้วบันทึกผลลง advance doc
 * - ล้มบางส่วน/ทั้งหมด → ติดธง `lineNotifyFailed` + error (ป้ายแดงในแอป)
 * - สำเร็จครบ + `clearFlagOnSuccess` → ล้างธงเดิม (ใช้ตอน admin กดส่งซ้ำ)
 */
export async function notifyAdminsAboutAdvance(
	config: LineConfig,
	advanceId: string | undefined,
	input: AdvanceRequestFlexInput,
	{ clearFlagOnSuccess = false }: { clearFlagOnSuccess?: boolean } = {},
): Promise<AdminNotifyOutcome> {
	const adminIds = parseAdminLineUserIds(config.ADMIN_LINE_USER_ID);
	if (!config.LINE_CHANNEL_ACCESS_TOKEN || adminIds.length === 0) {
		return { status: "not_configured" };
	}

	const result = await pushLineMessageToAll(
		config.LINE_CHANNEL_ACCESS_TOKEN,
		adminIds,
		[buildAdvanceRequestFlex(input)],
	);
	const status =
		result.sent === result.total
			? "sent"
			: result.sent === 0
				? "failed"
				: "partial";

	if (status !== "sent") {
		console.error(
			`[notifyAdminsAboutAdvance] ${status} ${result.sent}/${result.total} · advance=${advanceId ?? "-"}:`,
			result.errors,
		);
	}

	if (advanceId) {
		const ref = getAppFirestore().collection("advances").doc(advanceId);
		try {
			if (status !== "sent") {
				await ref.update({
					lineNotifyFailed: true,
					lineNotifyError: [...new Set(result.errors)]
						.join(" | ")
						.slice(0, 500),
					lineNotifyFailedAt: new Date().toISOString(),
					lineNotifySentCount: result.sent,
					lineNotifyAdminCount: result.total,
				});
			} else if (clearFlagOnSuccess) {
				await ref.update({
					lineNotifyFailed: false,
					lineNotifyError: FieldValue.delete(),
					lineNotifyFailedAt: FieldValue.delete(),
					lineNotifySentCount: FieldValue.delete(),
					lineNotifyAdminCount: FieldValue.delete(),
					lineNotifyResentAt: new Date().toISOString(),
				});
			}
		} catch (flagErr) {
			console.error(
				"[notifyAdminsAboutAdvance] failed to update advance doc:",
				flagErr instanceof Error ? flagErr.message : flagErr,
			);
		}
	}

	return { status, ...result };
}
