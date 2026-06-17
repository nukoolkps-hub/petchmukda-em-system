/* ─── Salary calculation helpers ───────────────────────────────── */

import { BUSINESS_RULES } from "../constants";
import type { PieceItem } from "../types";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";

/* ─── Role piece-commission policy ────────────────────────────────
   ตำแหน่งเก็บค่าคอมแยก 3 รูปแบบ:
   1. Pool sales — poolGroup ตั้ง → ใช้ normal/special/buy + invite/transfer
   2. Multi piece — poolGroup ว่าง + pieceItems ≥ 1 → แต่ละรายการมี rate
      (ต่อพนักงาน) + จำนวนชิ้น (ต่อเดือน) + invite/transfer
   3. ไม่มีค่าคอม — poolGroup ว่าง + ไม่มี pieceItems → เงินเดือนพื้นฐานอย่างเดียว
      (พนักงานทั่วไป รปภ. ทำความสะอาด)
   backward-compat: legacy role ที่มี pieceLabel (single) → migrate-on-read เป็น
   1 pieceItem id="default" ที่อ่าน rate จาก singlePieceRate + จำนวนจาก
   singleRatePieces                                                            */

/** id ของ piece item เริ่มต้น (legacy single-rate) — map กับ singlePieceRate /
 *  singleRatePieces ของข้อมูลเก่า                                              */
export const LEGACY_PIECE_ITEM_ID = "default";

interface RolePieceShape {
  poolGroup?: string | null;
  pieceItems?: PieceItem[] | null;
  pieceLabel?: string | null;
}

/** รายการ piece item ของตำแหน่ง (normalize legacy pieceLabel → 1 item)
 *  คืน [] ถ้า pool sales หรือไม่มีค่าคอมรายชิ้น                                  */
export function rolePieceItems(
  role: RolePieceShape | null | undefined,
): PieceItem[] {
  if (!role || role.poolGroup) return [];
  if (Array.isArray(role.pieceItems) && role.pieceItems.length > 0) {
    return role.pieceItems
      .filter((it) => it && it.id && (it.label ?? "").trim())
      .map((it) => ({ id: it.id, label: it.label.trim() }));
  }
  // legacy single label → 1 item id="default"
  if (role.pieceLabel?.trim()) {
    return [{ id: LEGACY_PIECE_ITEM_ID, label: role.pieceLabel.trim() }];
  }
  return [];
}

/** ตำแหน่งนี้มีค่าคอมแบบ "ต่อชิ้น" (รวม invite/transfer ด้วย) ไหม
 *  คืน true ถ้า: pool sales หรือ non-pool ที่มี pieceItems ≥ 1                  */
export function rolePaysPieceCommission(
  role: RolePieceShape | null | undefined,
): boolean {
  if (!role) return false;
  if (role.poolGroup) return true;
  return rolePieceItems(role).length > 0;
}

/** label ของ piece item แรก · "" ถ้าตำแหน่งไม่ใช้ piece (pool / no commission)
 *  ใช้แสดงหัวข้อรวมตอนมีรายการเดียว — backward-compat กับโค้ดเดิม                */
export function rolePieceLabel(
  role: RolePieceShape | null | undefined,
): string {
  const items = rolePieceItems(role);
  return items[0]?.label || "";
}

/** อัตราค่าคอมต่อชิ้นของ item นี้ (ต่อพนักงาน) — snapshot (salary) ก่อน live (rates)
 *  legacy item "default" → fallback singlePieceRate                            */
export function resolvePieceItemRate(
  itemId: string,
  salary:
    | { pieceRates?: Record<string, number>; singlePieceRate?: number }
    | null
    | undefined,
  rates:
    | { pieceRates?: Record<string, number>; singlePieceRate?: number }
    | null
    | undefined,
): number {
  if (salary?.pieceRates && typeof salary.pieceRates[itemId] === "number")
    return salary.pieceRates[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID && salary?.singlePieceRate != null)
    return salary.singlePieceRate;
  if (rates?.pieceRates && typeof rates.pieceRates[itemId] === "number")
    return rates.pieceRates[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID) return rates?.singlePieceRate ?? 0;
  return 0;
}

/** จำนวนชิ้นของ item นี้ในเดือน (จาก salary doc) — legacy "default" → fallback
 *  singleRatePieces                                                            */
export function resolvePieceItemPieces(
  itemId: string,
  salary:
    | { piecePieces?: Record<string, number>; singleRatePieces?: number }
    | null
    | undefined,
): number {
  if (salary?.piecePieces && typeof salary.piecePieces[itemId] === "number")
    return salary.piecePieces[itemId];
  if (itemId === LEGACY_PIECE_ITEM_ID) return salary?.singleRatePieces ?? 0;
  return 0;
}

const {
  DAYS_PER_MONTH,
  POOL_THRESHOLD,
  BASE_SALARY_THRESHOLD,
  SUNDAY_LEAVE_MULTIPLIER,
  WEEKDAY_LEAVE_QUOTA,
  LEAVE_DEDUCTION_FREE_DAYS,
} = BUSINESS_RULES;

/* ─── Annual Raise Helpers ───────────────────────────────────────
   เงินเดือนปัจจุบัน = baseSalary (ตอนเริ่มทำงาน) + ผลรวมของ raise ราย
   ปีจนถึงปีที่ต้องการคำนวณ · raise มีผลตั้งแต่ Jan ของปีนั้น

   2 source:
   - annualRaiseAmount: AUTO ทุกปี (admin ตั้งครั้งเดียว · 0 = ไม่ขึ้น)
   - annualRaises[year]: OVERRIDE per year (มี precedence เหนือ auto)     */

interface RaiseSource {
  baseSalary?: number;
  startWorkMonth?: string | null;
  annualRaiseAmount?: number;
  annualRaises?: Record<string, number>;
}

/** ส่วนเพิ่มของปีนั้น (override > auto > 0) */
function raiseAmountForYear(source: RaiseSource, year: number): number {
  const overrides = source.annualRaises ?? {};
  const key = String(year);
  if (overrides[key] !== undefined) return Number(overrides[key]) || 0;
  return Number(source.annualRaiseAmount ?? 0) || 0;
}

/** เงินเดือนพื้นฐาน "ของเดือน YYYY-MM" — รวม raises ของปีนั้นและก่อนหน้า ·
 *  ใช้ตอนคำนวณเงินเดือน live · admin ปรับ raise แล้วเดือนปัจจุบันเปลี่ยนทันที */
export function getEffectiveBaseSalary(
  source: RaiseSource | null | undefined,
  yearMonthOrYear?: string,
): number {
  if (!source) return 0;
  const base = source.baseSalary ?? 0;
  // default = ปีปัจจุบัน (ตามเครื่อง user)
  const targetYear = (() => {
    if (yearMonthOrYear) {
      const ys = yearMonthOrYear.slice(0, 4);
      const y = parseInt(ys, 10);
      if (Number.isFinite(y)) return y;
    }
    return new Date().getFullYear();
  })();
  const startWM = source.startWorkMonth;
  if (!startWM) return Math.max(0, base);
  const startYear = parseInt(startWM.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) return Math.max(0, base);
  let sum = base;
  // loop ปีตั้งแต่ startYear+1 → targetYear · skip ปีที่ยังไม่ครบ 1 ปี
  for (let y = startYear + 1; y <= targetYear; y++) {
    if (!isEligibleForRaiseYear(startWM, y)) continue;
    sum += raiseAmountForYear(source, y);
  }
  return Math.max(0, sum);
}

/** ตรวจว่าพนักงานทำงานครบ 1 ปีก่อน Jan 1 ของ raiseYear หรือไม่ ·
 *  เกณฑ์: (raiseDate − startDate) ≥ 365 วัน · startWorkMonth = YYYY-MM
 *  → treat เป็นวันที่ 1 ของเดือนนั้น                                       */
export function isEligibleForRaiseYear(
  startWorkMonth: string | undefined | null,
  raiseYear: number,
): boolean {
  if (!startWorkMonth) return false;
  const [ys, ms] = startWorkMonth.split("-");
  const sy = parseInt(ys ?? "", 10);
  const sm = parseInt(ms ?? "", 10);
  if (!Number.isFinite(sy) || !Number.isFinite(sm)) return false;
  const startMs = Date.UTC(sy, sm - 1, 1);
  const raiseMs = Date.UTC(raiseYear, 0, 1);
  const days = (raiseMs - startMs) / (1000 * 60 * 60 * 24);
  return days >= 365;
}

/** รายการประวัติ raise · ทุกปีที่ eligible ตั้งแต่ startYear+1 → currentYear
 *  (ไม่รวมปีอนาคต · ประวัติ = ที่เกิดขึ้นแล้ว/กำลังเกิดในปีปัจจุบัน)
 *  ส่ง back per-row: { year, amount, source: "auto" | "override" } */
export function buildRaiseHistory(
  source: RaiseSource | null | undefined,
  currentYear?: number,
): { year: number; amount: number; isOverride: boolean }[] {
  if (!source?.startWorkMonth) return [];
  const startYear = parseInt(source.startWorkMonth.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) return [];
  const now = currentYear ?? new Date().getFullYear();
  const overrides = source.annualRaises ?? {};
  const list: { year: number; amount: number; isOverride: boolean }[] = [];
  for (let y = startYear + 1; y <= now; y++) {
    if (!isEligibleForRaiseYear(source.startWorkMonth, y)) continue;
    list.push({
      year: y,
      amount: raiseAmountForYear(source, y),
      isOverride: overrides[String(y)] !== undefined,
    });
  }
  return list.sort((a, b) => b.year - a.year); // ใหม่ → เก่า
}

/* ─── Pool Share Helper (สูตรตาม Excel) ──────────────────────────
   ฝั่ง "ขาย"   = เกณฑ์ 80% ใช้ (ทั่วไป+พิเศษ) · กองกลางที่หารแบ่งใช้ "ทั่วไป" เท่านั้น
                  − poolAdjustment.excludedNormalPieces (สินค้าโปรโมชั่น ฯลฯ)
   ฝั่ง "รับซื้อ" = รับซื้อของแต่ละคน − poolAdjustment.excludedBuyPieces (MD ฯลฯ)
                  ขาย-พิเศษ → ใครขายใครได้: นับ 80% แต่ไม่เอาเข้ากองที่หารแบ่ง
   poolAdjustment ระดับ "เดือน" ที่ admin ใส่แยก ไม่ใช่ per-employee — หักเฉพาะ
   ยอดที่เข้ากอง ไม่กระทบเกณฑ์ 80% (พนักงานยังมีสิทธิ์อยู่ในกอง)

   สูตรการแบ่งทำแยกฝั่งขายและฝั่งรับซื้อ:
   - effectiveLeave = max(0, totalLeave − LEAVE_DEDUCTION_FREE_DAYS)
     (2 วันแรกฟรี ไม่ถูกหัก ไม่ถูกเอามาเกลี่ย — โบนัสหยุดน้อยไม่เกี่ยว)
   - เปอร์เซ็นต์ฐาน = 100 / จำนวนคนที่มีสิทธิ์ใน Pool
   - ตัวคูณหักวันลา = เปอร์เซ็นต์ฐาน / จำนวนวันทำงานต่อเดือน
   - เปอร์เซ็นต์หัก = effectiveLeave × ตัวคูณหักวันลา × (จำนวนคนที่มีสิทธิ์ - 1)
   - เปอร์เซ็นต์แบ่งเพื่อน = เปอร์เซ็นต์หัก / (จำนวนคนที่มีสิทธิ์ - 1)
   - เปอร์เซ็นต์สุทธิ = เปอร์เซ็นต์ฐาน - เปอร์เซ็นต์หัก + ผลรวมเปอร์เซ็นต์แบ่งจากคนอื่น
   - ชิ้นที่ได้ = เปอร์เซ็นต์สุทธิ × จำนวนชิ้นรวมใน Pool

   poolExclusion (Admin ตั้งให้แต่ละคน):
   - "sell"  → ปิดฝั่งขาย → ตัดออกจาก Pool ขาย
   - "buy"   → ปิดฝั่งรับซื้อ
   - "both"  → ปิดทั้งคู่ + ถ้าขาย < 50% ของ Top → ไม่ได้เงินเดือนพื้นฐาน

   กฎ 80%: ถ้าชิ้น (ทั่วไป+พิเศษ) น้อยกว่า 80% ของ Top → ตัดออกจาก Pool
   ขาย-พิเศษ → ใครขายใครได้: นับตอนเช็ก 80% แต่ไม่เอาเข้ากองที่หารแบ่ง */
export function computePoolSharesForGroup({
  groupEmployeeIds,
  salaryData,
  allLeaves,
  yearMonth,
  employeeDirectory,
  poolAdjustment, // { items: [{poolGroup, side, pieces, label}] } — ระดับเดือน
  poolGroup, // ตำแหน่ง/กลุ่มที่กำลังคำนวณ — กรอง adjustment เฉพาะของกลุ่มนี้
  storeCalendar, // ปฏิทินเปิด-ปิดร้าน · ใช้นับวันลา (Sat ปิด → ไม่นับ)
}: {
  groupEmployeeIds: string[];
  salaryData: any;
  allLeaves: any[];
  yearMonth: string;
  employeeDirectory: any[];
  poolAdjustment?: {
    items?: {
      poolGroup?: string;
      side: string;
      pieces: number;
      label: string;
    }[];
  } | null;
  poolGroup?: string | null;
  storeCalendar?: {
    extraOpenSaturdays: string[];
    extraClosedWeekdays: string[];
  } | null;
}) {
  if (!groupEmployeeIds || groupEmployeeIds.length === 0) return {};

  // กรองพนักงานที่ "ปิดสิทธิ์ระบบเงินเดือน" ออกก่อน — กลุ่มนี้ใช้แอปเฉพาะ
  // ระบบลา ไม่นับเข้ากองกลาง ไม่ pull เกณฑ์ 80% และไม่ได้รับ commission
  // CRITICAL: ใช้ salary snapshot ก่อน fall back current state
  // → past month ที่ admin flip salaryDisabled ภายหลัง ไม่ทำให้ pool เก่า
  //   ขยับ (เดิมใช้ current state ทำให้ peers ได้ share ของ Charlie ที่
  //   เคย active ในเดือนนั้นซ้ำ)
  const activeIds = groupEmployeeIds.filter((id) => {
    const salary = salaryData[id]?.[yearMonth];
    if (salary && typeof salary.salaryDisabled === "boolean") {
      return !salary.salaryDisabled;
    }
    const employee = employeeDirectory.find((e) => e.id === id);
    return !employee?.salaryDisabled;
  });
  if (activeIds.length === 0) return {};

  // --- Step 0: คัดข้อมูลพื้นฐานของแต่ละคน ---
  const sellPieces: Record<string, number> = {}; // ทั่วไป + พิเศษ ของตัวเอง
  const buyPieces: Record<string, number> = {}; // รับซื้อของตัวเอง
  const totalLeave: Record<string, number> = {}; // วันหยุดรวม (ปกติ + อาทิตย์)
  const poolExclusion: Record<string, string | null> = {};
  // เดือนนี้คนนี้ทำ monthly duty ที่ให้สิทธิ์กองกลาง → ยกเว้นเกณฑ์ 80%
  const thresholdExempt: Record<string, boolean> = {};
  activeIds.forEach((employeeId) => {
    const salary = salaryData[employeeId]?.[yearMonth];
    const employee = employeeDirectory.find(
      (candidateEmployee) => candidateEmployee.id === employeeId,
    );
    sellPieces[employeeId] =
      (salary?.normalSalePieces || 0) + (salary?.specialSalePieces || 0);
    buyPieces[employeeId] = salary?.buyPieces || 0;
    // ใช้ snapshot ที่เขียนพร้อม salary ก่อนเสมอ — admin/พนักงานจะเห็นเลข
    // ตรงกัน. fallback มา employee directory + allLeaves เฉพาะเดือนเก่าที่
    // ยังไม่มี snapshot field (data จากก่อน feature นี้)
    poolExclusion[employeeId] =
      salary?.poolExclusion !== undefined
        ? salary.poolExclusion
        : employee?.poolExclusion || null;
    thresholdExempt[employeeId] = salary?.poolThresholdExempt === true;
    if (typeof salary?.totalLeaveDays === "number") {
      totalLeave[employeeId] = salary.totalLeaveDays;
    } else if (employee) {
      const monthLeaves = allLeaves.filter(
        (leave) =>
          leave.employeeId === employeeId && leave.start.startsWith(yearMonth),
      );
      const weekdayLeaves = countWeekdayLeaves(monthLeaves, storeCalendar);
      const overInfo = getOverQuotaDays(monthLeaves, storeCalendar);
      // วันหยุดรวมตาม Excel = ปกติ + อาทิตย์ทั้งหมด (ไม่ใช่แค่ที่เกินโควต้า)
      totalLeave[employeeId] = weekdayLeaves + (overInfo.sundays || 0);
    } else {
      totalLeave[employeeId] = 0;
    }
  });
  const topSellPieces = Math.max(0, ...Object.values(sellPieces));
  const topBuyPieces = Math.max(0, ...Object.values(buyPieces));
  const sellEligibilityThreshold = topSellPieces * POOL_THRESHOLD;
  const buyEligibilityThreshold = topBuyPieces * POOL_THRESHOLD;
  const baseSalaryEligibilityThreshold = topSellPieces * BASE_SALARY_THRESHOLD;

  // --- Step 1: หาว่าใครเข้า Pool ฝั่งไหนบ้าง ---
  const sellPoolEligibility = {};
  const buyPoolEligibility = {};
  activeIds.forEach((employeeId) => {
    const employeePoolExclusion = poolExclusion[employeeId];
    // ทำ monthly duty ที่ให้สิทธิ์กองกลาง → ผ่านเกณฑ์ 80% อัตโนมัติ
    // แต่ poolExclusion ที่ admin ปิดยังมาก่อนเสมอ (ปิดฝั่งไหน ฝั่งนั้นไม่ได้)
    const exempt = thresholdExempt[employeeId];
    if (employeePoolExclusion === "sell" || employeePoolExclusion === "both") {
      sellPoolEligibility[employeeId] = false;
    } else {
      sellPoolEligibility[employeeId] =
        exempt || topSellPieces === 0
          ? true
          : sellPieces[employeeId] >= sellEligibilityThreshold;
    }
    if (employeePoolExclusion === "buy" || employeePoolExclusion === "both") {
      buyPoolEligibility[employeeId] = false;
    } else {
      buyPoolEligibility[employeeId] =
        exempt || topBuyPieces === 0
          ? true
          : buyPieces[employeeId] >= buyEligibilityThreshold;
    }
  });

  // --- Step 2: รวม Pool จากชิ้นของทุกคน แล้วหัก "ไม่นับค่าคอม" ระดับเดือน ---
  let totalSellPoolPieces = 0;
  let totalBuyPoolPieces = 0;
  activeIds.forEach((employeeId) => {
    const salary = salaryData[employeeId]?.[yearMonth];
    if (salary) {
      // กองกลางที่นำมาแบ่ง = เฉพาะ "ขายทั่วไป" — ขายพิเศษ ใครขายใครได้
      // (จ่ายตรงผ่าน specialSaleCommission อยู่แล้ว ไม่เข้ากองที่หารแบ่ง)
      totalSellPoolPieces += salary.normalSalePieces || 0;
      totalBuyPoolPieces += buyPieces[employeeId]; // รับซื้อ
    }
  });
  // หัก adjustment ระดับเดือน (admin ใส่แยก — เช่น สินค้าโปรโมชั่น / ทองแท่ง MD)
  // รวมจาก items แยกตามฝั่ง · clamp ≥ 0 · เก็บ gross + รายการไว้สำหรับแสดงผล
  const grossSellPoolPieces = totalSellPoolPieces;
  const grossBuyPoolPieces = totalBuyPoolPieces;
  // กรองเฉพาะรายการของ "ตำแหน่งนี้" + เป็น pool variant — item เก่าที่ไม่มี
  // poolGroup ถือว่าใช้ได้กับทุกกลุ่ม (backward compat data ก่อนมี field นี้)
  // ใหม่: ข้าม piece variant (kind="piece") — apply แยกใน calculateSalary
  const adjItems = (poolAdjustment?.items || []).filter(
    (it: any) =>
      it.kind !== "piece" &&
      (!it.poolGroup || !poolGroup || it.poolGroup === poolGroup),
  );
  const excludedNormalItems = adjItems.filter((it) => it.side === "normal");
  const excludedBuyItems = adjItems.filter((it) => it.side === "buy");
  const excludedNormal = excludedNormalItems.reduce(
    (s, it) => s + Math.max(0, Number(it.pieces) || 0),
    0,
  );
  const excludedBuy = excludedBuyItems.reduce(
    (s, it) => s + Math.max(0, Number(it.pieces) || 0),
    0,
  );
  totalSellPoolPieces = Math.max(0, totalSellPoolPieces - excludedNormal);
  totalBuyPoolPieces = Math.max(0, totalBuyPoolPieces - excludedBuy);

  // --- Step 3: คำนวณตามสูตร Excel แยก 2 ฝั่ง ---
  function computeShares(poolEligibility, totalPoolPieces) {
    const eligibleEmployeeIds = activeIds.filter(
      (employeeId) => poolEligibility[employeeId],
    );
    const eligibleEmployeeCount = eligibleEmployeeIds.length;
    if (eligibleEmployeeCount === 0) {
      return {
        shares: {},
        eligibleEmployeeCount: 0,
        baseSharePercent: 0,
        leaveDeductionFactor: 0,
      };
    }
    const baseSharePercent = 100 / eligibleEmployeeCount;
    const leaveDeductionFactor = baseSharePercent / DAYS_PER_MONTH;

    // % การหัก ของแต่ละคน — 2 วันแรก (LEAVE_DEDUCTION_FREE_DAYS) ฟรี ไม่ถูกหัก
    const leaveDeductionPercent = {};
    const redistributedPercent = {};
    eligibleEmployeeIds.forEach((employeeId) => {
      const effectiveLeave = Math.max(
        0,
        totalLeave[employeeId] - LEAVE_DEDUCTION_FREE_DAYS,
      );
      leaveDeductionPercent[employeeId] =
        effectiveLeave * leaveDeductionFactor * (eligibleEmployeeCount - 1);
      redistributedPercent[employeeId] =
        eligibleEmployeeCount > 1
          ? leaveDeductionPercent[employeeId] / (eligibleEmployeeCount - 1)
          : 0;
    });

    // % ที่ได้
    const shares = {};
    const totalRedistributedPercent = eligibleEmployeeIds.reduce(
      (sum, employeeId) => sum + redistributedPercent[employeeId],
      0,
    );
    eligibleEmployeeIds.forEach((employeeId) => {
      const redistributedFromOthers =
        totalRedistributedPercent - redistributedPercent[employeeId];
      const finalSharePercent =
        baseSharePercent -
        leaveDeductionPercent[employeeId] +
        redistributedFromOthers;
      const allocatedPieces = (finalSharePercent / 100) * totalPoolPieces;
      shares[employeeId] = {
        finalSharePercent,
        allocatedPieces,
        leaveDeductionPercent: leaveDeductionPercent[employeeId],
        redistributedPercent: redistributedPercent[employeeId],
        leaveDays: totalLeave[employeeId],
      };
    });
    return {
      shares,
      eligibleEmployeeCount,
      baseSharePercent,
      leaveDeductionFactor,
      eligibleEmployeeIds,
    };
  }

  const sellResult = computeShares(sellPoolEligibility, totalSellPoolPieces);
  const buyResult = computeShares(buyPoolEligibility, totalBuyPoolPieces);

  // --- Step 4: ประกอบผลลัพธ์ของแต่ละคน ---
  const result = {};
  activeIds.forEach((employeeId) => {
    const sellShare = sellResult.shares[employeeId];
    const buyShare = buyResult.shares[employeeId];
    const losesBaseSalary =
      poolExclusion[employeeId] === "both" &&
      topSellPieces > 0 &&
      sellPieces[employeeId] < baseSalaryEligibilityThreshold;

    result[employeeId] = {
      // จำนวนชิ้นที่ได้
      normalSalePieces: sellShare ? sellShare.allocatedPieces : 0,
      buyPieces: buyShare ? buyShare.allocatedPieces : 0,
      // เปอร์เซ็นต์ (สำหรับแสดงผล)
      sellSharePercent: sellShare ? sellShare.finalSharePercent : 0,
      sellLeaveDeductionPercent: sellShare
        ? sellShare.leaveDeductionPercent
        : 0,
      sellRedistributedPercent: sellShare ? sellShare.redistributedPercent : 0,
      buySharePercent: buyShare ? buyShare.finalSharePercent : 0,
      buyLeaveDeductionPercent: buyShare ? buyShare.leaveDeductionPercent : 0,
      buyRedistributedPercent: buyShare ? buyShare.redistributedPercent : 0,
      // ข้อมูล Pool
      totalSellPoolPieces,
      totalBuyPoolPieces,
      grossSellPoolPieces,
      grossBuyPoolPieces,
      excludedNormalPieces: excludedNormal,
      excludedBuyPieces: excludedBuy,
      excludedNormalItems,
      excludedBuyItems,
      eligibleSellEmployeeCount: sellResult.eligibleEmployeeCount,
      sellBaseSharePercent: sellResult.baseSharePercent,
      sellLeaveDeductionFactor: sellResult.leaveDeductionFactor,
      eligibleBuyEmployeeCount: buyResult.eligibleEmployeeCount,
      buyBaseSharePercent: buyResult.baseSharePercent,
      buyLeaveDeductionFactor: buyResult.leaveDeductionFactor,
      leaveDays: totalLeave[employeeId],
      // สิทธิ์
      eligibleForSellPool: sellPoolEligibility[employeeId],
      eligibleForBuyPool: buyPoolEligibility[employeeId],
      employeeSellPieces: sellPieces[employeeId],
      employeeBuyPieces: buyPieces[employeeId],
      topSellPieces,
      topBuyPieces,
      sellEligibilityThreshold,
      buyEligibilityThreshold,
      baseSalaryEligibilityThreshold,
      poolExclusion: poolExclusion[employeeId],
      losesBaseSalary,
      sellShareRatio: sellShare ? sellShare.finalSharePercent / 100 : 0,
      buyShareRatio: buyShare ? buyShare.finalSharePercent / 100 : 0,
      workDays: DAYS_PER_MONTH - totalLeave[employeeId],
      totalSellWorkDays: DAYS_PER_MONTH * sellResult.eligibleEmployeeCount,
      totalBuyWorkDays: DAYS_PER_MONTH * buyResult.eligibleEmployeeCount,
    };
  });
  return result;
}

export function calculateSalary(
  salary,
  overQuotaInfo,
  rates,
  totalLeaveDays,
  approvedAdvanceTotal,
  poolShare,
  roleConfig,
  // เงินกู้ผ่อนคืน (Stage B): { yearMonth, loans: [{id, monthlyDeduction,
  // principal, startMonth, repayments}] } ของพนักงานคนนี้ (ไม่รวม cancelled)
  loanContext?: {
    yearMonth: string;
    loans: {
      id: string;
      monthlyDeduction: number;
      principal: number;
      startMonth: string;
      repayments?: Record<string, number>;
    }[];
  } | null,
  // รายการยกเว้นค่าคอม "ระดับ piece" (multi-item) ของพนักงานคนนี้ เดือนนี้ ·
  // [{ pieceItemId, pieces, label }] · ลบจาก piecePieces[itemId] ก่อนคูณ rate
  // pool variant ไม่ส่งมาทางนี้ (apply ใน computePoolSharesForGroup)
  pieceExclusions?:
    | { pieceItemId: string; pieces: number; label?: string }[]
    | null,
) {
  if (!salary) return null;
  const weekdayOverQuotaDays = overQuotaInfo?.weekdays || 0;
  const sundayOverQuotaDays = overQuotaInfo?.sundays || 0;
  // เงินเดือนพื้นฐาน + เรท + ประกันสังคม:
  // อ่าน snapshot ใน salary doc ก่อนเสมอ (ค่าที่ถูก freeze ของเดือนนั้น) →
  // ถ้าเปลี่ยนตำแหน่ง/เรทในอนาคต อดีตไม่ขยับ. fallback เป็นค่าปัจจุบันจาก
  // employeeInfo (rates) เฉพาะเดือนที่ยังไม่มี snapshot (งวดเปิด / data เก่า
  // ก่อนมี feature นี้)
  // baseSalary ใช้ || (ไม่ใช่ ??) — ค่า 0 ถือว่า "ยังไม่ได้ตั้ง" (เงินเดือน
  // พื้นฐานไม่มีทางเป็น 0 จริง) จึง fallback ไปเรทปัจจุบัน กัน data เก่าที่เผลอ
  // เก็บ baseSalary:0 ไว้ทำให้แถวเงินเดือนพื้นฐานหาย
  // — สำหรับ live fallback (เดือนที่ยังไม่มี snapshot) ใช้ effective base
  //   salary ของปีนั้น (baseSalary + Σ annualRaises ≤ year) เพื่อสะท้อนการ
  //   ขึ้นเงินเดือนประจำปีทันที
  const liveEffectiveBase = getEffectiveBaseSalary(
    rates,
    loanContext?.yearMonth,
  );
  // ใช้ ?? แทน || → เคารพ salary.baseSalary=0 ที่ admin ตั้งตั้งใจ (เช่น
  // เดือนที่ลาไม่รับเงินเดือน) · เดิม || ทำให้ 0 ถูก fall back ไป live rate
  const baseSalaryAmount =
    salary.baseSalary !== undefined && salary.baseSalary !== null
      ? salary.baseSalary
      : (liveEffectiveBase ?? 0);
  const socialSecurityAmount =
    salary.socialSecurity ?? rates?.socialSecurity ?? 0;
  const dailySalaryRate = baseSalaryAmount / DAYS_PER_MONTH;
  const overQuotaDeduction = Math.round(
    weekdayOverQuotaDays * dailySalaryRate +
      sundayOverQuotaDays * dailySalaryRate * SUNDAY_LEAVE_MULTIPLIER,
  );

  // ตำแหน่งนี้มีค่าคอมรายชิ้นไหม (pool sales / single piece / ไม่มี)
  const usesPieceCommission = rolePaysPieceCommission(roleConfig);
  const usesSinglePieceRate =
    usesPieceCommission && roleConfig && !roleConfig.poolGroup;
  const singlePieceRate = salary.singlePieceRate ?? rates?.singlePieceRate ?? 0;
  const normalSalePieceRate =
    salary.normalSalePieceRate ?? rates?.normalSalePieceRate ?? 0;
  const specialSalePieceRate =
    salary.specialSalePieceRate ?? rates?.specialSalePieceRate ?? 0;
  const buyPieceRate = salary.buyPieceRate ?? rates?.buyPieceRate ?? 0;
  const invitePieceRate = salary.invitePieceRate ?? rates?.invitePieceRate ?? 0;
  const transferPieceRate =
    salary.transferPieceRate ?? rates?.transferPieceRate ?? 0;

  let singleRatePieces = 0,
    normalSalePieces = 0,
    specialSalePieces = 0,
    buyPieces = 0;
  let singleRateCommission = 0,
    normalSaleCommission = 0,
    specialSaleCommission = 0,
    buyCommission = 0;
  // breakdown รายการ piece (multi-item) — ใช้แสดงผลในสลิป/หน้า admin
  // excluded = ผลรวมจริงที่ admin ใส่ (ไม่ cap) เพื่อให้ UI โชว์ตรง · pieces
  // = max(0, gross-excluded) ตัวที่จ่ายเงินจริง
  let pieceBreakdown: {
    id: string;
    label: string;
    pieces: number;
    excluded: number;
    rate: number;
    amount: number;
  }[] = [];

  if (!usesPieceCommission) {
    // ตำแหน่งไม่มีค่าคอมรายชิ้น (พนักงานทั่วไป รปภ. ทำความสะอาด ฯลฯ)
    // → ทุก commission = 0 · เงินเดือนพื้นฐานอย่างเดียว
  } else if (usesSinglePieceRate) {
    // multi-item: รวมทุกรายการ → singleRateCommission = ผลรวม · pieceBreakdown
    // เก็บราย item · singleRatePieces = ผลรวมจำนวนชิ้น (สำหรับ backward-compat)
    const items = rolePieceItems(roleConfig);
    // ผลรวมยกเว้นต่อ item id (จาก pieceExclusions) — ลบจาก gross ก่อนคูณ rate
    const exclusionsByItem: Record<string, number> = {};
    for (const ex of pieceExclusions || []) {
      if (!ex?.pieceItemId) continue;
      exclusionsByItem[ex.pieceItemId] =
        (exclusionsByItem[ex.pieceItemId] || 0) + (Number(ex.pieces) || 0);
    }
    pieceBreakdown = items.map((item) => {
      const gross = resolvePieceItemPieces(item.id, salary);
      const excluded = exclusionsByItem[item.id] || 0;
      const pieces = Math.max(0, gross - excluded);
      const rate = resolvePieceItemRate(item.id, salary, rates);
      return {
        id: item.id,
        label: item.label,
        pieces,
        excluded,
        rate,
        amount: Math.round(pieces * rate),
      };
    });
    singleRatePieces = pieceBreakdown.reduce((s, b) => s + b.pieces, 0);
    singleRateCommission = pieceBreakdown.reduce((s, b) => s + b.amount, 0);
  } else {
    const inPool = !!poolShare;
    normalSalePieces = inPool
      ? poolShare.normalSalePieces || 0
      : salary.normalSalePieces || 0;
    specialSalePieces = salary.specialSalePieces || 0; // always personal
    buyPieces = inPool ? poolShare.buyPieces || 0 : salary.buyPieces || 0;
    normalSaleCommission = Math.round(normalSalePieces * normalSalePieceRate);
    specialSaleCommission = Math.round(
      specialSalePieces * specialSalePieceRate,
    );
    buyCommission = Math.round(buyPieces * buyPieceRate);
  }

  const invitePieces = usesPieceCommission ? salary.invitePieces || 0 : 0;
  const transferPieces = usesPieceCommission ? salary.transferPieces || 0 : 0;
  const inviteCommission = invitePieces * invitePieceRate;
  const transferCommission = transferPieces * transferPieceRate;
  const memberBonusTotal = inviteCommission + transferCommission;

  // ถ้าถูกปิดสิทธิ์ Pool และขาย < 50% ของ Top → เงินเดือนพื้นฐาน = 0
  // (ต้อง compute losesBaseSalary ก่อน attendanceBonus เพื่อ zero มันด้วย)
  const losesBaseSalary = !!poolShare?.losesBaseSalary;
  const baseSalary = losesBaseSalary ? 0 : baseSalaryAmount;

  // โบนัสแห่งความขยัน — รวม "ลาวันอาทิตย์" ด้วย (ขาดงานคือขาดงาน · เดิมนับ
  // เฉพาะ weekday ทำให้ลาอาทิตย์อย่างเดียวยังได้ bonus เต็ม)
  // ถ้า losesBaseSalary → ไม่ได้ bonus (base = 0 อยู่แล้ว · ป้องกัน paying
  // 2× dailyRate ให้คนที่ไม่ควรได้ base · CRITICAL bug)
  const leaveDays = (totalLeaveDays || 0) + sundayOverQuotaDays;
  const bonusDays = losesBaseSalary
    ? 0
    : Math.max(0, WEEKDAY_LEAVE_QUOTA - leaveDays);
  const attendanceBonus = Math.round(bonusDays * dailySalaryRate);

  const customEarningsTotal = Array.isArray(salary.customEarnings)
    ? salary.customEarnings.reduce(
        (sum, item) => sum + (Number(item?.amount) || 0),
        0,
      )
    : 0;
  // รายการประจำเดือนของพนักงาน (recurringItems) — ตั้งครั้งเดียวที่
  // employee doc ใช้ทุกๆ เดือนจนกว่าจะลบ. แยก income/deduction.
  const recurringItems: { type: string; label: string; amount: number }[] =
    Array.isArray(rates?.recurringItems) ? rates.recurringItems : [];
  const recurringIncomes = recurringItems
    .filter((it) => it.type === "income")
    .map((it) => ({
      label: it.label || "(ไม่ระบุ)",
      amount: Number(it.amount) || 0,
    }));
  const recurringDeductions = recurringItems
    .filter((it) => it.type === "deduction")
    .map((it) => ({
      label: it.label || "(ไม่ระบุ)",
      amount: Number(it.amount) || 0,
    }));
  const recurringIncomesTotal = recurringIncomes.reduce(
    (s, it) => s + it.amount,
    0,
  );
  const recurringDeductionsTotal = recurringDeductions.reduce(
    (s, it) => s + it.amount,
    0,
  );
  // เงินค่าแทน (coverage) — admin stamp ตอน save salary · denorm ใน snapshot
  const coveragePay = Number(salary.coveragePay) || 0;
  const earnings =
    baseSalary +
    singleRateCommission +
    normalSaleCommission +
    specialSaleCommission +
    buyCommission +
    memberBonusTotal +
    attendanceBonus +
    coveragePay +
    customEarningsTotal +
    recurringIncomesTotal;
  const advanceDeduction = approvedAdvanceTotal || 0;
  const customDeductionsTotal = Array.isArray(salary.customDeductions)
    ? salary.customDeductions.reduce(
        (sum, item) => sum + (Number(item?.amount) || 0),
        0,
      )
    : 0;
  // ─── หักเงินกู้ผ่อนคืน (หักเท่าที่มี: cap ที่เงินสุทธิก่อนหักกู้) ───
  // FIFO: เรียงตามเดือนเริ่ม → id · ต่อก้อน หัก = min(ผ่อนเดือนละ, คงเหลือ)
  // คงเหลือคิดจาก principal − Σ(repayments ที่ไม่ใช่เดือนนี้) → re-confirm
  // เดือนเดิมได้ผลเท่าเดิม (idempotent)
  const deductionsBeforeLoan =
    advanceDeduction +
    socialSecurityAmount +
    overQuotaDeduction +
    customDeductionsTotal +
    recurringDeductionsTotal;
  let loanDeduction = 0;
  const loanRepayments: Record<string, number> = {}; // {loanId: ยอดหักเดือนนี้}
  const loanBreakdown: { id: string; amount: number }[] = [];
  if (loanContext?.loans?.length) {
    const ym = loanContext.yearMonth;
    let avail = Math.max(0, earnings - deductionsBeforeLoan);
    const sorted = [...loanContext.loans].sort((a, b) => {
      const m = (a.startMonth || "").localeCompare(b.startMonth || "");
      return m !== 0 ? m : String(a.id).localeCompare(String(b.id));
    });
    for (const loan of sorted) {
      if ((loan.startMonth || "") > ym) continue; // ยังไม่ถึงเดือนเริ่มหัก
      const paidExcludingThis = Object.entries(loan.repayments || {}).reduce(
        (s, [k, v]) => (k === ym ? s : s + (Number(v) || 0)),
        0,
      );
      const remaining = Math.max(
        0,
        (Number(loan.principal) || 0) - paidExcludingThis,
      );
      const due = Math.min(Number(loan.monthlyDeduction) || 0, remaining);
      const take = Math.min(due, avail);
      if (take > 0) {
        avail -= take;
        loanDeduction += take;
        loanRepayments[loan.id] = take;
        loanBreakdown.push({ id: loan.id, amount: take });
      }
    }
  }

  const deductions = deductionsBeforeLoan + loanDeduction;
  const netSalary = earnings - deductions;
  return {
    earnings,
    deductions,
    netSalary,
    loanDeduction,
    loanRepayments, // {loanId: ยอดหักเดือนนี้} — ใช้บันทึก ledger ตอนยืนยันยอด
    loanBreakdown, // [{id, amount}] — เรียงตามที่หัก (สำหรับแสดงผล)
    recurringIncomes, // [{label, amount}] — รายรับประจำเดือนจาก employee doc
    recurringDeductions, // [{label, amount}] — รายจ่ายประจำเดือน
    recurringIncomesTotal,
    recurringDeductionsTotal,
    overQuotaDeduction,
    dailySalaryRate,
    weekdayOverQuotaDays,
    sundayOverQuotaDays,
    usesSinglePieceRate,
    singleRatePieces,
    singleRateCommission,
    singlePieceRate,
    pieceBreakdown, // [{id,label,pieces,rate,amount}] — multi-item piece commission
    normalSaleCommission,
    specialSaleCommission,
    buyCommission,
    inviteCommission,
    transferCommission,
    memberBonusTotal,
    normalSalePieces,
    specialSalePieces,
    buyPieces,
    invitePieces,
    transferPieces,
    normalSalePieceRate,
    specialSalePieceRate,
    buyPieceRate,
    invitePieceRate,
    transferPieceRate,
    attendanceBonus,
    bonusDays,
    coveragePay,
    leaveDays,
    advanceDeduction,
    socialSecurity: socialSecurityAmount,
    baseSalary,
    losesBaseSalary,
  };
}
