/* ─── Domain Types ──────────────────────────────────────────── */

export interface Employee {
  id: string;
  name: string;
  avatar: string;
  avatarType: "text" | "emoji" | "image";
  avatarImageUrl: string | null;
  role: string;
  roleId: string;
  bank?: string;
  bankAccountNumber?: string;
  lineUserId?: string;
  baseSalary?: number;
  singlePieceRate?: number;
  normalSalePieceRate?: number;
  specialSalePieceRate?: number;
  buyPieceRate?: number;
  invitePieceRate?: number;
  transferPieceRate?: number;
  salaryDisabled?: boolean;
  poolExclusion?: "sell" | "buy" | "both" | "" | null;
}

export interface LeaveEntry {
  id: string | number;
  employeeName: string;
  employeeId: string;
  type: "personal" | "sick";
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  days: number;
  reason?: string;
  submitted?: string;
  createdAt?: number;
}

export interface LeaveType {
  id: "personal" | "sick";
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
  lateDeduction?: number;
  socialSecurity?: number;
  note?: string;
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
}

export interface Role {
  id: string;
  name: string;
  poolGroup: string | null;
  icon: string;
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
  leaveDays: number;
  advanceDeduction: number;
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
}
