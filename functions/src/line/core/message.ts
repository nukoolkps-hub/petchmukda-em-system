import type { LineEvent, LineMentionee } from "./types.js";

export function getMentionees(event: LineEvent): LineMentionee[] {
	return event.message?.mention?.mentionees || [];
}

export function isGroupOrRoom(event: LineEvent): boolean {
	return event.source?.type === "group" || event.source?.type === "room";
}

export function isBotMentioned(event: LineEvent): boolean {
	return getMentionees(event).some(
		(mentionee) => mentionee.type === "user" && mentionee.isSelf === true,
	);
}

export function isAddressedToBot(event: LineEvent): boolean {
	if (!isGroupOrRoom(event)) return true;
	return isBotMentioned(event);
}
