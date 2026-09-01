import { COLORS } from "../../helpers/config.js";
import type { LinePushMessage } from "../../types.js";
import { isAuthorizedLineAdmin } from "../core/admin.js";
import { replyMessage } from "../core/reply.js";
import { type LineCommand, matched, notMatched } from "../core/types.js";

const HELP_ALT_TEXT = "คำสั่งสำหรับผู้ดูแลระบบ";
const CREAM = "#FFFDF5";
const TEXT_SOFT = "#9E8B7D";

export const helpCommand: LineCommand<void> = {
	name: "คำสั่ง",
	parse({ text }) {
		return text === "คำสั่ง" ? matched(undefined) : notMatched();
	},
	async handle({ config, event }) {
		if (event.source?.type !== "user") return;
		if (!event.replyToken) return;

		const senderLineUserId = event.source.userId;
		if (!senderLineUserId) return;

		const admin = await isAuthorizedLineAdmin(senderLineUserId, config);
		if (!admin) return;

		await replyMessage(config, event.replyToken, makeHelpFlexMessage());
	},
};

function makeHelpFlexMessage(): LinePushMessage {
	return {
		type: "flex",
		altText: HELP_ALT_TEXT,
		contents: {
			type: "bubble",
			size: "giga",
			header: {
				type: "box",
				layout: "vertical",
				backgroundColor: COLORS.maroon,
				paddingAll: "16px",
				contents: [
					{
						type: "text",
						text: HELP_ALT_TEXT,
						color: COLORS.goldLight,
						weight: "bold",
						size: "lg",
					},
					{
						type: "text",
						text: "ห้างเพชรทองมุกดา",
						color: COLORS.goldLight,
						size: "xs",
						margin: "sm",
					},
				],
			},
			body: {
				type: "box",
				layout: "vertical",
				spacing: "md",
				contents: [
					commandBox({
						command: "ไอดีฉัน",
						description: "ดูไอดี LINE ของตัวเอง",
						scope: "แชทส่วนตัว",
					}),
					commandBox({
						command: "คำสั่ง",
						description: "ดูคำสั่งทั้งหมด",
						scope: "แชทส่วนตัว",
					}),
					commandBox({
						command: "ไอดีกลุ่ม",
						description: "ดู Group ID ของกลุ่มนี้",
						scope: "กลุ่ม",
					}),
					commandBox({
						command: "@บอท ไอดี @ผู้ใช้ไลน์",
						description: "ดูไอดี LINE ของผู้ใช้ที่แท็ก",
						scope: "กลุ่ม",
					}),
					commandBox({
						command: "@บอท เชื่อมพนักงาน @พนักงาน",
						description: "เชื่อมบัญชี LINE ให้พนักงานจากการแท็ก",
						scope: "กลุ่ม",
					}),
					commandBox({
						command: "@บอท เชื่อมพนักงาน @พนักงาน ชื่อพนักงาน",
						description: "เชื่อมหรือเพิ่มพนักงานด้วยชื่อที่ระบุ",
						scope: "กลุ่ม",
					}),
					commandBox({
						command: "ทดสอบแจ้งเตือน",
						description:
							"Bot push ตัวอย่างสรุปประจำวัน (Calendar + คนหยุด + เคล็ดลับ) มาให้ดู",
						scope: "แชทส่วนตัว",
					}),
					commandBox({
						command: "ทดสอบคนลาเพิ่ม",
						description: 'Bot push ตัวอย่างกล่อง "มีคนลาเพิ่ม" (รอบ 08:30) มาให้ดู',
						scope: "แชทส่วนตัว",
					}),
				],
			},
			footer: scheduleFooter(),
		},
	};
}

/* ─── สิ่งที่บอทส่งเองโดยไม่ต้องสั่ง ──────────────────────────────
   admin มักถามว่า "บอทส่งอะไรตอนไหนบ้าง" — ใส่ไว้ท้ายการ์ดคำสั่งเลย
   จะได้ไม่ต้องเปิดหน้าเว็บดู · เพิ่มงานตามเวลาใหม่ต้องมาเติมที่นี่ด้วย */
function scheduleFooter(): Record<string, unknown> {
	const rows: [string, string][] = [
		["07:30", "สรุปประจำวัน — ภารกิจ + คนหยุด + เคล็ดลับ (เสาร์ปกติข้าม)"],
		["08:30", "มีคนลาเพิ่ม — เฉพาะคนที่กดลาหลังสรุปเช้า (ไม่มี = ไม่ส่ง)"],
		["ทันที", "ผลอนุมัติเบิกเงิน / เงินกู้ใหม่ → ส่งหาพนักงานคนนั้น"],
	];

	return {
		type: "box",
		layout: "vertical",
		backgroundColor: CREAM,
		paddingAll: "14px",
		spacing: "sm",
		contents: [
			{
				type: "text",
				text: "แจ้งเตือนอัตโนมัติ",
				color: COLORS.maroon,
				weight: "bold",
				size: "sm",
			},
			...rows.map(([time, what]) => ({
				type: "box",
				layout: "baseline",
				spacing: "sm",
				contents: [
					{
						type: "text",
						text: time,
						color: COLORS.maroon,
						weight: "bold",
						size: "xs",
						flex: 2,
					},
					{
						type: "text",
						text: what,
						color: COLORS.textMedium,
						size: "xs",
						flex: 9,
						wrap: true,
					},
				],
			})),
			{
				type: "text",
				text: "เปิด-ปิดได้ที่ เว็บแอป → ผู้ดูแล → LINE BOT → การแจ้งเตือน",
				color: TEXT_SOFT,
				size: "xxs",
				margin: "md",
				wrap: true,
			},
		],
	};
}

function commandBox({
	command,
	description,
	scope,
}: {
	command: string;
	description: string;
	scope: CommandScope;
}): Record<string, unknown> {
	return {
		type: "box",
		layout: "vertical",
		backgroundColor: COLORS.goldPale,
		cornerRadius: "8px",
		paddingAll: "12px",
		spacing: "sm",
		contents: [
			{
				type: "box",
				layout: "horizontal",
				justifyContent: "flex-end",
				contents: [scopeBadge(scope)],
			},
			{
				type: "text",
				text: command,
				color: COLORS.maroon,
				weight: "bold",
				size: "sm",
				wrap: true,
			},
			{
				type: "text",
				text: description,
				color: COLORS.textMedium,
				size: "xs",
				wrap: true,
			},
		],
	};
}

type CommandScope = "แชทส่วนตัว" | "กลุ่ม";

function scopeBadge(scope: CommandScope): Record<string, unknown> {
	const isDirect = scope === "แชทส่วนตัว";

	return {
		type: "box",
		layout: "vertical",
		backgroundColor: isDirect ? COLORS.greenLight : COLORS.goldLight,
		cornerRadius: "999px",
		paddingStart: "10px",
		paddingEnd: "10px",
		paddingTop: "3px",
		paddingBottom: "3px",
		flex: 0,
		contents: [
			{
				type: "text",
				text: scope,
				color: isDirect ? COLORS.green : COLORS.maroon,
				size: "xxs",
				weight: "bold",
				align: "center",
			},
		],
	};
}
