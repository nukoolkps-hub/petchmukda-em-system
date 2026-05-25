import { replyText } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

export const groupIdCommand: LineCommand<void> = {
	name: "ไอดีกลุ่ม",
	parse({ event, text }) {
		if (
			(event.source?.type === "group" || event.source?.type === "room") &&
			text === "ไอดีกลุ่ม"
		) {
			return matched(undefined);
		}

		return notMatched();
	},
	async handle({ config, event }) {
		if (!event.replyToken) return;

		const groupId = event.source?.groupId || event.source?.roomId;
		if (!groupId) {
			await replyText(config, event.replyToken, "ไม่พบ Group ID");
			return;
		}

		const label = event.source?.type === "room" ? "Room ID" : "Group ID";
		await replyText(
			config,
			event.replyToken,
			`${label} ของกลุ่มนี้:\n${groupId}`,
		);
	},
};
