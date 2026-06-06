/**
 * sendDailySummary — ส่งสรุปประจำวันเข้า LINE
 *
 * Schedule: 07:30 ทุกวัน เวลาไทย
 *
 * สำหรับแต่ละ group ใน DAILY_SUMMARY_GROUPS:
 * 1. ดึง events จาก Google Calendar
 * 2. ถ้า group.includeLeaves → ดึงรายชื่อพนักงานหยุดวันนี้
 * 3. ถ้า group.sendAiTip → เรียก Claude API
 * 4. รวมเป็น flex bubble (maroon theme) → push เข้า LINE group
 *
 * Idempotency: doc `dailySummarySent/{ymd}` เป็น guard
 * (claim ครั้งเดียว — กัน at-least-once delivery ของ Cloud Scheduler)
 */

import type { Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAppFirestore, getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";
import { buildDailySummaryFlex } from "./buildFlex.js";
import {
	type CalendarEvent,
	createCalendarClient,
	fetchTodayEvents,
} from "./calendar.js";
import { APP_TIMEZONE, DAILY_SUMMARY_GROUPS, SAT_DAY_NAME } from "./config.js";
import { bangkokYmd, formatDateTH, getThaiDayName } from "./dateUtils.js";
import { fetchTodayLeaves, type LeaveItem } from "./leaves.js";
import { generateDailyTip } from "./tip.js";

interface RunOptions {
	targetOverride?: string; // ส่งทุก message ไป LINE ID นี้แทน (สำหรับ preview)
}

interface GroupResult {
	name: string;
	sent: boolean;
	error?: string;
	skipped?: string;
}

export const sendDailySummary = onSchedule(
	{
		schedule: "30 7 * * *",
		timeZone: APP_TIMEZONE,
		timeoutSeconds: 120,
	},
	async () => {
		const ymd = bangkokYmd(new Date());
		const db = getAppFirestore();
		const claimed = await claimToday(db, ymd);
		if (!claimed) {
			console.log(`[sendDailySummary] already sent for ${ymd}, skipping`);
			return;
		}
		try {
			const results = await runDailySummary();
			await db.doc(`dailySummarySent/${ymd}`).update({
				results,
				sentAt: new Date().toISOString(),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await db
				.doc(`dailySummarySent/${ymd}`)
				.update({ error: msg })
				.catch(() => undefined);
			throw err;
		}
	},
);

/* ─── Core logic — เรียกได้ทั้ง scheduled และ LINE command ──── */

export async function runDailySummary(
	options: RunOptions = {},
): Promise<GroupResult[]> {
	const targetOverride = options.targetOverride || null;
	const now = new Date();
	const dateStr = formatDateTH(now);
	const dayName = getThaiDayName(now);
	const isSaturday = dayName === SAT_DAY_NAME;

	const config = await getLineConfig();
	const token = config.LINE_CHANNEL_ACCESS_TOKEN;
	const anthropicApiKey = config.ANTHROPIC_API_KEY;
	if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");

	const db = getAppFirestore();
	const calendar = createCalendarClient();
	const hasLeavesGroup = DAILY_SUMMARY_GROUPS.some((g) => g.includeLeaves);

	// ดึง leaves + Calendar events ของทุก group แบบ parallel — ลด latency จาก
	// O(groups × roundtrip) → O(roundtrip) (ใหญ่สุดของชุดงาน)
	const [todayLeaves, eventsByGroup] = await Promise.all([
		hasLeavesGroup
			? fetchTodayLeaves(db, now).catch((err) => {
					console.error("[runDailySummary] fetchTodayLeaves error:", err);
					return [] as LeaveItem[];
				})
			: Promise.resolve<LeaveItem[]>([]),
		Promise.all(
			DAILY_SUMMARY_GROUPS.map((group) =>
				fetchTodayEvents(calendar, group.calendarId, now)
					.then((events) => ({ events, error: false }))
					.catch((err) => {
						console.error(
							`[runDailySummary] calendar error for ${group.name}:`,
							err,
						);
						return { events: [] as CalendarEvent[], error: true };
					}),
			),
		),
	]);

	const results: GroupResult[] = [];

	for (let i = 0; i < DAILY_SUMMARY_GROUPS.length; i++) {
		const group = DAILY_SUMMARY_GROUPS[i];
		const { events, error: calendarError } = eventsByGroup[i];

		// Skip กลุ่มที่ไม่มี event + ไม่ส่ง tip + ไม่ใช่กลุ่มพนักงาน
		// (กันส่งข้อความ "ไม่มีภารกิจ" รบกวนตอนวันหยุด/ไม่มีอะไรเลย)
		const shouldSkipEmpty =
			!targetOverride &&
			events.length === 0 &&
			!calendarError &&
			!group.includeLeaves &&
			(!group.sendAiTip || isSaturday);
		if (shouldSkipEmpty) {
			console.log(`[runDailySummary] skip ${group.name} — no events`);
			results.push({ name: group.name, sent: false, skipped: "no_events" });
			continue;
		}

		let tip: string | null = null;
		let tipDebugError: string | null = null;
		if (group.sendAiTip) {
			if (!anthropicApiKey) {
				tipDebugError =
					"ANTHROPIC_API_KEY ไม่ได้ตั้งใน Firestore /config/secrets";
				console.warn(
					`[runDailySummary] ${group.name}: ${tipDebugError}`,
				);
			} else {
				try {
					const tipResult = await generateDailyTip(anthropicApiKey);
					tip = tipResult.raw;
				} catch (err) {
					tipDebugError = err instanceof Error ? err.message : String(err);
					console.error(
						`[runDailySummary] tip error for ${group.name}:`,
						tipDebugError,
					);
				}
			}
		}

		const flex = buildDailySummaryFlex({
			groupName: group.name,
			dateStr,
			dayName,
			events,
			leaves: group.includeLeaves ? todayLeaves : null,
			tip,
			// preview mode (targetOverride set): โชว์ error ของ tip ในกล่อง
			// แทน skip เงียบๆ — ให้ admin debug ง่าย
			tipDebugError: targetOverride ? tipDebugError : null,
			calendarError,
		});

		const target = targetOverride || group.lineTargetId;
		try {
			await pushLineMessage(token, target, flex);
			results.push({ name: group.name, sent: true });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[runDailySummary] push error for ${group.name}:`, msg);
			results.push({ name: group.name, sent: false, error: msg });
		}
	}

	return results;
}

/** Atomic claim ของวันนี้ — กัน scheduler ยิงซ้ำส่งสแปม */
async function claimToday(db: Firestore, ymd: string): Promise<boolean> {
	const ref = db.doc(`dailySummarySent/${ymd}`);
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
