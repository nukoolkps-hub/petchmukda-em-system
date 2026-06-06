/**
 * notifyDailyLeaves — แจ้งเตือนทุกวันเวลา 07:30 ตามเวลาไทยว่ามีพนักงาน
 * คนไหนหยุดวันนี้บ้าง ส่งเข้ากลุ่ม LINE ที่ admin ตั้งไว้
 *
 * กลุ่มที่ส่งเก็บใน config/notifications.employeeGroupId — ตั้งโดย
 * admin พิมพ์ "แจ้งเตือนกลุ่มนี้" ในกลุ่ม LINE (commands/setNotifyGroup.ts)
 *
 * แสดงชื่อโดยใช้ "ชื่อเล่น" (employee.nickname) ก่อน fallback ไป full name
 *
 * Idempotency: เขียน doc `dailyLeaveNotifications/{ymd}` ก่อนส่ง — ถ้า
 * scheduler ยิงซ้ำ (at-least-once delivery) จะ skip รอบที่สอง
 */

import type { Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { COLORS, getAppFirestore, getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import type { LinePushMessage } from "../types.js";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS_SHORT = [
	"ม.ค.",
	"ก.พ.",
	"มี.ค.",
	"เม.ย.",
	"พ.ค.",
	"มิ.ย.",
	"ก.ค.",
	"ส.ค.",
	"ก.ย.",
	"ต.ค.",
	"พ.ย.",
	"ธ.ค.",
];

interface LeaveItem {
	nickname: string;
	kindLabel: string;
	dateLabel: string;
}

export const notifyDailyLeaves = onSchedule(
	{ schedule: "30 7 * * *", timeZone: "Asia/Bangkok" },
	async () => {
		const config = await getLineConfig();
		const token = config.LINE_CHANNEL_ACCESS_TOKEN;
		if (!token) {
			console.warn("[notifyDailyLeaves] LINE_CHANNEL_ACCESS_TOKEN not set");
			return;
		}

		const db = getAppFirestore();
		const { ymd, thai: todayThai } = bangkokToday();

		// อ่าน groupId ที่ admin ตั้งไว้ — ถ้ายังไม่ได้ตั้ง → skip ทั้งวัน
		const notifConfig = await db.doc("config/notifications").get();
		const groupId = stringValue(
			(notifConfig.data() as Record<string, unknown> | undefined)
				?.employeeGroupId,
		);
		if (!groupId) {
			console.warn(
				"[notifyDailyLeaves] employeeGroupId not configured — admin ต้องพิมพ์ 'แจ้งเตือนกลุ่มนี้' ในกลุ่ม LINE ก่อน",
			);
			return;
		}

		// Idempotency: claim today's slot ก่อนส่ง
		const claimed = await claimToday(db, ymd);
		if (!claimed) {
			console.log(`[notifyDailyLeaves] already sent for ${ymd}, skipping`);
			return;
		}

		// หาคนที่ลาวันนี้: ดึง leaves ที่ end >= today แล้ว filter ใน-memory
		// (Firestore ห้าม inequality 2 fields ใน query เดียว)
		const leavesSnap = await db
			.collection("leaves")
			.where("end", ">=", ymd)
			.get();

		const todayLeaves = leavesSnap.docs
			.map((d) => d.data() as Record<string, unknown>)
			.filter((leave) => {
				const start = String(leave.start || "");
				const end = String(leave.end || "");
				return start <= ymd && end >= ymd;
			});

		if (todayLeaves.length === 0) {
			console.log(`[notifyDailyLeaves] no leaves for ${ymd}`);
			await db
				.doc(`dailyLeaveNotifications/${ymd}`)
				.update({ skippedReason: "no_leaves", sent: false });
			return;
		}

		// join กับ employees → nickname
		const empSnap = await db.collection("employees").get();
		const empById = new Map<string, Record<string, unknown>>();
		for (const e of empSnap.docs) empById.set(e.id, e.data());

		const items: LeaveItem[] = todayLeaves.map((leave) => {
			const employeeId = String(leave.employeeId || "");
			const emp = empById.get(employeeId);
			const nickname =
				stringValue(emp?.nickname) ||
				stringValue(emp?.name) ||
				stringValue(leave.employeeName) ||
				"-";
			const kindLabel = leave.type === "sick" ? "ลาป่วย" : "ลากิจ";
			const start = String(leave.start || "");
			const end = String(leave.end || "");
			const dateLabel =
				start === end ? "วันเดียว" : `${formatDate(start)} – ${formatDate(end)}`;
			return { nickname, kindLabel, dateLabel };
		});

		const message = buildLeaveFlex(todayThai, items);

		try {
			await pushLineMessage(token, groupId, message);
			await db.doc(`dailyLeaveNotifications/${ymd}`).update({
				sent: true,
				groupId,
				leaveCount: items.length,
			});
			console.log(
				`[notifyDailyLeaves] sent to group ${groupId} (${items.length} leave items)`,
			);
		} catch (err) {
			const errMessage = err instanceof Error ? err.message : String(err);
			console.error(`[notifyDailyLeaves] push to group ${groupId} failed:`, errMessage);
			await db.doc(`dailyLeaveNotifications/${ymd}`).update({
				sent: false,
				error: errMessage,
				groupId,
			});
			throw err;
		}
	},
);

/** Atomic claim ของวันนี้ — กัน scheduler ยิงซ้ำส่งสแปม */
async function claimToday(db: Firestore, ymd: string): Promise<boolean> {
	const ref = db.doc(`dailyLeaveNotifications/${ymd}`);
	return db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists) return false;
		tx.set(ref, {
			ymd,
			claimedAt: new Date().toISOString(),
		});
		return true;
	});
}

/** เวลาไทย (UTC+7) — return YYYY-MM-DD + Thai-formatted "วันที่ X เดือน พ.ศ." */
function bangkokToday(): { ymd: string; thai: string } {
	const now = new Date();
	const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
	const y = bkk.getUTCFullYear();
	const m = bkk.getUTCMonth() + 1;
	const d = bkk.getUTCDate();
	const dow = bkk.getUTCDay();
	const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
	const thai = `วัน${THAI_DAYS[dow]}ที่ ${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
	return { ymd, thai };
}

function formatDate(ymd: string): string {
	const parts = ymd.split("-");
	if (parts.length !== 3) return ymd;
	const m = parseInt(parts[1], 10);
	const d = parseInt(parts[2], 10);
	return `${d} ${THAI_MONTHS_SHORT[m - 1] || ""}`;
}

function stringValue(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function buildLeaveFlex(
	todayThai: string,
	items: LeaveItem[],
): LinePushMessage {
	return {
		type: "flex",
		altText: `พนักงานหยุดวันนี้ ${items.length} คน`,
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
						text: "พนักงานหยุดวันนี้",
						color: "#FFFFFF",
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: todayThai,
						color: COLORS.goldPale,
						size: "xs",
						margin: "sm",
					},
				],
			},
			body: {
				type: "box",
				layout: "vertical",
				spacing: "md",
				contents: items.map((item) => ({
					type: "box",
					layout: "vertical",
					spacing: "xs",
					contents: [
						{
							type: "box",
							layout: "horizontal",
							contents: [
								{
									type: "text",
									text: "•",
									flex: 0,
									color: COLORS.maroon,
									weight: "bold",
									size: "md",
								},
								{
									type: "text",
									text: ` ${item.nickname}`,
									weight: "bold",
									size: "md",
									color: COLORS.text,
									flex: 1,
									wrap: true,
								},
							],
						},
						{
							type: "text",
							text: `${item.kindLabel} · ${item.dateLabel}`,
							size: "xs",
							color: COLORS.textMedium,
							margin: "none",
						},
					],
				})),
			},
			footer: {
				type: "box",
				layout: "vertical",
				contents: [
					{
						type: "text",
						text: "ห้างเพชรทองมุกดา",
						size: "xxs",
						color: COLORS.textMedium,
						align: "center",
					},
				],
			},
		},
	};
}
