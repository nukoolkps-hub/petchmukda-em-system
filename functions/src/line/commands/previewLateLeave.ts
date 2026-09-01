/**
 * ทดสอบคนลาเพิ่ม — admin พิมพ์ในแชท → bot push ตัวอย่างกล่อง "มีคนลาเพิ่ม"
 * (รอบ 08:30) มาให้ดู โดยไม่ต้องรอให้มีคนกดลาสายจริง
 *
 * ใช้ตัวสร้างข้อความเดียวกับ scheduled function → ตัวอย่างเหมือนของจริง 100%
 * · ถ้าวันนี้ไม่มีใครกดลาหลังสรุปเช้าจริงๆ จะใช้ข้อมูลตัวอย่างแทน แล้วบอก
 *   ให้รู้ว่านี่คือของสมมติ (ของจริงวันนั้นจะไม่ถูกส่งเลย)
 */

import { bangkokYmd, formatDateTH } from "../../dailySummary/dateUtils.js";
import {
	fetchLateLeaves,
	resolveLateCutoffMs,
} from "../../dailySummary/lateLeaves.js";
import type { LeaveItem } from "../../dailySummary/leaves.js";
import { pushLateLeaveNotice } from "../../dailySummary/sendLateLeaveNotice.js";
import { getAppFirestore } from "../../helpers/config.js";
import { pushLineMessage } from "../../helpers/line.js";
import { isAuthorizedLineAdmin } from "../core/admin.js";
import { getMentionees, removeMentionRanges } from "../core/message.js";
import { replyText } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

const TRIGGER = "ทดสอบคนลาเพิ่ม";

const SAMPLE: LeaveItem[] = [
	{ nickname: "ตัวอย่าง ก", kindLabel: "ลาป่วย", dateLabel: "วันเดียว" },
	{ nickname: "ตัวอย่าง ข", kindLabel: "ลากิจ", dateLabel: "วันเดียว" },
];

function normalize(s: string): string {
	return s.replace(/\s+/g, "");
}

export const previewLateLeaveCommand: LineCommand<void> = {
	name: TRIGGER,
	parse({ event, text }) {
		const selfMentions = getMentionees(event).filter(
			(m) => m.type === "user" && m.isSelf === true,
		);
		const cleaned = normalize(removeMentionRanges(text, selfMentions));
		return cleaned === normalize(TRIGGER) ? matched(undefined) : notMatched();
	},
	async handle({ config, event }) {
		if (!event.replyToken) return;
		const senderLineUserId = event.source?.userId;
		if (!senderLineUserId) return;
		if (!(await isAuthorizedLineAdmin(senderLineUserId, config))) return;

		const token = config.LINE_CHANNEL_ACCESS_TOKEN;
		if (!token) {
			await replyText(
				config,
				event.replyToken,
				"LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้ง",
			);
			return;
		}
		await replyText(config, event.replyToken, "📋 กำลังเตรียมตัวอย่าง... รอสักครู่");

		try {
			const db = getAppFirestore();
			const now = new Date();
			const ymd = bangkokYmd(now);
			const morning = await db
				.doc(`dailySummarySent/${ymd}`)
				.get()
				.then((s) => s.data() as Record<string, unknown> | undefined)
				.catch(() => undefined);
			const real = await fetchLateLeaves(
				db,
				ymd,
				resolveLateCutoffMs(ymd, morning),
			);
			const usingSample = real.length === 0;

			await pushLateLeaveNotice(
				db,
				usingSample ? SAMPLE : real,
				formatDateTH(now),
				senderLineUserId,
			);
			await pushLineMessage(token, senderLineUserId, {
				type: "text",
				text: usingSample
					? "☝️ นี่คือ**ข้อมูลตัวอย่าง** — วันนี้ยังไม่มีใครกดลาหลังสรุปเช้า\nของจริงจะส่งตอน 08:30 เฉพาะวันที่มีคนตกหล่นเท่านั้น (ไม่มี = ไม่ส่ง)"
					: `☝️ นี่คือของจริงของวันนี้ (${real.length} คน) — จะถูกส่งเข้ากลุ่มตอน 08:30`,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await pushLineMessage(token, senderLineUserId, {
				type: "text",
				text: `⚠️ ทดสอบไม่สำเร็จ: ${msg}`,
			});
		}
	},
};
