/**
 * LINE Messaging API helpers
 */

import type { LinePushMessage } from "../types.js";

/**
 * Push message(s) to a LINE user via the Messaging API.
 */
export async function pushLineMessage(
	token: string,
	to: string,
	messages: LinePushMessage | LinePushMessage[],
): Promise<void> {
	await fetch("https://api.line.me/v2/bot/message/push", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			to,
			messages: Array.isArray(messages) ? messages : [messages],
		}),
	});
}

/**
 * Reply to a LINE webhook event.
 */
export async function replyLineMessage(
	token: string,
	replyToken: string,
	messages: LinePushMessage | LinePushMessage[],
): Promise<void> {
	const response = await fetch("https://api.line.me/v2/bot/message/reply", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			replyToken,
			messages: Array.isArray(messages) ? messages : [messages],
		}),
	});

	if (!response.ok) {
		console.error("LINE reply failed:", response.status, await response.text());
	}
}
