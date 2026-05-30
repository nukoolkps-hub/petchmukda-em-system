import {
  IconArrowLeft,
  IconBuildingBank,
  IconCirclePlus,
  IconClock,
  IconPrinter,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { printSalaryCertificate } from "../../print/printSalaryCertificate";
import { printSalarySlip } from "../../print/printSalarySlip";
import {
  isLineWebview,
  openInExternalBrowser,
} from "../../print/webviewHelpers";
import BaseModal from "../shared/BaseModal";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import {
  calculateSalary,
  computePoolSharesForGroup,
} from "../../utils/salaryUtils";

/* ─── Salary View (employee — read only) ───────────────────────── */
export default function SalaryView({
  profile,
  employeeId: profileEmployeeId,
  salaryData,
  allLeaves,
  employeeDirectory,
  advanceRequests,
  onOpenAdvance,
  onOpenHistory,
  roles,
  payrollConfirms,
}) {
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const employeeInfo =
    employeeDirectory.find((employee) => employee.id === profileEmployeeId) ||
    employeeDirectory.find((employee) => employee.name === profile?.name);
  const salaryEmployeeId = employeeInfo?.id || profileEmployeeId || "";
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const months = useMemo(
    () =>
      Object.keys(salaryData[salaryEmployeeId] || {})
        .sort()
        .reverse()
        .slice(0, 12),
    [salaryData, salaryEmployeeId],
  );
  const selectMonths = months.includes(selectedMonth)
    ? months
    : [selectedMonth, ...months];

  useEffect(() => {
    if (months.length === 0) return;
    if (!months.includes(selectedMonth)) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  const data = salaryData[salaryEmployeeId]?.[selectedMonth];
  const employeeRole = roles?.find((role) => role.id === employeeInfo?.roleId);

  const {
    overInfo,
    overTotalDays,
    monthApprovedAdvances,
    poolShare,
    salaryCalculation,
  } = useMemo(() => {
    const monthLeaves = profile
      ? allLeaves.filter(
          (leave) =>
            leave.employeeName === profile.name &&
            leave.start.startsWith(selectedMonth),
        )
      : [];
    const overQuotaInfo = getOverQuotaDays(monthLeaves);
    const leaveDays = countWeekdayLeaves(monthLeaves);
    const approvedAdvancesForMonth = (advanceRequests || []).filter(
      (advanceRequest) =>
        advanceRequest.month === selectedMonth &&
        advanceRequest.status === "approved",
    );
    const approvedAdvanceAmountTotal = approvedAdvancesForMonth.reduce(
      (sum, advanceRequest) => sum + advanceRequest.amount,
      0,
    );
    let employeePoolShare: any = null;
    if (employeeRole?.poolGroup) {
      const groupEmployees = employeeDirectory.filter((employee) => {
        const role = roles.find(
          (candidateRole) => candidateRole.id === employee.roleId,
        );
        return role?.poolGroup === employeeRole.poolGroup;
      });
      const shares = computePoolSharesForGroup({
        groupEmployeeIds: groupEmployees.map((employee) => employee.id),
        salaryData,
        allLeaves,
        yearMonth: selectedMonth,
        employeeDirectory,
      });
      employeePoolShare = shares[employeeInfo?.id];
    }
    const computedSalary = calculateSalary(
      data,
      overQuotaInfo,
      employeeInfo,
      leaveDays,
      approvedAdvanceAmountTotal,
      employeePoolShare,
      employeeRole,
    );
    return {
      overInfo: overQuotaInfo,
      overTotalDays: overQuotaInfo.weekdays + overQuotaInfo.sundays,
      totalLeaveDays: leaveDays,
      monthApprovedAdvances: approvedAdvancesForMonth,
      approvedAdvanceTotal: approvedAdvanceAmountTotal,
      poolShare: employeePoolShare,
      salaryCalculation: computedSalary,
    };
  }, [
    profile,
    allLeaves,
    selectedMonth,
    advanceRequests,
    employeeRole,
    employeeDirectory,
    roles,
    salaryData,
    employeeInfo,
    data,
  ]);

  const slipConfirmed = !!payrollConfirms?.[selectedMonth];

  function handlePrintSlip() {
    if (!data || !salaryCalculation) {
      alert("ไม่มีข้อมูลเงินเดือนเดือนนี้");
      return;
    }
    if (!slipConfirmed) {
      alert("ยังพิมพ์ไม่ได้ — รอ Admin ยืนยันยอดเงินเดือนเดือนนี้ก่อน");
      return;
    }
    if (isLineWebview()) {
      openInExternalBrowser();
      return;
    }
    printSalarySlip({
      profile,
      employeeInfo,
      employeeRole,
      data,
      salaryCalculation,
      poolShare,
      selectedMonth,
      monthApprovedAdvances,
    });
  }

  const [showCertModal, setShowCertModal] = useState(false);
  const [certPurpose, setCertPurpose] = useState("ยื่นกู้สินเชื่อ");

  function handlePrintCert() {
    if (!data) {
      alert("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง");
      return;
    }
    setShowCertModal(true);
  }

  function confirmPrintCert() {
    setShowCertModal(false);
    if (isLineWebview()) {
      openInExternalBrowser();
      return;
    }
    printSalaryCertificate({
      profile,
      employeeInfo,
      data,
      purpose: certPurpose.trim() || undefined,
    });
  }

  if (!data || !salaryCalculation) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="text-sm text-txt-soft flex-1">สลิปเงินเดือน</div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="pl-3 pr-8 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-cream font-[inherit] outline-none"
          >
            {selectMonths.map((m) => {
              const [y, mo] = m.split("-");
              return (
                <option key={m} value={m}>
                  {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]}{" "}
                  {parseInt(y, 10) + 543}
                </option>
              );
            })}
          </select>
        </div>
        <div className="text-center text-txt-soft py-[50px] px-6 text-base bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="text-5xl mb-3">💰</div>
          <div className="font-bold text-txt mb-1">ยังไม่มีข้อมูลเงินเดือน</div>
          <div className="text-sm text-txt-soft mb-5">
            เดือน {(() => {
              const [y, mo] = selectedMonth.split("-");
              return `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
            })()}
          </div>
          {months.includes(currentYearMonth) &&
            selectedMonth !== currentYearMonth && (
              <button
                onClick={() => setSelectedMonth(currentYearMonth)}
                className="px-5 py-2.5 rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-sm font-bold cursor-pointer font-[inherit] shadow-[0_3px_10px_var(--color-gold)/0.25] inline-flex items-center gap-1.5"
              >
                <IconArrowLeft size={14} stroke={2.5} />
                กลับไปเดือนปัจจุบัน
              </button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* month selector — บนสุด เพื่อให้สลับเดือนง่าย */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-txt-mid">
          📅 เดือนเงินเดือน
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="pl-3 pr-8 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-cream font-[inherit] outline-none"
        >
          {selectMonths.map((m) => {
            const [y, mo] = m.split("-");
            return (
              <option key={m} value={m}>
                {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
              </option>
            );
          })}
        </select>
      </div>

      {/* Bank info card */}
      <div className="bg-white rounded-[14px] px-4 py-3.5 mb-2.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-linear-135 from-gold to-gold-lt flex items-center justify-center shrink-0 shadow-[0_2px_8px_var(--color-gold)/0.25]">
          <IconBuildingBank size={19} color="#fff" stroke={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-txt-soft mb-0.5">โอนเข้าบัญชี</div>
          <div className="text-sm font-bold text-txt mb-px">
            {employeeInfo?.bank || "-"}
          </div>
          <div className="text-sm text-txt-mid tracking-wider">
            {employeeInfo?.bankAccountNumber || "-"}
          </div>
        </div>
      </div>

      {/* Advance (left col: stacked) + Print panel (right col) */}
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        {/* Left col: เบิกเงิน + ประวัติเบิกเงิน — stacked */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onOpenAdvance}
            className="bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-3.5 py-3 border-none cursor-pointer font-[inherit] shadow-[0_3px_12px_var(--color-maroon)/0.25] text-left relative overflow-hidden"
          >
            <svg
              className="absolute -top-1.5 -right-1.5 opacity-15"
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill={COLORS.goldLight}
            >
              <path d="M6 3h12l4 6-10 12L2 9z" />
            </svg>
            <div className="flex items-center gap-2 relative">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-white/18 flex items-center justify-center shrink-0">
                <IconCirclePlus
                  size={17}
                  color={COLORS.goldLight}
                  stroke={2.4}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gold-lt leading-tight">
                  เบิกเงิน
                </div>
                <div className="text-xs text-gold-lt/65 mt-px">ล่วงหน้า</div>
              </div>
            </div>
          </button>
          <button
            onClick={onOpenHistory}
            className="bg-white rounded-[14px] px-3.5 py-3 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(90,30,10,0.06)] text-left relative border-[1.5px] border-[#C9973A50]"
          >
            <div className="flex items-center gap-2">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-gold-pale flex items-center justify-center shrink-0 border border-[#C9973A40]">
                <IconClock size={17} color={COLORS.maroon} stroke={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-maroon leading-tight">
                  ประวัติเบิกเงิน
                </div>
                <div className="text-xs text-txt-soft mt-px">
                  {advanceRequests && advanceRequests.length > 0
                    ? `${advanceRequests.length} คำขอ`
                    : "ยังไม่มี"}
                </div>
              </div>
              {advanceRequests?.some((r) => r.status === "pending") && (
                <div className="w-2 h-2 rounded-full bg-amber shadow-[0_0_0_3px_var(--color-amber)/0.2] shrink-0" />
              )}
            </div>
          </button>
        </div>

        {/* Right col: Print panel — สลิปเงินเดือน + ใบรับรองเงินเดือน */}
        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-[14px] bg-gold-pale/20 border border-gold/15">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-txt-mid font-semibold">
                📋 สลิปเงินเดือน
              </div>
              {!slipConfirmed && (
                <div className="text-[10px] text-amber font-semibold mt-0.5">
                  🔒 รอ Admin ยืนยันยอด
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handlePrintSlip}
              disabled={!slipConfirmed}
              title={
                slipConfirmed
                  ? "พิมพ์ / บันทึก PDF"
                  : "รอ Admin ยืนยันยอดก่อน"
              }
              className={`px-3.5 py-2 rounded-lg text-sm font-bold cursor-pointer font-[inherit] flex items-center gap-1.5 whitespace-nowrap border-[1.5px] shrink-0 ${
                slipConfirmed
                  ? "bg-white text-maroon border-[#7B1C1C50]"
                  : "bg-gray-100 text-txt-soft border-bdr cursor-not-allowed opacity-70"
              }`}
            >
              <PrintIcon />
              พิมพ์
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm text-txt-mid font-semibold min-w-0">
              📄 ใบรับรองเงินเดือน
            </div>
            <button
              type="button"
              onClick={handlePrintCert}
              title="พิมพ์ / บันทึก PDF"
              className="px-3.5 py-2 rounded-lg bg-white text-maroon text-sm font-bold cursor-pointer font-[inherit] flex items-center gap-1.5 whitespace-nowrap border-[1.5px] border-[#7B1C1C50] shrink-0"
            >
              <PrintIcon />
              พิมพ์
            </button>
          </div>
          <div className="text-[11px] text-txt-soft leading-snug mt-auto pt-1">
            💡 เลือก <b>"Save as PDF"</b> เพื่อบันทึกไฟล์
          </div>
        </div>
      </div>

      {/* Net pay big card */}
      <div className="bg-linear-135 from-maroon-dk to-maroon rounded-[18px] px-[22px] pt-[22px] pb-5 text-white mb-4.5 shadow-[0_8px_28px_var(--color-maroon)/0.25] relative overflow-hidden">
        <svg
          className="absolute -top-2.5 -right-2.5 opacity-15"
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill={COLORS.goldLight}
        >
          <path d="M6 3h12l4 6-10 12L2 9z" />
        </svg>
        <div className="relative">
          <div className="text-sm text-gold-lt/65">เงินสุทธิที่ได้รับ</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-gold-lt tracking-[-0.02em]">
              ฿{formatThaiNumber(salaryCalculation?.netSalary ?? 0)}
            </span>
          </div>
          <div className="flex gap-3.5 mt-3.5 pt-3.5 border-t border-gold-lt/12">
            <div>
              <div className="text-xs text-gold-lt/50">รวมรายรับ</div>
              <div className="text-base font-bold text-[#7EE8B5]">
                +฿{formatThaiNumber(salaryCalculation.earnings)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gold-lt/50">รวมรายหัก</div>
              <div className="text-base font-bold text-[#FCA5A5]">
                −฿{formatThaiNumber(salaryCalculation.deductions)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-green" />
          <div className="font-bold text-base text-txt">รายรับ</div>
        </div>
        {[
          {
            icon: "💼",
            main: "เงินเดือนพื้นฐาน",
            sub: "",
            value: salaryCalculation.baseSalary,
          },
          ...(salaryCalculation.usesSinglePieceRate
            ? [
                {
                  icon: "📦",
                  main: "ค่าคอม",
                  sub: `${salaryCalculation.singleRatePieces} ชิ้น × ฿${formatThaiNumber(salaryCalculation.singlePieceRate)}`,
                  value: salaryCalculation.singleRateCommission,
                },
              ]
            : [
                {
                  icon: "💎",
                  main: "ค่าคอมขาย (ทั่วไป)",
                  sub: poolShare
                    ? `Pool ${poolShare.totalSellPoolPieces} ชิ้น · ได้ ${poolShare.sellSharePercent.toFixed(2)}% = ${salaryCalculation.normalSalePieces.toFixed(1)} ชิ้น × ฿${formatThaiNumber(salaryCalculation.normalSalePieceRate)}`
                    : `${salaryCalculation.normalSalePieces} ชิ้น × ฿${formatThaiNumber(salaryCalculation.normalSalePieceRate)}`,
                  value: salaryCalculation.normalSaleCommission,
                },
                {
                  icon: "✨",
                  main: "ค่าคอมขาย (พิเศษ)",
                  sub: `${salaryCalculation.specialSalePieces} ชิ้น × ฿${formatThaiNumber(salaryCalculation.specialSalePieceRate)}`,
                  value: salaryCalculation.specialSaleCommission,
                },
                {
                  icon: "🛍",
                  main: "ค่าคอมรับซื้อ",
                  sub: poolShare
                    ? `Pool ${poolShare.totalBuyPoolPieces} ชิ้น · ได้ ${poolShare.buySharePercent.toFixed(2)}% = ${salaryCalculation.buyPieces.toFixed(1)} ชิ้น × ฿${formatThaiNumber(salaryCalculation.buyPieceRate)}`
                    : `${salaryCalculation.buyPieces} ชิ้น × ฿${formatThaiNumber(salaryCalculation.buyPieceRate)}`,
                  value: salaryCalculation.buyCommission,
                },
              ]),
          {
            icon: "🎫",
            main: "โบนัสเชิญชวนสมัครบัตร",
            sub: `${salaryCalculation.invitePieces} ใบ × ฿${formatThaiNumber(salaryCalculation.invitePieceRate)}`,
            value: salaryCalculation.inviteCommission,
          },
          {
            icon: "🔄",
            main: "โบนัสย้ายข้อมูลบัตร",
            sub: `${salaryCalculation.transferPieces} ใบ × ฿${formatThaiNumber(salaryCalculation.transferPieceRate)}`,
            value: salaryCalculation.transferCommission,
          },
          {
            icon: "🌟",
            main: "โบนัสแห่งความขยัน(ไม่หยุด)",
            sub:
              salaryCalculation.leaveDays <= 2
                ? `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน → ${salaryCalculation.bonusDays} วัน × ฿${formatThaiNumber(Math.round(salaryCalculation.dailySalaryRate))}`
                : `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน — ไม่ได้รับโบนัส`,
            value: salaryCalculation.attendanceBonus,
          },
          ...(Array.isArray(data.customEarnings)
            ? data.customEarnings.map((e) => ({
                icon: "➕",
                main: e.label || "รายการรายรับ",
                sub: "",
                value: e.amount,
              }))
            : []),
        ]
          .filter((x) => x.value > 0)
          .map((row, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-dashed border-cream-dk" : ""}`}
            >
              <span className="text-base w-[22px] text-center shrink-0">
                {row.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-txt-mid">{row.main}</div>
                {row.sub && (
                  <div className="text-xs text-txt-soft mt-px">{row.sub}</div>
                )}
              </div>
              <span className="text-base font-semibold text-green whitespace-nowrap">
                +฿{formatThaiNumber(row.value)}
              </span>
            </div>
          ))}
        <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
          <span className="text-sm font-bold text-txt">รวมรายรับ</span>
          <span className="text-lg font-extrabold text-green">
            ฿{formatThaiNumber(salaryCalculation.earnings)}
          </span>
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-red" />
          <div className="font-bold text-base text-txt">รายการหัก</div>
        </div>
        {[
          {
            icon: "⏰",
            main: "หักขาดงาน/มาสาย",
            sub: "",
            value: data.lateDeduction,
          },
          {
            icon: "💵",
            main: "หักเงินเบิกล่วงหน้า",
            sub:
              monthApprovedAdvances.length > 0
                ? `เบิกแล้ว ${monthApprovedAdvances.length} ครั้งในเดือนนี้`
                : "",
            value: salaryCalculation.advanceDeduction,
          },
          {
            icon: "🏛",
            main: "หักประกันสังคม",
            sub: "",
            value: salaryCalculation.socialSecurity,
          },
          {
            icon: "📋",
            main: "หักลาเกินโควต้า",
            sub:
              overTotalDays > 0
                ? `${overInfo.weekdays > 0 ? `${overInfo.weekdays} วันธรรมดา` : ""}${overInfo.weekdays > 0 && overInfo.sundays > 0 ? " + " : ""}${overInfo.sundays > 0 ? `${overInfo.sundays} วันอาทิตย์ ×1.5` : ""}`
                : "",
            value: salaryCalculation.overQuotaDeduction,
          },
          ...(Array.isArray(data.customDeductions)
            ? data.customDeductions.map((d) => ({
                icon: "➖",
                main: d.label || "รายการหัก",
                sub: "",
                value: d.amount,
              }))
            : []),
        ]
          .filter((x) => x.value > 0)
          .map((row, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-dashed border-cream-dk" : ""}`}
            >
              <span className="text-base w-[22px] text-center shrink-0">
                {row.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-txt-mid">{row.main}</div>
                {row.sub && (
                  <div className="text-xs text-txt-soft mt-px">{row.sub}</div>
                )}
              </div>
              <span className="text-base font-semibold text-red whitespace-nowrap">
                −฿{formatThaiNumber(row.value)}
              </span>
            </div>
          ))}
        {salaryCalculation.deductions === 0 && (
          <div className="text-center text-txt-soft text-sm py-2">
            ไม่มีรายการหัก ✨
          </div>
        )}
        {salaryCalculation.deductions > 0 && (
          <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
            <span className="text-sm font-bold text-txt">รวมรายหัก</span>
            <span className="text-lg font-extrabold text-red">
              ฿{formatThaiNumber(salaryCalculation.deductions)}
            </span>
          </div>
        )}
      </div>

      {data.note && (
        <div className="bg-gold-pale rounded-xl px-3.5 py-3 text-sm text-txt-mid border border-[#C9973A40]">
          📝 หมายเหตุ: {data.note}
        </div>
      )}

      <div className="text-center text-xs text-txt-soft mt-4">
        ข้อมูลกำหนดโดย Admin
      </div>

      {showCertModal && (
        <BaseModal onClose={() => setShowCertModal(false)}>
          <div className="bg-cream rounded-2xl p-5 w-full">
            <div className="text-lg font-bold text-maroon mb-1">
              📄 พิมพ์ใบรับรองเงินเดือน
            </div>
            <div className="text-sm text-txt-mid mb-3.5">
              ระบุวัตถุประสงค์ — ข้อความจะถูกพิมพ์ลงในใบรับรอง
            </div>

            <div className="text-xs font-bold text-txt-soft uppercase tracking-wide mb-1.5">
              เลือกด่วน
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CERT_PURPOSE_OPTIONS.map((p) => {
                const active = certPurpose === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCertPurpose(p)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold text-left border-[1.5px] cursor-pointer font-[inherit] ${
                      active
                        ? "bg-maroon text-white border-maroon"
                        : "bg-white text-txt border-bdr"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCertPurpose("")}
              className={`w-full px-3 py-2 mb-4 rounded-lg text-sm font-semibold border-[1.5px] cursor-pointer font-[inherit] ${
                certPurpose === ""
                  ? "bg-maroon text-white border-maroon"
                  : "bg-white text-txt-mid border-dashed border-bdr"
              }`}
            >
              — ไม่ระบุวัตถุประสงค์ —
            </button>

            <div className="text-xs font-bold text-txt-soft uppercase tracking-wide mb-1.5">
              ✏️ พิมพ์เอง / แก้ไข
            </div>
            <input
              type="text"
              value={certPurpose}
              onChange={(e) => setCertPurpose(e.target.value)}
              placeholder="เช่น สมัครงาน, ขอเครดิตการ์ด..."
              className="w-full px-3 py-2.5 mb-4 rounded-lg border-[1.5px] border-bdr text-sm font-[inherit] bg-white outline-none focus:border-maroon"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-white text-txt-mid text-sm font-bold border border-bdr cursor-pointer font-[inherit]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmPrintCert}
                className="flex-1 py-2.5 rounded-lg bg-maroon text-white text-sm font-bold border-none cursor-pointer font-[inherit] shadow-[0_3px_10px_var(--color-maroon)/0.25]"
              >
                🖨 พิมพ์
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}

const CERT_PURPOSE_OPTIONS = [
  "ยื่นกู้สินเชื่อ",
  "เปิดบัญชีธนาคาร",
  "ติดต่อราชการ",
  "ทำวีซ่า",
];

/* ─── Icon helpers ────────────────────────────────────────────── */

function PrintIcon() {
  return <IconPrinter size={12} stroke={2.2} />;
}
