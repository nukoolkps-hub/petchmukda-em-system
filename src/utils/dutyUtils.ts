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
 *  อัตโนมัติ. ลำดับ deterministic — ปรับด้วย admin reorder (displayOrder) */
function activePool(duty: Duty, employees: Employee[]): string[] {
  return employees
    .filter((e) => e.roleId === duty.roleId && !e.salaryDisabled)
    .sort((a, b) => {
      const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
      const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return (a.name || "").localeCompare(b.name || "", "th");
    })
    .map((e) => e.id);
}

/** คำนวณ assignment ของหน้าที่เดียวในวันเดียว
 *  dutyIndex: ลำดับของหน้าที่ในชุด (เริ่มที่ 0) — ใช้ shift primary ไม่ให้ทับ
 *             หน้าที่อื่น ตำแหน่งเดียวกัน period เดียวกัน
 *  primariesToday: ใช้ exclude ตอนหา substitute ("ไม่ทับคนอื่น")           */
export function computeDutyForDay(
  duty: Duty,
  dutyIndex: number,
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
  primariesToday: Set<string>,
): DutyAssignment {
  const pool = activePool(duty, employees);
  const { start: periodStart, end: periodEnd } = getPeriodRange(duty, todayYmd);

  if (pool.length === 0) {
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

  const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
  // shift primary ด้วย dutyIndex → หน้าที่อื่นที่ใช้ pool/period เดียวกัน
  // จะได้คนละคน (ถ้า pool.length ≥ duties.length)
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
  // เริ่มไล่จากตำแหน่ง primary+1 — ใช้ idx+dutyIndex+offset
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

  // fallback: ทุกคนใน pool ติดหน้าที่อื่น → ใช้ใครก็ได้ที่ไม่ลา (double up)
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

/** คำนวณทุกหน้าที่ในวันเดียว — เรียง duties ตามลำดับ + เก็บ primariesToday
 *  เพื่อให้ substitute logic ของหน้าที่หลังๆ exclude primaries ที่ assign ไปแล้ว
 *  (= ป้องกัน "ทับคนอื่น")                                              */
export function computeAllDutiesForDay(
  duties: Duty[],
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
): DutyAssignment[] {
  // Pass 1: หา primary (ก่อนเช็ค leave) ของทุกหน้าที่ — shift ด้วย dutyIndex
  // กันไม่ให้หน้าที่ที่ใช้ pool+period+startDate เดียวกันมี primary ทับกัน
  const primariesToday = new Set<string>();
  duties.forEach((duty, dutyIndex) => {
    const pool = activePool(duty, employees);
    if (pool.length === 0) return;
    const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    primariesToday.add(pool[(idx + dutyIndex) % pool.length]);
  });

  // Pass 2: compute actual ของแต่ละหน้าที่ (รับรู้ primaries ของหน้าที่อื่น
  // เพื่อให้ substitute ไม่ทับ)
  return duties.map((duty, dutyIndex) =>
    computeDutyForDay(
      duty,
      dutyIndex,
      todayYmd,
      employees,
      leaves,
      primariesToday,
    ),
  );
}
