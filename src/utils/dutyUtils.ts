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

/** ช่วงของ period ที่ today อยู่ใน — สำหรับแสดง "สัปดาห์นี้ X – Y" */
export function getPeriodRange(
  duty: Duty,
  todayYmd: string,
): { start: string; end: string } {
  const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
  const start = new Date(`${duty.rotationStartDate}T00:00:00`);
  if (duty.period === "weekly") {
    start.setDate(start.getDate() + idx * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toYMD(start), end: toYMD(end) };
  }
  start.setMonth(start.getMonth() + idx);
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // last day of period month
  return { start: toYMD(start), end: toYMD(end) };
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
  return employees
    .filter(
      (e) =>
        e.roleId === duty.roleId && !e.salaryDisabled && !excluded.has(e.id),
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
