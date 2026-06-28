/* ─── Duty rotation + substitute logic ─────────────────────────
   Pure functions — รับ input ออก output, ไม่แตะ Firestore / state

   ─── Rotation stability (A+B+C) ────────────────────────────────
   A · dutyOffset = stableSlot(duty.id) แทนตำแหน่งใน array — เพิ่ม/ลบ
       หน้าที่ตัวหนึ่งไม่กระทบ slot ของหน้าที่ตัวอื่น
   B · ฝั่ง server: ถ้า duty.cachedPrimary ตรง periodIndex ปัจจุบันและคน
       ยังอยู่ใน pool → ใช้ cache แทนคำนวณใหม่ (pool เปลี่ยนกลาง period
       ไม่กระทบ primary) — fallback ลงมาที่ A เมื่อ cache invalid
   C · ตอนสร้างพนักงานใหม่: displayOrder = max(existing)+1 → คนใหม่ต่อ
       ท้าย queue ไม่แทรกกลาง                                      */

import type { Duty, Employee, LeaveEntry } from "../types";
import { toYMD } from "./dateUtils";

/** FNV-1a 32-bit hash — deterministic, no deps, low collision rate
 *  ใช้แปลง duty.id → ตัวเลขคงที่ → กลายเป็น slot ใน pool
 *  ⚠️ ต้องเหมือน functions/src/duty/dutyUtils.ts เป๊ะ (client/server compute
 *     ต้องตรงกัน) — แก้ที่นี่แล้วแก้ฝั่ง server ด้วย                       */
export function hashDutyId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0; // unsigned 32-bit
}

/** วันอาทิตย์ของวันที่ ymd ("YYYY-MM-DD") — parse แบบ local-date เลี่ยง TZ */
export function isSunday(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
}

interface StoreCalendarLite {
  extraOpenSaturdays: string[];
  extraClosedWeekdays: string[];
  extraClosedSundays?: string[];
}

/** filter หน้าที่ที่ "applicable วันนี้":
 *  - ร้านปิด (เสาร์ default หรือ admin mark ปิด) → [] (ไม่มีหน้าที่)
 *  - อาทิตย์ปิดพิเศษ → [] (ไม่มีหน้าที่)
 *  - อาทิตย์เปิด → ตัด weekly+skipSundays (per-duty opt-out)
 *  - วันทำงานอื่น → ทุกหน้าที่ปกติ                                        */
export function applicableDuties(
  duties: Duty[],
  todayYmd: string,
  calendar?: StoreCalendarLite | null,
): Duty[] {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  // เสาร์: ปิด default ยกเว้นใน extraOpenSaturdays
  if (dow === 6 && !(calendar?.extraOpenSaturdays || []).includes(todayYmd)) {
    return [];
  }
  // จันทร์-ศุกร์ ที่อยู่ใน extraClosedWeekdays → ปิดพิเศษ
  if (
    dow !== 0 &&
    dow !== 6 &&
    (calendar?.extraClosedWeekdays || []).includes(todayYmd)
  ) {
    return [];
  }
  // อาทิตย์: ปิดพิเศษ → [] · เปิด → ใช้ per-duty opt-out
  if (dow === 0) {
    if ((calendar?.extraClosedSundays || []).includes(todayYmd)) {
      return [];
    }
    return duties.filter((dt) => !(dt.period === "weekly" && dt.skipSundays));
  }
  return duties;
}

/** เลือก primary ของหน้าที่ — single source of truth ของ A+B
 *  B · cache: ถ้า periodIndex ตรง + คนยังอยู่ใน pool + ยังไม่ถูกใช้รอบนี้
 *  A · hash base + skip-collision: hashDutyId เป็น slot เริ่มต้น แล้วเลื่อน
 *      ข้ามคนที่ถูกหน้าที่อื่นจองแล้ว (used) → กระจายให้คนละคน
 *  used = คนที่เป็น primary ของหน้าที่อื่นในรอบนี้แล้ว (กัน 2 หน้าที่ทับคน)
 *  คืน null เมื่อ pool ว่าง (caller ควร guard ก่อน — นี่คือ safety net)
 *
 *  Fairness guarantee (วัดจาก simulation 52 สัปดาห์):
 *  - pool คงที่ → ทุกคนได้แต่ละหน้าที่เท่ากันเป๊ะ (หมุนครบทุก L period)
 *  - pool เปลี่ยนกลางปี → คลาดเคลื่อน ≤ ~7% ตามสัดส่วนเวลาที่อยู่จริง
 *  (ต่างจาก coverage ที่ใช้ replayCoverageHistory นับประวัติ — rotation
 *   เลือกใช้สูตร stateless เพื่อความนิ่ง/คาดเดาได้ ยอมแลก fairness ส่วนน้อย) */
export function pickPrimary(
  duty: Duty,
  pool: string[],
  periodIdx: number,
  used: Set<string>,
): string | null {
  if (pool.length === 0) return null; // กัน % 0 = NaN
  const cache = duty.cachedPrimary;
  if (
    cache &&
    cache.periodIndex === periodIdx &&
    pool.includes(cache.empId) &&
    !used.has(cache.empId)
  ) {
    return cache.empId;
  }
  const base = (periodIdx + hashDutyId(duty.id)) % pool.length;
  for (let off = 0; off < pool.length; off++) {
    const cand = pool[(base + off) % pool.length];
    if (!used.has(cand)) return cand;
  }
  return pool[base]; // ทุกคนถูกใช้หมด → ยอมซ้ำ (หน้าที่ > คน)
}

/** assign primary ให้หน้าที่กลุ่มหนึ่ง (Phase 1 = monthly, Phase 2 = weekly)
 *  — ลูปเดียวใช้ร่วม 2 phase:
 *  - pool ของแต่ละหน้าที่ = poolOf(duty) − locked (fallback pool เต็มถ้าว่าง)
 *  - lockPicked: monthly เพิ่มคนที่เลือกเข้า locked (กันออกจาก weekly)
 *  ผล: เขียนเพิ่มลง out + assigned (skip-collision ข้ามหน้าที่)            */
function assignPrimaries(
  duties: Duty[],
  todayYmd: string,
  poolOf: (duty: Duty) => string[],
  assigned: Set<string>,
  locked: Set<string>,
  lockPicked: boolean,
  out: Map<string, string>,
): void {
  for (const duty of duties) {
    const fullPool = poolOf(duty);
    if (fullPool.length === 0) continue;
    const remaining = fullPool.filter((id) => !locked.has(id));
    const pool = remaining.length > 0 ? remaining : fullPool;
    const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
    const primary = pickPrimary(duty, pool, idx, assigned);
    if (!primary) continue;
    assigned.add(primary);
    if (lockPicked) locked.add(primary);
    out.set(duty.id, primary);
  }
}

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
  // คนที่ปิดกองกลาง "ทั้งหมด" (poolExclusion = "all" · legacy "both")
  // ห้ามทำ monthly duty — ติดทั้งเดือนแล้วเสี่ยงหลุดเกณฑ์ 50% เงินเดือน
  // พื้นฐาน โดย exemption ช่วยไม่ได้ (exemption ยกเว้นแค่เกณฑ์ 80%)
  const blockMonthly = duty.period === "monthly";
  return employees
    .filter(
      (e) =>
        e.roleId === duty.roleId &&
        !e.salaryDisabled &&
        !excluded.has(e.id) &&
        !(
          blockMonthly &&
          (e.poolExclusion === "all" || e.poolExclusion === "both")
        ),
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
 *  excludeForPrimary: ID ของคนที่ "ไม่ให้เป็น primary" (เช่น คนที่ทำ
 *    monthly แล้ว — แยกออกจาก weekly)
 *  primariesToday: ใช้ exclude ตอนหา substitute ("ไม่ทับคนอื่น")
 *
 *  Algorithm:
 *  - pool พรีเฟอเรนซ์ = activePool − excludeForPrimary
 *  - ถ้า pool เหลือ 0 → fallback ใช้ activePool ทั้งหมด (ห้ามให้มีหน้าที่ว่าง)
 *  - primary มาจาก precomputedPrimary (Phase 1/2 ที่ de-collide แล้ว) —
 *    ถ้าไม่ส่งมา (standalone) compute เองผ่าน pickPrimary                   */
export function computeDutyForDay(
  duty: Duty,
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
  excludeForPrimary: Set<string>,
  primariesToday: Set<string>,
  precomputedPrimary?: string,
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
  // ใช้ primary ที่ Phase 1/2 คำนวณไว้ (de-collide แล้ว) ถ้ายังอยู่ใน pool
  // ปัจจุบัน · ไม่งั้น compute เอง — ใช้ primariesToday เป็น used set เพื่อ
  // เคารพ skip-collision (ไม่ทับ primary ของหน้าที่อื่น) แม้ใน fallback
  const primary =
    precomputedPrimary && pool.includes(precomputedPrimary)
      ? precomputedPrimary
      : pickPrimary(duty, pool, idx, primariesToday);
  if (!primary) {
    // pool ว่างหลัง filter ทุกชั้น (ไม่ควรถึง — fullPool guard ด้านบน)
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
  // scan เริ่มจากตำแหน่ง primary ใน pool (deterministic)
  const startIdx = Math.max(0, pool.indexOf(primary));
  for (let offset = 1; offset < pool.length; offset++) {
    const cand = pool[(startIdx + offset) % pool.length];
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
    const cand = pool[(startIdx + offset) % pool.length];
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
 *  Offset ของแต่ละหน้าที่ใช้ hashDutyId(duty.id) — stable ตาม id (เพิ่ม/
 *  ลบหน้าที่ตัวอื่น ไม่กระทบ slot ของหน้าที่นี้)                          */
export function computeAllDutiesForDay(
  duties: Duty[],
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
  calendar?: StoreCalendarLite | null,
): DutyAssignment[] {
  // ร้านปิด → ไม่มีหน้าที่ · อาทิตย์ → ตัด weekly+skipSundays per duty
  const todayDuties = applicableDuties(duties, todayYmd, calendar);
  const monthlyDuties = todayDuties.filter((d) => d.period === "monthly");
  const weeklyDuties = todayDuties.filter((d) => d.period === "weekly");

  // assigned = คนที่เป็น primary แล้วในรอบนี้ — pickPrimary ใช้ skip-collision
  // (2 หน้าที่ pool เดียวกัน → คนละคน) · lockedByMonthly = monthly กันออก weekly
  const assigned = new Set<string>();
  const lockedByMonthly = new Set<string>();
  const primaryByDuty = new Map<string, string>(); // dutyId → empId
  const poolOf = (duty: Duty) => activePool(duty, employees);

  // Phase 1: monthly (assign ก่อน + lock) · Phase 2: weekly (exclude locked)
  assignPrimaries(
    monthlyDuties,
    todayYmd,
    poolOf,
    assigned,
    lockedByMonthly,
    true,
    primaryByDuty,
  );
  assignPrimaries(
    weeklyDuties,
    todayYmd,
    poolOf,
    assigned,
    lockedByMonthly,
    false,
    primaryByDuty,
  );

  // primariesToday = primary ทั้งหมด (de-collide แล้ว) — substitute "ไม่ทับ"
  const primariesToday = new Set<string>(primaryByDuty.values());

  // Phase 3: compute actual — ใช้ todayDuties (กรองแล้ว) เพื่อให้ Sunday-off
  // ไม่โผล่ใน assignment array
  return todayDuties.map((duty) =>
    computeDutyForDay(
      duty,
      todayYmd,
      employees,
      leaves,
      duty.period === "monthly" ? new Set<string>() : lockedByMonthly,
      primariesToday,
      primaryByDuty.get(duty.id),
    ),
  );
}

/** employeeId เป็นคนที่ทำ monthly duty ที่ "ให้สิทธิ์กองกลาง" ในเดือน yearMonth
 *  ไหม → ใช้ตอน stamp poolThresholdExempt ลง salary snapshot
 *  ดู primary (คนที่ถูกกำหนดทั้งเดือน) ไม่ใช่ substitute · empty leaves
 *  ⚠️ ใช้ monthlyPrimariesForDay ตรงๆ ไม่ผ่าน computeAllDutiesForDay —
 *  computeAllDutiesForDay จะ filter ผ่าน applicableDuties(calendar) ซึ่ง
 *  ถ้าวันตัวแทนเป็นวันร้านปิด (เช่น ส.ค. 2569: วันที่ 15 = เสาร์) จะคืน []
 *  → ทุกคนไม่ได้ exemption ทั้งเดือนแบบเงียบๆ (regression ตอนเพิ่ม calendar) */
export function employeeHasPoolExemptDuty(
  employeeId: string,
  yearMonth: string, // "YYYY-MM"
  duties: Duty[],
  employees: Employee[],
): boolean {
  const exemptDuties = duties.filter(
    (d) =>
      d.kind !== "coverage" &&
      d.period === "monthly" &&
      d.grantsPoolEligibility,
  );
  if (exemptDuties.length === 0) return false;
  // ใช้วันที่ 1 ของเดือนเป็นตัวแทน — monthly period = monthsBetween ขึ้นกับ
  // เดือนเท่านั้น ไม่ขึ้นกับวันในเดือน · monthlyPrimariesForDay ไม่ filter
  // calendar (skip applicableDuties) → ไม่กระทบเดือนที่วันตัวแทน = วันร้านปิด
  const primaries = monthlyPrimariesForDay(
    exemptDuties,
    `${yearMonth}-01`,
    employees,
  );
  return primaries.has(employeeId);
}

/* ─── Coverage earnings (เงินค่าแทน) ────────────────────────────────
   คำนวณว่าคนคนหนึ่งใน yearMonth ถูกเลือกเป็นคนแทน (coverage actual)
   ทั้งหมดกี่ครั้ง × rate ของแต่ละ duty → breakdown รายหน้าที่
   replay logic เดียวกับ server (functions/duty/dutyUtils) เพื่อให้นับตรงกัน */

/** monthly primaries ของวันใดๆ — ใช้ assignPrimaries ตัวเดียวกับ
 *  computeAllDutiesForDay (cache + hash + de-collide) เพื่อให้ผลตรงกัน
 *  ⚠️ ต้องเหมือน functions/src/duty/dutyUtils.ts เป๊ะ                    */
export function monthlyPrimariesForDay(
  monthlyDuties: Duty[],
  todayYmd: string,
  employees: Employee[],
): Set<string> {
  if (monthlyDuties.length === 0) return new Set();
  const assigned = new Set<string>();
  const locked = new Set<string>();
  const out = new Map<string, string>();
  assignPrimaries(
    monthlyDuties,
    todayYmd,
    (d) => activePool(d, employees),
    assigned,
    locked,
    true,
    out,
  );
  return new Set(out.values());
}

function pickCoverageCandidate(
  duty: Duty,
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
  history: Map<string, number>,
  usedToday: Set<string>,
  monthlyPrimaries: Set<string>,
): string | null {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const eligible = (duty.candidateEmpIds || [])
    .map((id) => byId.get(id))
    .filter(
      (e): e is Employee =>
        !!e &&
        !e.salaryDisabled &&
        !usedToday.has(e.id) &&
        !monthlyPrimaries.has(e.id) &&
        !isOnLeave(leaves, e.id, todayYmd),
    )
    .sort((a, b) => {
      const ca = history.get(a.id) || 0;
      const cb = history.get(b.id) || 0;
      if (ca !== cb) return ca - cb;
      const ao = typeof a.displayOrder === "number" ? a.displayOrder : 1e9;
      const bo = typeof b.displayOrder === "number" ? b.displayOrder : 1e9;
      if (ao !== bo) return ao - bo;
      return (a.name || "").localeCompare(b.name || "", "th");
    });
  return eligible.length > 0 ? eligible[0].id : null;
}

function dutyAbsentTargets(
  duty: Duty,
  todayYmd: string,
  employees: Employee[],
  leaves: LeaveEntry[],
): string[] {
  return employees
    .filter(
      (e) =>
        e.roleId === duty.coverageRoleId &&
        !e.salaryDisabled &&
        isOnLeave(leaves, e.id, todayYmd),
    )
    .sort(
      (a, b) =>
        (typeof a.displayOrder === "number" ? a.displayOrder : 1e9) -
        (typeof b.displayOrder === "number" ? b.displayOrder : 1e9),
    )
    .map((e) => e.id);
}

export interface CoverageEarning {
  dutyId: string;
  dutyName: string;
  count: number;
  rate: number;
  subtotal: number;
}

/** เงินค่าแทนของ employeeId ใน yearMonth — replay coverage ทั้งปี (จำเป็น
 *  เพื่อให้ "ใครเคยแทนน้อยสุด" นับถูก) แล้วเฉพาะวันใน yearMonth นับเข้า
 *  คนนี้ × rate ของแต่ละ duty                                            */
export function computeCoverageEarningsForMonth(
  employeeId: string,
  yearMonth: string, // "YYYY-MM"
  duties: Duty[],
  employees: Employee[],
  allLeaves: LeaveEntry[],
): { total: number; breakdown: CoverageEarning[] } {
  const coverageDuties = duties.filter(
    (d) => d.kind === "coverage" && (d.coveragePayPerOccurrence || 0) > 0,
  );
  if (coverageDuties.length === 0) return { total: 0, breakdown: [] };
  // monthly primaries ของแต่ละวัน → กันคนทำหน้าที่ประจำเดือนไม่ให้ถูก
  // เลือกเป็นคนแทน (replay ต้องคำนวณรายวัน — primaries เปลี่ยนทุกเดือน)
  const monthlyDuties = duties.filter(
    (d) => d.kind !== "coverage" && d.period === "monthly",
  );

  const [y, m] = yearMonth.split("-").map(Number);
  const yearStart = `${y}-01-01`;
  const monthStart = `${yearMonth}-01`;
  const monthEnd = new Date(y, m, 0);
  const monthEndYmd = `${yearMonth}-${String(monthEnd.getDate()).padStart(2, "0")}`;

  // นับครั้งที่ employeeId ถูกเลือกในเดือนนี้ (per duty)
  const countByDuty = new Map<string, number>();
  const history = new Map<string, number>();
  const monthlyPrimariesCache = new Map<string, Set<string>>();
  const start = new Date(`${yearStart}T00:00:00`);
  // replay ตั้งแต่ต้นปี — รอบในเดือน yearMonth นับเข้า count, รอบก่อนหน้านับเข้า history
  for (let d = new Date(start); ; d.setDate(d.getDate() + 1)) {
    const ymd = toYMD(d);
    if (ymd > monthEndYmd) break;
    const inMonth = ymd >= monthStart && ymd <= monthEndYmd;
    // memoize ตามเดือน — monthly period = monthsBetween ไม่ขึ้นกับวัน
    // จึงคำนวณ ~12 ครั้ง/ปี แทน ~365 ครั้ง (×assignPrimaries ทุกครั้ง)
    const ym = ymd.slice(0, 7);
    let monthlyPrimaries = monthlyPrimariesCache.get(ym);
    if (!monthlyPrimaries) {
      monthlyPrimaries = monthlyPrimariesForDay(monthlyDuties, ymd, employees);
      monthlyPrimariesCache.set(ym, monthlyPrimaries);
    }
    const usedToday = new Set<string>();
    for (const duty of coverageDuties) {
      for (const _t of dutyAbsentTargets(duty, ymd, employees, allLeaves)) {
        const pick = pickCoverageCandidate(
          duty,
          ymd,
          employees,
          allLeaves,
          history,
          usedToday,
          monthlyPrimaries,
        );
        if (!pick) continue;
        usedToday.add(pick);
        history.set(pick, (history.get(pick) || 0) + 1);
        if (inMonth && pick === employeeId) {
          countByDuty.set(duty.id, (countByDuty.get(duty.id) || 0) + 1);
        }
      }
    }
  }

  const breakdown: CoverageEarning[] = [];
  let total = 0;
  for (const duty of coverageDuties) {
    const count = countByDuty.get(duty.id) || 0;
    if (count === 0) continue;
    const rate = Number(duty.coveragePayPerOccurrence) || 0;
    const subtotal = count * rate;
    total += subtotal;
    breakdown.push({
      dutyId: duty.id,
      dutyName: duty.name,
      count,
      rate,
      subtotal,
    });
  }
  return { total, breakdown };
}

/* ─── Forecast (ปฏิทินหน้าที่ล่วงหน้า) ──────────────────────────────
   คำนวณ "primary ของแต่ละ period ในอนาคต" — ใช้ pool ที่ resolve แล้ว
   (จาก server snapshot) ดังนั้นทั้ง admin/พนักงานคำนวณเองได้ client-side
   โดยไม่ต้องอ่าน employees/leaves ของคนอื่น

   Forecast แสดงเฉพาะ primary ตาม rotation (deterministic) — ไม่รวม
   substitute/leave เพราะการลาในอนาคตยังไม่รู้ + เป็น schedule สำหรับ
   "เตรียมพร้อม" ล่วงหน้า

   ⚠️ Forecast เป็น period-level (สัปดาห์/เดือน) — ไม่ filter ด้วย
   storeCalendar รายวัน เพราะ "ใครได้สัปดาห์นี้" ไม่เปลี่ยนตาม
   เสาร์-เปิดพิเศษ/วันธรรมดาปิดพิเศษ (คนรับผิดชอบยังคงเดิม แค่บางวัน
   อาจไม่มี assignment) · ถ้าทั้งสัปดาห์ร้านปิด — assignment รายวัน
   จะว่าง แต่ผู้รับผิดชอบใน forecast ยังเป็นคนเดิม (intentional)        */

/** primary ของทุก duty ในวันที่ระบุ — รับ pool ที่ resolve แล้ว
 *  (dutyId → ordered empIds). ใช้ pickPrimary ตัวเดียวกับ computeAllDuties
 *  ForDay (cache + hash + skip-collision) เพื่อให้ forecast แถวสัปดาห์
 *  ปัจจุบันตรงกับ snapshot ฝั่ง server (cache มีผลเฉพาะ period ปัจจุบัน)   */
export function computeForecastPrimaries(
  duties: Duty[],
  poolByDutyId: Map<string, string[]>,
  todayYmd: string,
): Map<string, string | null> {
  const monthly = duties.filter((d) => d.period === "monthly");
  const weekly = duties.filter((d) => d.period === "weekly");
  const assigned = new Set<string>();
  const locked = new Set<string>();
  const picked = new Map<string, string>();
  const poolOf = (duty: Duty) => poolByDutyId.get(duty.id) || [];

  assignPrimaries(monthly, todayYmd, poolOf, assigned, locked, true, picked);
  assignPrimaries(weekly, todayYmd, poolOf, assigned, locked, false, picked);

  // หน้าที่ที่ pool ว่าง → null (helper ข้ามไว้)
  const result = new Map<string, string | null>();
  for (const duty of duties) result.set(duty.id, picked.get(duty.id) ?? null);
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
