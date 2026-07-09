/**
 * processLoanNotifications — server-side LINE notification worker for loans.
 *
 * Pattern: ตามแบบ processAdvanceNotifications. Admin สร้างเงินกู้ + (optional)
 * แนบสลิปโอน → เมื่อ frontend อัปเดตเสร็จจะ set `lineNotificationStatus:"pending"`
 * บน loan doc. Worker นี้ scan ทุกนาทีจับ pending loans → push flex message +
 * slip image ไปที่ employee.lineUserId · update status เป็น "sent" / "error"
 */

import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
	COLORS,
	formatThaiNumber,
	getAppFirestore,
	getLineConfig,
	isNotificationEnabled,
} from "../helpers/config.js";
import { isTrustedImageUrl, pushLineMessage } from "../helpers/line.js";
import type { LinePushMessage } from "../types.js";

type LoanDoc = Record<string, unknown>;

const BATCH_SIZE = 20;

export const processLoanNotifications = onSchedule(
	{ schedule: "* * * * *", timeZone: "Asia/Bangkok" },
	async () => {
		// Admin toggle: /admin → LINE BOT → การแจ้งเตือน
		if (!(await isNotificationEnabled("loanCreatedEnabled"))) {
			console.log(
				"[processLoanNotifications] disabled in admin config, skipping",
			);
			return;
		}
		const config = await getLineConfig();
		if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
			console.warn("[processLoanNotifications] LINE config not set");
			return;
		}

		const db = getAppFirestore();
		const snap = await db
			.collection("employeeLoans")
			.where("lineNotificationStatus", "==", "pending")
			.limit(BATCH_SIZE)
			.get();

		if (snap.empty) return;

		for (const docSnap of snap.docs) {
			const claimed = await claimNotification(docSnap.ref);
			if (!claimed) continue;

			try {
				await sendLoanCreatedNotification(
					db,
					docSnap.ref,
					docSnap.id,
					claimed,
					config.LINE_CHANNEL_ACCESS_TOKEN,
				);
			} catch (error) {
				const message = errorMessage(error);
				console.error(
					`[processLoanNotifications] ${docSnap.id} failed:`,
					message,
				);
				await docSnap.ref.update({
					lineNotificationStatus: "error",
					lineNotificationLastError: message,
					lineNotificationFailedAt: new Date().toISOString(),
				});
			}
		}
	},
);

async function claimNotification(
	ref: DocumentReference,
): Promise<LoanDoc | null> {
	return ref.firestore.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const data = snap.data() as LoanDoc | undefined;
		if (!data || data.lineNotificationStatus !== "pending") return null;

		const now = new Date().toISOString();
		tx.update(ref, {
			lineNotificationStatus: "processing",
			lineNotificationProcessingStartedAt: now,
			lineNotificationAttempts: numberValue(data.lineNotificationAttempts) + 1,
		});
		return data;
	});
}

async function sendLoanCreatedNotification(
	db: Firestore,
	ref: DocumentReference,
	loanId: string,
	loan: LoanDoc,
	token: string,
) {
	const employeeLineUserId = await findEmployeeLineUserId(db, loan);
	if (!employeeLineUserId) {
		await ref.update({
			lineNotificationStatus: "skipped",
			lineNotificationSkippedReason: "employee_missing_line_user_id",
			lineNotificationCheckedAt: new Date().toISOString(),
		});
		return;
	}

	await pushLineMessage(token, employeeLineUserId, buildLoanCreatedFlex(loanId, loan));

	// แนบรูปสลิปการโอน (ถ้ามี) — push เป็น image message แยก
	let slipImagePushFailed = false;
	let slipImageError: string | null = null;
	const slipImageUrl = stringValue(loan.slipImageUrl);
	if (slipImageUrl && isTrustedImageUrl(slipImageUrl)) {
		try {
			await pushLineMessage(token, employeeLineUserId, {
				type: "image",
				originalContentUrl: slipImageUrl,
				previewImageUrl: slipImageUrl,
			});
		} catch (error) {
			slipImagePushFailed = true;
			slipImageError = errorMessage(error);
			console.warn(
				`[processLoanNotifications] ${loanId} slip image failed:`,
				slipImageError,
			);
		}
	}

	await ref.update({
		lineNotificationStatus: "sent",
		lineNotificationSentAt: new Date().toISOString(),
		lineNotificationLastError: null,
		lineNotificationSkippedReason: null,
		lineNotificationSlipImagePushFailed: slipImagePushFailed,
		lineNotificationSlipImageError: slipImageError,
	});
}

async function findEmployeeLineUserId(
	db: Firestore,
	loan: LoanDoc,
): Promise<string | null> {
	const employeeId = stringValue(loan.employeeId);
	if (employeeId) {
		const employee = await db.doc(`employees/${employeeId}`).get();
		const lineUserId = stringValue(employee.data()?.lineUserId);
		if (lineUserId) return lineUserId;
	}
	// fallback: employeeName (กรณี employeeId ไม่ valid)
	const employeeName = stringValue(loan.employeeName);
	if (!employeeName) return null;
	const employeeSnap = await db
		.collection("employees")
		.where("name", "==", employeeName)
		.limit(1)
		.get();
	const employee = employeeSnap.docs[0]?.data();
	return stringValue(employee?.lineUserId) || null;
}

function buildLoanCreatedFlex(loanId: string, loan: LoanDoc): LinePushMessage {
	const employeeName = stringValue(loan.employeeName) || "-";
	const principal = numberValue(loan.principal);
	const monthlyDeduction = numberValue(loan.monthlyDeduction);
	const startMonth = stringValue(loan.startMonth) || "-";
	const note = stringValue(loan.note);
	const months =
		monthlyDeduction > 0 ? Math.ceil(principal / monthlyDeduction) : 0;
	const lastMonthAmount =
		monthlyDeduction > 0 && principal % monthlyDeduction !== 0
			? principal % monthlyDeduction
			: 0;
	const createdAt = stringValue(loan.createdAt);

	return {
		type: "flex",
		altText: `💰 มีเงินกู้ใหม่ ฿${formatThaiNumber(principal)} · ${employeeName}`,
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
						text: "💰 มีเงินกู้ใหม่",
						color: COLORS.goldLight,
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: "ADMIN สร้างเงินกู้ให้คุณ · ห้างเพชรทองมุกดา",
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
						type: "text",
						text: `สวัสดี คุณ${employeeName}`,
						size: "md",
						weight: "bold",
						color: COLORS.text,
					},
					{
						type: "text",
						text: "ADMIN ได้สร้างรายการเงินกู้ผ่อนคืนให้คุณ · ระบบจะหักจากเงินเดือนอัตโนมัติทุกเดือนจนครบ",
						size: "sm",
						color: COLORS.textMedium,
						wrap: true,
					},
					amountBox("เงินต้น", principal, COLORS.maroon, COLORS.goldPale),
					kvRow("ผ่อนเดือนละ", `฿${formatThaiNumber(monthlyDeduction)}`),
					kvRow("เริ่มหักเดือน", formatMonthLabel(startMonth)),
					kvRow(
						"ระยะเวลาผ่อน",
						months > 0
							? `${months} เดือน${
									lastMonthAmount > 0
										? ` (เดือนสุดท้าย ฿${formatThaiNumber(lastMonthAmount)})`
										: ""
								}`
							: "-",
					),
					...(note ? [kvRow("หมายเหตุ", note)] : []),
					{
						type: "text",
						text: `สร้างเมื่อ: ${formatThaiDateTime(createdAt)}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
					{
						type: "text",
						text: `เลขที่: ${loanId}`,
						size: "xxs",
						color: "#B89A72",
					},
				],
			},
		},
	};
}

function amountBox(
	label: string,
	amount: number,
	color: string,
	backgroundColor: string,
) {
	return {
		type: "box",
		layout: "vertical",
		backgroundColor,
		cornerRadius: "8px",
		paddingAll: "12px",
		margin: "md",
		contents: [
			{ type: "text", text: label, size: "xs", color: COLORS.textMedium },
			{
				type: "text",
				text: `฿${formatThaiNumber(amount)}`,
				size: "xxl",
				weight: "bold",
				color,
			},
		],
	};
}

function kvRow(label: string, value: string) {
	return {
		type: "box",
		layout: "horizontal",
		spacing: "sm",
		contents: [
			{
				type: "text",
				text: label,
				size: "sm",
				color: COLORS.textMedium,
				flex: 2,
			},
			{
				type: "text",
				text: value,
				size: "sm",
				color: COLORS.text,
				flex: 4,
				wrap: true,
			},
		],
	};
}

function formatMonthLabel(yearMonth: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
	if (!match) return yearMonth || "-";
	const year = Number.parseInt(match[1], 10);
	const monthIdx = Number.parseInt(match[2], 10) - 1;
	const months = [
		"มกราคม",
		"กุมภาพันธ์",
		"มีนาคม",
		"เมษายน",
		"พฤษภาคม",
		"มิถุนายน",
		"กรกฎาคม",
		"สิงหาคม",
		"กันยายน",
		"ตุลาคม",
		"พฤศจิกายน",
		"ธันวาคม",
	];
	if (monthIdx < 0 || monthIdx > 11) return yearMonth;
	return `${months[monthIdx]} ${year + 543}`;
}

function formatThaiDateTime(value: string | undefined): string {
	const date = value ? new Date(value) : new Date();
	return date.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	});
}

function stringValue(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function numberValue(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
