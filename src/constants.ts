/* ─── App-wide constants ─────────────────────────────────────────── */

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
export const THAI_SHORT_WEEKDAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export const LEAVE_TYPES = [
  {
    id: "personal",
    label: "ลากิจ",
    icon: "💼",
    color: COLORS.gold,
    colorLt: COLORS.goldPale,
  },
  {
    id: "sick",
    label: "ลาป่วย",
    icon: "🏥",
    color: COLORS.red,
    colorLt: COLORS.redLight,
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
  { name: "ธนาคารกสิกรไทย", short: "KBank", slug: "kbank", color: "#138f2d" },
  { name: "ธนาคารกรุงเทพ", short: "BBL", slug: "bbl", color: "#1e4598" },
  { name: "ธนาคารกรุงไทย", short: "KTB", slug: "ktb", color: "#1ba5e1" },
  { name: "ธนาคารไทยพาณิชย์", short: "SCB", slug: "scb", color: "#4e2e7f" },
  { name: "ธนาคารกรุงศรีอยุธยา", short: "BAY", slug: "bay", color: "#fec43b" },
  {
    name: "ธนาคารทหารไทยธนชาต",
    short: "TTB",
    slug: "ttb",
    color: "#ee871e",
    solid: true,
  },
  { name: "ธนาคารออมสิน", short: "GSB", slug: "gsb", color: "#eb198d" },
  { name: "ธนาคาร ธ.ก.ส.", short: "BAAC", slug: "baac", color: "#4b9b1d" },
  { name: "ธนาคารอาคารสงเคราะห์", short: "GHB", slug: "ghb", color: "#f7941e" },
  { name: "ธนาคารยูโอบี", short: "UOB", slug: "uob", color: "#0b3979" },
  { name: "ธนาคารซีไอเอ็มบี", short: "CIMB", slug: "cimb", color: "#7e2f36" },
  {
    name: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
    short: "LH Bank",
    slug: "lhb",
    color: "#6d6e71",
  },
  { name: "ธนาคารไอซีบีซี", short: "ICBC", slug: "icbc", color: "#c50f1c" },
  {
    name: "ธนาคารสแตนดาร์ดชาร์เตอร์ด",
    short: "SCBT",
    slug: "sc",
    color: "#0473EA",
  },
  { name: "ธนาคารทิสโก้", short: "TISCO", slug: "tisco", color: "#003F87" },
  { name: "ธนาคารเกียรตินาคินภัทร", short: "KKP", slug: "kkp", color: "#199cc5" },
  {
    name: "ธนาคารอิสลามแห่งประเทศไทย",
    short: "IBANK",
    slug: "ibank",
    color: "#008C44",
  },
];

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
