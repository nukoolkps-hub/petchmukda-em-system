/* ─── จัด format เลขบัญชีธนาคารสำหรับ "แสดงผล" (ใส่ -) ─────────────────
   ⚠️ ใช้แค่ตอนแสดงผล · การคัดลอก/ส่งข้อมูลให้ใช้เลขล้วนเสมอ (strip - ก่อน)
   ฟังก์ชันนี้แค่จัดกลุ่มตัวเลขให้อ่านง่าย ไม่แตะตัวเลขจริง

   pattern ตาม "จำนวนหลัก" ของเลขบัญชี (ตัด - / ช่องว่างออกก่อน):
   - 10 หลัก → XXX-X-XXXXX-X  (มาตรฐานไทย · กสิกร/ไทยพาณิชย์/กรุงเทพ/กรุงไทย/
     กรุงศรี/ทหารไทยธนชาต/GHB/UOB/CIMB/LH/ICBC/TISCO/KKP/IBANK = 15 ธนาคาร)
   - 12 หลัก → XXX-X-XXXXX-XXX  (ออมสิน/ธ.ก.ส./สแตนดาร์ดชาร์เตอร์ด · 12 หลัก
     ไม่มี format ตายตัว → จัดกลุ่มให้อ่านง่าย best-effort)
   - จำนวนหลักอื่น/ไม่ครบ → คืนเลขล้วน (กันใส่ - ผิดตำแหน่ง)                  */

const ACCOUNT_GROUPINGS: Record<number, number[]> = {
  10: [3, 1, 5, 1],
  12: [3, 1, 5, 3],
};

/** "1138172771" → "113-8-17277-1" · เลขที่มี - อยู่แล้วก็ regroup ให้ตรง pattern
 *  · ความยาวไม่เข้า pattern → คืนเลขล้วน (ไม่เดา) */
export function formatBankAccount(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const groups = ACCOUNT_GROUPINGS[digits.length];
  if (!groups) return digits || raw;
  const parts: string[] = [];
  let i = 0;
  for (const len of groups) {
    parts.push(digits.slice(i, i + len));
    i += len;
  }
  return parts.join("-");
}
