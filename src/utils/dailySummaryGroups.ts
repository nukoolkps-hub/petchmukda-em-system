/* ─── กลุ่ม LINE ที่รับ "สรุปประจำวัน 07:30" ─────────────────────────
   เดิม hardcode ไว้ใน `functions/src/dailySummary/config.ts`
   (`DAILY_SUMMARY_GROUPS`) — ต้องแก้โค้ด + deploy ทุกครั้งที่เปลี่ยนกลุ่ม
   ตอนนี้ ADMIN ตั้งเองได้ที่ /admin → LINE BOT → การแจ้งเตือน
   เก็บใน `config/notifications.dailySummaryGroups`

   ไฟล์นี้เป็น pure logic (validate/normalize) — ใช้ทั้งฝั่ง UI ตอนบันทึก
   และเป็นสัญญาว่า server ต้องอ่านรูปทรงแบบไหน                            */

/** LINE target ID ที่รับได้:
 *  - `C…` = กลุ่ม (group) · `R…` = ห้องแชท (room) · `U…` = 1:1 กับผู้ใช้
 *  ตามด้วย hex 32 ตัว (ตัวพิมพ์เล็ก) — รูปแบบเดียวกับ VALIDATION.LINE_USER_ID_PATTERN
 *  แต่กว้างกว่าเพราะรับ C/R ด้วย */
export const LINE_TARGET_ID_PATTERN = /^[CRU][0-9a-f]{32}$/;

export function isValidLineTargetId(id: unknown): id is string {
  return typeof id === "string" && LINE_TARGET_ID_PATTERN.test(id.trim());
}

export interface DailySummaryGroupConfig {
  /** LINE group/room/user ID ปลายทาง — คีย์หลัก (ห้ามซ้ำ) */
  lineTargetId: string;
  /** ชื่อที่ ADMIN ตั้งไว้ให้จำง่าย (โชว์ใน UI + log เท่านั้น) */
  name: string;
  /** Google Calendar ที่ดึง "ภารกิจวันนี้" — ว่าง = ไม่ดึงปฏิทิน */
  calendarId?: string;
  /** ส่ง "เคล็ดลับมืออาชีพ" (Claude API) ให้กลุ่มนี้ไหม */
  sendAiTip?: boolean;
  /** รวม "พนักงานหยุดวันนี้" ไหม — ใช้กับกลุ่มพนักงานเท่านั้น */
  includeLeaves?: boolean;
  /** แนบรูปที่ ADMIN ตั้งวันส่งไว้ (dailySummaryImages) ไหม */
  sendScheduledImage?: boolean;
}

/** ทำความสะอาด list ที่อ่านมาจาก Firestore / ที่ ADMIN กำลังจะบันทึก
 *  - ตัดตัวที่ ID ผิดรูปแบบทิ้ง (กัน push ไป target มั่ว → LINE error รายวัน)
 *  - ตัด ID ซ้ำ (เก็บตัวแรก) — ไม่งั้นกลุ่มเดียวได้ข้อความ 2 รอบ
 *  - trim ช่องว่าง + บังคับ boolean ให้เป็น boolean จริง
 *  คืน array ใหม่เสมอ (ไม่แก้ของเดิม)                                    */
export function normalizeDailySummaryGroups(
  raw: unknown,
): DailySummaryGroupConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DailySummaryGroupConfig[] = [];
  for (const item of raw) {
    const g = item as Partial<DailySummaryGroupConfig> | null;
    const id = typeof g?.lineTargetId === "string" ? g.lineTargetId.trim() : "";
    if (!isValidLineTargetId(id) || seen.has(id)) continue;
    seen.add(id);
    const calendarId =
      typeof g?.calendarId === "string" ? g.calendarId.trim() : "";
    out.push({
      lineTargetId: id,
      name:
        (typeof g?.name === "string" ? g.name.trim() : "") || id.slice(0, 8),
      ...(calendarId ? { calendarId } : {}),
      sendAiTip: g?.sendAiTip === true,
      includeLeaves: g?.includeLeaves === true,
      sendScheduledImage: g?.sendScheduledImage === true,
    });
  }
  return out;
}
