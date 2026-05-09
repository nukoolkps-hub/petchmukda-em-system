import { isBotMentioned, isGroupOrRoom } from "../core/message.js";
import { replyText } from "../core/reply.js";
import type { LineCommandContext } from "../core/types.js";

const FALLBACK_REPLY_TEXT = `ไม่รู้จักคำสั่งนี้
คำสั่งที่ใช้ได้:
- ID
- @BOT setup employee @EMPLOYEE หรือ @BOT setup employee @EMPLOYEE ชื่อพนักงาน`;

export async function fallbackCommand(ctx: LineCommandContext): Promise<void> {
	if (!shouldReplyToFallback(ctx)) return;
	await replyText(ctx.config, ctx.event.replyToken, FALLBACK_REPLY_TEXT);
}

function shouldReplyToFallback({ event, text }: LineCommandContext): boolean {
	return !isGroupOrRoom(event) || isBotMentioned(event) || text.startsWith("/");
}
