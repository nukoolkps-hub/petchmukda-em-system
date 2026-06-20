/* ─── Domain Types ──────────────────────────────────────────── */

export type LeaveKind = "personal" | "sick";
export type LeaveBalance = Record<LeaveKind, number>;

export interface Employee {
  id: string;
  name: string;
  nickname?: string; // ชื่อเล่น — แสดงในปฏิทินการลา + รายการลา + แจ้งเตือน LINE
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
  singlePieceRate?: number; // legacy: rate ของ "default" piece item
  /** อัตราค่าคอมต่อชิ้น แยกตามรายการ (multi-item · PR multi-piece)
   *  key = pieceItem.id ใน Role.pieceItems · value = ฿/ชิ้น ของพนักงานคนนี้
   *  legacy "default" item อ่าน singlePieceRate ถ้าไม่มีใน map นี้                */
  pieceRates?: Record<string, number>;
  normalSalePieceRate?: number;
  specialSalePieceRate?: number;
  buyPieceRate?: number;
  invitePieceRate?: number;
  transferPieceRate?: number;
  /** map ของ rate "โบนัสอื่นๆ" — key=bonusItem.id · value=฿/ครั้ง
   *  legacy "invite"/"transfer" item อ่าน invitePieceRate/transferPieceRate
   *  ถ้าไม่มีใน map นี้ (backward compat)                                          */
  bonusRates?: Record<string, number>;
  /** map ของ rate pool item — key=poolItem.id · value=฿/ชิ้น
   *  legacy "normal"/"special"/"buy" fallback ไป normal/special/buyPieceRate    */
  poolItemRates?: Record<string, number>;
  salaryDisabled?: boolean;
  /** poolExclusion shape:
   *  null/""/undefined → ไม่ปิด
   *  "all"             → ปิดทั้งหมด (กฎเดิม "both": <50% primary item ขาด base)
   *  string[]          → ปิดเฉพาะ pool item ids ที่ระบุ
   *  legacy: "sell" → migrate "normal"+"special" (kind=pool ฝั่งขาย) ⋅
   *          "buy"  → migrate "buy" item id ⋅
   *          "both" → migrate "all"                                              */
  poolExclusion?: "sell" | "buy" | "both" | "all" | "" | string[] | null;
  displayOrder?: number; // ลำดับการเรียง card admin ลากย้ายได้ — sync ทุกคน
  recurringItems?: RecurringItem[]; // รายรับ/รายจ่ายประจำเดือน (ใช้ทุกเดือน)
  /** การขึ้นเงินเดือนประจำปี · จำนวนคงที่ AUTO ทุกปี Jan · 0 = ไม่ขึ้น auto
   *  (admin ตั้งครั้งเดียว · apply ทุกปีที่ทำงานครบรอบ ≥ 1 ปี) */
  annualRaiseAmount?: number;
  /** override ราคารายปี · key = ปี ค.ศ. string เช่น "2026" · value = บาท
   *  (มีผล override จำนวน auto สำหรับปีนั้น · เช่น ปีพิเศษ/ปีไม่ขึ้น) */
  annualRaises?: Record<string, number>;
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

/** บรรทัดเงินในสลิป (ชื่อ + จำนวน) — ใช้กับ custom earnings/deductions +
 *  recurring incomes/deductions ที่ engine แตกออกมาแล้ว (ไม่มี id/type) */
export interface SalaryLineItem {
  label: string;
  amount: number;
}

export interface LeaveEntry {
  id: string | number;
  employeeName: string;
  /** snapshot ของ employee.nickname ตอนสร้าง — ใช้แสดงในปฏิทินทีมฝั่งพนักงาน
   *  (employee subscription scope = own only · ดูชื่อเล่นเพื่อนผ่าน peer doc ไม่ได้)
   *  null = พนักงานไม่ได้ตั้งชื่อเล่นไว้ตอนยื่นใบลา (กัน Firestore undefined) */
  employeeNickname?: string | null;
  employeeId: string;
  type: LeaveKind;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  days: number;
  reason?: string;
  submitted?: string;
  createdAt?: number;
  /** true ถ้า admin เพิ่มให้พนักงาน (เช่น พนักงานลืมกดลา) — โผล่ badge "ADMIN" ในลิสต์ */
  createdByAdmin?: boolean;
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
  singleRatePieces?: number; // legacy: จำนวนชิ้นของ "default" piece item
  /** จำนวนชิ้นต่อรายการค่าคอม (multi-item) ของเดือนนี้
   *  key = pieceItem.id · value = จำนวนชิ้น · legacy "default" อ่าน
   *  singleRatePieces ถ้าไม่มีใน map นี้                                         */
  piecePieces?: Record<string, number>;
  /** snapshot อัตราค่าคอมต่อชิ้นแยกรายการ (ตอน admin save salary) —
   *  freeze rate ของเดือนนั้น เหมือน singlePieceRate/normalSalePieceRate         */
  pieceRates?: Record<string, number>;
  normalSalePieces?: number;
  specialSalePieces?: number;
  buyPieces?: number;
  invitePieces?: number;
  transferPieces?: number;
  /** จำนวนครั้งของแต่ละ "โบนัสอื่นๆ" item · key=bonusItem.id · value=จำนวนครั้ง
   *  legacy "invite"/"transfer" อ่าน invitePieces/transferPieces ถ้าไม่มีใน map  */
  bonusCounts?: Record<string, number>;
  /** จำนวนชิ้นของแต่ละ pool item · key=poolItem.id · value=จำนวนชิ้น
   *  legacy "normal"/"special"/"buy" fallback ไป normal/special/buyPieces        */
  poolItemPieces?: Record<string, number>;
  socialSecurity?: number;
  customEarnings?: SalaryLineItem[]; // รายการรายรับที่ Admin เพิ่มเอง
  customDeductions?: SalaryLineItem[]; // รายการหักที่ Admin เพิ่มเอง
  note?: string;
  slipUrl?: string; // สลิป PDF ที่ freeze ลง Storage ตอน Admin ยืนยันยอด
  slipFrozenAt?: string; // ISO timestamp ตอน freeze สลิป
  // ─── Pool snapshot ─────────────────────────────────────────
  // เขียนพร้อมกันตอน admin save salary เพื่อให้พนักงานคำนวณ pool ได้
  // โดยไม่ต้องอ่าน employees/leaves ของคนอื่น (ซึ่งถูก rules ปิดไว้)
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

/** รายการค่าคอมต่อชิ้น 1 ประเภท (เช่น "ทำบิล", "นับสต๊อก") ของตำแหน่งที่ไม่ใช่
 *  pool sales · id คงที่ (อ้างถึง rate ต่อพนักงาน + จำนวนชิ้นต่อเดือน)        */
export interface PieceItem {
  id: string;
  label: string;
}

export interface Role {
  id: string;
  name: string;
  poolGroup: string | null;
  icon: string;
  /** หน้าที่หลักของตำแหน่ง (admin กรอกเอง · null = ไม่ได้ตั้งค่า) */
  mainDuties?: string | null;
  /** รายการค่าคอมต่อชิ้น (multi-item) สำหรับตำแหน่งที่ไม่ใช่ pool sales
   *  - null/[] → ไม่มีค่าคอมรายชิ้น (พนักงานทั่วไป/รปภ/ทำความสะอาด)
   *    → ซ่อน piece rate + invite/transfer เงินเดือนพื้นฐานอย่างเดียว
   *  - [{id,label}, ...] → แต่ละรายการมี rate (ต่อพนักงาน) + จำนวนชิ้น (ต่อเดือน)
   *  สำหรับ pool sales (poolGroup ตั้ง) — field นี้ไม่มีผล                      */
  pieceItems?: PieceItem[] | null;
  /** legacy single-label (ก่อน multi-item) · migrate-on-read เป็น 1 pieceItem
   *  id="default" · เก็บไว้เพื่อ backward-compat ข้อมูลเก่า                      */
  pieceLabel?: string | null;
  /** รายการ pool sales (สำหรับ role ที่ poolGroup ตั้ง) — ก่อนหน้านี้ hardcode
   *  3 รายการ (normal/special/buy) · ตอนนี้ admin custom ได้
   *  null/undefined → migrate-on-read default 3 items
   *  [] → no pool items (ตำแหน่ง pool group แต่ยังไม่ตั้งค่า — เลข = 0)
   *  - kind: "pool" → แชร์กองกลาง (เกณฑ์ threshold% ของ top เพื่อเข้ากอง)
   *  - kind: "personal" → ส่วนตัว (ไม่เข้ากองกลาง · threshold ใช้สำหรับ count
   *    เข้าเกณฑ์ 50%/ฐานเงินเดือนเท่านั้น)                                       */
  poolItems?: PoolItem[] | null;
  /** primary pool item id — ใช้สำหรับ losesBaseSalary check (ขาย < 50% ของ top)
   *  ตอน poolExclusion = "all" · default migration = "normal"                  */
  primaryPoolItemId?: string | null;
  /** รายการ "โบนัสอื่นๆ" (multi-item) — แทน invite/transfer แบบ hardcode เดิม
   *  - null/undefined → migrate-on-read เป็น default 2 รายการ
   *    ({id:"invite",label:"เชิญชวนสมัครบัตร"}, {id:"transfer",label:"ย้ายข้อมูลบัตร"})
   *  - [] → ไม่มีโบนัสอื่นๆ (ซ่อน section)
   *  - [{id,label}, ...] → แต่ละรายการมี rate (ต่อพนักงาน) + จำนวน (ต่อเดือน)
   *  ใช้ได้ทุก role ที่ rolePaysPieceCommission · pool sales ก็ใช้ได้                */
  bonusItems?: PieceItem[] | null;
}

/** Pool item config — admin custom รายการของ pool sales ต่อ role
 *  threshold = % ของ top pieces ของ item นี้ ที่ต้องถึงเพื่อเข้ากอง (kind=pool)
 *  หรือเกณฑ์ 50% สำหรับ base salary loss check (kind=personal · primary item) */
export interface PoolItem {
  id: string;
  label: string;
  kind: "pool" | "personal";
  /** % ของ top (0-100) · default 80 สำหรับ pool · personal ใช้ตอน eligibility */
  threshold: number;
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

/** ปฏิทินวันเปิด-ปิดร้าน (admin-managed · doc เดียว: config/storeCalendar)
 *  Default:
 *  - อาทิตย์ = เปิด (× 1.5 ตามกฎเดิม)
 *  - เสาร์ = ปิด
 *  - จ-ศ = เปิด
 *  Override:
 *  - extraOpenSaturdays: เสาร์ที่ admin เปิดพิเศษ (วันทำงานปกติ)
 *  - extraClosedWeekdays: จ-ศ ที่ admin ปิดพิเศษ (เช่น วันอบรม)
 *  - extraClosedSundays: อาทิตย์ที่ admin ปิดพิเศษ (ร้านปิด ลาไม่นับ · ไม่ × 1.5) */
export interface StoreCalendar {
  extraOpenSaturdays: string[]; // ["YYYY-MM-DD", ...]
  extraClosedWeekdays: string[]; // ["YYYY-MM-DD", ...]
  /** เสาร์เปิดพิเศษที่ ADMIN tick "ให้เงินเพิ่ม 1 วัน" — subset ของ
   *  extraOpenSaturdays · พนักงานที่ไม่ลาวันนี้ได้ดอลลาร์เพิ่ม (dailyRate)
   *  null/undefined → ไม่มี (legacy data)                                 */
  paidExtraSaturdays?: string[];
  /** อาทิตย์ที่ ADMIN ปิดพิเศษ — กลายเป็นวันร้านปิด: ลาวันนั้นไม่นับ ·
   *  ไม่หัก × 1.5 · ไม่มีหน้าที่ · null/undefined → ไม่มี (legacy = อาทิตย์เปิดเสมอ) */
  extraClosedSundays?: string[];
}

/** ราคาทองคำไทย (อ้างอิงสมาคมค้าทองคำ · admin update วันละครั้ง)
 *  doc เดียว: /config/goldPrice                                          */
export interface GoldPrice {
  pricePerBaht: number; // ฿/บาท ราคาขายออก (ทองคำแท่ง สมาคม)
  buyPrice: number; // ฿/บาท ราคารับซื้อ (0 = ไม่มีข้อมูล)
  updatedAt: number; // ms epoch
  updatedBy: string; // ชื่อ admin หรือ "auto · ..." (Cloud Function)
  lastFetchError: string; // error ล่าสุดจาก auto-fetch ("" = ไม่มี)
  lastFetchErrorAt: number; // ms epoch (0 = ไม่มี)
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
  storeCalendar: StoreCalendar;
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
