/* ─── Payroll per-employee monthly computation (pure) ───────────────
   Single source ของ:
   1. การประกอบ "แถวเงินเดือน 1 คน/เดือน" (inputs → calculateSalary)
   2. การ settle denorm/auto-carry/loan ledger (inject writer · ไม่แตะ Firestore)

   ใช้ทั้ง PayrollSummaryPanel (ตอนยืนยันยอด) และ
   useFirebaseAppData.resettleConfirmedMonth (auto-settle เดือน grace ตอนแก้เรท)
   เพื่อให้ผลลัพธ์ตรงกันเป๊ะ — ไม่ duplicate logic แล้ว diverge

   pure 100% (ไม่ import firebase) → unit-test ได้ใต้ node                       */

import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";
import {
  calculateSalary,
  computeExtraOpenSaturdayWorkedDates,
  computePoolSharesForGroup,
  getEffectiveBaseSalary,
} from "./salaryUtils";

/** roleId ของพนักงาน "ณ เดือนนั้น" — snapshot ใน salary doc ก่อน fallback ปัจจุบัน
 *  → เปลี่ยนตำแหน่งในอนาคตไม่ทำให้การจัดกลุ่ม pool ของเดือนเก่าเปลี่ยน             */
export function roleIdForMonth(
  employee: any,
  yearMonth: string,
  salaryData: any,
): string | undefined {
  return salaryData?.[employee.id]?.[yearMonth]?.roleId ?? employee.roleId;
}

/** "YYYY-MM" → เดือนถัดไป "YYYY-MM" */
export function nextMonthOf(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m, 1); // m (1-based) = index ของเดือนถัดไป (JS 0-based)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** loanContext ให้ calculateSalary — เงินกู้ที่ยังไม่ยกเลิกของพนักงานคนนี้
 *  (canonical · firebase/employeeLoans re-export ให้ component เดิมใช้ต่อได้)   */
export function buildLoanContext(
  allLoans: any[] | undefined,
  employeeId: string,
  yearMonth: string,
) {
  const loans = (allLoans || [])
    .filter((l) => l.employeeId === employeeId && l.status !== "cancelled")
    .map((l) => ({
      id: l.id,
      monthlyDeduction: l.monthlyDeduction,
      principal: l.principal,
      startMonth: l.startMonth,
      repayments: l.repayments,
    }));
  return { yearMonth, loans };
}

/** field "เรท/เงินเดือนพื้นฐาน" ที่ snapshot ลง salary doc — single source ใช้ทั้ง
 *  updateSalary (re-stamp) + resettle (overlay เรทใหม่ลง data ก่อน recompute) */
export function buildRateFieldsSnapshot(employee: any, yearMonth: string) {
  return {
    baseSalary: getEffectiveBaseSalary(employee, yearMonth),
    singlePieceRate: employee.singlePieceRate ?? 0,
    pieceRates: employee.pieceRates ?? {},
    normalSalePieceRate: employee.normalSalePieceRate ?? 0,
    specialSalePieceRate: employee.specialSalePieceRate ?? 0,
    buyPieceRate: employee.buyPieceRate ?? 0,
    invitePieceRate: employee.invitePieceRate ?? 0,
    transferPieceRate: employee.transferPieceRate ?? 0,
    bonusRates: employee.bonusRates ?? {},
    poolItemRates: employee.poolItemRates ?? {},
    socialSecurity: employee.socialSecurity ?? 0,
  };
}

/** จัดกลุ่มพนักงาน active ตาม poolGroup (ตาม roleId ของเดือนนั้น) */
export function groupEmployeesByPool(
  activeEmployees: any[],
  yearMonth: string,
  salaryData: any,
  roles: any[],
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const employee of activeEmployees) {
    const r = roles.find(
      (rl) => rl.id === roleIdForMonth(employee, yearMonth, salaryData),
    );
    if (r?.poolGroup) {
      if (!grouped[r.poolGroup]) grouped[r.poolGroup] = [];
      grouped[r.poolGroup].push(employee.id);
    }
  }
  return grouped;
}

/** คำนวณ pool shares ต่อกลุ่ม "ครั้งเดียว" (hoist · กัน O(G²) ต่อกลุ่ม) ·
 *  คืน { [poolGroup]: { [empId]: share } }                                      */
export function buildPoolSharesByGroup({
  activeEmployees,
  yearMonth,
  salaryData,
  allLeaves,
  employeeDirectory,
  roles,
  poolAdjustment,
  storeCalendar,
}: {
  activeEmployees: any[];
  yearMonth: string;
  salaryData: any;
  allLeaves: any[];
  employeeDirectory: any[];
  roles: any[];
  poolAdjustment: any;
  storeCalendar: any;
}): Record<string, Record<string, any>> {
  const grouped = groupEmployeesByPool(
    activeEmployees,
    yearMonth,
    salaryData,
    roles,
  );
  const sharesByPoolGroup: Record<string, Record<string, any>> = {};
  for (const [poolGroup, groupIds] of Object.entries(grouped)) {
    sharesByPoolGroup[poolGroup] = computePoolSharesForGroup({
      groupEmployeeIds: groupIds,
      salaryData,
      allLeaves,
      yearMonth,
      employeeDirectory,
      roles,
      poolAdjustment: poolAdjustment || null,
      poolGroup,
      storeCalendar,
    });
  }
  return sharesByPoolGroup;
}

export interface EmployeeMonthRow {
  employee: any;
  employeeRole: any;
  data: any;
  salaryCalculation: any;
  poolShare: any;
  advanceTotal: number;
  monthApprovedAdvances: any[];
}

/** ประกอบ "แถวเงินเดือน" 1 คน/เดือน — single source ของ inputs ที่ส่งเข้า
 *  calculateSalary · คืน null ถ้าไม่มี salary doc (ทั้ง salaryData และ dataOverride)
 *
 *  - poolSharesByGroup: ส่งมา reuse (PayrollSummaryPanel hoist ทั้งกลุ่ม) · ถ้า
 *    ไม่ส่ง จะคำนวณ share ของกลุ่มเฉพาะกิจให้ (resettle 1 คน)
 *  - dataOverride: ใช้แทน salary doc ใน salaryData (resettle ที่ in-memory ยัง
 *    เป็นเรทเก่า → overlay เรทใหม่เข้ามา ให้ resolve*Rate (snapshot-first) เห็นใหม่)
 *  - employee/employeeDirectory: caller ส่งร่างที่ override แล้วได้ (state stale) */
export function computeEmployeeMonthRow({
  employee,
  yearMonth,
  salaryData,
  allLeaves,
  employeeDirectory,
  roles,
  employeeLoans,
  monthApprovedAdvances,
  poolAdjustment,
  storeCalendar,
  poolSharesByGroup,
  dataOverride,
}: {
  employee: any;
  yearMonth: string;
  salaryData: any;
  allLeaves: any[];
  employeeDirectory: any[];
  roles: any[];
  employeeLoans: any[];
  monthApprovedAdvances: any[];
  poolAdjustment: any;
  storeCalendar: any;
  poolSharesByGroup?: Record<string, Record<string, any>>;
  dataOverride?: any;
}): EmployeeMonthRow | null {
  const employeeRole =
    roles.find(
      (r) => r.id === roleIdForMonth(employee, yearMonth, salaryData),
    ) || null;
  const data = dataOverride ?? salaryData?.[employee.id]?.[yearMonth] ?? null;
  if (!data) return null;

  const monthLeaves = (allLeaves || []).filter(
    (lv) => lv.employeeId === employee.id && lv.start.startsWith(yearMonth),
  );
  const overInfo = getOverQuotaDays(monthLeaves, storeCalendar);
  const totalLeaveDays = countWeekdayLeaves(monthLeaves, storeCalendar);
  const monthApprovedForEmp = (monthApprovedAdvances || []).filter(
    (r) => r.employeeId === employee.id,
  );
  const approvedAdvanceTotal = monthApprovedForEmp.reduce(
    (s, r) => s + (r.amount || 0),
    0,
  );

  let poolShare = null;
  if (employeeRole?.poolGroup) {
    // pool share อิง "จำนวนชิ้น" ไม่ใช่ "เรท" → salaryData เดิม (แม้ stale เรท)
    // ให้ share ถูกต้อง · ถ้า caller ไม่ได้ hoist มาก็คำนวณกลุ่มให้เฉพาะกิจ
    const groupShares =
      poolSharesByGroup?.[employeeRole.poolGroup] ??
      buildPoolSharesByGroup({
        activeEmployees: employeeDirectory.filter((e) => !e.salaryDisabled),
        yearMonth,
        salaryData,
        allLeaves,
        employeeDirectory,
        roles,
        poolAdjustment,
        storeCalendar,
      })[employeeRole.poolGroup];
    poolShare = groupShares?.[employee.id] ?? null;
  }

  const monthExclusions = ((poolAdjustment?.items as any[]) || [])
    .filter((it: any) => it.kind === "piece" && it.employeeId === employee.id)
    .map((it: any) => ({
      pieceItemId: it.pieceItemId,
      pieces: Number(it.pieces) || 0,
      label: it.label,
    }));
  const extraSatWorked = computeExtraOpenSaturdayWorkedDates(
    yearMonth,
    storeCalendar,
    monthLeaves,
  );
  const salaryCalculation = calculateSalary(
    data,
    overInfo,
    employee,
    totalLeaveDays,
    approvedAdvanceTotal,
    poolShare,
    employeeRole,
    buildLoanContext(employeeLoans, employee.id, yearMonth),
    monthExclusions,
    { workedDates: extraSatWorked },
  );
  return {
    employee,
    employeeRole,
    data,
    salaryCalculation,
    poolShare,
    advanceTotal: approvedAdvanceTotal,
    monthApprovedAdvances: monthApprovedForEmp,
  };
}

/** settle 1 แถว/เดือน — denorm netSalary + auto-carry + loan ledger
 *  inject writer ทั้งหมด (ไม่แตะ Firestore เอง · pure orchestration) เพื่อให้ทั้ง
 *  confirm flow และ auto-settle เดือน grace เขียนด้วย logic เดียวกัน
 *
 *  - saveNetDenorm(empId, ym, net, clearDeficit): เขียน salary.netSalary +
 *    (clearDeficit → deficitClearedAt:null) · ไม่ส่ง undefined (โปรเจกต์ไม่เปิด
 *    ignoreUndefinedProperties) · net<0 → ไม่แตะ deficitClearedAt
 *  - syncAutoCarry({sourceMonth, nextMonth, employeeId, employeeName, deficitAmount})
 *  - recordLoanRepayment(loanId, ym, amount): เขียน ledger (idempotent ภายในเอง) */
export async function settleEmployeeMonth(
  row: EmployeeMonthRow,
  yearMonth: string,
  employeeLoans: any[],
  writers: {
    saveNetDenorm: (
      employeeId: string,
      yearMonth: string,
      net: number,
      clearDeficit: boolean,
    ) => Promise<unknown>;
    syncAutoCarry: (args: {
      sourceMonth: string;
      nextMonth: string;
      employeeId: string;
      employeeName: string;
      deficitAmount: number;
    }) => Promise<unknown>;
    recordLoanRepayment: (
      loanId: string,
      yearMonth: string,
      amount: number,
    ) => Promise<unknown>;
  },
): Promise<void> {
  const calc = row.salaryCalculation;
  if (!calc) return;
  const net = calc.netSalary;
  // 1) denorm netSalary (+ clear deficit flag เมื่อ net>=0)
  await writers.saveNetDenorm(row.employee.id, yearMonth, net, net >= 0);
  // 2) auto-carry advance เดือนถัดไป (สร้าง/อัปเดต/ลบ ตาม deficit)
  await writers.syncAutoCarry({
    sourceMonth: yearMonth,
    nextMonth: nextMonthOf(yearMonth),
    employeeId: row.employee.id,
    employeeName: row.employee.nickname || row.employee.name || "",
    deficitAmount: net < 0 ? -net : 0,
  });
  // 3) loan ledger — repayments[ym] = ยอดหักจริง (เขียนเมื่อเปลี่ยน)
  const reps = calc.loanRepayments || {};
  const empLoans = (employeeLoans || []).filter(
    (l) => l.employeeId === row.employee.id && l.status !== "cancelled",
  );
  for (const loan of empLoans) {
    const amt = reps[loan.id] || 0;
    const prev = loan.repayments?.[yearMonth] || 0;
    if (amt !== prev) {
      await writers.recordLoanRepayment(loan.id, yearMonth, amt);
    }
  }
}
