/* ─── Duty rotation + substitute logic ─────────────────────────
   Pure functions — รับ input ออก output, ไม่แตะ Firestore / state    */

import type { Duty, Employee, LeaveEntry } from "../types";
import { toYMD } from "./dateUtils";

export interface DutyAssignment {
  dutyId: string;
  dutyName: string;
  period: "weekly" | "monthly";
  primaryEmpId: string | null; // คนที่ระบบกำหนดให้ตาม rotation (ก่อนเช็ค leave)
  actualEmpId: string | null; // คนที่ทำจริงในวันนั้น (= primary ถ้าไม่ลา / substitute ถ้าลา)
  reason:
    | "rotation"
    | "substitute_for_leave"
    | "double_up"
    | "all_on_leave"
    | "empty_pool";
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string;
}

/** วันห่างระหว่าง 2 วัน (calendar days, ไม่ใช่ 24h × ms) */
function daysBetween(startYmd: string, todayYmd: string): number {
  const a = new Date(`${startYmd}T00:00:00`);
  const b = new Date(`${todayYmd}T00:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/** เดือนห่างตามปฏิทิน (Jan→Feb = 1) */
function monthsBetween(startYmd: string, todayYmd: string): number {
  const a = new Date(`${startYmd}T00:00:00`);
  const b = new Date(`${todayYmd}T00:00:00`);
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

/** คำนวณ period index ของวันที่ X — index 0 = period แรก (วันที่
 *  rotationStartDate), index 1 = period ที่ 2, ฯลฯ */
export function getPeriodIndex(duty: Duty, todayYmd: string): number {
  if (duty.period === "weekly") {
    return Math.floor(daysBetween(duty.rotationStartDate, todayYmd) / 7);
  }
  return monthsBetween(duty.rotationStartDate, todayYmd);
}

/** ช่วงของ period index ที่ระบุ — index 0 = period แรก (rotationStartDate) */
export function getPeriodRangeForIndex(
  duty: Duty,
  idx: number,
): { start: string; end: string } {
  const safeIdx = Math.max(0, idx);
  const start = new Date(`${duty.rotationStartDate}T00:00:00`);
  if (duty.period === "weekly") {
    start.setDate(start.getDate() + safeIdx * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toYMD(start), end: toYMD(end) };
  }
  start.setMonth(start.getMonth() + safeIdx);
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // last day of period month
  return { start: toYMD(start), end: toYMD(end) };
}

/** ช่วงของ period ที่ today อยู่ใน — สำหรับแสดง "สัปดาห์นี้ X – Y" */
export function getPeriodRange(
  duty: Duty,
  todayYmd: string,
): { start: string; end: string } {
  return getPeriodRangeForIndex(duty, getPeriodIndex(duty, todayYmd));
}

/** ลาวันนั้นไหม — leave.start ≤ ymd ≤ leave.end (string compare) */
function isOnLeave(leaves: LeaveEntry[], empId: string, ymd: string): boolean {
  return leaves.some(
    (l) => l.employeeId === empId && l.start <= ymd && l.end >= ymd,
  );
}

/** Resolve pool — คนในตำแหน่ง duty.roleId เรียงตาม displayOrder (asc) →
 *  ชื่อ (asc) เป็น fallback. คนที่ salaryDisabled ถือว่าใช้แอปแค่ระบบลา
 *  ไม่ทำหน้าที่ → exclude. คนที่ถูกลบจาก system → ไม่อยู่ใน list → exclude
 *  อัตโนมัติ. คนใน duty.excludedEmpIds (admin ตัดออก) → exclude.
 *  ลำดับ deterministic — ปรับด้วย admin reorder (displayOrder)
 *
 *  public — UI อื่นๆ (DutyCard ใน admin) ก็ใช้ตัวนี้เพื่อแสดงรายชื่อ pool
 *  จะได้ตรงกับ rotation จริงเสมอ (single source of truth)               */
export function resolveDutyPool(duty: Duty, employees: Employee[]): Employee[] {
  const excluded = new Set(duty.excludedEmpIds || []);
  // คน poolExclusion="both" (ปิดทั้งคู่ — ไม่อยู่ในกองกลาง + ใช้เกณฑ์ 50%
  // เงินเดือนพื้นฐาน) ห้ามทำ monthly duty — ติดทั้งเดือนแล้วเสี่ยงหลุด 50%
  // โดย exemption ช่วยไม่ได้ (exemption ยกเว้นแค่เกณฑ์ 80%)
  const blockBoth = duty.period === "monthly";
  return employees
    .filter(
      (e) =>
        e.roleId === duty.roleId &&
        !e.salaryDisabled &&
        !excluded.has(e.id) &&
        !(blockBoth && e.poolExclusion === "both"),
    )
    .sort((a, b) => {
      const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
      const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return (a.name || "").localeCompare(b.name || "", "th");
    });
}

function activePool(duty: Duty, employees: Employee[]): string[] {
  return resolveDutyPool(duty, employees).map((e) => e.id);
}

/** คำนวณ assignment ของหน้าที่เดียวในวันเดียว
 *  dutyIndex: ลำดับใน group (monthly แยก / weekly แยก) — ใช้ shift primary
 *  excludeForPrimary: ID ของคนที่ "ไม่ให้เป็น primary" (เช่น คนที่ทำ
 *    monthly แล้ว — แยกออกจาก weekly)
 *  primariesToday: ใช้ exclude ตอนหา substitute ("ไม่ทับคนอื่น")
 *
 *  Algorithm:
 *  - pool พรีเฟอเรนซ์ = activePool − excludeForPrimary
 *  - ถ้า pool เหลือ 0 → fallback ใช้ activePool ทั้งหมด (ห้ามให้มีหน้าที่ว่าง)
 *  - primary = preferredPool[(periodIndex + dutyIndex) % length]            */
export function computeDutyForDay(
  duty: Duty,
  dutyIndex: number,
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
  excludeForPrimary: Set<string>,
  primariesToday: Set<string>,
): DutyAssignment {
  const fullPool = activePool(duty, employees);
  const { start: periodStart, end: periodEnd } = getPeriodRange(duty, todayYmd);

  if (fullPool.length === 0) {
    return {
      dutyId: duty.id,
      dutyName: duty.name,
      period: duty.period,
      primaryEmpId: null,
      actualEmpId: null,
      reason: "empty_pool",
      periodStart,
      periodEnd,
    };
  }

  // pool พรีเฟอเรนซ์ — exclude คนที่ "ห้ามเป็น primary" (เช่น monthly lock)
  // ถ้า exclude ทำให้ pool ว่าง → fallback ใช้ pool เต็ม (กันหน้าที่ว่าง)
  const preferredPool = fullPool.filter((id) => !excludeForPrimary.has(id));
  const pool = preferredPool.length > 0 ? preferredPool : fullPool;

  const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
  const primary = pool[(idx + dutyIndex) % pool.length];

  // primary ไม่ลา → ใช้ primary
  if (!isOnLeave(leaves, primary, todayYmd)) {
    return {
      dutyId: duty.id,
      dutyName: duty.name,
      period: duty.period,
      primaryEmpId: primary,
      actualEmpId: primary,
      reason: "rotation",
      periodStart,
      periodEnd,
    };
  }

  // primary ลา → หา substitute (ข้ามคนที่ติดหน้าที่อื่น + ข้ามคนที่ลา)
  // ใช้ pool (ที่ filter แล้ว = excludeForPrimary applied) ที่นี่ —
  // คนที่ทำ monthly จะ "หาย" ทั้งเดือน ไม่มาช่วย weekly แม้ตอนคนลา
  const baseOffset = idx + dutyIndex;
  for (let offset = 1; offset < pool.length; offset++) {
    const cand = pool[(baseOffset + offset) % pool.length];
    if (cand === primary) continue;
    if (isOnLeave(leaves, cand, todayYmd)) continue;
    if (primariesToday.has(cand)) continue; // ไม่ทับหน้าที่อื่น
    return {
      dutyId: duty.id,
      dutyName: duty.name,
      period: duty.period,
      primaryEmpId: primary,
      actualEmpId: cand,
      reason: "substitute_for_leave",
      periodStart,
      periodEnd,
    };
  }

  // fallback: ทุกคนใน pool ติดหน้าที่อื่น → ใช้ใครก็ได้ใน pool ที่ไม่ลา
  // (double up — ยังไม่ออกไป fullPool ตามกฎ monthly แยก)
  for (let offset = 1; offset < pool.length; offset++) {
    const cand = pool[(baseOffset + offset) % pool.length];
    if (cand === primary) continue;
    if (isOnLeave(leaves, cand, todayYmd)) continue;
    return {
      dutyId: duty.id,
      dutyName: duty.name,
      period: duty.period,
      primaryEmpId: primary,
      actualEmpId: cand,
      reason: "double_up",
      periodStart,
      periodEnd,
    };
  }

  // ทุกคนใน pool ลาหมด
  return {
    dutyId: duty.id,
    dutyName: duty.name,
    period: duty.period,
    primaryEmpId: primary,
    actualEmpId: null,
    reason: "all_on_leave",
    periodStart,
    periodEnd,
  };
}

/** คำนวณทุกหน้าที่ในวันเดียว
 *
 *  Strategy:
 *  1. Phase 1 — assign monthly primaries ก่อน (จะ "lock" คนเหล่านี้
 *     ทั้งเดือน → ไม่เข้าใน weekly duty)
 *  2. Phase 2 — assign weekly primaries จาก pool ที่เหลือ (ไม่ทับ monthly)
 *  3. Phase 3 — compute actual (substitute ถ้า primary ลา) — ใช้
 *     primariesToday set กัน "ทับ"
 *
 *  Order ของ dutyIndex แยกตาม group (monthly idx / weekly idx) — ลำดับ
 *  ภายในยึดตาม createdAt ASC (เรียงใน subscribeDuties)                  */
export function computeAllDutiesForDay(
  duties: Duty[],
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
): DutyAssignment[] {
  const monthlyDuties = duties.filter((d) => d.period === "monthly");
  const weeklyDuties = duties.filter((d) => d.period === "weekly");

  // Phase 1: monthly primaries — ไม่มี exclude (assign ก่อน + lock)
  const lockedByMonthly = new Set<string>();
  const monthlyPrimaries = new Map<string, string>(); // dutyId → empId
  monthlyDuties.forEach((duty, monthlyIdx) => {
    const fullPool = activePool(duty, employees);
    if (fullPool.length === 0) return;
    // monthly แต่ละตัวต่างกันด้วย monthlyIdx + ห้ามทับกันเอง
    const remaining = fullPool.filter((id) => !lockedByMonthly.has(id));
    const pool = remaining.length > 0 ? remaining : fullPool;
    const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    const primary = pool[(idx + monthlyIdx) % pool.length];
    lockedByMonthly.add(primary);
    monthlyPrimaries.set(duty.id, primary);
  });

  // Phase 2: weekly primaries — exclude คนที่ทำ monthly ทั้งเดือน
  const weeklyPrimaries = new Map<string, string>();
  weeklyDuties.forEach((duty, weeklyIdx) => {
    const fullPool = activePool(duty, employees);
    if (fullPool.length === 0) return;
    const preferred = fullPool.filter((id) => !lockedByMonthly.has(id));
    const pool = preferred.length > 0 ? preferred : fullPool;
    const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    const primary = pool[(idx + weeklyIdx) % pool.length];
    weeklyPrimaries.set(duty.id, primary);
  });

  // primariesToday = รวมทุก primary จาก monthly + weekly เพื่อให้
  // substitute logic exclude ("ไม่ทับ")
  const primariesToday = new Set<string>([
    ...monthlyPrimaries.values(),
    ...weeklyPrimaries.values(),
  ]);

  // Phase 3: compute actual ของแต่ละ duty — preserve original order ใน
  // duties array. แต่ละ duty ใช้ dutyIndex ใน group ของมัน + excludeForPrimary
  // = lockedByMonthly สำหรับ weekly, Set ว่างสำหรับ monthly
  let monthlyCounter = 0;
  let weeklyCounter = 0;
  return duties.map((duty) => {
    if (duty.period === "monthly") {
      const dutyIndex = monthlyCounter++;
      return computeDutyForDay(
        duty,
        dutyIndex,
        todayYmd,
        employees,
        leaves,
        new Set<string>(), // monthly ไม่มี exclude (assign ก่อน weekly)
        primariesToday,
      );
    }
    const dutyIndex = weeklyCounter++;
    return computeDutyForDay(
      duty,
      dutyIndex,
      todayYmd,
      employees,
      leaves,
      lockedByMonthly, // weekly exclude คนที่ทำ monthly
      primariesToday,
    );
  });
}

/** employeeId เป็นคนที่ทำ monthly duty ที่ "ให้สิทธิ์กองกลาง" ในเดือน yearMonth
 *  ไหม → ใช้ตอน stamp poolThresholdExempt ลง salary snapshot
 *  ดู primary (คนที่ถูกกำหนดทั้งเดือน) ไม่ใช่ substitute · empty leaves      */
export function employeeHasPoolExemptDuty(
  employeeId: string,
  yearMonth: string, // "YYYY-MM"
  duties: Duty[],
  employees: Employee[],
): boolean {
  const exemptIds = new Set(
    duties
      .filter(
        (d) =>
          d.kind !== "coverage" &&
          d.period === "monthly" &&
          d.grantsPoolEligibility,
      )
      .map((d) => d.id),
  );
  if (exemptIds.size === 0) return false;
  // ใช้กลางเดือนเป็นตัวแทน + ไม่ใส่ leaves (ดู primary ตาม rotation)
  const repDate = `${yearMonth}-15`;
  const assignments = computeAllDutiesForDay(duties, repDate, employees, []);
  return assignments.some(
    (a) => exemptIds.has(a.dutyId) && a.primaryEmpId === employeeId,
  );
}

/* ─── Forecast (ปฏิทินหน้าที่ล่วงหน้า) ──────────────────────────────
   คำนวณ "primary ของแต่ละ period ในอนาคต" — ใช้ pool ที่ resolve แล้ว
   (จาก server snapshot) ดังนั้นทั้ง admin/พนักงานคำนวณเองได้ client-side
   โดยไม่ต้องอ่าน employees/leaves ของเพื่อน

   Forecast แสดงเฉพาะ primary ตาม rotation (deterministic) — ไม่รวม
   substitute/leave เพราะการลาในอนาคตยังไม่รู้ + เป็น schedule สำหรับ
   "เตรียมพร้อม" ล่วงหน้า                                                */

/** primary ของทุก duty ในวันที่ระบุ — รับ pool ที่ resolve แล้ว
 *  (dutyId → ordered empIds). Logic ตรงกับ computeAllDutiesForDay phase
 *  1+2 (monthly lock cross-duty + weekly exclude) แต่ไม่มี substitute    */
export function computeForecastPrimaries(
  duties: Duty[],
  poolByDutyId: Map<string, string[]>,
  todayYmd: string,
): Map<string, string | null> {
  const monthly = duties.filter((d) => d.period === "monthly");
  const weekly = duties.filter((d) => d.period === "weekly");
  const locked = new Set<string>();
  const result = new Map<string, string | null>();

  monthly.forEach((duty, idx) => {
    const full = poolByDutyId.get(duty.id) || [];
    if (full.length === 0) {
      result.set(duty.id, null);
      return;
    }
    const remaining = full.filter((id) => !locked.has(id));
    const pool = remaining.length > 0 ? remaining : full;
    const pIdx = Math.max(0, getPeriodIndex(duty, todayYmd));
    const primary = pool[(pIdx + idx) % pool.length];
    locked.add(primary);
    result.set(duty.id, primary);
  });

  weekly.forEach((duty, idx) => {
    const full = poolByDutyId.get(duty.id) || [];
    if (full.length === 0) {
      result.set(duty.id, null);
      return;
    }
    const preferred = full.filter((id) => !locked.has(id));
    const pool = preferred.length > 0 ? preferred : full;
    const pIdx = Math.max(0, getPeriodIndex(duty, todayYmd));
    const primary = pool[(pIdx + idx) % pool.length];
    result.set(duty.id, primary);
  });

  return result;
}

export interface ForecastPeriod {
  index: number;
  start: string; // YYYY-MM-DD
  end: string;
  primaryEmpId: string | null;
}

export interface DutyForecast {
  dutyId: string;
  dutyName: string;
  period: "weekly" | "monthly";
  periods: ForecastPeriod[];
}

/** Forecast ของทุก duty ตั้งแต่ period ปัจจุบัน → endYmd (เช่นสิ้นปี)
 *  คืน per-duty timeline. คำนวณ primary ณ ต้น period แต่ละช่วง (cache
 *  ตามวันที่เพื่อไม่คำนวณซ้ำ)                                              */
export function computeDutyForecast(
  duties: Duty[],
  poolByDutyId: Map<string, string[]>,
  todayYmd: string,
  endYmd: string,
): DutyForecast[] {
  // coverage = เวรแทนคนลา (ขึ้นกับการลาจริง) → forecast ล่วงหน้าไม่ได้
  const rotationDuties = duties.filter((d) => d.kind !== "coverage");
  const cache = new Map<string, Map<string, string | null>>();
  const primariesAt = (ymd: string) => {
    const key = ymd < todayYmd ? todayYmd : ymd;
    let m = cache.get(key);
    if (!m) {
      m = computeForecastPrimaries(rotationDuties, poolByDutyId, key);
      cache.set(key, m);
    }
    return m;
  };

  return rotationDuties.map((duty) => {
    const periods: ForecastPeriod[] = [];
    let idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    // เดินไปข้างหน้าจน period start เกิน endYmd (safety cap 80 รอบ)
    while (periods.length < 80) {
      const range = getPeriodRangeForIndex(duty, idx);
      if (range.start > endYmd) break;
      const repDate = range.start < todayYmd ? todayYmd : range.start;
      const primary = primariesAt(repDate).get(duty.id) ?? null;
      periods.push({
        index: idx,
        start: range.start,
        end: range.end,
        primaryEmpId: primary,
      });
      idx++;
    }
    return {
      dutyId: duty.id,
      dutyName: duty.name,
      period: duty.period,
      periods,
    };
  });
}
