/* ─── Payroll per-employee monthly computation (pure) ───────────────
   Single source ของ:
   1. การประกอบ "แถวเงินเดือน 1 คน/เดือน" (inputs → calculateSalary)
   2. การ settle denorm/auto-carry/loan ledger (inject writer · ไม่แตะ Firestore)

   ใช้ทั้ง PayrollSummaryPanel (ตอนยืนยันยอด) และ
   useFirebaseAppData.resettleConfirmedMonth (auto-settle เดือน grace ตอนแก้เรท)
   เพื่อให้ผลลัพธ์ตรงกันเป๊ะ — ไม่ duplicate logic แล้ว diverge

   pure 100% (ไม่ import firebase) → unit-test ได้ใต้ node                       */

import { fmtShort } from "./dateUtils";
import { formatThaiNumber } from "./format";
import {
  countWeekdayLeaves,
  getOverQuotaDays,
  leaveOverlapsMonth,
} from "./leaveUtils";
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
    // freeze รายการประจำเดือน (ค่าเดินทาง/ค่าอาหาร ฯลฯ) ต่อเดือน — กันสลิป
    // เดือนเก่าเพี้ยนเมื่อ admin เพิ่ม/ลบ recurring ในอนาคต
    recurringItems: Array.isArray(employee.recurringItems)
      ? employee.recurringItems
      : [],
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
    (lv) => lv.employeeId === employee.id && leaveOverlapsMonth(lv, yearMonth),
  );
  const overInfo = getOverQuotaDays(monthLeaves, storeCalendar, yearMonth);
  const totalLeaveDays = countWeekdayLeaves(
    monthLeaves,
    storeCalendar,
    yearMonth,
  );
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

/** ลายเซ็นยอดต่อคน — ใช้เทียบ "ข้อมูลเปลี่ยนหลังยืนยัน" + sync ยอดทางการ ·
 *  single source (เดิม inline ใน PayrollSummaryPanel) · sort กันลำดับสลับ      */
export function computeBreakdownSig(rows: EmployeeMonthRow[]): string {
  return rows
    .map((r) => `${r.employee.id}:${Math.round(r.salaryCalculation.netSalary)}`)
    .sort()
    .join("|");
}

/** สรุปยอดทั้งเดือน (total/count/sig + rows) — ใช้ทั้ง PayrollSummaryPanel
 *  (live figure) และ auto-sync ยอดทางการตอนแก้เรทในเดือน grace                */
export function computeMonthSummary(args: {
  activeEmployees: any[];
  yearMonth: string;
  salaryData: any;
  allLeaves: any[];
  employeeDirectory: any[];
  roles: any[];
  employeeLoans: any[];
  monthApprovedAdvances: any[];
  poolAdjustment: any;
  storeCalendar: any;
}): {
  total: number;
  count: number;
  breakdownSig: string;
  rows: EmployeeMonthRow[];
} {
  const poolSharesByGroup = buildPoolSharesByGroup({
    activeEmployees: args.activeEmployees,
    yearMonth: args.yearMonth,
    salaryData: args.salaryData,
    allLeaves: args.allLeaves,
    employeeDirectory: args.employeeDirectory,
    roles: args.roles,
    poolAdjustment: args.poolAdjustment,
    storeCalendar: args.storeCalendar,
  });
  const rows = args.activeEmployees
    .map((employee) =>
      computeEmployeeMonthRow({
        employee,
        yearMonth: args.yearMonth,
        salaryData: args.salaryData,
        allLeaves: args.allLeaves,
        employeeDirectory: args.employeeDirectory,
        roles: args.roles,
        employeeLoans: args.employeeLoans,
        monthApprovedAdvances: args.monthApprovedAdvances,
        poolAdjustment: args.poolAdjustment,
        storeCalendar: args.storeCalendar,
        poolSharesByGroup,
      }),
    )
    .filter((r): r is EmployeeMonthRow => !!r?.salaryCalculation);
  const total = rows.reduce((s, r) => s + r.salaryCalculation.netSalary, 0);
  return {
    total,
    count: rows.length,
    breakdownSig: computeBreakdownSig(rows),
    rows,
  };
}

/* ─── field ของ employee ที่ "กระทบเงินเดือน" — single source of truth ──────
   ใช้ 2 ที่ที่ต้องตรงกันเสมอ:
   1. useFirebaseAppData.updateEmployee → trigger re-settle เดือน grace
   2. diffSalaryFields (ด้านล่าง) → ต้องอธิบาย field ที่เปลี่ยนได้ทุกตัว
   ── เพิ่ม field ใหม่ที่นี่ที่เดียว · เทสต์ "diffSalaryFields covers ทุก field"
      ใน payrollCompute.test.ts จะ fail ถ้าลืมสอน diffSalaryFields ให้อธิบายมัน
   - scalar: trigger เมื่อค่า "เปลี่ยนจริง" (เทียบ !==)
   - object/array: trigger เมื่อมี key ส่งมา (deep-compare ยาก · re-stamp idempotent) */
export const SALARY_AFFECTING_SCALAR_FIELDS = [
  "baseSalary",
  "annualRaiseAmount",
  "roleId",
  "salaryDisabled",
  "singlePieceRate",
  "normalSalePieceRate",
  "specialSalePieceRate",
  "buyPieceRate",
  "invitePieceRate",
  "transferPieceRate",
  "socialSecurity",
] as const;
export const SALARY_AFFECTING_OBJECT_FIELDS = [
  "annualRaises",
  "poolExclusion",
  "pieceRates",
  "poolItemRates",
  "bonusRates",
  "recurringItems",
] as const;

/* ─── Human-readable diff ของ field ที่กระทบเงินเดือน (สำหรับ changeLog) ──── */
const SALARY_FIELD_LABELS: Record<string, string> = {
  baseSalary: "เงินเดือนพื้นฐาน",
  annualRaiseAmount: "ขึ้นเงินเดือนประจำปี",
  socialSecurity: "ประกันสังคม",
  singlePieceRate: "ค่าคอมต่อชิ้น",
  normalSalePieceRate: "ค่าคอมขายทั่วไป",
  specialSalePieceRate: "ค่าคอมขายพิเศษ",
  buyPieceRate: "ค่าคอมรับซื้อ",
  invitePieceRate: "ค่าเชิญบัตร",
  transferPieceRate: "ค่าย้ายบัตร",
  roleId: "ตำแหน่ง",
};
const SALARY_MAP_LABELS: Record<string, string> = {
  poolItemRates: "ค่าคอม",
  pieceRates: "เรท",
  bonusRates: "โบนัส",
};

/** สร้างรายการ "อะไรเปลี่ยนบ้าง" (human-readable) จาก before → fields ที่ส่งแก้ ·
 *  ใช้บันทึก changeLog ของเดือน grace · ครอบ scalar + map เรท + poolExclusion
 *  itemLabels: map id→ชื่อรายการ ต่อ field (poolItemRates/pieceRates/bonusRates)
 *  เพื่อโชว์ชื่อ ("ค่าคอมขายเพชร") แทน id ดิบ ("ค่าคอม(p_1781...)")               */
export function diffSalaryFields(
  before: any,
  fields: any,
  itemLabels?: Record<string, Record<string, string>>,
): string[] {
  const out: string[] = [];
  const b = before || {};
  for (const [key, label] of Object.entries(SALARY_FIELD_LABELS)) {
    if (!(key in fields)) continue;
    const oldV = b[key];
    const newV = fields[key];
    if (key === "roleId") {
      if ((oldV ?? null) === (newV ?? null)) continue;
      // โชว์ชื่อตำแหน่ง ("ช่างทอง") แทน id ดิบ ("r_1781...") ถ้า caller ส่ง map มา
      const roleName = (id: any) =>
        id == null ? "-" : (itemLabels?.roleId?.[id] ?? id);
      out.push(`${label}: ${roleName(oldV)} → ${roleName(newV)}`);
    } else {
      // coerce ตัวเลขก่อนเทียบ — form อาจส่ง rate เป็น string ("30000") ขณะที่
      // ของเดิมเป็น number 30000 → กัน changeLog หลอก "30,000 → 30,000"
      const o = Number(oldV) || 0;
      const n = Number(newV) || 0;
      if (o === n) continue;
      out.push(`${label} ${formatThaiNumber(o)} → ${formatThaiNumber(n)}`);
    }
  }
  for (const [key, label] of Object.entries(SALARY_MAP_LABELS)) {
    if (!(key in fields)) continue;
    const oldMap = (b[key] as Record<string, number>) || {};
    const newMap = (fields[key] as Record<string, number>) || {};
    const ids = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    for (const id of ids) {
      const o = Number(oldMap[id]) || 0;
      const n = Number(newMap[id]) || 0;
      if (o !== n) {
        // โชว์ชื่อรายการถ้ามี ("ค่าคอมขายเพชร") · ไม่มี → fallback id ดิบ
        const itemLabel = itemLabels?.[key]?.[id];
        const shown = itemLabel ? `${label}${itemLabel}` : `${label}(${id})`;
        out.push(`${shown} ${formatThaiNumber(o)} → ${formatThaiNumber(n)}`);
      }
    }
  }
  if (
    "salaryDisabled" in fields &&
    !!b.salaryDisabled !== !!fields.salaryDisabled
  ) {
    out.push(fields.salaryDisabled ? "ปิดสิทธิ์เงินเดือน" : "เปิดสิทธิ์เงินเดือน");
  }
  if ("poolExclusion" in fields) {
    // แปลง id รายการ → ชื่อไทย ("normal" → "ขายทั่วไป") · legacy sell/buy รองรับ
    const labelMap = itemLabels?.poolItemRates || {};
    const idLabel = (id: string) =>
      labelMap[id] || (id === "sell" ? "ขายทั่วไป" : id === "buy" ? "รับซื้อ" : id);
    const fmt = (v: any): string => {
      if (v == null) return "ไม่ปิด";
      if (v === "all" || v === "both") return "ปิดทั้งหมด";
      if (Array.isArray(v))
        return v.length ? `ปิด: ${v.map(idLabel).join(", ")}` : "ไม่ปิด";
      return `ปิด: ${idLabel(String(v))}`;
    };
    const o = fmt(b.poolExclusion);
    const n = fmt(fields.poolExclusion);
    if (o !== n) out.push(`การปิดสิทธิ์กองกลาง: ${o} → ${n}`);
  }
  // รายการประจำเดือน (ค่าเดินทาง/เบี้ยขยัน/ค่าชุด/ค่าอาหาร) — diff ต่อ item ตาม id
  if ("recurringItems" in fields) {
    const kindLabel = (t: string) =>
      t === "deduction" ? "รายการหักประจำ" : "รายรับประจำ";
    const oldArr: any[] = Array.isArray(b.recurringItems)
      ? b.recurringItems
      : [];
    const newArr: any[] = Array.isArray(fields.recurringItems)
      ? fields.recurringItems
      : [];
    const oldById = new Map(oldArr.map((it) => [it.id, it]));
    const newById = new Map(newArr.map((it) => [it.id, it]));
    for (const id of new Set([...oldById.keys(), ...newById.keys()])) {
      const o = oldById.get(id);
      const n = newById.get(id);
      if (o && !n) {
        out.push(`ลบ${kindLabel(o.type)} "${o.label}"`);
      } else if (!o && n) {
        out.push(
          `เพิ่ม${kindLabel(n.type)} "${n.label}" ${formatThaiNumber(Number(n.amount) || 0)} ฿`,
        );
      } else if (
        o &&
        n &&
        (Number(o.amount) || 0) !== (Number(n.amount) || 0)
      ) {
        out.push(
          `${kindLabel(n.type)} "${n.label}" ${formatThaiNumber(Number(o.amount) || 0)} → ${formatThaiNumber(Number(n.amount) || 0)} ฿`,
        );
      }
    }
  }
  // ขึ้นเงินเดือนรายปี (override ต่อปี) — diff ต่อปี
  if ("annualRaises" in fields) {
    const o = (b.annualRaises || {}) as Record<string, number>;
    const n = (fields.annualRaises || {}) as Record<string, number>;
    for (const y of new Set([...Object.keys(o), ...Object.keys(n)])) {
      const ov = Number(o[y]) || 0;
      const nv = Number(n[y]) || 0;
      if (ov !== nv) {
        out.push(
          `ปรับขึ้นเงินเดือนปี ${y}: ${formatThaiNumber(ov)} → ${formatThaiNumber(nv)}`,
        );
      }
    }
  }
  return out;
}

/** diff "จำนวนชิ้น/ครั้ง" ต่อ item (poolItemPieces/piecePieces/bonusCounts) จาก
 *  before → after · ใช้บันทึก changeLog เมื่อ admin แก้จำนวนใน SalaryAdminEdit
 *  itemLabels: map id→ชื่อ ต่อ field (โชว์ชื่อรายการแทน id ดิบ)                   */
export function diffSalaryCounts(
  before: any,
  after: any,
  itemLabels?: Record<string, Record<string, string>>,
): string[] {
  const out: string[] = [];
  const b = before || {};
  const a = after || {};
  const maps: { key: string; unit: string }[] = [
    { key: "poolItemPieces", unit: "ชิ้น" },
    { key: "piecePieces", unit: "ชิ้น" },
    { key: "bonusCounts", unit: "ครั้ง" },
  ];
  for (const { key, unit } of maps) {
    if (!(key in a)) continue;
    const oldMap = (b[key] as Record<string, number>) || {};
    const newMap = (a[key] as Record<string, number>) || {};
    const ids = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    for (const id of ids) {
      const o = Number(oldMap[id]) || 0;
      const n = Number(newMap[id]) || 0;
      if (o === n) continue;
      const name = itemLabels?.[key]?.[id] ?? id;
      out.push(
        `${name} ${formatThaiNumber(o)} → ${formatThaiNumber(n)} ${unit}`,
      );
    }
  }
  // รายรับ/รายการหักพิเศษ (array) — diff ที่ "ยอดรวม" (ไม่มี id เสถียรต่อแถว)
  const sums: { key: string; label: string }[] = [
    { key: "customEarnings", label: "รายรับพิเศษ" },
    { key: "customDeductions", label: "รายการหักพิเศษ" },
  ];
  for (const { key, label } of sums) {
    if (!(key in a)) continue;
    const sum = (arr: any) =>
      (Array.isArray(arr) ? arr : []).reduce(
        (s: number, it: any) => s + (Number(it?.amount) || 0),
        0,
      );
    const o = sum(b[key]);
    const n = sum(a[key]);
    if (o !== n) {
      out.push(`${label} ${formatThaiNumber(o)} → ${formatThaiNumber(n)} ฿`);
    }
  }
  return out;
}

/** diff รายการ "หักกองกลาง" (PoolAdjustmentEntry) prev → next ต่อ item id ·
 *  ใช้บันทึก changeLog เมื่อ admin แก้รายการหักกองกลางในเดือน grace ·
 *  รายงาน เพิ่ม/ลบ/แก้จำนวนชิ้น (จำนวนชิ้นคือสิ่งที่กระทบการเกลี่ยกองกลาง)        */
export function diffPoolAdjustment(prev: any, next: any): string[] {
  const out: string[] = [];
  const prevItems: any[] = Array.isArray(prev?.items) ? prev.items : [];
  const nextItems: any[] = Array.isArray(next?.items) ? next.items : [];
  const oldById = new Map(prevItems.map((it) => [it.id, it]));
  const newById = new Map(nextItems.map((it) => [it.id, it]));
  const nameOf = (it: any) => (it?.label || "").trim() || "(ไม่ระบุ)";
  const pcs = (it: any) => Number(it?.pieces) || 0;
  for (const id of new Set([...oldById.keys(), ...newById.keys()])) {
    const o = oldById.get(id);
    const n = newById.get(id);
    if (o && !n) {
      out.push(`หักกองกลาง: ลบ "${nameOf(o)}" (${formatThaiNumber(pcs(o))} ชิ้น)`);
    } else if (!o && n) {
      out.push(`หักกองกลาง: เพิ่ม "${nameOf(n)}" ${formatThaiNumber(pcs(n))} ชิ้น`);
    } else if (o && n && pcs(o) !== pcs(n)) {
      out.push(
        `หักกองกลาง "${nameOf(n)}" ${formatThaiNumber(pcs(o))} → ${formatThaiNumber(pcs(n))} ชิ้น`,
      );
    }
  }
  return out;
}

/** label เปิด/ปิด ต่อ array ของ storeCalendar (สำหรับ changeLog) */
const CALENDAR_DATE_LABELS: Record<string, { added: string; removed: string }> =
  {
    extraOpenSaturdays: {
      added: "เปิดเสาร์พิเศษ",
      removed: "ยกเลิกเปิดเสาร์พิเศษ",
    },
    paidExtraSaturdays: {
      added: "จ่ายเพิ่มเสาร์พิเศษ",
      removed: "ยกเลิกจ่ายเพิ่มเสาร์พิเศษ",
    },
    extraClosedWeekdays: {
      added: "ปิดวันธรรมดาพิเศษ",
      removed: "ยกเลิกปิดวันธรรมดาพิเศษ",
    },
    extraClosedSundays: {
      added: "ปิดวันอาทิตย์พิเศษ",
      removed: "ยกเลิกปิดวันอาทิตย์พิเศษ",
    },
  };

/** diff ปฏิทินเปิด-ปิดร้าน prev → next เป็นข้อความต่อเดือน (key = "YYYY-MM") ·
 *  ใช้บันทึก changeLog ของแต่ละเดือน grace ที่ได้รับผลกระทบ — แทนข้อความรวม
 *  "แก้ปฏิทินเปิด-ปิดร้าน" ให้รู้ว่าวันไหนเปลี่ยนเป็นอะไร                          */
export function diffCalendarChanges(
  prev: any,
  next: any,
): Record<string, string[]> {
  const byMonth: Record<string, string[]> = {};
  const push = (ymd: string, text: string) => {
    const ym = ymd.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(text);
  };
  for (const [key, labels] of Object.entries(CALENDAR_DATE_LABELS)) {
    const sa = new Set<string>(prev?.[key] || []);
    const sb = new Set<string>(next?.[key] || []);
    for (const d of sb)
      if (!sa.has(d)) push(d, `${labels.added} ${fmtShort(d)}`);
    for (const d of sa)
      if (!sb.has(d)) push(d, `${labels.removed} ${fmtShort(d)}`);
  }
  return byMonth;
}

/** สถานะเงินกู้ → ไทย (changeLog) */
const LOAN_STATUS_LABELS: Record<string, string> = {
  active: "กำลังผ่อน",
  paid_off: "ผ่อนครบแล้ว",
  cancelled: "ยกเลิก",
};

/** diff field ของเงินกู้ผ่อนคืน before → fields ที่แก้ · ใช้บันทึก changeLog
 *  เมื่อ admin แก้เงินกู้ในเดือน grace · ครอบ เงินต้น/หักต่อเดือน/เดือนเริ่ม/สถานะ */
export function diffLoanFields(before: any, fields: any): string[] {
  const out: string[] = [];
  const b = before || {};
  const moneyFields: { key: string; label: string }[] = [
    { key: "principal", label: "เงินต้น" },
    { key: "monthlyDeduction", label: "หักต่อเดือน" },
  ];
  for (const { key, label } of moneyFields) {
    if (!(key in fields)) continue;
    const o = Number(b[key]) || 0;
    const n = Number(fields[key]) || 0;
    if (o !== n) {
      out.push(`${label} ${formatThaiNumber(o)} → ${formatThaiNumber(n)} ฿`);
    }
  }
  if (
    "startMonth" in fields &&
    (b.startMonth ?? "") !== (fields.startMonth ?? "")
  ) {
    out.push(`เดือนเริ่มหัก ${b.startMonth ?? "-"} → ${fields.startMonth ?? "-"}`);
  }
  if ("status" in fields && (b.status ?? "") !== (fields.status ?? "")) {
    const lbl = (s: any) => LOAN_STATUS_LABELS[s] ?? s ?? "-";
    out.push(`สถานะเงินกู้ ${lbl(b.status)} → ${lbl(fields.status)}`);
  }
  return out;
}

/** ข้อความสรุปเงินกู้ 1 ก้อน (เพิ่ม/ลบ) สำหรับ changeLog */
export function loanSummary(loan: any): string {
  const principal = formatThaiNumber(Number(loan?.principal) || 0);
  const monthly = formatThaiNumber(Number(loan?.monthlyDeduction) || 0);
  return `เงินต้น ${principal} ฿ · หักเดือนละ ${monthly} ฿`;
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
