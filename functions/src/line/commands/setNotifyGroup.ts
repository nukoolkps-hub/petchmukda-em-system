/**
 * แจ้งเตือนกลุ่มนี้ / ยกเลิกแจ้งเตือนกลุ่มนี้
 *
 * Admin พิมพ์ในกลุ่ม → bot save groupId ลง config/notifications
 * → notifyDailyLeaves (07:30 ทุกวัน) จะ push เข้ากลุ่มที่ตั้งไว้
 */

import { getAppFirestore } from "../../helpers/config.js";
import { isAuthorizedLineAdmin } from "../core/admin.js";
import {
	getMentionees,
	isGroupOrRoom,
	removeMentionRanges,
} from "../core/message.js";
import { replyText } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

const SET_TRIGGER = "แจ้งเตือนกลุ่มนี้";
const UNSET_TRIGGER = "ยกเลิกแจ้งเตือนกลุ่มนี้";

type Payload = { action: "set" | "unset" };

export const setNotifyGroupCommand: LineCommand<Payload> = {
	name: "แจ้งเตือนกลุ่มนี้",
	parse({ event, text }) {
		if (!isGroupOrRoom(event)) return notMatched();

		const selfMentions = getMentionees(event).filter(
			(m) => m.type === "user" && m.isSelf === true,
		);
		const cleaned = removeMentionRanges(text, selfMentions).trim();

		if (cleaned === SET_TRIGGER) return matched({ action: "set" });
		if (cleaned === UNSET_TRIGGER) return matched({ action: "unset" });
		return notMatched();
	},
	async handle({ config, event }, payload) {
		if (!event.replyToken) return;

		const senderLineUserId = event.source?.userId;
		if (!senderLineUserId) return;

		const admin = await isAuthorizedLineAdmin(senderLineUserId, config);
		if (!admin) return;

		const groupId = event.source?.groupId || event.source?.roomId;
		if (!groupId) {
			await replyText(config, event.replyToken, "ไม่พบ Group ID");
			return;
		}

		const db = getAppFirestore();
		const ref = db.doc("config/notifications");

		if (payload.action === "set") {
			await ref.set(
				{
					employeeGroupId: groupId,
					employeeGroupSetBy: senderLineUserId,
					employeeGroupSetAt: new Date().toISOString(),
				},
				{ merge: true },
			);
			await replyText(
				config,
				event.replyToken,
				"✅ ตั้งกลุ่มนี้เป็นที่แจ้งเตือนรายวันแล้ว\nทุกวัน 07:30 จะส่งสรุปรายชื่อพนักงานที่หยุดวันนี้",
			);
			return;
		}

		// unset
		const snap = await ref.get();
		const currentGroupId = (snap.data() as Record<string, unknown> | undefined)
			?.employeeGroupId;
		if (currentGroupId !== groupId) {
			await replyText(
				config,
				event.replyToken,
				"กลุ่มนี้ไม่ใช่กลุ่มที่ตั้งไว้แจ้งเตือน",
			);
			return;
		}

		await ref.set({ employeeGroupId: null }, { merge: true });
		await replyText(
			config,
			event.replyToken,
			"✅ ยกเลิกการแจ้งเตือนกลุ่มนี้แล้ว",
		);
	},
};
