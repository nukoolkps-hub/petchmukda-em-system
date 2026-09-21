/**
 * "มีคนลาเพิ่ม" — รอบตามหลังสรุปเช้า · ตอนนี้มี 2 รอบ: 08:30 และ 09:30
 *
 * สรุปเช้า 07:30 ถ่ายภาพคนหยุด ณ ตอนนั้น — ใครกดลาหลังจากนั้นจะไม่โผล่
 * ในกล่องเช้าเลย รอบตามจึงแจ้งเฉพาะ "คนที่ตกหล่น" ไม่ใช่ส่งซ้ำทั้งหมด
 *
 * **แต่ละรอบนับต่อจากรอบก่อนหน้า ไม่ใช่จากสรุปเช้าเสมอ** — รอบ 09:30 ใช้
 * cutoff = เวลาที่รอบ 08:30 claim ไว้ ไม่งั้นจะประกาศชื่อเดิมซ้ำ (ดู
 * `resolveRoundCutoffMs` ใน leaveRules.ts สำหรับ fallback chain)
 *
 * ไม่มีใครตกหล่น → ไม่ส่งอะไรเลย (เงียบ · ไม่มีกล่อง "ไม่มีคนลาเพิ่ม"
 * มารบกวนทุกเช้า) · รอบที่ไม่ได้ส่งจะไม่สร้าง doc → รอบถัดไป fallback ไป
 * ใช้ cutoff ของรอบเก่ากว่าเอง
 *
 * ปลายทาง = กลุ่มเดียวกับที่เปิด "พนักงานหยุดวันนี้" ในสรุปเช้า
 * (`includeLeaves`) — กลุ่มที่ไม่ได้ดูเรื่องคนไม่เกี่ยวกับข้อความนี้
 *
 * Idempotency: doc `{sentCollection}/{ymd}` claim ครั้งเดียวต่อรอบ
 *
 * **เพิ่มรอบใหม่:** ประกาศ LateLeaveRound ตัวใหม่ (prevCollections ต้องมีรอบ
 * ก่อนหน้าทุกตัว เรียงใหม่→เก่า) + export onSchedule + เพิ่ม toggle ใน
 * `isNotificationEnabled` (functions) และ `NotificationSettings` (frontend)
 */

import type { DocumentReference, Firestore } from "firebase-admin/firestore";
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
import { fetchLateLeaves, resolveRoundCutoffMs } from "./lateLeaves.js";
import { shouldSkipSaturday } from "./sendDailySummary.js";

interface GroupResult {
	name: string;
	sent: boolean;
	error?: string;
}

/** นิยาม 1 รอบตามแจ้ง — ทุกอย่างที่ต่างกันระหว่างรอบอยู่ในนี้ที่เดียว */
interface LateLeaveRound {
	/** ชื่อรอบใน log */
	label: string;
	/** field ใน `config/notifications` (admin เปิด-ปิดแยกแต่ละรอบ) */
	toggle: Parameters<typeof isNotificationEnabled>[0];
	/** collection ที่ใช้ claim กัน scheduler ยิงซ้ำ */
	sentCollection: string;
	/** collection ของรอบก่อนหน้า เรียงใหม่ → เก่า (ใช้หา cutoff) */
	prevCollections: string[];
}

const ROUND_0830: LateLeaveRound = {
	label: "08:30",
	toggle: "lateLeaveNoticeEnabled",
	sentCollection: "lateLeaveNoticeSent",
	prevCollections: ["dailySummarySent"],
};

const ROUND_0930: LateLeaveRound = {
	label: "09:30",
	toggle: "lateLeaveNotice0930Enabled",
	sentCollection: "lateLeaveNotice0930Sent",
	// 08:30 ก่อน — ถ้ารอบนั้นไม่ได้ส่ง (ไม่มีใครตกหล่น) จะไม่มี doc
	// แล้วตกมาใช้สรุปเช้าแทน ซึ่งถูกต้อง คนช่วง 07:30-09:30 ยังไม่เคยถูกประกาศ
	prevCollections: ["lateLeaveNoticeSent", "dailySummarySent"],
};

async function runLateLeaveRound(round: LateLeaveRound): Promise<void> {
	const tag = `[lateLeaveNotice ${round.label}]`;
	if (!(await isNotificationEnabled(round.toggle))) {
		console.log(`${tag} disabled in admin config, skipping`);
		return;
	}
	const db = getAppFirestore();
	const now = new Date();
	const ymd = bangkokYmd(now);

	// เสาร์ปกติร้านปิด → ไม่มีใครต้องรู้ว่าใครลา (กฎเดียวกับสรุปเช้า)
	if (await shouldSkipSaturday(db, ymd)) {
		console.log(`${tag} เสาร์ปกติ (${ymd}) · skipping`);
		return;
	}

	const prevDocs = await Promise.all(
		round.prevCollections.map((col) =>
			db
				.doc(`${col}/${ymd}`)
				.get()
				.then((snap) => snap.data() as Record<string, unknown> | undefined)
				.catch(() => undefined),
		),
	);
	const cutoffMs = resolveRoundCutoffMs(ymd, prevDocs);

	const lateLeaves = await fetchLateLeaves(db, ymd, cutoffMs);
	if (lateLeaves.length === 0) {
		console.log(`${tag} ไม่มีคนกดลาเพิ่มหลังรอบก่อน (${ymd}) · skipping`);
		return;
	}

	const ref = db.doc(`${round.sentCollection}/${ymd}`);
	const claimed = await claimToday(ref);
	if (!claimed) {
		console.log(`${tag} already sent for ${ymd}, skipping`);
		return;
	}

	try {
		const results = await pushLateLeaveNotice(
			db,
			lateLeaves,
			formatDateTH(now),
		);
		await ref.update({
			results,
			count: lateLeaves.length,
			sentAt: new Date().toISOString(),
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await ref.update({ error: msg }).catch(() => undefined);
		throw err;
	}
}

export const sendLateLeaveNotice = onSchedule(
	{ schedule: "30 8 * * *", timeZone: APP_TIMEZONE, timeoutSeconds: 120 },
	async () => {
		await runLateLeaveRound(ROUND_0830);
	},
);

export const sendLateLeaveNotice0930 = onSchedule(
	{ schedule: "30 9 * * *", timeZone: APP_TIMEZONE, timeoutSeconds: 120 },
	async () => {
		await runLateLeaveRound(ROUND_0930);
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

/** Atomic claim ของรอบนั้นในวันนั้น — กัน scheduler ยิงซ้ำส่งสแปม */
async function claimToday(ref: DocumentReference): Promise<boolean> {
	return ref.firestore.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists) return false;
		tx.set(ref, {
			ymd: ref.id,
			claimedAt: new Date().toISOString(),
		});
		return true;
	});
}
