/**
 * Google Calendar fetcher — ดึง event ของวันนี้
 *
 * Auth: ใช้ default service account ของ Firebase project
 * (petchmukda-bot@appspot.gserviceaccount.com)
 * ต้อง share Google Calendar กับ email ของ SA ก่อน
 */

import { google } from "googleapis";
import { APP_TIMEZONE } from "./config.js";
import { getThaiDayRange } from "./dateUtils.js";

export interface CalendarEvent {
	time: string;
	title: string;
	description: string;
	location: string;
}

/** Calendar client เดียว ใช้ร่วมกันใน loop ของ runDailySummary */
export function createCalendarClient() {
	const auth = new google.auth.GoogleAuth({
		scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
	});
	return google.calendar({ version: "v3", auth });
}

export async function fetchTodayEvents(
	calendar: ReturnType<typeof createCalendarClient>,
	calendarId: string,
	now: Date,
): Promise<CalendarEvent[]> {
	const { startISO, endISO } = getThaiDayRange(now);
	const result = await calendar.events.list({
		calendarId,
		timeMin: startISO,
		timeMax: endISO,
		singleEvents: true,
		orderBy: "startTime",
		timeZone: APP_TIMEZONE,
	});
	return (result.data.items || []).map((e) => formatEvent(e));
}

function formatEvent(event: {
	start?: { date?: string | null; dateTime?: string | null };
	end?: { date?: string | null; dateTime?: string | null };
	summary?: string | null;
	description?: string | null;
	location?: string | null;
}): CalendarEvent {
	const isAllDay =
		!!event.start?.date && !event.start.dateTime;
	let time: string;
	if (isAllDay) {
		time = "🌟 ทั้งวัน";
	} else {
		const fmt = new Intl.DateTimeFormat("en-GB", {
			timeZone: APP_TIMEZONE,
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		const startStr = event.start?.dateTime
			? fmt.format(new Date(event.start.dateTime))
			: "";
		const endStr = event.end?.dateTime
			? fmt.format(new Date(event.end.dateTime))
			: "";
		time = endStr
			? `⏰ ${startStr}-${endStr} น.`
			: `⏰ ${startStr} น.`;
	}

	const description = (event.description || "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.trim();

	return {
		time,
		title: event.summary || "(ไม่มีชื่อ)",
		description,
		location: event.location || "",
	};
}
