/**
 * ทดสอบแจ้งเตือน — admin พิมพ์ในกลุ่ม/แชทส่วนตัว → bot reply ตัวอย่าง
 * flex message ที่ notifyDailyLeaves จะส่งทุกวัน 07:30
 *
 * ถ้าวันนี้มีคนหยุดจริง → preview ด้วยข้อมูลจริง
 * ถ้าไม่มี → ใช้ mock data (พี่หมู, น้องนุ่น) เพื่อให้เห็นหน้าตา
 */

import { getAppFirestore } from "../../helpers/config.js";
import {
	bangkokToday,
	buildLeaveFlex,
	type LeaveItem,
} from "../../leave/notifyDailyLeaves.js";
import { isAuthorizedLineAdmin } from "../core/admin.js";
import { getMentionees, removeMentionRanges } from "../core/message.js";
import { replyMessage } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

const TRIGGER = "ทดสอบแจ้งเตือน";

function normalize(s: string): string {
	return s.replace(/\s+/g, "");
}

export const previewNotifyCommand: LineCommand<void> = {
	name: "ทดสอบแจ้งเตือน",
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

		const admin = await isAuthorizedLineAdmin(senderLineUserId, config);
		if (!admin) return;

		const db = getAppFirestore();
		const { ymd, thai: todayThai } = bangkokToday();

		// หาคนที่ลาวันนี้จริง — ถ้ามีใช้ของจริง ถ้าไม่มีใช้ mock
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

		let items: LeaveItem[];
		let isMock = false;
		if (todayLeaves.length > 0) {
			const empSnap = await db.collection("employees").get();
			const empById = new Map<string, Record<string, unknown>>();
			for (const e of empSnap.docs) empById.set(e.id, e.data());
			items = todayLeaves.map((leave) => {
				const emp = empById.get(String(leave.employeeId || ""));
				const nicknameVal = emp?.nickname;
				const nameVal = emp?.name;
				const fallbackVal = leave.employeeName;
				const nickname =
					(typeof nicknameVal === "string" && nicknameVal.trim()) ||
					(typeof nameVal === "string" && nameVal.trim()) ||
					(typeof fallbackVal === "string" && fallbackVal.trim()) ||
					"-";
				const kindLabel = leave.type === "sick" ? "ลาป่วย" : "ลากิจ";
				const start = String(leave.start || "");
				const end = String(leave.end || "");
				const dateLabel = start === end ? "วันเดียว" : "ช่วงนี้";
				return { nickname, kindLabel, dateLabel };
			});
		} else {
			isMock = true;
			items = [
				{ nickname: "พี่หมู", kindLabel: "ลากิจ", dateLabel: "วันเดียว" },
				{ nickname: "น้องนุ่น", kindLabel: "ลาป่วย", dateLabel: "ช่วงนี้" },
			];
		}

		await replyMessage(config, event.replyToken, [
			{
				type: "text",
				text: isMock
					? "📋 ตัวอย่างที่จะส่งทุกวัน 07:30 (วันนี้ไม่มีคนหยุดจริง — ใช้ข้อมูลตัวอย่าง)"
					: "📋 ตัวอย่างที่จะส่งทุกวัน 07:30 (ข้อมูลของวันนี้)",
			},
			buildLeaveFlex(todayThai, items),
		]);
	},
};
