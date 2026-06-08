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

/** filter pool — เก็บเฉพาะคนที่ยังมีตัวอยู่ใน employeeDirectory
 *  (ถ้าถูกลบจาก system → ตัดออกจาก pool โดยอัตโนมัติ) */
function activePool(duty: Duty, employees: Employee[]): string[] {
  const known = new Set(employees.map((e) => e.id));
  return duty.poolEmployeeIds.filter((id) => known.has(id));
}

/** คำนวณ assignment ของเวรเดียวในวันเดียว — ใช้ primariesToday เพื่อ
 *  exclude คนที่เป็น primary เวรอื่นในวันนี้ออกจาก substitute pool       */
export function computeDutyForDay(
  duty: Duty,
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
  const primary = pool[idx % pool.length];

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

  // primary ลา → หา substitute (ข้ามคนที่ติดเวรอื่น + ข้ามคนที่ลา)
  for (let offset = 1; offset < pool.length; offset++) {
    const cand = pool[(idx + offset) % pool.length];
    if (cand === primary) continue;
    if (isOnLeave(leaves, cand, todayYmd)) continue;
    if (primariesToday.has(cand)) continue; // ไม่ทับเวรอื่น
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

  // fallback: ทุกคนใน pool ติดเวรอื่น → ใช้ใครก็ได้ที่ไม่ลา (double up)
  for (let offset = 1; offset < pool.length; offset++) {
    const cand = pool[(idx + offset) % pool.length];
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

/** คำนวณทุกเวรในวันเดียว — เรียง duties ตามลำดับ + เก็บ primariesToday
 *  เพื่อให้ substitute logic ของเวรหลังๆ exclude primaries ที่ assign ไปแล้ว
 *  (= ป้องกัน "ทับคนอื่น")                                              */
export function computeAllDutiesForDay(
  duties: Duty[],
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
): DutyAssignment[] {
  // Pass 1: หา primary (ก่อนเช็ค leave) ของทุกเวร → ใช้สำหรับ substitute
  // exclusion. ถ้า primary คนนั้นลา substitute ไม่ควรเอามาทับ
  const primariesToday = new Set<string>();
  for (const duty of duties) {
    const pool = activePool(duty, employees);
    if (pool.length === 0) continue;
    const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    primariesToday.add(pool[idx % pool.length]);
  }

  // Pass 2: compute actual ของแต่ละเวร (รับรู้ primaries ของเวรอื่น)
  return duties.map((duty) =>
    computeDutyForDay(duty, todayYmd, employees, leaves, primariesToday),
  );
}
