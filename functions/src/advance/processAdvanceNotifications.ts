/**
 * processAdvanceNotifications — server-side LINE notification worker.
 *
 * The client only updates Firestore. This scheduled worker reads approved /
 * rejected advance documents marked for notification and sends LINE messages
 * from Cloud Functions so browser callable/network blocking cannot drop them.
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
import { pushLineMessage } from "../helpers/line.js";
import type { LinePushMessage } from "../types.js";

type AdvanceStatus = "approved" | "rejected";
type AdvanceDoc = Record<string, unknown>;

const BATCH_SIZE = 20;

export const processAdvanceNotifications = onSchedule(
	{ schedule: "* * * * *", timeZone: "Asia/Bangkok" },
	async () => {
		// Admin toggle: /admin → LINE BOT → การแจ้งเตือน
		if (!(await isNotificationEnabled("advanceApprovalEnabled"))) {
			console.log(
				"[processAdvanceNotifications] disabled in admin config, skipping",
			);
			return;
		}
		const config = await getLineConfig();
		if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
			console.warn("[processAdvanceNotifications] LINE config not set");
			return;
		}

		const db = getAppFirestore();
		const snap = await db
			.collection("advances")
			.where("lineNotificationStatus", "==", "pending")
			.limit(BATCH_SIZE)
			.get();

		if (snap.empty) return;

		for (const docSnap of snap.docs) {
			const claimed = await claimNotification(docSnap.ref);
			if (!claimed) continue;

			try {
				await sendAdvanceStatusNotification(
					db,
					docSnap.ref,
					docSnap.id,
					claimed,
					config.LINE_CHANNEL_ACCESS_TOKEN,
				);
			} catch (error) {
				const message = errorMessage(error);
				console.error(
					`[processAdvanceNotifications] ${docSnap.id} failed:`,
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
): Promise<AdvanceDoc | null> {
	return ref.firestore.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const data = snap.data() as AdvanceDoc | undefined;
		if (!data || data.lineNotificationStatus !== "pending") return null;

		const status = advanceStatus(data);
		const now = new Date().toISOString();
		if (!status) {
			tx.update(ref, {
				lineNotificationStatus: "skipped",
				lineNotificationSkippedReason: "unsupported_advance_status",
				lineNotificationCheckedAt: now,
			});
			return null;
		}

		tx.update(ref, {
			lineNotificationStatus: "processing",
			lineNotificationProcessingStartedAt: now,
			lineNotificationAttempts: numberValue(data.lineNotificationAttempts) + 1,
		});
		return data;
	});
}

async function sendAdvanceStatusNotification(
	db: Firestore,
	ref: DocumentReference,
	advanceId: string,
	advance: AdvanceDoc,
	token: string,
) {
	const status = advanceStatus(advance);
	if (!status) return;

	const employeeLineUserId = await findEmployeeLineUserId(db, advance);
	if (!employeeLineUserId) {
		await ref.update({
			lineNotificationStatus: "skipped",
			lineNotificationSkippedReason: "employee_missing_line_user_id",
			lineNotificationCheckedAt: new Date().toISOString(),
		});
		return;
	}

	await pushLineMessage(
		token,
		employeeLineUserId,
		status === "approved"
			? buildApprovedFlex(advanceId, advance)
			: buildRejectedFlex(advanceId, advance),
	);

	let slipImagePushFailed = false;
	let slipImageError: string | null = null;
	const slipImageUrl = stringValue(advance.slipImageUrl);
	if (status === "approved" && slipImageUrl && isTrustedImageUrl(slipImageUrl)) {
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
				`[processAdvanceNotifications] ${advanceId} slip image failed:`,
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
	advance: AdvanceDoc,
): Promise<string | null> {
	const employeeId = stringValue(advance.employeeId);
	if (employeeId) {
		const employee = await db.doc(`employees/${employeeId}`).get();
		const lineUserId = stringValue(employee.data()?.lineUserId);
		if (lineUserId) return lineUserId;
	}

	const employeeName = stringValue(advance.employeeName);
	if (!employeeName) return null;
	const employeeSnap = await db
		.collection("employees")
		.where("name", "==", employeeName)
		.limit(1)
		.get();
	const employee = employeeSnap.docs[0]?.data();
	return stringValue(employee?.lineUserId) || null;
}

function buildApprovedFlex(
	advanceId: string,
	advance: AdvanceDoc,
): LinePushMessage {
	const employeeName = stringValue(advance.employeeName) || "-";
	const amount = numberValue(advance.amount);
	const requestReason = stringValue(advance.reason) || "-";
	const month = stringValue(advance.month) || "-";
	const approvedAt = stringValue(advance.approvedAt);

	return {
		type: "flex",
		altText: `อนุมัติเบิกเงินล่วงหน้า ฿${formatThaiNumber(amount)}`,
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
						text: "โอนเงินเรียบร้อยแล้ว",
						color: "#FFFFFF",
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
					amountBox("จำนวนที่โอน", amount, COLORS.green, COLORS.greenLight),
					kvRow("เดือน", month),
					kvRow("เหตุผล", requestReason),
					{
						type: "text",
						text: `อนุมัติเมื่อ: ${formatThaiDateTime(approvedAt)}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
					{
						type: "text",
						text: `เลขที่คำขอ: ${advanceId}`,
						size: "xxs",
						color: "#B89A72",
					},
				],
			},
		},
	};
}

function buildRejectedFlex(
	advanceId: string,
	advance: AdvanceDoc,
): LinePushMessage {
	const employeeName = stringValue(advance.employeeName) || "-";
	const amount = numberValue(advance.amount);
	const requestReason = stringValue(advance.reason) || "-";
	const rejectionReason = stringValue(advance.rejectionReason) || "-";
	const month = stringValue(advance.month) || "-";
	const rejectedAt = stringValue(advance.rejectedAt);

	return {
		type: "flex",
		altText: `ไม่อนุมัติเบิกเงินล่วงหน้า ฿${formatThaiNumber(amount)}`,
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
						text: "คำขอไม่ได้รับอนุมัติ",
						color: "#FFFFFF",
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
						text: "คำขอเบิกเงินล่วงหน้าของคุณไม่ได้รับอนุมัติในครั้งนี้",
						size: "sm",
						color: COLORS.textMedium,
						wrap: true,
					},
					amountBox("จำนวนที่ขอ", amount, COLORS.red, "#FDECEA"),
					kvRow("เดือน", month),
					kvRow("คำขอเดิม", requestReason),
					kvRow("เหตุผลปฏิเสธ", rejectionReason),
					{
						type: "text",
						text: `ปฏิเสธเมื่อ: ${formatThaiDateTime(rejectedAt)}`,
						size: "xs",
						color: "#B89A72",
						margin: "md",
					},
					{
						type: "text",
						text: `เลขที่คำขอ: ${advanceId}`,
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

function formatThaiDateTime(value: string | undefined): string {
	const date = value ? new Date(value) : new Date();
	return date.toLocaleString("th-TH", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	});
}

function advanceStatus(data: AdvanceDoc): AdvanceStatus | null {
	const status = stringValue(data.status);
	return status === "approved" || status === "rejected" ? status : null;
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

const TRUSTED_IMAGE_HOSTS = [
	"storage.googleapis.com",
	"firebasestorage.googleapis.com",
];

function isTrustedImageUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") return false;
		return TRUSTED_IMAGE_HOSTS.some((host) => parsed.hostname === host);
	} catch {
		return false;
	}
}
