/* ─── App-wide constants ─────────────────────────────────────────── */

import {
  Briefcase as IconBriefcase,
  Stethoscope as IconStethoscope,
} from "lucide-react";

export const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap";

export const COLORS = {
  maroon: "#7B1C1C",
  maroonDark: "#5C1212",
  maroonLt: "#9B3030",
  gold: "#C9973A",
  goldLight: "#E8C87A",
  goldPale: "#F5E6C8",
  cream: "#FDF8F0",
  creamDark: "#F0E4CC",
  white: "#FFFFFF",
  text: "#2D1A0E",
  textMedium: "#7A5C3A",
  textSoft: "#B89A72",
  border: "#E8D5B0",
  red: "#C0392B",
  redLight: "#FDECEA",
  green: "#1A6B3A",
  greenLight: "#E8F5EE",
  amber: "#D97706",
  amberLight: "#FEF3C7",
};

export const THAI_MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
export const THAI_MONTH_SHORT_NAMES = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
export const THAI_SHORT_WEEKDAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export const LEAVE_TYPES = [
  {
    id: "personal",
    label: "ลากิจ",
    Icon: IconBriefcase,
    color: "#1E40AF",
    colorLt: "#DDEEFF",
  },
  {
    id: "sick",
    label: "ลาป่วย",
    Icon: IconStethoscope,
    color: "#0F766E",
    colorLt: "#CCFBF1",
  },
];

export const EMOJI_LIST = [
  "😊",
  "😄",
  "🙂",
  "😎",
  "🤩",
  "🥰",
  "😇",
  "🤗",
  "😏",
  "🥳",
  "👨‍💼",
  "👩‍💼",
  "👨‍⚕️",
  "👩‍⚕️",
  "👨‍🍳",
  "👩‍🍳",
  "👷",
  "💁",
  "🧑‍💻",
  "👮",
  "🧑‍🎨",
  "🧑‍🏫",
  "🦸",
  "🦹",
  "🧙",
  "🧝",
  "🧛",
  "🐯",
  "🦊",
  "🐼",
  "🌟",
  "💎",
  "🌺",
  "🌸",
  "🍀",
  "🦋",
  "🐉",
  "👑",
  "🎯",
  "🔥",
];

/* ─── ธนาคารหลักในประเทศไทย ─────────────────────────────────────
   `slug` ตรงกับชื่อไฟล์ SVG ใน public/banks/{slug}.svg
   `color` คือสีพื้นแบรนด์ — SVG ของ banks-logo ออกแบบเป็นโลโก้ขาว
   วางบนพื้นสีแบรนด์ (เลข hex จาก banks-logo metadata)
   โลโก้มาจาก banks-logo (casperstack) — host เองที่ public/banks/   */
export const THAI_BANKS = [
  // accountDigits = จำนวนหลักของเลขบัญชี (ไม่รวม - หรือ space) · ใช้ block
  // ตอนพิมพ์ใน EmployeeEditModal + ProfileSetupModal · ค่ามาตรฐานปัจจุบัน
  // (อิงข้อมูลบัตร debit/PromptPay) · ส่วนใหญ่ 10 หลัก ยกเว้น ออมสิน +
  // ธ.ก.ส. + สแตนดาร์ดชาร์เตอร์ด ที่ใช้ 12 หลัก
  { name: "ธนาคารกสิกรไทย", short: "KBank", slug: "kbank", color: "#138f2d", accountDigits: 10 },
  { name: "ธนาคารกรุงเทพ", short: "BBL", slug: "bbl", color: "#1e4598", accountDigits: 10 },
  { name: "ธนาคารกรุงไทย", short: "KTB", slug: "ktb", color: "#1ba5e1", accountDigits: 10 },
  { name: "ธนาคารไทยพาณิชย์", short: "SCB", slug: "scb", color: "#4e2e7f", accountDigits: 10 },
  { name: "ธนาคารกรุงศรีอยุธยา", short: "BAY", slug: "bay", color: "#fec43b", accountDigits: 10 },
  {
    name: "ธนาคารทหารไทยธนชาต",
    short: "TTB",
    slug: "ttb",
    color: "#ee871e",
    solid: true,
    accountDigits: 10,
  },
  {
    name: "ธนาคารออมสิน",
    short: "GSB",
    slug: "gsb",
    color: "#eb198d",
    // โลโก้ทางการเป็นตราครุฑรายละเอียดสูง — ย่อเล็กแล้วอ่านไม่ออก
    // ใช้ wordmark ตัวอักษรแทน (คมชัดทุกขนาด)
    textLogo: true,
    accountDigits: 12,
  },
  { name: "ธนาคาร ธ.ก.ส.", short: "BAAC", slug: "baac", color: "#4b9b1d", accountDigits: 12 },
  { name: "ธนาคารอาคารสงเคราะห์", short: "GHB", slug: "ghb", color: "#f7941e", accountDigits: 10 },
  { name: "ธนาคารยูโอบี", short: "UOB", slug: "uob", color: "#0b3979", accountDigits: 10 },
  { name: "ธนาคารซีไอเอ็มบี", short: "CIMB", slug: "cimb", color: "#7e2f36", accountDigits: 10 },
  {
    name: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
    short: "LH Bank",
    slug: "lhb",
    color: "#6d6e71",
    accountDigits: 10,
  },
  { name: "ธนาคารไอซีบีซี", short: "ICBC", slug: "icbc", color: "#c50f1c", accountDigits: 10 },
  {
    name: "ธนาคารสแตนดาร์ดชาร์เตอร์ด",
    short: "SCBT",
    slug: "sc",
    color: "#0473EA",
    accountDigits: 12,
  },
  { name: "ธนาคารทิสโก้", short: "TISCO", slug: "tisco", color: "#003F87", accountDigits: 10 },
  { name: "ธนาคารเกียรตินาคินภัทร", short: "KKP", slug: "kkp", color: "#199cc5", accountDigits: 10 },
  {
    name: "ธนาคารอิสลามแห่งประเทศไทย",
    short: "IBANK",
    slug: "ibank",
    color: "#008C44",
    accountDigits: 10,
  },
];

/** จำนวนหลักสูงสุดของเลขบัญชี (digit only, ไม่นับ -/space) ตามธนาคาร ·
 *  default 15 (ค่อนข้างหลวม) สำหรับกรณีไม่รู้จัก / ยังไม่เลือกธนาคาร */
export function getBankAccountDigits(bankName: string | null | undefined): number {
  if (!bankName) return 15;
  const found = THAI_BANKS.find((b) => b.name === bankName);
  return (found as { accountDigits?: number } | undefined)?.accountDigits ?? 15;
}

export const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

/* ─── Business rules (คอนฟิกของบริษัท) ─────────────────────────────
   ค่าเหล่านี้คือ "สูตร/กฎของบริษัท" — แก้ที่นี่ที่เดียวจะปรับทุกที่
   อนาคต: ย้ายไปเป็น settings ใน admin panel ให้แก้ผ่าน UI ได้     */
export const BUSINESS_RULES = {
  /** จำนวนวันต่อเดือน (สมมติให้คงที่ ใช้ในสูตร Pool) */
  DAYS_PER_MONTH: 30,

  /** โควต้าวันลาธรรมดา (ครั้ง/เดือน) — เกินจะถูกหัก */
  WEEKDAY_LEAVE_QUOTA: 2,

  /** ตัวคูณวันอาทิตย์ที่ลา (1.5 = 1.5 เท่าของ day rate) */
  SUNDAY_LEAVE_MULTIPLIER: 1.5,

  /** เกณฑ์ Pool — ขายต่ำกว่า 80% ของ Top → ตัดออกจาก Pool */
  POOL_THRESHOLD: 0.8,

  /** จำนวนวันลา "ฟรี" ต่อเดือนสำหรับสูตรกองกลาง (Pool) — วันที่ ≤ n นี้
   *  ไม่ถูกหัก % และไม่ถูกเอามาเกลี่ยให้เพื่อน · วันที่เกินจากนี้ค่อย
   *  เริ่มหัก. ตัวอย่าง n=2: ลา 5 วัน → ใช้ 3 วันคำนวณ % หัก, ลา 2 วัน → 0
   *  ไม่เกี่ยวกับโบนัสหยุดน้อย (ใช้ WEEKDAY_LEAVE_QUOTA ต่างหาก) */
  LEAVE_DEDUCTION_FREE_DAYS: 2,

  /** เกณฑ์เงินเดือนพื้นฐาน — poolExclusion='both' + ขาย < 50% ของ Top → ไม่ได้เงินเดือนพื้นฐาน */
  BASE_SALARY_THRESHOLD: 0.5,

  /** เพดานการเบิกเงินล่วงหน้า — สูงสุดกี่ % ของเงินเดือนพื้นฐาน */
  ADVANCE_LIMIT_PERCENT: 0.5,
};

/* ─── Validation patterns ─────────────────────────────────────────── */
export const VALIDATION = {
  /** LINE User ID: ต้องขึ้นต้น U + ตามด้วย hex 32 ตัว */
  LINE_USER_ID_PATTERN: /^U[a-f0-9]{32}$/,

  /** เลขบัญชีธนาคาร: ตัวเลข 9-15 หลัก (รวม dash) */
  BANK_ACCOUNT_PATTERN: /^[\d-]{9,20}$/,

  /** ขั้นต่ำเลขบัญชี (เลขเฉพาะ) */
  BANK_ACCOUNT_MIN_DIGITS: 9,
};
