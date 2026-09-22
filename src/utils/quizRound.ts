/* ─── รอบสอบ (QR ให้พนักงานสแกนทำข้อสอบจากมือถือตัวเอง) — logic ล้วน ──
   ADMIN กด "เปิดรอบสอบ" → ได้รหัสรอบ + QR · พนักงานสแกนแล้วทำข้อสอบได้
   **โดยไม่ต้อง login** → รหัสรอบคือสิ่งเดียวที่กั้นอยู่ จึงต้อง

   1. เดาไม่ได้ (สุ่ม 6 ตัวจาก 32 ตัวอักษร ≈ 1,000 ล้านแบบ)
   2. **มีอายุ** — เปิดค้างไว้ = ใครก็เข้ามาเริ่มจับเวลาเล่นได้ตลอด
   3. ปิดเองได้ทันทีเมื่อสอบเสร็จ

   ตัวตัดสินจริงว่ารอบยังเปิดอยู่ไหมอยู่ที่ Cloud Function (`quizGuestJoin`)
   ที่อ่าน `/config/quizRound` ด้วย Admin SDK — ไฟล์นี้ใช้ทั้งฝั่ง UI (โชว์
   สถานะ/นับถอยหลัง) และเป็นกฎเดียวกับที่ฝั่ง server เช็ค                   */

/** doc `/config/quizRound` — มีรอบเดียวในระบบ (เปิดรอบใหม่ = ทับของเดิม) */
export interface QuizRound {
  /** รหัสรอบที่อยู่ใน QR · ว่าง = ยังไม่เคยเปิดรอบเลย */
  code: string;
  /** ชุดข้อสอบที่ตรึงไว้ตอนเปิดรอบ — เปลี่ยนชุดที่ใช้สอบกลางรอบต้องไม่สลับโจทย์ */
  quizId: string;
  quizTitle: string;
  openedAt: number;
  openedBy: string;
  /** หมดอายุอัตโนมัติ (epoch ms) */
  closesAt: number;
  /** ADMIN กดปิดเอง (epoch ms) · null = ยังไม่ได้กดปิด */
  closedAt: number | null;
}

export const EMPTY_QUIZ_ROUND: QuizRound = {
  code: "",
  quizId: "",
  quizTitle: "",
  openedAt: 0,
  openedBy: "",
  closesAt: 0,
  closedAt: null,
};

/** ตัวเลือกความยาวรอบ — สั้นไว้ก่อน ต่ออายุด้วยการกดเปิดรอบใหม่ได้เสมอ */
export const ROUND_DURATION_OPTIONS = [
  { hours: 2, label: "2 ชั่วโมง" },
  { hours: 4, label: "4 ชั่วโมง" },
  { hours: 8, label: "8 ชั่วโมง" },
] as const;

/** ตัวอักษรที่ใช้ในรหัสรอบ — **ตัด I O 0 1 ทิ้ง** เพราะต้องอ่านจากจอแล้ว
 *  พิมพ์เองได้ด้วยเมื่อสแกน QR ไม่ติด (เลขศูนย์กับตัวโอสลับกันบ่อย) */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** สุ่มรหัสรอบ — `rand` ฉีดเข้ามาได้เพื่อให้เทสต์คุมผลลัพธ์ได้ */
export function makeRoundCode(rand: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const idx =
      Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length;
    code += CODE_ALPHABET[idx];
  }
  return code;
}

/** รหัสที่ผู้ใช้พิมพ์/มาจาก URL → รูปแบบมาตรฐาน (ตัวใหญ่ ไม่มีช่องว่าง) */
export function normalizeRoundCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** รอบนี้ยังเปิดให้เริ่มสอบได้ไหม — กฎเดียวกับที่ Cloud Function เช็ค
 *
 *  ปิดเอง (`closedAt`) และหมดอายุ (`closesAt`) แยกกันคนละเหตุผล แต่ผลเท่ากัน
 *  คือ "เริ่มใหม่ไม่ได้" · คนที่เริ่มไปแล้วยังทำต่อจนหมดเวลาของตัวเองได้
 *  (นาฬิกาของใบสอบอิง `startedAt` ของใบนั้น ไม่ใช่ของรอบ)                  */
export function isRoundOpen(
  round: QuizRound | null | undefined,
  now: number,
): boolean {
  if (!round?.code || !round.quizId) return false;
  if (round.closedAt) return false;
  return round.closesAt > now;
}

/** เหลือเวลาอีกเท่าไรก่อนรอบปิดเอง (ms · ปิดแล้ว/หมดแล้ว = 0) */
export function roundRemainingMs(
  round: QuizRound | null | undefined,
  now: number,
): number {
  if (!isRoundOpen(round, now)) return 0;
  return Math.max(0, (round?.closesAt ?? 0) - now);
}

/** ลิงก์ที่ฝังใน QR — HashRouter จึงต้องมี `#` เสมอ
 *
 *  `origin` ส่งเข้ามา (ไม่อ่าน `window` ตรงๆ) เพื่อให้เทสต์ได้ และเพื่อให้
 *  ลิงก์ที่โชว์บนจอเป็นโดเมนจริงที่พนักงานเปิดได้ ไม่ใช่ localhost ของเครื่อง */
export function examLink(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/#/exam/${normalizeRoundCode(code)}`;
}
