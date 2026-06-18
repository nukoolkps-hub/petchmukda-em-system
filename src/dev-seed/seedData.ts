/* ─── Seed data — Initial values for development ───────────────── */
/* Production: replace with API calls or database. */

import type {
  AdvanceRequest,
  Employee,
  LeaveEntry,
  Role,
  SalaryData,
} from "../types";

export const ALL_LEAVES_INIT: LeaveEntry[] = [
  // ── เดือนนี้ (เม.ย. 2569) ──
  // กมลวรรณ — ลาธรรมดา 1 + อาทิตย์ 1 (ได้โบนัสหยุดน้อย แต่หักวันอาทิตย์)
  {
    id: 101,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    type: "personal",
    start: "2026-04-07",
    end: "2026-04-07",
    days: 1,
    reason: "ธุระส่วนตัว",
    submitted: "6 เม.ย. 2569 09:00",
  },
  {
    id: 102,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    type: "sick",
    start: "2026-04-19",
    end: "2026-04-19",
    days: 1,
    reason: "ไข้หวัด",
    submitted: "18 เม.ย. 2569 08:30",
  },
  // วิภา — ลา 2 ครั้ง พอดีโควต้า
  {
    id: 103,
    employeeId: "e2",
    employeeName: "วิภา รักดี",
    type: "sick",
    start: "2026-04-09",
    end: "2026-04-09",
    days: 1,
    reason: "ไม่สบายท้อง",
    submitted: "8 เม.ย. 2569 18:00",
  },
  {
    id: 104,
    employeeId: "e2",
    employeeName: "วิภา รักดี",
    type: "personal",
    start: "2026-04-22",
    end: "2026-04-22",
    days: 1,
    reason: "ไปทำเอกสาร",
    submitted: "21 เม.ย. 2569 09:30",
  },
  // ธนกร — ลา 1 ครั้ง
  {
    id: 105,
    employeeId: "e3",
    employeeName: "ธนกร มั่นคง",
    type: "personal",
    start: "2026-04-15",
    end: "2026-04-15",
    days: 1,
    reason: "ประชุมต่างจังหวัด",
    submitted: "13 เม.ย. 2569 14:20",
  },
  // ปิยะ — ลา 3 ครั้ง (เกินโควต้า)
  {
    id: 106,
    employeeId: "e5",
    employeeName: "ปิยะ เจริญงาม",
    type: "personal",
    start: "2026-04-03",
    end: "2026-04-03",
    days: 1,
    reason: "ทำธุระ",
    submitted: "2 เม.ย. 2569 19:00",
  },
  {
    id: 107,
    employeeId: "e5",
    employeeName: "ปิยะ เจริญงาม",
    type: "sick",
    start: "2026-04-14",
    end: "2026-04-15",
    days: 2,
    reason: "ป่วยเป็นไข้",
    submitted: "13 เม.ย. 2569 22:00",
  },
  {
    id: 108,
    employeeId: "e5",
    employeeName: "ปิยะ เจริญงาม",
    type: "personal",
    start: "2026-04-28",
    end: "2026-04-28",
    days: 1,
    reason: "งานครอบครัว",
    submitted: "27 เม.ย. 2569 10:00",
  },
  // ── เดือนที่แล้ว (มี.ค. 2569) ──
  {
    id: 201,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    type: "personal",
    start: "2026-03-12",
    end: "2026-03-12",
    days: 1,
    reason: "ธุระส่วนตัว",
    submitted: "11 มี.ค. 2569 16:00",
  },
  {
    id: 202,
    employeeId: "e2",
    employeeName: "วิภา รักดี",
    type: "sick",
    start: "2026-03-20",
    end: "2026-03-20",
    days: 1,
    reason: "ไข้",
    submitted: "19 มี.ค. 2569 21:00",
  },
  {
    id: 203,
    employeeId: "e3",
    employeeName: "ธนกร มั่นคง",
    type: "personal",
    start: "2026-03-05",
    end: "2026-03-06",
    days: 2,
    reason: "ไปอบรม",
    submitted: "3 มี.ค. 2569 11:30",
  },
];

// employees directory (admin manages roles)
export const EMP_DIR_INIT: Employee[] = [
  {
    id: "e1",
    name: "กมลวรรณ สุขใจ",
    role: "พนักงานขาย",
    roleId: "sales",
    avatar: "กส",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารกสิกรไทย",
    bankAccountNumber: "123-4-56789-0",
    lineUserId: "U1234567890abcdef1234567890abcdef",
    balance: { personal: 15, sick: 15 },
    used: { personal: 2, sick: 1 },
    baseSalary: 18000,
    normalSalePieceRate: 80,
    specialSalePieceRate: 150,
    buyPieceRate: 50,
    invitePieceRate: 30,
    transferPieceRate: 20,
  },
  {
    id: "e2",
    name: "วิภา รักดี",
    role: "พนักงานขาย",
    roleId: "sales",
    avatar: "วร",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารกรุงเทพ",
    bankAccountNumber: "234-5-67890-1",
    lineUserId: "Uabcdef1234567890abcdef1234567890",
    balance: { personal: 15, sick: 15 },
    used: { personal: 2, sick: 1 },
    baseSalary: 16000,
    normalSalePieceRate: 60,
    specialSalePieceRate: 120,
    buyPieceRate: 40,
    invitePieceRate: 25,
    transferPieceRate: 15,
  },
  {
    id: "e6",
    name: "พิมพ์ใจ ทองดี",
    role: "พนักงานขาย",
    roleId: "sales",
    avatar: "พท",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารกสิกรไทย",
    bankAccountNumber: "678-9-01234-5",
    lineUserId: "",
    balance: { personal: 15, sick: 15 },
    used: { personal: 1, sick: 0 },
    poolExclusion: "buy", // 🛍 Admin ปิดฝั่งรับซื้อ
    baseSalary: 16000,
    normalSalePieceRate: 70,
    specialSalePieceRate: 130,
    buyPieceRate: 45,
    invitePieceRate: 25,
    transferPieceRate: 15,
  },
  {
    id: "e7",
    name: "สมหญิง ใจเย็น",
    role: "พนักงานขาย",
    roleId: "sales",
    avatar: "สญ",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารออมสิน",
    bankAccountNumber: "789-0-12345-6",
    lineUserId: "",
    balance: { personal: 15, sick: 15 },
    used: { personal: 0, sick: 1 },
    poolExclusion: "both", // 🔒 Admin ปิดสิทธิ์ Pool ทั้งคู่
    baseSalary: 15000,
    normalSalePieceRate: 65,
    specialSalePieceRate: 125,
    buyPieceRate: 42,
    invitePieceRate: 25,
    transferPieceRate: 15,
  },
  {
    id: "e3",
    name: "ธนกร มั่นคง",
    role: "ผู้จัดการสาขา",
    roleId: "manager",
    avatar: "ธม",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารไทยพาณิชย์",
    bankAccountNumber: "345-6-78901-2",
    lineUserId: "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1",
    balance: { personal: 15, sick: 15 },
    used: { personal: 1, sick: 1 },
    baseSalary: 28000,
    singlePieceRate: 120,
    invitePieceRate: 60,
    transferPieceRate: 40,
  },
  {
    id: "e5",
    name: "ปิยะ เจริญงาม",
    role: "ช่างทอง",
    roleId: "goldsmith",
    avatar: "ปจ",
    avatarType: "text",
    avatarImageUrl: null,
    bank: "ธนาคารกสิกรไทย",
    bankAccountNumber: "567-8-90123-4",
    lineUserId: "",
    balance: { personal: 15, sick: 15 },
    used: { personal: 2, sick: 1 },
    baseSalary: 22000,
    singlePieceRate: 90,
    invitePieceRate: 0,
    transferPieceRate: 0,
  },
];

/* ─── Salary data per employee per month (YYYY-MM) ──────────────── */
export const SALARY_INIT: SalaryData = {
  // ─── ตัวอย่างพนักงานขาย 4 คน — แสดง 4 กรณีของกฎ 80% ──
  // กมลวรรณ = Top ทั้งขายและซื้อ ✅✅
  e1: {
    "2026-04": {
      baseSalary: 18000,
      normalSalePieces: 50, // ขายทั่วไป
      specialSalePieces: 10, // ขายพิเศษ
      // → ขายรวม 60 (Top)
      buyPieces: 40, // รับซื้อ (Top)
      invitePieces: 14,
      transferPieces: 6,
      socialSecurity: 750,
      note: "",
    },
  },
  // วิภา = ผ่านทั้งคู่ ✅✅
  e2: {
    "2026-04": {
      baseSalary: 16000,
      normalSalePieces: 48,
      specialSalePieces: 10,
      // → ขายรวม 58 (96.7% ของ Top 60) ✅
      buyPieces: 35, // (87.5% ของ Top 40) ✅
      invitePieces: 8,
      transferPieces: 4,
      socialSecurity: 750,
      note: "",
    },
  },
  // พิมพ์ใจ = ขายเก่ง รับซื้อน้อย → ผ่านขายเท่านั้น ✅❌
  e6: {
    "2026-04": {
      baseSalary: 16000,
      normalSalePieces: 50,
      specialSalePieces: 8,
      // → ขายรวม 58 (96.7%) ✅
      buyPieces: 20, // (50% ของ Top 40) ❌
      invitePieces: 6,
      transferPieces: 3,
      socialSecurity: 750,
      note: "",
    },
  },
  // สมหญิง = ถูก Admin ปิดสิทธิ์ Pool + ขายน้อย → ไม่ได้เงินเดือนพื้นฐาน ❌🚫
  e7: {
    "2026-04": {
      baseSalary: 15000,
      normalSalePieces: 18,
      specialSalePieces: 4,
      // → ขายรวม 22 (36.7% ของ Top 60) ❌ < 50% ไม่ได้เงินเดือนพื้นฐาน
      buyPieces: 25, // ไม่นับเพราะถูกปิดสิทธิ์อยู่แล้ว
      invitePieces: 4,
      transferPieces: 2,
      socialSecurity: 750,
      note: "",
    },
  },
  e3: {
    "2026-04": {
      baseSalary: 28000,
      singleRatePieces: 65, // 65 × 120 = 7,800 (ผู้จัดการ — ค่าคอมแยก)
      invitePieces: 18,
      transferPieces: 9,
      socialSecurity: 750,
      note: "",
    },
  },
  e5: {
    "2026-04": {
      baseSalary: 22000,
      singleRatePieces: 42, // 42 × 90 = 3,780 (ช่างทอง — ค่าคอมแยก)
      invitePieces: 0,
      transferPieces: 0,
      socialSecurity: 750,
      note: "",
    },
  },
};

/* ─── Advance Requests (เบิกเงินล่วงหน้า) ────────────────────────── */
export const ADVANCE_REQUESTS_INIT: AdvanceRequest[] = [
  // กมลวรรณ — เดือนนี้ มี 2 รายการ (อนุมัติ 1, รออนุมัติ 1)
  {
    id: 1001,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    amount: 3000,
    reason: "ค่ารักษาพยาบาล",
    month: "2026-04",
    status: "approved",
    submittedAt: "2026-04-12T09:30:00.000Z",
    approvedAt: "2026-04-12T11:00:00.000Z",
    slipImageDataUrl: null,
  },
  {
    id: 1002,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    amount: 2000,
    reason: "ค่าเล่าเรียนลูก",
    month: "2026-04",
    status: "pending",
    submittedAt: "2026-04-25T14:20:00.000Z",
    slipImageDataUrl: null,
  },

  // กมลวรรณ — เดือนที่แล้ว
  {
    id: 1003,
    employeeId: "e1",
    employeeName: "กมลวรรณ สุขใจ",
    amount: 5000,
    reason: "ฉุกเฉิน — ซ่อมรถ",
    month: "2026-03",
    status: "approved",
    submittedAt: "2026-03-18T10:00:00.000Z",
    approvedAt: "2026-03-18T15:30:00.000Z",
    slipImageDataUrl: null,
  },

  // วิภา — รออนุมัติ
  {
    id: 1004,
    employeeId: "e2",
    employeeName: "วิภา รักดี",
    amount: 1500,
    reason: "ค่าน้ำค่าไฟ",
    month: "2026-04",
    status: "pending",
    submittedAt: "2026-04-26T19:45:00.000Z",
    slipImageDataUrl: null,
  },

  // ธนกร — อนุมัติแล้ว
  {
    id: 1005,
    employeeId: "e3",
    employeeName: "ธนกร มั่นคง",
    amount: 8000,
    reason: "ค่าหมอลูก",
    month: "2026-04",
    status: "approved",
    submittedAt: "2026-04-08T08:15:00.000Z",
    approvedAt: "2026-04-08T09:00:00.000Z",
    slipImageDataUrl: null,
  },

  // ปิยะ — ไม่อนุมัติ
  {
    id: 1006,
    employeeId: "e5",
    employeeName: "ปิยะ เจริญงาม",
    amount: 10000,
    reason: "ลงทุนส่วนตัว",
    month: "2026-04",
    status: "rejected",
    submittedAt: "2026-04-20T16:00:00.000Z",
    rejectedAt: "2026-04-20T17:00:00.000Z",
  },
];

/* ─── ตำแหน่งงาน (Roles config) ──────────────────────────────────
   poolGroup:  ตำแหน่งใน group เดียวกัน → แชร์ Pool ค่าคอม
               (รวมชิ้น แล้วแบ่งตามสัดส่วนวันทำงาน)
   ตำแหน่งที่ไม่มี poolGroup (null)
   → ใช้ Rate/ชิ้นเดียว (ค่าคอมแยก ของใครของมัน)                       */
export const ROLES_INIT: Role[] = [
  { id: "sales", name: "พนักงานขาย", poolGroup: "sales", icon: "💎" },
  { id: "manager", name: "ผู้จัดการสาขา", poolGroup: null, icon: "👔" },
  { id: "goldsmith", name: "ช่างทอง", poolGroup: null, icon: "🛠" },
  { id: "accountant", name: "ฝ่ายบัญชี", poolGroup: null, icon: "📊" },
];
