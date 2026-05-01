/**
 * LINE Messaging API helpers
 */

import type { LineMessage } from "../types.js";

/**
 * Push message(s) to a LINE user via the Messaging API.
 */
export async function pushLineMessage(
	token: string,
	to: string,
	messages: LineMessage | LineMessage[],
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
