/* ─── Domain Types ──────────────────────────────────────────── */

export type LeaveKind = "personal" | "sick";
export type LeaveBalance = Record<LeaveKind, number>;

export interface Employee {
  id: string;
  name: string;
  nickname?: string; // ชื่อเล่น — ใช้ในการแจ้งเตือนรายวันทาง LINE
  avatar: string;
  avatarType: "text" | "emoji" | "image";
  avatarImageUrl: string | null;
  role: string;
  roleId: string;
  bank?: string;
  bankAccountNumber?: string;
  lineUserId?: string;
  baseSalary?: number;
  socialSecurity?: number;
  startWorkMonth?: string; // YYYY-MM วันที่เริ่มงาน (ใช้ในหนังสือรับรองเงินเดือน)
  prefix?: "นาย" | "นาง" | "นางสาว"; // คำนำหน้าชื่อ (ใช้ในหนังสือรับรองเงินเดือน)
  singlePieceRate?: number;
  normalSalePieceRate?: number;
  specialSalePieceRate?: number;
  buyPieceRate?: number;
  invitePieceRate?: number;
  transferPieceRate?: number;
  salaryDisabled?: boolean;
  poolExclusion?: "sell" | "buy" | "both" | "" | null;
  displayOrder?: number; // ลำดับการเรียง card admin ลากย้ายได้ — sync ทุกคน
  recurringItems?: RecurringItem[]; // รายรับ/รายจ่ายประจำเดือน (ใช้ทุกเดือน)
  balance?: LeaveBalance;
  used?: LeaveBalance;
}

/** รายการประจำเดือน — admin เพิ่มได้ทั้งรายรับและรายจ่าย ใช้ทุกๆ เดือน
 *  จนกว่าจะลบ (เช่น ค่าเดินทาง +500/เดือน, ค่าชุด -200/เดือน) */
export interface RecurringItem {
  id: string;
  type: "income" | "deduction";
  label: string;
  amount: number;
}

export interface LeaveEntry {
  id: string | number;
  employeeName: string;
  employeeId: string;
  type: LeaveKind;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  days: number;
  reason?: string;
  submitted?: string;
  createdAt?: number;
}

export interface LeaveType {
  id: LeaveKind;
  label: string;
  icon: string;
  color: string;
  colorLt: string;
}

export interface SalaryMonth {
  baseSalary?: number;
  singleRatePieces?: number;
  normalSalePieces?: number;
  specialSalePieces?: number;
  buyPieces?: number;
  invitePieces?: number;
  transferPieces?: number;
  socialSecurity?: number;
  customEarnings?: { label: string; amount: number }[]; // รายการรายรับที่ Admin เพิ่มเอง
  customDeductions?: { label: string; amount: number }[]; // รายการหักที่ Admin เพิ่มเอง
  note?: string;
  slipUrl?: string; // สลิป PDF ที่ freeze ลง Storage ตอน Admin ยืนยันยอด
  slipFrozenAt?: string; // ISO timestamp ตอน freeze สลิป
  // ─── Pool snapshot ─────────────────────────────────────────
  // เขียนพร้อมกันตอน admin save salary เพื่อให้พนักงานคำนวณ pool ได้
  // โดยไม่ต้องอ่าน employees/leaves ของเพื่อน (ซึ่งถูก rules ปิดไว้)
  roleId?: string; // ใช้ map → role.poolGroup
  poolExclusion?: "sell" | "buy" | "both" | null;
  totalLeaveDays?: number; // weekday leaves + over-quota Sundays
  // เดือนนี้คนนี้ทำ monthly duty ที่ "ให้สิทธิ์กองกลาง" → ยกเว้นเกณฑ์ 80%
  // (ทั้ง sell+buy) แต่ยังเคารพ poolExclusion + เกณฑ์ 50% เงินเดือนพื้นฐาน
  poolThresholdExempt?: boolean;
  // ─── Coverage pay snapshot ─────────────────────────────────
  // จำนวนเงินตอบแทนรวม + breakdown รายหน้าที่ (denorm จาก
  // computeCoverageEarnings ตอน admin save salary)
  coveragePay?: number;
  coveragePayBreakdown?: {
    dutyId: string;
    dutyName: string;
    count: number; // จำนวนวันที่แทนในเดือนนั้น
    rate: number; // ฿/ครั้ง
    subtotal: number; // count × rate
  }[];
}

export type SalaryData = Record<string, Record<string, SalaryMonth>>;

export interface AdvanceRequest {
  id: string | number;
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  month: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  slipImageDataUrl?: string | null;
  slipImageUrl?: string | null;
  rejectionReason?: string;
  lineNotificationStatus?:
    | "pending"
    | "processing"
    | "sent"
    | "skipped"
    | "error";
  lineNotificationType?: "approved" | "rejected";
  lineNotificationRequestedAt?: string;
  lineNotificationSentAt?: string;
  lineNotificationLastError?: string | null;
  lineNotificationSkippedReason?: string | null;
}

export interface Role {
  id: string;
  name: string;
  poolGroup: string | null;
  icon: string;
  /** หน้าที่หลักของตำแหน่ง (admin กรอกเอง · null = ไม่ได้ตั้งค่า) */
  mainDuties?: string | null;
}

/** ตารางหน้าที่ admin-managed — admin กำหนดว่า "ตำแหน่งไหน ทำหน้าที่อะไร"
 *  ระบบ pull คนจากตำแหน่งนั้นมา rotate ตาม displayOrder + period
 *  weekly = สลับทุก 7 วัน, monthly = สลับทุกเดือนตามปฏิทิน
 *  rotationStartDate = anchor ของ round-robin (วันแรกของ index 0)        */
export interface Duty {
  id: string;
  name: string;
  /** kind = "rotation" (default) → หมุนเวียนตาม period · "coverage" → เวรแทน
   *  คนลาของตำแหน่งเป้าหมาย (เลือกคนแทนจาก candidateEmpIds ให้ยุติธรรม)   */
  kind?: "rotation" | "coverage";
  period: "weekly" | "monthly";
  roleId: string; // (rotation) ตำแหน่งที่ทำหน้าที่นี้ — pool resolve จาก employees ที่ roleId ตรง
  excludedEmpIds?: string[]; // คนในตำแหน่งที่ admin ตัดออก ไม่ให้ทำหน้าที่นี้
  // (monthly เท่านั้น) ให้สิทธิ์กองกลางแก่คนที่ทำหน้าที่นี้ทั้งเดือน แม้ขาย/ซื้อ
  // ไม่ถึง 80% ของ top — เพราะติดทำหน้าที่ขายไม่ทันเพื่อน · ยกเว้นเกณฑ์ 80%
  // เท่านั้น (ยังเคารพ poolExclusion ที่ admin ปิด + เกณฑ์ 50% เงินเดือนพื้นฐาน)
  grantsPoolEligibility?: boolean;
  /** (weekly เท่านั้น) ข้ามวันอาทิตย์ — ไม่ assign หน้าที่นี้ในวันอาทิตย์
   *  เพื่อให้พนักงาน focus ขาย (วันอาทิตย์ลูกค้าเยอะ) · default = false  */
  skipSundays?: boolean;
  rotationStartDate: string; // "YYYY-MM-DD"
  // ─── coverage (kind="coverage") ───────────────────────────────
  coverageRoleId?: string; // ตำแหน่งเป้าหมาย — เมื่อคนในตำแหน่งนี้ลา ต้องหาคนแทน
  candidateEmpIds?: string[]; // รายชื่อคนแทน (admin เลือก · ระบบหมุนให้ยุติธรรม)
  /** (coverage) เงินตอบแทน "ต่อครั้ง/วันที่แทน" — ฿ · นับจากจำนวนวันที่
   *  คนนั้นถูกเลือกเป็นคนแทนใน yearMonth · แสดงในสลิปแยกบรรทัด "เงินค่าแทน" */
  coveragePayPerOccurrence?: number;
  /** Primary cache (B · stability) — เก็บคนที่ระบบเลือกเป็น primary
   *  ใน period ปัจจุบัน · pool เปลี่ยนกลาง period ไม่ recompute (ใช้ cache)
   *  · invalidate ตอน period boundary หรือคนใน cache หายจาก pool        */
  cachedPrimary?: {
    periodIndex: number;
    empId: string;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export interface PayrollConfirmEntry {
  confirmedAt: string;
  totalAmount: number;
  employeeCount: number;
}

export type PayrollConfirms = Record<string, PayrollConfirmEntry>;

export interface PoolShareResult {
  normalSalePieces: number;
  buyPieces: number;
  sellSharePercent: number;
  sellLeaveDeductionPercent: number;
  sellRedistributedPercent: number;
  buySharePercent: number;
  buyLeaveDeductionPercent: number;
  buyRedistributedPercent: number;
  totalSellPoolPieces: number;
  totalBuyPoolPieces: number;
  eligibleSellEmployeeCount: number;
  sellBaseSharePercent: number;
  sellLeaveDeductionFactor: number;
  eligibleBuyEmployeeCount: number;
  buyBaseSharePercent: number;
  buyLeaveDeductionFactor: number;
  leaveDays: number;
  eligibleForSellPool: boolean;
  eligibleForBuyPool: boolean;
  employeeSellPieces: number;
  employeeBuyPieces: number;
  topSellPieces: number;
  topBuyPieces: number;
  sellEligibilityThreshold: number;
  buyEligibilityThreshold: number;
  poolExclusion: string | null;
  losesBaseSalary: boolean;
  sellShareRatio: number;
  buyShareRatio: number;
  workDays: number;
  totalSellWorkDays: number;
  totalBuyWorkDays: number;
}

export interface SalaryCalcResult {
  earnings: number;
  deductions: number;
  netSalary: number;
  overQuotaDeduction: number;
  dailySalaryRate: number;
  weekdayOverQuotaDays: number;
  sundayOverQuotaDays: number;
  usesSinglePieceRate: boolean;
  singleRatePieces: number;
  singleRateCommission: number;
  singlePieceRate: number;
  normalSaleCommission: number;
  specialSaleCommission: number;
  buyCommission: number;
  inviteCommission: number;
  transferCommission: number;
  memberBonusTotal: number;
  normalSalePieces: number;
  specialSalePieces: number;
  buyPieces: number;
  invitePieces: number;
  transferPieces: number;
  normalSalePieceRate: number;
  specialSalePieceRate: number;
  buyPieceRate: number;
  invitePieceRate: number;
  transferPieceRate: number;
  attendanceBonus: number;
  bonusDays: number;
  coveragePay: number; // เงินตอบแทนแทนคนลา (รวม)
  leaveDays: number;
  advanceDeduction: number;
  loanDeduction: number;
  loanRepayments: Record<string, number>;
  loanBreakdown: { id: string; amount: number }[];
  baseSalary: number;
  losesBaseSalary: boolean;
}

export interface OverQuotaResult {
  weekdays: number;
  sundays: number;
}

export interface Bank {
  name: string;
  short: string;
  emoji: string;
}

export interface BusinessRules {
  WEEKDAY_LEAVE_QUOTA: number;
  SUNDAY_DEDUCTION_MULTIPLIER: number;
  DAYS_IN_MONTH: number;
  ATTEND_BONUS_ZERO_LEAVE: number;
  ATTEND_BONUS_ONE_LEAVE: number;
  ADVANCE_LIMIT_PERCENT: number;
  POOL_THRESHOLD_PCT: number;
  POOL_SALARY_THRESHOLD_PCT: number;
}

export interface Validation {
  LINE_USER_ID_PATTERN: RegExp;
  BANK_ACCOUNT_PATTERN: RegExp;
  BANK_ACCOUNT_MIN_DIGITS: number;
}

/* ─── useAppData return type ──────────────────────────────────── */
export interface AppData {
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  salaryData: SalaryData;
  advanceRequests: AdvanceRequest[];
  roles: Role[];
  payrollConfirms: PayrollConfirms;
  poolAdjustments: PoolAdjustmentsByMonth;
  loading: boolean;
  error: Error | null;

  setAllLeaves:
    | React.Dispatch<React.SetStateAction<LeaveEntry[]>>
    | (() => void);
  setEmployeeDirectory:
    | React.Dispatch<React.SetStateAction<Employee[]>>
    | (() => void);
  setSalaryData:
    | React.Dispatch<React.SetStateAction<SalaryData>>
    | (() => void);
  setAdvanceRequests:
    | React.Dispatch<React.SetStateAction<AdvanceRequest[]>>
    | (() => void);
  setRoles: React.Dispatch<React.SetStateAction<Role[]>> | (() => void);
  setPayrollConfirms:
    | React.Dispatch<React.SetStateAction<PayrollConfirms>>
    | (() => void);

  addLeave: (
    leave: Omit<LeaveEntry, "id">,
  ) => string | number | Promise<string>;
  deleteLeave: (id: string | number) => void | Promise<void>;
  updateEmployee: (
    id: string,
    fields: Partial<Employee>,
  ) => void | Promise<void>;
  upsertEmployee: (employee: Employee) => string | Promise<string>;
  deleteEmployee: (id: string) => void | Promise<void>;
  updateSalary: (
    employeeId: string,
    yearMonth: string,
    fields: Partial<SalaryMonth>,
  ) => void | Promise<void>;
  submitAdvance: (
    request: Omit<AdvanceRequest, "id" | "status" | "submittedAt">,
  ) => string | number | Promise<string>;
  updateAdvance: (
    id: string | number,
    fields: Partial<AdvanceRequest>,
  ) => void | Promise<void>;
  approveAdvance: (
    id: string | number,
    slipImageUrl?: string | null,
  ) => void | Promise<void>;
  rejectAdvance: (id: string | number, reason?: string) => void | Promise<void>;
  upsertRole: (role: Role) => void | Promise<void>;
  deleteRole: (id: string) => void | Promise<void>;
  setPayrollConfirm: (
    yearMonth: string,
    summary: PayrollConfirmEntry,
  ) => void | Promise<void>;
  setPoolAdjustment: (
    yearMonth: string,
    fields: {
      items?: {
        id: string;
        poolGroup: string;
        side: "normal" | "buy";
        pieces: number;
        label: string;
      }[];
    },
  ) => Promise<void>;
}

export interface PoolAdjustmentItem {
  id: string;
  poolGroup: string;
  side: "normal" | "buy";
  pieces: number;
  label: string;
}

export interface PoolAdjustmentEntry {
  items?: PoolAdjustmentItem[];
  updatedAt?: number;
}

export type PoolAdjustmentsByMonth = Record<string, PoolAdjustmentEntry>;
