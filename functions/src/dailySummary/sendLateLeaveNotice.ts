/**
 * sendLateLeaveNotice — "มีคนลาเพิ่ม" รอบตาม 08:30
 *
 * Schedule: 08:30 ทุกวัน เวลาไทย (หลังสรุปเช้า 1 ชม.)
 *
 * สรุปเช้า 07:30 ถ่ายภาพคนหยุด ณ ตอนนั้น — ใครกดลาหลังจากนั้นจะไม่โผล่
 * ในกล่องเช้าเลย รอบนี้จึงตามแจ้งเฉพาะ "คนที่ตกหล่น" ไม่ใช่ส่งซ้ำทั้งหมด
 *
 * ไม่มีใครตกหล่น → ไม่ส่งอะไรเลย (เงียบ · ไม่มีกล่อง "ไม่มีคนลาเพิ่ม"
 * มารบกวนทุกเช้า)
 *
 * ปลายทาง = กลุ่มเดียวกับที่เปิด "พนักงานหยุดวันนี้" ในสรุปเช้า
 * (`includeLeaves`) — กลุ่มที่ไม่ได้ดูเรื่องคนไม่เกี่ยวกับข้อความนี้
 *
 * Idempotency: doc `lateLeaveNoticeSent/{ymd}` claim ครั้งเดียว
 */

import type { Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
	getAppFirestore,
	getLineConfig,
	isNotificationEnabled,
} from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { buildLateLeaveFlex } from "./buildLateLeaveFlex.js";
import { APP_TIMEZONE } from "./config.js";
import { bangkokYmd, formatDateTH } from "./dateUtils.js";
import { resolveDailySummaryGroups } from "./groups.js";
import { fetchLateLeaves, resolveLateCutoffMs } from "./lateLeaves.js";
import { shouldSkipSaturday } from "./sendDailySummary.js";

interface GroupResult {
	name: string;
	sent: boolean;
	error?: string;
}

export const sendLateLeaveNotice = onSchedule(
	{
		schedule: "30 8 * * *",
		timeZone: APP_TIMEZONE,
		timeoutSeconds: 120,
	},
	async () => {
		if (!(await isNotificationEnabled("lateLeaveNoticeEnabled"))) {
			console.log("[sendLateLeaveNotice] disabled in admin config, skipping");
			return;
		}
		const db = getAppFirestore();
		const now = new Date();
		const ymd = bangkokYmd(now);

		// เสาร์ปกติร้านปิด → ไม่มีใครต้องรู้ว่าใครลา (กฎเดียวกับสรุปเช้า)
		if (await shouldSkipSaturday(db, ymd)) {
			console.log(`[sendLateLeaveNotice] เสาร์ปกติ (${ymd}) · skipping`);
			return;
		}

		const morning = await db
			.doc(`dailySummarySent/${ymd}`)
			.get()
			.then((s) => s.data() as Record<string, unknown> | undefined)
			.catch(() => undefined);
		const cutoffMs = resolveLateCutoffMs(ymd, morning);

		const lateLeaves = await fetchLateLeaves(db, ymd, cutoffMs);
		if (lateLeaves.length === 0) {
			console.log(
				`[sendLateLeaveNotice] ไม่มีคนกดลาหลังสรุปเช้า (${ymd}) · skipping`,
			);
			return;
		}

		const claimed = await claimToday(db, ymd);
		if (!claimed) {
			console.log(`[sendLateLeaveNotice] already sent for ${ymd}, skipping`);
			return;
		}

		try {
			const results = await pushLateLeaveNotice(
				db,
				lateLeaves,
				formatDateTH(now),
			);
			await db.doc(`lateLeaveNoticeSent/${ymd}`).update({
				results,
				count: lateLeaves.length,
				sentAt: new Date().toISOString(),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await db
				.doc(`lateLeaveNoticeSent/${ymd}`)
				.update({ error: msg })
				.catch(() => undefined);
			throw err;
		}
	},
);

/** push เข้าทุกกลุ่มที่เปิด "พนักงานหยุดวันนี้" · export ไว้ให้ preview เรียกได้ */
export async function pushLateLeaveNotice(
	db: Firestore,
	lateLeaves: Awaited<ReturnType<typeof fetchLateLeaves>>,
	dateStr: string,
	targetOverride?: string,
): Promise<GroupResult[]> {
	const config = await getLineConfig();
	const token = config.LINE_CHANNEL_ACCESS_TOKEN;
	if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");

	const groups = (await resolveDailySummaryGroups(db)).filter(
		(g) => g.includeLeaves,
	);
	const flex = buildLateLeaveFlex(lateLeaves, dateStr);

	if (targetOverride) {
		await pushLineMessage(token, targetOverride, [flex]);
		return [{ name: "preview", sent: true }];
	}

	const results: GroupResult[] = [];
	for (const group of groups) {
		try {
			await pushLineMessage(token, group.lineTargetId, [flex]);
			results.push({ name: group.name, sent: true });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[sendLateLeaveNotice] push error for ${group.name}:`, msg);
			results.push({ name: group.name, sent: false, error: msg });
		}
	}
	return results;
}

/** Atomic claim ของวันนี้ — กัน scheduler ยิงซ้ำส่งสแปม */
async function claimToday(db: Firestore, ymd: string): Promise<boolean> {
	const ref = db.doc(`lateLeaveNoticeSent/${ymd}`);
	return db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists) return false;
		tx.set(ref, { ymd, claimedAt: new Date().toISOString() });
		return true;
	});
}
