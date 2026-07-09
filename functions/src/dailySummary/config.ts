/**
 * config + ค่าคงที่ของ dailySummary
 *
 * CONFIG: list ของกลุ่ม LINE ที่ส่งข้อความเข้าทุกเช้า 07:30
 * - calendarId  : Google Calendar ที่จะดึง event ออกมาแสดงเป็น "ภารกิจวันนี้"
 * - lineTargetId: LINE Group/Room ID ปลายทาง
 * - sendAiTip   : ส่ง "เคล็ดลับมืออาชีพ" (เรียก Claude API) ไหม
 * - includeLeaves: รวม "พนักงานหยุดวันนี้" ในกลุ่มนี้ไหม (ใช้กับกลุ่มพนักงานเท่านั้น)
 *
 * **Service Account ต้องถูก share เข้า Google Calendar ทั้ง 3 ก่อน:**
 * 1. เปิด Google Calendar settings ของ calendarId ที่กำหนดไว้
 * 2. Share with specific people → ใส่ `petchmukda-bot@appspot.gserviceaccount.com`
 * 3. Permission: "See all event details" (read-only ก็พอ)
 */

export const APP_TIMEZONE = "Asia/Bangkok";
export const AI_MODEL = "claude-sonnet-4-6";
export const AI_MAX_TOKENS = 1024;
/** จำนวน tip ล่าสุดที่ดึงมา dedup ก่อนยิง Claude */
export const RECENT_TIPS_LIMIT = 30;
/** retry กี่ครั้งถ้า Claude ตอบซ้ำ */
export const TIP_RETRY_LIMIT = 3;
/** เก็บ recentTips ย้อนหลังกี่วัน — เกินนี้ cleanupOldTips ลบทิ้ง */
export const RECENT_TIPS_RETENTION_DAYS = 60;
/** ชื่อวันเสาร์ — ใช้ skip การส่งเคล็ดลับวันเสาร์ที่ไม่มี event */
export const SAT_DAY_NAME = "เสาร์";

export interface DailySummaryGroup {
	name: string;
	calendarId: string;
	lineTargetId: string;
	sendAiTip: boolean;
	includeLeaves: boolean;
	/** แนบ "รูปที่ตั้งเวลาไว้" (admin อัปโหลด + กำหนดวันส่ง) เข้าข้อความเช้านี้ไหม
	 *  — เฉพาะกลุ่มพนักงาน (we r mukda) · ดู dailySummaryImages collection      */
	sendScheduledImage?: boolean;
}

export const DAILY_SUMMARY_GROUPS: DailySummaryGroup[] = [
	{
		name: "we r mukda",
		calendarId:
			"85c5e9c2aa3564528eaff72fc802823c23170d11ea44547281e301d148c50f72@group.calendar.google.com",
		lineTargetId: "C731807ff80bde798e0f8ab6bcfcd69c9",
		sendAiTip: true,
		includeLeaves: true, // กลุ่มพนักงาน — แสดงคนหยุดด้วย
		sendScheduledImage: true, // แนบรูปที่ admin ตั้งเวลาไว้ (ถ้าตรงวัน)
	},
	{
		name: "Various Tasks",
		calendarId:
			"ccfda0fd8477b5eab5538529972d623a030ef4fcf47be494fd1e30bfa9b4f181@group.calendar.google.com",
		lineTargetId: "Cde0eb18343de6494209622308c8824b4",
		sendAiTip: false,
		includeLeaves: false,
	},
	{
		name: "KS Apartment",
		calendarId:
			"2f611e5c6ca2b2b27f1fc562665d914c1c23e594c9dea2b481d47eef7806aca4@group.calendar.google.com",
		lineTargetId: "C54ada2d79e2258dd7d18cfbce6d2d17a",
		sendAiTip: false,
		includeLeaves: false,
	},
];
