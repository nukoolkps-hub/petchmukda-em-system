/**
 * Flex Bubble — "มีคนลาเพิ่ม" (รอบ 08:30)
 *
 * ต่างจากสรุปเช้าโดยตั้งใจ: ข้อความนี้ต้อง "สะดุดตา + อ่านจบใน 1 วินาที"
 * เพราะมันมาแทรกกลางวันทำงาน ไม่ใช่กล่องสรุปที่คนตั้งใจเปิดอ่านตอนเช้า
 * → ไม่มีภารกิจ ไม่มีเคล็ดลับ ไม่มีวันที่ยืดยาว · มีแค่ชื่อคนตัวใหญ่ๆ
 */

import { COLORS } from "../helpers/config.js";
import type { LinePushMessage } from "../types.js";
import type { LeaveItem } from "./leaves.js";

const MAROON = COLORS.maroon; // #7B1C1C
const ALERT_BG = "#FFE0B2"; // ส้มพาสเทล — เตือนแต่ไม่ดุเหมือนแดง
const ALERT_TEXT = "#7A3E00";
const CREAM = "#FFFDF5";
const CREAM_TINT = "#FFF8E7";
const TEXT_DK = "#3D2C20";
const TEXT_SOFT = "#9E8B7D";

export function buildLateLeaveFlex(
	leaves: LeaveItem[],
	dateStr: string,
): LinePushMessage {
	const rows = leaves.map((leave) => ({
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM_TINT,
		cornerRadius: "10px",
		paddingAll: "14px",
		margin: "8px",
		contents: [
			{
				type: "text",
				// ชื่อคนคือข้อมูลเดียวที่ต้องอ่านออกจากระยะไกล → ใหญ่สุดในกล่อง
				text: leave.nickname,
				size: "xxl",
				weight: "bold",
				color: MAROON,
				wrap: true,
			},
			{
				type: "text",
				text: leave.kindLabel,
				size: "lg",
				weight: "bold",
				color: TEXT_DK,
				margin: "2px",
			},
		],
	}));

	const bubble: Record<string, unknown> = {
		type: "bubble",
		size: "mega",
		header: {
			type: "box",
			layout: "vertical",
			backgroundColor: ALERT_BG,
			paddingAll: "18px",
			contents: [
				{
					type: "text",
					text: "⚠️ มีคนลาเพิ่ม",
					size: "xxl",
					weight: "bold",
					color: ALERT_TEXT,
					wrap: true,
				},
				{
					type: "text",
					text: `กดลาหลังสรุปเช้า · ${dateStr}`,
					size: "sm",
					color: ALERT_TEXT,
					margin: "4px",
					wrap: true,
				},
			],
		},
		body: {
			type: "box",
			layout: "vertical",
			backgroundColor: CREAM,
			paddingAll: "14px",
			contents: [
				{
					type: "text",
					text: `เพิ่มอีก ${leaves.length} คน`,
					size: "md",
					weight: "bold",
					color: TEXT_SOFT,
				},
				...rows,
			],
		},
	};

	return {
		type: "flex",
		altText: `⚠️ มีคนลาเพิ่ม ${leaves.length} คน — ${leaves
			.map((l) => l.nickname)
			.join(" ")}`,
		contents: bubble,
	};
}
