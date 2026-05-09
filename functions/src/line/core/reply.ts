import { replyLineMessage } from "../../helpers/line.js";
import type { LineConfig } from "../../types.js";

export async function replyText(
	config: LineConfig,
	replyToken: string | undefined,
	text: string,
): Promise<void> {
	if (!replyToken) return;
	if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
		console.warn("LINE_CHANNEL_ACCESS_TOKEN is not configured; cannot reply");
		return;
	}

	await replyLineMessage(config.LINE_CHANNEL_ACCESS_TOKEN, replyToken, {
		type: "text",
		text,
	});
}
