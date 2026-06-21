/**
 * Flex Bubble — สรุปประจำวัน (pastel-of-day header + cream body)
 *
 * Layout:
 * - Header: pastel bg ของวัน + วงกลม vivid ของวัน + 🏆 หัวเรื่อง
 * - Body:
 *   - ภารกิจวันนี้ (Calendar events) — หรือ "ไม่มีภารกิจ"
 *   - คนหยุดวันนี้ (Leaves) — เฉพาะกลุ่มที่ includeLeaves
 * - Footer: เคล็ดลับมืออาชีพ (Claude tip) — เฉพาะกลุ่มที่ sendAiTip
 */

import { COLORS } from "../helpers/config.js";
import type { LinePushMessage } from "../types.js";
import type { CalendarEvent } from "./calendar.js";
import type { ThaiDayName } from "./dateUtils.js";
import type { LeaveItem } from "./leaves.js";
import { parseTipParts } from "./tip.js";

const GOLD_PALE = COLORS.goldPale; // #F5E6C8
const MAROON = COLORS.maroon; // #7B1C1C
const CREAM = "#FFFDF5";
const CREAM_TINT = "#FFF8E7";
const TEXT_DK = "#3D2C20";
const TEXT_MID = "#5D4037";
const TEXT_SOFT = "#9E8B7D";

/** สี header background — pastel ของวันในสัปดาห์ */
const DAY_PASTEL_BG: Record<ThaiDayName, string> = {
	อาทิตย์: "#FFCDD2", // ชมพูพาสเทล
	จันทร์: "#FFF59D", // เหลืองพาสเทล
	อังคาร: "#F8BBD0", // ชมพู
	พุธ: "#C8E6C9", // เขียวพาสเทล
	พฤหัสบดี: "#FFE0B2", // ส้มพาสเทล
	ศุกร์: "#BBDEFB", // ฟ้าพาสเทล
	เสาร์: "#E1BEE7", // ม่วงพาสเทล
};

/** สีวงกลมประจำวัน — vivid version (เด่นกว่า pastel background) */
const DAY_ACCENT: Record<ThaiDayName, string> = {
	อาทิตย์: "#E53935", // แดง
	จันทร์: "#FBC02D", // เหลือง
	อังคาร: "#EC407A", // ชมพูเข้ม
	พุธ: "#66BB6A", // เขียว
	พฤหัสบดี: "#FB8C00", // ส้ม
	ศุกร์: "#42A5F5", // ฟ้า
	เสาร์: "#8E24AA", // ม่วง
};

/** สีข้อความบน header pastel — ใช้สีเข้มให้อ่านง่าย */
const HEADER_TITLE = "#1A1A1A"; // ดำสนิท
const HEADER_SUB = "#3D2C20"; // น้ำตาลเข้ม

interface BuildFlexInput {
	groupName: string;
	dateStr: string; // "05/06/2026"
	dayName: ThaiDayName;
	events: CalendarEvent[];
	leaves: LeaveItem[] | null; // null = ไม่แสดง section (ไม่ใช่กลุ่มพนักงาน)
	tip: string | null; // raw tip text — null = ไม่แสดง section
	calendarError: boolean;
	/** preview mode debug — ถ้าไม่ใช่ null โชว์ error ในกล่อง tip
	 *  (ใช้ตอน admin ทดสอบเพื่อหาเหตุที่ tip ไม่ขึ้น) */
	tipDebugError?: string | null;
}

export function buildDailySummaryFlex(input: BuildFlexInput): LinePushMessage {
	const {
		groupName,
		dateStr,
		dayName,
		events,
		leaves,
		tip,
		calendarError,
		tipDebugError,
	} = input;
	const accent = DAY_ACCENT[dayName] || MAROON;
	const headerBg = DAY_PASTEL_BG[dayName] || GOLD_PALE;

	const bubble: Record<string, unknown> = {
		type: "bubble",
		size: "giga",
		header: buildHeader(groupName, dateStr, dayName, accent, headerBg),
		body: buildBody(events, leaves, calendarError, accent),
	};

	if (tip) {
		bubble.footer = buildTipFooter(tip);
	} else if (tipDebugError) {
		bubble.footer = buildTipDebugFooter(tipDebugError);
	}

	return {
		type: "flex",
		altText: `สรุปภารกิจประจำวัน (${dateStr}) — ${groupName}`,
		contents: bubble,
	};
}

/* ─── header — pastel bg ของวัน + วงกลม vivid + ตัวอักษรสีเข้ม ── */

function buildHeader(
	groupName: string,
	dateStr: string,
	dayName: ThaiDayName,
	accent: string,
	headerBg: string,
) {
	return {
		type: "box",
		layout: "horizontal",
		backgroundColor: headerBg,
		paddingAll: "0px",
		contents: [
			{
				type: "box",
				layout: "vertical",
				paddingAll: "20px",
				flex: 1,
				contents: [
					{
						type: "box",
						layout: "horizontal",
						alignItems: "center",
						contents: [
							{ type: "text", text: "🏆", size: "xxl", flex: 0 },
							{
								type: "box",
								layout: "vertical",
								paddingStart: "12px",
								contents: [
									{
										type: "text",
										text: "สรุปภารกิจประจำวัน",
										color: HEADER_TITLE,
										size: "lg",
										weight: "bold",
									},
									{
										type: "text",
										text: groupName,
										color: HEADER_SUB,
										size: "sm",
										weight: "bold",
									},
								],
							},
						],
					},
					{
						type: "box",
						layout: "horizontal",
						paddingTop: "10px",
						contents: [
							{
								type: "text",
								text: `📅 วัน${dayName}  ${dateStr}`,
								color: HEADER_SUB,
								size: "xs",
								weight: "bold",
							},
						],
					},
				],
			},
			{
				type: "box",
				layout: "vertical",
				justifyContent: "center",
				alignItems: "center",
				paddingEnd: "20px",
				flex: 0,
				contents: [
					{
						type: "box",
						layout: "vertical",
						backgroundColor: accent,
						width: "55px",
						height: "55px",
						cornerRadius: "28px",
						contents: [],
					},
				],
			},
		],
	};
}

/* ─── body — tasks + leaves sections ───────────────────────────── */

function buildBody(
	events: CalendarEvent[],
	leaves: LeaveItem[] | null,
	calendarError: boolean,
	accent: string,
): Record<string, unknown> {
	const contents: Record<string, unknown>[] = [];

	// ── Tasks section ────────────────────────────────────────────
	if (calendarError) {
		contents.push({
			type: "box",
			layout: "vertical",
			backgroundColor: "#FFF0F0",
			cornerRadius: "8px",
			paddingAll: "12px",
			contents: [
				{
					type: "text",
					text: "⚠️ ไม่สามารถเข้าถึงปฏิทินได้",
					color: "#CC0000",
					size: "sm",
					align: "center",
				},
			],
		});
	} else if (events.length === 0) {
		contents.push({
			type: "box",
			layout: "vertical",
			backgroundColor: "#F5F5F5",
			cornerRadius: "8px",
			paddingAll: "16px",
			contents: [
				{
					type: "text",
					text: "😌 ไม่มีภารกิจสำหรับวันนี้",
					color: TEXT_SOFT,
					size: "sm",
					align: "center",
				},
			],
		});
	} else {
		contents.push(
			{
				type: "text",
				text: `📋 ภารกิจวันนี้ (${events.length} รายการ)`,
				color: MAROON,
				size: "sm",
				weight: "bold",
			},
			{ type: "separator", margin: "10px", color: GOLD_PALE },
		);
		events.forEach((ev, index) => {
			if (index > 0)
				contents.push({ type: "separator", margin: "8px", color: GOLD_PALE });
			contents.push(buildEventCard(ev));
		});
	}

	// ── Leaves section (เฉพาะกลุ่มพนักงาน) ─────────────────────
	if (leaves !== null) {
		contents.push({ type: "separator", margin: "16px", color: GOLD_PALE });
		contents.push(buildLeavesSection(leaves, accent));
	}

	return {
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM,
		paddingAll: "16px",
		contents,
	};
}

function buildEventCard(ev: CalendarEvent) {
	const eventContents: Record<string, unknown>[] = [
		{
			type: "text",
			text: ev.time,
			color: "#B8860B",
			size: "xs",
			weight: "bold",
		},
		{
			type: "text",
			text: ev.title,
			color: TEXT_DK,
			size: "md",
			wrap: true,
			margin: "4px",
		},
	];
	if (ev.description) {
		eventContents.push({
			type: "text",
			text: ev.description,
			color: TEXT_MID,
			size: "xs",
			wrap: true,
			margin: "4px",
		});
	}
	if (ev.location) {
		const urlMatch = ev.location.match(/https?:\/\/\S+/);
		let labelText: string;
		let uri: string;
		if (urlMatch) {
			labelText = ev.location.replace(urlMatch[0], "").trim() || "เปิดแผนที่";
			uri = urlMatch[0];
		} else {
			labelText = ev.location;
			uri = `https://www.google.com/maps?q=${encodeURIComponent(ev.location)}`;
		}
		const truncated =
			labelText.length > 35 ? `${labelText.substring(0, 35)}…` : labelText;
		eventContents.push({
			type: "button",
			action: { type: "uri", label: `📍 ${truncated}`, uri },
			style: "primary",
			color: "#1A73E8",
			height: "sm",
			margin: "10px",
		});
	}
	return {
		type: "box",
		layout: "vertical",
		contents: eventContents,
		backgroundColor: CREAM_TINT,
		cornerRadius: "8px",
		paddingAll: "12px",
		margin: "8px",
	};
}

function buildLeavesSection(
	leaves: LeaveItem[],
	accent: string,
): Record<string, unknown> {
	if (leaves.length === 0) {
		return {
			type: "box",
			layout: "vertical",
			backgroundColor: "#F5F5F5",
			cornerRadius: "8px",
			paddingAll: "12px",
			margin: "10px",
			contents: [
				{
					type: "text",
					text: "👥 ไม่มีพนักงานหยุดวันนี้",
					color: TEXT_SOFT,
					size: "sm",
					align: "center",
				},
			],
		};
	}

	const itemContents: Record<string, unknown>[] = [
		{
			type: "text",
			text: `👥 พนักงานหยุดวันนี้ (${leaves.length} คน)`,
			color: MAROON,
			size: "sm",
			weight: "bold",
		},
		{ type: "separator", margin: "10px", color: GOLD_PALE },
	];

	// รายชื่อ inline · format: "ชื่อ(ประเภทลา) ชื่อ(ประเภทลา) ..."
	// ไม่โชว์วันที่ (ลาหลายวัน) · กระชับใน 1 text · wrap อัตโนมัติถ้าเกิน
	const inlineList = leaves
		.map((leave) => `${leave.nickname}(${leave.kindLabel})`)
		.join(" ");
	itemContents.push({
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM_TINT,
		cornerRadius: "8px",
		paddingAll: "10px",
		margin: "6px",
		contents: [
			{
				type: "text",
				text: inlineList,
				color: TEXT_DK,
				size: "sm",
				weight: "bold",
				wrap: true,
			},
		],
	});

	return {
		type: "box",
		layout: "vertical",
		margin: "10px",
		contents: itemContents,
	};
}

/* ─── footer — Claude tip ─────────────────────────────────────── */

function buildTipFooter(tip: string): Record<string, unknown> {
	const parts = parseTipParts(tip);
	const tipContents: Record<string, unknown>[] = [
		{
			type: "text",
			text: "💡 เคล็ดลับมืออาชีพวันนี้",
			color: "#B8860B",
			size: "sm",
			weight: "bold",
		},
		{ type: "separator", margin: "8px", color: GOLD_PALE },
		{
			type: "text",
			text: parts.description || tip,
			color: TEXT_MID,
			size: "sm",
			wrap: true,
			margin: "10px",
			lineSpacing: "6px",
		},
	];

	if (parts.summary) {
		tipContents.push({
			type: "box",
			layout: "vertical",
			backgroundColor: "#FFF3CD",
			cornerRadius: "6px",
			paddingAll: "10px",
			margin: "12px",
			contents: [
				{
					type: "text",
					text: `📌 ${parts.summary}`,
					color: "#B8860B",
					size: "sm",
					weight: "bold",
					wrap: true,
				},
			],
		});
	}

	return {
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM,
		paddingAll: "16px",
		paddingTop: "0px",
		contents: [
			{
				type: "box",
				layout: "vertical",
				contents: tipContents,
				backgroundColor: "#FFF8E1",
				cornerRadius: "10px",
				paddingAll: "14px",
			},
		],
	};
}

/* ─── debug footer สำหรับ preview mode — โชว์ error ของ tip ─── */

function buildTipDebugFooter(errorMessage: string): Record<string, unknown> {
	return {
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM,
		paddingAll: "16px",
		paddingTop: "0px",
		contents: [
			{
				type: "box",
				layout: "vertical",
				backgroundColor: "#FFF0F0",
				cornerRadius: "10px",
				paddingAll: "14px",
				contents: [
					{
						type: "text",
						text: "⚠️ เคล็ดลับยังไม่พร้อม (preview only)",
						color: "#CC0000",
						size: "sm",
						weight: "bold",
					},
					{
						type: "separator",
						margin: "8px",
						color: "#F0CACA",
					},
					{
						type: "text",
						text: errorMessage,
						color: "#5D4037",
						size: "xs",
						wrap: true,
						margin: "10px",
					},
					{
						type: "text",
						text: "ดูใน Functions Logs สำหรับรายละเอียดเพิ่มเติม",
						color: "#9E8B7D",
						size: "xxs",
						margin: "8px",
					},
				],
			},
		],
	};
}
