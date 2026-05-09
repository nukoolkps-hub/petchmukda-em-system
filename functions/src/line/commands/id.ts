import { replyText } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

export const idCommand: LineCommand<void> = {
	name: "id",
	parse({ text }) {
		return text.toUpperCase() === "ID" ? matched(undefined) : notMatched();
	},
	async handle({ config, event }) {
		await replyText(
			config,
			event.replyToken,
			`Your User ID:\n${event.source?.userId || "-"}\n\nนำไปใส่ในระบบเพื่อรับการแจ้งเตือน`,
		);
	},
};
