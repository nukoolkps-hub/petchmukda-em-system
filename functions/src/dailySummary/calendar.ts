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
	// event อาจไม่มี dateTime ทั้ง start/end (allday) หรือมีแค่ start
	const startDT = event.start?.dateTime;
	const endDT = event.end?.dateTime;
	const isAllDay = !startDT;

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
		const startStr = fmt.format(new Date(startDT));
		const endStr = endDT ? fmt.format(new Date(endDT)) : "";
		time = endStr ? `⏰ ${startStr}-${endStr} น.` : `⏰ ${startStr} น.`;
	}

	return {
		time,
		title: event.summary || "(ไม่มีชื่อ)",
		description: stripHtml(event.description || ""),
		location: event.location || "",
	};
}

/** ตัด HTML tag + decode entity ที่พบบ่อยใน Google Calendar description */
function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
			String.fromCharCode(parseInt(n, 16)),
		)
		.trim();
}
