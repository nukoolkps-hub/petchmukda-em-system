/* ─── Salary calculation helpers ───────────────────────────────── */
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";
import { BUSINESS_RULES } from "../constants";

const { DAYS_PER_MONTH, POOL_THRESHOLD, BASE_SALARY_THRESHOLD, SUNDAY_LEAVE_MULTIPLIER, WEEKDAY_LEAVE_QUOTA } = BUSINESS_RULES;

/* ─── Pool Share Helper (สูตรตาม Excel) ──────────────────────────
   ฝั่ง "ขาย"   = ทั่วไป + พิเศษ ของแต่ละคน → รวมเป็น Pool ขาย
   ฝั่ง "รับซื้อ" = รับซื้อ ของแต่ละคน         → รวมเป็น Pool รับซื้อ

   สูตรการแบ่ง (ทำแยกฝั่ง ขาย / ซื้อ):
   ┌──────────────────────────────────────────────────────────
   │ N = จำนวนคนใน Pool (หลังตัดสิทธิ์)
   │ Base = 100 / N         (% ของแต่ละคนแบบเท่ากัน)
   │ K = Base / 30          (ตัวคูณการหัก)
   │
   │ % การหัก_i = วันหยุดรวม_i × K × (N-1)
   │ % แบ่งเพื่อน_i = % การหัก_i / (N-1)
   │ % ที่ได้_i = Base − % การหัก_i + Σ(% แบ่งเพื่อน ของคนอื่น)
   │ ชิ้น_i = (% ที่ได้_i × Pool รวม) / 100
   └──────────────────────────────────────────────────────────

   poolExclude (Admin ตั้งให้แต่ละคน):
   - "sell"  → ปิดฝั่งขาย → ตัดออกจาก Pool ขาย → N ลดลง
   - "buy"   → ปิดฝั่งรับซื้อ
   - "both"  → ปิดทั้งคู่ + ถ้าขาย < 50% ของ Top → ไม่ได้เงินเดือนพื้นฐาน

   กฎ 80%: ถ้าชิ้นน้อยกว่า 80% ของ Top → ตัดออกจาก Pool
   ขาย-พิเศษ → ใครขายใครได้ (ไม่ใช่ Pool เดียวกัน — แต่นับรวม sellPieces) */
export function computePoolSharesForGroup({ groupEmpIds, salaryData, allLeaves, ym, empDir }){
  if(!groupEmpIds||groupEmpIds.length===0) return {};

  // --- Step 0: คัดข้อมูลพื้นฐานของแต่ละคน ---
  const sellPieces: Record<string, number> = {};   // ทั่วไป + พิเศษ ของตัวเอง
  const buyPieces: Record<string, number>  = {};   // รับซื้อของตัวเอง
  const totalLeave: Record<string, number> = {};   // วันหยุดรวม (ปกติ + อาทิตย์)
  const poolExc: Record<string, string | null>    = {};
  groupEmpIds.forEach(empId=>{
    const sal = salaryData[empId]?.[ym];
    const emp = empDir.find(e=>e.id===empId);
    sellPieces[empId] = (sal?.piecesNormal||0) + (sal?.piecesSpecial||0);
    buyPieces[empId]  = (sal?.piecesBuy||0);
    poolExc[empId]    = emp?.poolExclude || null;
    const monthLeaves = emp ? allLeaves.filter(lv=>lv.empName===emp.name && lv.start.startsWith(ym)) : [];
    const w = countWeekdayLeaves(monthLeaves);
    const overInfo = getOverQuotaDays(monthLeaves);
    // วันหยุดรวมตาม Excel = ปกติ + อาทิตย์ทั้งหมด (ไม่ใช่แค่ที่เกินโควต้า)
    totalLeave[empId] = w + (overInfo.sundays || 0);
  });
  const topSell = Math.max(0, ...Object.values(sellPieces));
  const topBuy  = Math.max(0, ...Object.values(buyPieces));
  const sellThreshold = topSell * POOL_THRESHOLD;
  const buyThreshold  = topBuy  * POOL_THRESHOLD;
  const baseSalaryThreshold = topSell * BASE_SALARY_THRESHOLD;

  // --- Step 1: หาว่าใครเข้า Pool ฝั่งไหนบ้าง ---
  const eligibleSell = {};
  const eligibleBuy  = {};
  groupEmpIds.forEach(empId=>{
    const exc = poolExc[empId];
    if(exc==="sell" || exc==="both"){ eligibleSell[empId] = false; }
    else { eligibleSell[empId] = topSell===0 ? true : (sellPieces[empId] >= sellThreshold); }
    if(exc==="buy"  || exc==="both"){ eligibleBuy[empId]  = false; }
    else { eligibleBuy[empId]  = topBuy===0  ? true : (buyPieces[empId]  >= buyThreshold); }
  });

  // --- Step 2: รวม Pool จากชิ้นของทุกคน (รวมคนที่ถูกตัด) ---
  let poolN_total = 0, poolB_total = 0;
  groupEmpIds.forEach(empId=>{
    const sal = salaryData[empId]?.[ym];
    if(sal){
      poolN_total += sellPieces[empId];          // ทั่วไป + พิเศษ
      poolB_total += buyPieces[empId];           // รับซื้อ
    }
  });

  // --- Step 3: คำนวณตามสูตร Excel แยก 2 ฝั่ง ---
  function computeShares(eligible, poolTotal){
    const eligibleIds = groupEmpIds.filter(id=>eligible[id]);
    const N = eligibleIds.length;
    if(N===0) return { shares:{}, N:0, base:0, K:0 };
    const base = 100 / N;
    const K = base / DAYS_PER_MONTH;

    // % การหัก ของแต่ละคน
    const deductPct = {};
    const sharePct  = {};
    eligibleIds.forEach(id=>{
      deductPct[id] = totalLeave[id] * K * (N-1);
      sharePct[id]  = N>1 ? deductPct[id] / (N-1) : 0;
    });
    // % ที่ได้
    const shares = {};
    const sumShareAll = eligibleIds.reduce((s,id)=>s+sharePct[id], 0);
    eligibleIds.forEach(id=>{
      const sumOthers = sumShareAll - sharePct[id];
      const pct = base - deductPct[id] + sumOthers;
      const pieces = (pct/100) * poolTotal;
      shares[id] = { pct, pieces, deductPct:deductPct[id], sharePct:sharePct[id], leaveDays:totalLeave[id] };
    });
    return { shares, N, base, K, eligibleIds };
  }

  const sellResult = computeShares(eligibleSell, poolN_total);
  const buyResult  = computeShares(eligibleBuy,  poolB_total);

  // --- Step 4: ประกอบผลลัพธ์ของแต่ละคน ---
  const result = {};
  groupEmpIds.forEach(empId=>{
    const sShare = sellResult.shares[empId];
    const bShare = buyResult.shares[empId];
    const losesBaseSalary = poolExc[empId]==="both" && topSell>0 && sellPieces[empId] < baseSalaryThreshold;

    result[empId] = {
      // จำนวนชิ้นที่ได้
      piecesNormal: sShare ? sShare.pieces : 0,
      piecesBuy:    bShare ? bShare.pieces : 0,
      // เปอร์เซ็นต์ (สำหรับแสดงผล)
      sellPct:        sShare ? sShare.pct        : 0,
      sellDeductPct:  sShare ? sShare.deductPct  : 0,
      sellSharePct:   sShare ? sShare.sharePct   : 0,
      buyPct:         bShare ? bShare.pct        : 0,
      buyDeductPct:   bShare ? bShare.deductPct  : 0,
      buySharePct:    bShare ? bShare.sharePct   : 0,
      // ข้อมูล Pool
      poolN: poolN_total, poolB: poolB_total,
      sellN: sellResult.N, sellBase: sellResult.base, sellK: sellResult.K,
      buyN:  buyResult.N,  buyBase:  buyResult.base,  buyK:  buyResult.K,
      leaveDays: totalLeave[empId],
      // สิทธิ์
      eligibleSell: eligibleSell[empId],
      eligibleBuy:  eligibleBuy[empId],
      mySell: sellPieces[empId], myBuy: buyPieces[empId],
      topSell, topBuy,
      sellThreshold, buyThreshold, baseSalaryThreshold,
      poolExclude: poolExc[empId],
      losesBaseSalary,
      // (เพื่อความเข้ากันได้ย้อนหลังกับ UI เดิม)
      ratioSell: sShare ? sShare.pct/100 : 0,
      ratioBuy:  bShare ? bShare.pct/100 : 0,
      workDay:   DAYS_PER_MONTH - totalLeave[empId],
      totalWorkSell: DAYS_PER_MONTH * sellResult.N,
      totalWorkBuy:  DAYS_PER_MONTH * buyResult.N,
    };
  });
  return result;
}

export function calcSalary(s, overQuotaInfo, rates, totalLeaveDays, approvedAdvanceTotal, poolShare, roleConfig){
  if(!s) return null;
  const wd = overQuotaInfo?.weekdays || 0;
  const sun = overQuotaInfo?.sundays || 0;
  // เงินเดือนพื้นฐาน — ดึงจาก empInfo (Admin กรอกในแท็บ "ข้อมูลพนักงาน")
  const baseAmt = rates?.baseSalary ?? (s.base || 0);
  const dayRate = baseAmt / DAYS_PER_MONTH;
  const overQ = Math.round(wd * dayRate + sun * dayRate * SUNDAY_LEAVE_MULTIPLIER);

  const isSingle = (roleConfig && !roleConfig.poolGroup);
  const rSingle  = rates?.ratePerPiece || 0;
  const rNormal   = rates?.ratePerPieceNormal   || 0;
  const rSpecial  = rates?.ratePerPieceSpecial  || 0;
  const rBuy      = rates?.ratePerPieceBuy      || 0;
  const rInvite   = rates?.ratePerPieceInvite   || 0;
  const rTransfer = rates?.ratePerPieceTransfer || 0;

  let pcsSingle=0, pcsN=0, pcsS=0, pcsB=0;
  let commSingle=0, commNormal=0, commSpecial=0, commBuy=0;

  if(isSingle){
    pcsSingle = s.pieces||0;
    commSingle = Math.round(pcsSingle * rSingle);
  } else {
    const inPool = !!poolShare;
    pcsN = inPool ? (poolShare.piecesNormal||0) : (s.piecesNormal||0);
    pcsS = s.piecesSpecial||0;  // always personal
    pcsB = inPool ? (poolShare.piecesBuy||0)    : (s.piecesBuy||0);
    commNormal  = Math.round(pcsN * rNormal);
    commSpecial = Math.round(pcsS * rSpecial);
    commBuy     = Math.round(pcsB * rBuy);
  }

  const pcsI = s.piecesInvite||0;
  const pcsT = s.piecesTransfer||0;
  const commInvite   = pcsI * rInvite;
  const commTransfer = pcsT * rTransfer;
  const memberBonusTotal = commInvite + commTransfer;

  const lvDays = totalLeaveDays || 0;
  const bonusDays = Math.max(0, WEEKDAY_LEAVE_QUOTA - lvDays);
  const attendBonus = Math.round(bonusDays * dayRate);

  // ถ้าถูกปิดสิทธิ์ Pool และขาย < 50% ของ Top → เงินเดือนพื้นฐาน = 0
  const losesBaseSalary = !!poolShare?.losesBaseSalary;
  const baseSalary = losesBaseSalary ? 0 : baseAmt;

  const earnings = baseSalary + commSingle + commNormal + commSpecial + commBuy + memberBonusTotal + attendBonus;
  const advanceDed = approvedAdvanceTotal || 0;
  const deductions = (s.lateDeduction||0) + advanceDed + (s.socialSecurity||0) + overQ;
  const net = earnings - deductions;
  return { earnings, deductions, net, overQ, dayRate, wd, sun,
    isSingle, pcsSingle, commSingle, rSingle,
    commNormal, commSpecial, commBuy, commInvite, commTransfer, memberBonusTotal,
    pcsN, pcsS, pcsB, pcsI, pcsT, rNormal, rSpecial, rBuy, rInvite, rTransfer,
    attendBonus, bonusDays, lvDays, advanceDed,
    baseSalary, losesBaseSalary };
}
