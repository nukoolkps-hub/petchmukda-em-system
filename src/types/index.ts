/* ─── Domain Types ──────────────────────────────────────────── */

export interface Employee {
  id: string;
  name: string;
  av: string;
  avType: "text" | "emoji" | "image";
  img: string | null;
  role: string;
  roleId: string;
  bank?: string;
  bankAcc?: string;
  lineUserId?: string;
  baseSalary?: number;
  ratePerPiece?: number;
  ratePerPieceNormal?: number;
  ratePerPieceSpecial?: number;
  ratePerPieceBuy?: number;
  ratePerPieceInvite?: number;
  ratePerPieceTransfer?: number;
  salaryDisabled?: boolean;
  poolExclude?: "sell" | "buy" | "both" | "" | null;
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
  base?: number;
  pieces?: number;
  piecesNormal?: number;
  piecesSpecial?: number;
  piecesBuy?: number;
  piecesInvite?: number;
  piecesTransfer?: number;
  lateDeduction?: number;
  socialSecurity?: number;
  note?: string;
}

export type SalaryData = Record<string, Record<string, SalaryMonth>>;

export interface AdvanceRequest {
  id: string | number;
  empId: string;
  empName: string;
  amount: number;
  reason: string;
  month: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  slipImg?: string | null;
  slipUrl?: string | null;
  rejectReason?: string;
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
  empCount: number;
}

export type PayrollConfirms = Record<string, PayrollConfirmEntry>;

export interface PoolShareResult {
  piecesNormal: number;
  piecesBuy: number;
  sellPct: number;
  sellDeductPct: number;
  sellSharePct: number;
  buyPct: number;
  buyDeductPct: number;
  buySharePct: number;
  poolN: number;
  poolB: number;
  sellN: number;
  sellBase: number;
  sellK: number;
  buyN: number;
  buyBase: number;
  buyK: number;
  leaveDays: number;
  eligibleSell: boolean;
  eligibleBuy: boolean;
  mySell: number;
  myBuy: number;
  topSell: number;
  topBuy: number;
  sellThreshold: number;
  buyThreshold: number;
  poolExclude: string | null;
  losesBaseSalary: boolean;
}

export interface SalaryCalcResult {
  earnings: number;
  deductions: number;
  net: number;
  overQ: number;
  dayRate: number;
  isSingle: boolean;
  pcsSingle: number;
  commSingle: number;
  rSingle: number;
  commNormal: number;
  commSpecial: number;
  commBuy: number;
  commInvite: number;
  commTransfer: number;
  memberBonusTotal: number;
  pcsN: number;
  pcsS: number;
  pcsB: number;
  pcsI: number;
  pcsT: number;
  rNormal: number;
  rSpecial: number;
  rBuy: number;
  rInvite: number;
  rTransfer: number;
  attendBonus: number;
  bonusDays: number;
  lvDays: number;
  advanceDed: number;
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
  empDir: Employee[];
  salaryData: SalaryData;
  advanceRequests: AdvanceRequest[];
  roles: Role[];
  payrollConfirms: PayrollConfirms;
  loading: boolean;
  error: Error | null;

  setAllLeaves:
    | React.Dispatch<React.SetStateAction<LeaveEntry[]>>
    | (() => void);
  setEmpDir: React.Dispatch<React.SetStateAction<Employee[]>> | (() => void);
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
  upsertEmployee: (emp: Employee) => string | Promise<string>;
  updateSalary: (
    empId: string,
    ym: string,
    fields: Partial<SalaryMonth>,
  ) => void | Promise<void>;
  submitAdvance: (
    req: Omit<AdvanceRequest, "id" | "status" | "submittedAt">,
  ) => string | number | Promise<string>;
  updateAdvance: (
    id: string | number,
    fields: Partial<AdvanceRequest>,
  ) => void | Promise<void>;
  approveAdvance: (
    id: string | number,
    slipUrl?: string | null,
  ) => void | Promise<void>;
  rejectAdvance: (id: string | number, reason?: string) => void | Promise<void>;
  upsertRole: (role: Role) => void | Promise<void>;
  deleteRole: (id: string) => void | Promise<void>;
  setPayrollConfirm: (
    ym: string,
    summary: PayrollConfirmEntry,
  ) => void | Promise<void>;
}
