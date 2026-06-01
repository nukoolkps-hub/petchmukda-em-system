/* ─── Salary calculation helpers ───────────────────────────────── */

import { BUSINESS_RULES } from "../constants";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";

const {
  DAYS_PER_MONTH,
  POOL_THRESHOLD,
  BASE_SALARY_THRESHOLD,
  SUNDAY_LEAVE_MULTIPLIER,
  WEEKDAY_LEAVE_QUOTA,
  LEAVE_DEDUCTION_FREE_DAYS,
} = BUSINESS_RULES;

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
}) {
  if (!groupEmployeeIds || groupEmployeeIds.length === 0) return {};

  // --- Step 0: คัดข้อมูลพื้นฐานของแต่ละคน ---
  const sellPieces: Record<string, number> = {}; // ทั่วไป + พิเศษ ของตัวเอง
  const buyPieces: Record<string, number> = {}; // รับซื้อของตัวเอง
  const totalLeave: Record<string, number> = {}; // วันหยุดรวม (ปกติ + อาทิตย์)
  const poolExclusion: Record<string, string | null> = {};
  groupEmployeeIds.forEach((employeeId) => {
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
    if (typeof salary?.totalLeaveDays === "number") {
      totalLeave[employeeId] = salary.totalLeaveDays;
    } else if (employee) {
      const monthLeaves = allLeaves.filter(
        (leave) =>
          leave.employeeId === employeeId && leave.start.startsWith(yearMonth),
      );
      const weekdayLeaves = countWeekdayLeaves(monthLeaves);
      const overInfo = getOverQuotaDays(monthLeaves);
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
  groupEmployeeIds.forEach((employeeId) => {
    const employeePoolExclusion = poolExclusion[employeeId];
    if (employeePoolExclusion === "sell" || employeePoolExclusion === "both") {
      sellPoolEligibility[employeeId] = false;
    } else {
      sellPoolEligibility[employeeId] =
        topSellPieces === 0
          ? true
          : sellPieces[employeeId] >= sellEligibilityThreshold;
    }
    if (employeePoolExclusion === "buy" || employeePoolExclusion === "both") {
      buyPoolEligibility[employeeId] = false;
    } else {
      buyPoolEligibility[employeeId] =
        topBuyPieces === 0
          ? true
          : buyPieces[employeeId] >= buyEligibilityThreshold;
    }
  });

  // --- Step 2: รวม Pool จากชิ้นของทุกคน แล้วหัก "ไม่นับค่าคอม" ระดับเดือน ---
  let totalSellPoolPieces = 0;
  let totalBuyPoolPieces = 0;
  groupEmployeeIds.forEach((employeeId) => {
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
  // กรองเฉพาะรายการของ "ตำแหน่งนี้" — item เก่าที่ไม่มี poolGroup ถือว่าใช้ได้
  // กับทุกกลุ่ม (backward compat data ก่อนมี field นี้)
  const adjItems = (poolAdjustment?.items || []).filter(
    (it) => !it.poolGroup || !poolGroup || it.poolGroup === poolGroup,
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
    const eligibleEmployeeIds = groupEmployeeIds.filter(
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
  groupEmployeeIds.forEach((employeeId) => {
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
  const baseSalaryAmount = salary.baseSalary || rates?.baseSalary || 0;
  const socialSecurityAmount =
    salary.socialSecurity ?? rates?.socialSecurity ?? 0;
  const dailySalaryRate = baseSalaryAmount / DAYS_PER_MONTH;
  const overQuotaDeduction = Math.round(
    weekdayOverQuotaDays * dailySalaryRate +
      sundayOverQuotaDays * dailySalaryRate * SUNDAY_LEAVE_MULTIPLIER,
  );

  const usesSinglePieceRate = roleConfig && !roleConfig.poolGroup;
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

  if (usesSinglePieceRate) {
    singleRatePieces = salary.singleRatePieces || 0;
    singleRateCommission = Math.round(singleRatePieces * singlePieceRate);
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

  const invitePieces = salary.invitePieces || 0;
  const transferPieces = salary.transferPieces || 0;
  const inviteCommission = invitePieces * invitePieceRate;
  const transferCommission = transferPieces * transferPieceRate;
  const memberBonusTotal = inviteCommission + transferCommission;

  const leaveDays = totalLeaveDays || 0;
  const bonusDays = Math.max(0, WEEKDAY_LEAVE_QUOTA - leaveDays);
  const attendanceBonus = Math.round(bonusDays * dailySalaryRate);

  // ถ้าถูกปิดสิทธิ์ Pool และขาย < 50% ของ Top → เงินเดือนพื้นฐาน = 0
  const losesBaseSalary = !!poolShare?.losesBaseSalary;
  const baseSalary = losesBaseSalary ? 0 : baseSalaryAmount;

  const customEarningsTotal = Array.isArray(salary.customEarnings)
    ? salary.customEarnings.reduce(
        (sum, item) => sum + (Number(item?.amount) || 0),
        0,
      )
    : 0;
  const earnings =
    baseSalary +
    singleRateCommission +
    normalSaleCommission +
    specialSaleCommission +
    buyCommission +
    memberBonusTotal +
    attendanceBonus +
    customEarningsTotal;
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
    customDeductionsTotal;
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
    overQuotaDeduction,
    dailySalaryRate,
    weekdayOverQuotaDays,
    sundayOverQuotaDays,
    usesSinglePieceRate,
    singleRatePieces,
    singleRateCommission,
    singlePieceRate,
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
    leaveDays,
    advanceDeduction,
    socialSecurity: socialSecurityAmount,
    baseSalary,
    losesBaseSalary,
  };
}
