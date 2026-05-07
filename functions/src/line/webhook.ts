/**
 * lineWebhook — LINE Webhook (พิมพ์ "ID" → ตอบ User ID)
 */

import { onRequest } from "firebase-functions/v2/https";
import { getLineConfig } from "../helpers/config.js";

interface LineEvent {
	type: string;
	replyToken: string;
	message: { type: string; text: string };
	source: { userId: string };
}

export const lineWebhook = onRequest(async (request, res) => {
	if (request.method !== "POST") {
		res.status(405).send("Method Not Allowed");
		return;
	}

	try {
		const config = await getLineConfig();
		const events = (request.body.events || []) as LineEvent[];

		for (const event of events) {
			if (event.type === "message" && event.message.type === "text") {
				if (event.message.text.toUpperCase() === "ID") {
					await fetch("https://api.line.me/v2/bot/message/reply", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
						},
						body: JSON.stringify({
							replyToken: event.replyToken,
							messages: [
								{
									type: "text",
									text: `Your User ID:\n${event.source.userId}\n\nนำไปใส่ในระบบเพื่อรับการแจ้งเตือน`,
								},
							],
						}),
					});
				}
			}
		}
		res.json({ ok: true });
	} catch (err) {
		console.error("webhook error:", err);
		res.status(500).json({ ok: false });
	}
});
