import {
  ArrowLeft as IconArrowLeft,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CirclePlus as IconCirclePlus,
  ClipboardList as IconClipboardList,
  Clock as IconClock,
  Diamond as IconDiamond,
  FileText as IconFileText,
  HandCoins as IconHandCoins,
  Lightbulb as IconLightbulb,
  Minus as IconMinus,
  Network as IconNetwork,
  StickyNote as IconNote,
  Package as IconPackage,
  Pencil as IconPencil,
  Plus as IconPlus,
  Printer as IconPrinter,
  RefreshCw as IconRefresh,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Ticket as IconTicket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { buildLoanContext, loanRemaining } from "../../firebase/employeeLoans";
import { printSalaryCertificate } from "../../print/printSalaryCertificate";
import { printSalarySlip } from "../../print/printSalarySlip";
import {
  isLineWebview,
  openInExternalBrowser,
} from "../../print/webviewHelpers";
import { currentYearMonth } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import {
  calculateSalary,
  computePoolSharesForGroup,
} from "../../utils/salaryUtils";
import AdvanceHistoryModal from "../modals/AdvanceHistoryModal";
import MonthChevronNav from "../shared/MonthChevronNav";
import PoolFlowModal from "../modals/PoolFlowModal";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";

/* ─── Salary View (employee — read only) ───────────────────────── */
export default function SalaryView({
  profile,
  employeeId: profileEmployeeId,
  salaryData,
  allLeaves,
  employeeDirectory,
  advanceRequests,
  onOpenAdvance,
  roles,
  payrollConfirms,
  poolAdjustments,
  employeeLoans,
  storeCalendar,
  showToast,
}) {
  const currentYM = currentYearMonth();
  const employeeInfo =
    employeeDirectory.find((employee) => employee.id === profileEmployeeId) ||
    employeeDirectory.find((employee) => employee.name === profile?.name);
  const salaryEmployeeId = employeeInfo?.id || profileEmployeeId || "";
  const [selectedMonth, setSelectedMonth] = useState(currentYM);
  const months = useMemo(
    () =>
      Object.keys(salaryData[salaryEmployeeId] || {})
        .sort()
        .reverse()
        // เก็บได้ถึง 5 ปี — พนักงานเก่าเปิด popover เลือกย้อนได้ลึก
        .slice(0, 60),
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
  // ตำแหน่ง "ณ เดือนที่ดู" — ใช้ roleId จาก snapshot ใน salary doc ก่อน (frozen)
  // fallback เป็น roleId ปัจจุบัน → อดีตไม่ขยับเมื่อเปลี่ยนตำแหน่ง
  const employeeRole = roles?.find(
    (role) => role.id === (data?.roleId ?? employeeInfo?.roleId),
  );
  // คำขอเบิกเงิน "ของเดือนที่เลือก" — ให้ปุ่มประวัติเบิกเงินสอดคล้องกับ dropdown
  // เดือน (เหมือนสลิป/ค่าคอม) ไม่ใช่นับรวมทุกเดือน
  const monthAdvances = (advanceRequests || []).filter(
    (r) => r.month === selectedMonth,
  );

  const {
    overInfo,
    overTotalDays,
    monthApprovedAdvances,
    poolShare,
    salaryCalculation,
  } = useMemo(() => {
    const monthLeaves = salaryEmployeeId
      ? allLeaves.filter(
          (leave) =>
            leave.employeeId === salaryEmployeeId &&
            leave.start.startsWith(selectedMonth),
        )
      : [];
    const overQuotaInfo = getOverQuotaDays(monthLeaves, storeCalendar);
    const leaveDays = countWeekdayLeaves(monthLeaves, storeCalendar);
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
      // ฝั่งพนักงานมี employeeDirectory แค่ตัวเอง (rules) → ใช้ snapshot
      // ใน salary doc ของแต่ละเดือน หาคนที่ poolGroup ตรงกัน
      const groupIdSet = new Set<string>();
      groupIdSet.add(employeeInfo.id);
      Object.keys(salaryData).forEach((peerId) => {
        const peerSalary = salaryData[peerId]?.[selectedMonth];
        if (!peerSalary?.roleId) return;
        const peerRole = roles.find((r) => r.id === peerSalary.roleId);
        if (peerRole?.poolGroup === employeeRole.poolGroup) {
          groupIdSet.add(peerId);
        }
      });
      const shares = computePoolSharesForGroup({
        groupEmployeeIds: Array.from(groupIdSet),
        salaryData,
        allLeaves,
        yearMonth: selectedMonth,
        employeeDirectory,
        poolAdjustment: poolAdjustments?.[selectedMonth] || null,
        poolGroup: employeeRole.poolGroup,
        storeCalendar,
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
      buildLoanContext(employeeLoans, salaryEmployeeId, selectedMonth),
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
    allLeaves,
    selectedMonth,
    advanceRequests,
    employeeRole,
    employeeDirectory,
    roles,
    salaryData,
    employeeInfo,
    data,
    salaryEmployeeId,
    poolAdjustments,
    employeeLoans,
    storeCalendar,
  ]);

  function handlePrintSlip() {
    if (!data || !salaryCalculation) {
      showToast?.("ไม่มีข้อมูลเงินเดือนเดือนนี้");
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
  const [showPoolFlow, setShowPoolFlow] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // preset และ custom เก็บแยกกัน — custom (ถ้าพิมพ์) override preset
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    "ยื่นกู้สินเชื่อ",
  );
  const [customPurpose, setCustomPurpose] = useState("");

  function handlePrintCert() {
    if (!data) {
      showToast?.("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง");
      return;
    }
    setShowCertModal(true);
  }

  const [issuingCert, setIssuingCert] = useState(false);

  async function confirmPrintCert() {
    if (isLineWebview()) {
      setShowCertModal(false);
      openInExternalBrowser();
      return;
    }
    setIssuingCert(true);
    let refNo: string | undefined;
    try {
      const { getNextCertRefNumber } = await import(
        "../../firebase/certCounter"
      );
      refNo = await getNextCertRefNumber();
    } catch (err) {
      console.error("[SalaryView] getNextCertRefNumber failed:", err);
      // ปล่อยให้ printSalaryCertificate ใช้ fallback date-time stamp
    }
    setIssuingCert(false);
    setShowCertModal(false);
    const custom = customPurpose.trim();
    const purpose = custom || selectedPreset || undefined;
    printSalaryCertificate({
      profile,
      employeeInfo,
      data,
      purpose,
      refNo,
    });
  }

  // เดือนนี้ admin ยืนยันยอดแล้วหรือยัง — ถ้ายัง ยังโชว์เงินเดือนรวมคร่าวๆ
  // ได้ (preview) แต่ banner เตือนชัดว่า "ยอดอาจเปลี่ยน" + ปิดปุ่มพิมพ์ +
  // PoolFlowModal ล็อกด้วย isConfirmed prop (ปิดแผนผังจนกว่าจะ confirm)
  const isMonthConfirmed = !!payrollConfirms?.[selectedMonth]?.confirmedAt;
  const selectedMonthLabel = (() => {
    const [y, mo] = selectedMonth.split("-");
    return `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
  })();

  if (!data || !salaryCalculation) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="text-sm text-txt-soft flex-1">สลิปเงินเดือน</div>
          <MonthChevronNav
            months={selectMonths}
            selected={selectedMonth}
            onSelect={setSelectedMonth}
            popoverSide="right"
          />
        </div>
        <div className="text-center text-txt-soft py-[50px] px-6 text-base bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="flex justify-center mb-3 text-gold">
            <IconBanknote size={48} strokeWidth={1.8} />
          </div>
          <div className="font-bold text-txt mb-1">ยังไม่มีข้อมูลเงินเดือน</div>
          <div className="text-sm text-txt-soft mb-5">
            เดือน {selectedMonthLabel}
          </div>
          {months.includes(currentYM) && selectedMonth !== currentYM && (
            <button
              onClick={() => setSelectedMonth(currentYM)}
              className="px-5 py-2.5 rounded-[10px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] shadow-[0_3px_10px_var(--color-maroon)/0.25] inline-flex items-center gap-1.5"
            >
              <IconArrowLeft size={14} strokeWidth={2.5} />
              กลับไปเดือนปัจจุบัน
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* month selector + ปุ่มแผนผังเงินเดือน — บนสุด เพื่อให้สลับเดือนง่าย */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowPoolFlow(true)}
          title="แผนผังเงินเดือน"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] border border-bdr bg-cream cursor-pointer text-sm font-semibold text-maroon font-[inherit]"
        >
          <IconNetwork size={14} strokeWidth={2.4} />
          แผนผังเงินเดือน
        </button>
        <MonthChevronNav
          months={selectMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
          popoverSide="right"
        />
      </div>

      {/* รอยืนยันยอด — แสดงเงินรวมคร่าวๆ ก่อน แต่เตือนว่ายังเปลี่ยนได้ */}
      {!isMonthConfirmed && (
        <div className="mb-2.5 px-3.5 py-2.5 rounded-[12px] bg-amber/10 border border-amber/30 flex items-start gap-2">
          <IconClock
            size={16}
            strokeWidth={2.4}
            className="text-amber shrink-0 mt-0.5"
          />
          <div className="text-xs text-txt leading-snug">
            <b>ตัวเลขประมาณการ</b> — ADMIN ยังไม่ได้ยืนยันยอด ตัวเลขอาจ เปลี่ยนแปลงได้ ·
            พิมพ์สลิป/ใบรับรอง + แผนผังเงินเดือน เปิดได้หลังยืนยันยอด
          </div>
        </div>
      )}

      {/* Bank info card */}
      <div className="bg-white rounded-[14px] px-4 py-3.5 mb-2.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)] flex items-center gap-3">
        <BankLogo bank={employeeInfo?.bank} size={40} />
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
                  strokeWidth={2.4}
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
            onClick={() => setShowHistory(true)}
            className="bg-white rounded-[14px] px-3.5 py-3 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(90,30,10,0.06)] text-left relative border-[1.5px] border-[#C9973A50]"
          >
            <div className="flex items-center gap-2">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-gold-pale flex items-center justify-center shrink-0 border border-[#C9973A40]">
                <IconClock size={17} color={COLORS.maroon} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-maroon leading-tight">
                  ประวัติเบิกเงิน
                </div>
                <div className="text-xs text-txt-soft mt-px">
                  {monthAdvances.length > 0
                    ? `${monthAdvances.length} คำขอเดือนนี้`
                    : "ไม่มีเดือนนี้"}
                </div>
              </div>
              {monthAdvances.some((r) => r.status === "pending") && (
                <div className="w-2 h-2 rounded-full bg-amber shadow-[0_0_0_3px_var(--color-amber)/0.2] shrink-0" />
              )}
            </div>
          </button>
        </div>

        {/* Right col: Print panel — สลิปเงินเดือน + ใบรับรองเงินเดือน */}
        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-[14px] bg-gold-pale/20 border border-gold/15">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-txt-mid font-semibold flex items-center gap-1.5">
                <IconClipboardList size={14} strokeWidth={2.4} />
                สลิป
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrintSlip}
              disabled={!isMonthConfirmed}
              title={isMonthConfirmed ? "พิมพ์ / บันทึก PDF" : "รอยืนยันยอด"}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold font-[inherit] flex items-center gap-1.5 whitespace-nowrap border-[1.5px] shrink-0 ${
                isMonthConfirmed
                  ? "bg-white text-maroon border-[#7B1C1C50] cursor-pointer"
                  : "bg-bdr/30 text-txt-soft border-bdr cursor-not-allowed"
              }`}
            >
              {isMonthConfirmed ? (
                <PrintIcon />
              ) : (
                <IconClock size={14} strokeWidth={2.4} />
              )}
              พิมพ์
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm text-txt-mid font-semibold min-w-0 flex items-center gap-1.5">
              <IconFileText size={14} strokeWidth={2.4} />
              ใบรับรอง
            </div>
            <button
              type="button"
              onClick={handlePrintCert}
              disabled={!isMonthConfirmed}
              title={isMonthConfirmed ? "พิมพ์ / บันทึก PDF" : "รอยืนยันยอด"}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold font-[inherit] flex items-center gap-1.5 whitespace-nowrap border-[1.5px] shrink-0 ${
                isMonthConfirmed
                  ? "bg-white text-maroon border-[#7B1C1C50] cursor-pointer"
                  : "bg-bdr/30 text-txt-soft border-bdr cursor-not-allowed"
              }`}
            >
              {isMonthConfirmed ? (
                <PrintIcon />
              ) : (
                <IconClock size={14} strokeWidth={2.4} />
              )}
              พิมพ์
            </button>
          </div>
          <div className="text-[11px] text-txt-soft leading-snug mt-auto pt-1 flex items-start gap-1">
            <IconLightbulb
              size={12}
              strokeWidth={2.4}
              className="mt-0.5 shrink-0 text-gold"
            />
            <span>
              เลือก <b>"Save as PDF"</b> เพื่อบันทึกไฟล์
            </span>
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
              {formatThaiNumber(salaryCalculation?.netSalary ?? 0)} ฿
            </span>
          </div>
          <div className="flex gap-3.5 mt-3.5 pt-3.5 border-t border-gold-lt/12">
            <div>
              <div className="text-xs text-gold-lt/50">รวมรายรับ</div>
              <div className="text-base font-bold text-[#7EE8B5]">
                + {formatThaiNumber(salaryCalculation.earnings)} ฿
              </div>
            </div>
            <div>
              <div className="text-xs text-gold-lt/50">รวมรายหัก</div>
              <div className="text-base font-bold text-[#FCA5A5]">
                − {formatThaiNumber(salaryCalculation.deductions)} ฿
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-gold-lt/50">เดือน</div>
              <div className="text-sm font-bold text-gold-lt">
                {selectedMonthLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* เงินกู้ของคุณ (loan) */}
      {(() => {
        const myLoans = (employeeLoans || []).filter(
          (l) => l.employeeId === salaryEmployeeId && l.status !== "cancelled",
        );
        if (myLoans.length === 0) return null;
        return (
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3">
              <IconHandCoins
                size={18}
                strokeWidth={2.2}
                color={COLORS.maroon}
              />
              <div className="font-bold text-base text-txt">เงินกู้ของคุณ</div>
            </div>
            <div className="flex flex-col gap-2.5">
              {myLoans.map((loan) => {
                const remaining = loanRemaining(loan);
                const paid = (loan.principal || 0) - remaining;
                const pct =
                  loan.principal > 0
                    ? Math.min(100, Math.round((paid / loan.principal) * 100))
                    : 0;
                const thisMonth =
                  salaryCalculation.loanBreakdown?.find((b) => b.id === loan.id)
                    ?.amount || 0;
                const done = remaining <= 0;
                return (
                  <div
                    key={loan.id}
                    className="bg-cream rounded-[10px] p-3 border border-bdr"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-sm font-bold text-txt truncate">
                        {loan.note || "เงินกู้"}
                      </div>
                      {done ? (
                        <span className="text-xs font-bold text-green shrink-0">
                          ผ่อนครบแล้ว
                        </span>
                      ) : thisMonth > 0 ? (
                        <span className="text-xs font-semibold text-red shrink-0">
                          เดือนนี้หัก − {formatThaiNumber(thisMonth)} ฿
                        </span>
                      ) : null}
                    </div>
                    <div className="h-1.5 rounded-full bg-cream-dk overflow-hidden mb-1.5">
                      <div
                        className="h-full bg-maroon rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-txt-soft">
                      <span>
                        ผ่อนเดือนละ {formatThaiNumber(loan.monthlyDeduction)} ฿
                      </span>
                      <span>
                        คงเหลือ{" "}
                        <b className="text-maroon">
                          {formatThaiNumber(remaining)} ฿
                        </b>{" "}
                        / {formatThaiNumber(loan.principal)} ฿
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Earnings */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-green" />
          <div className="font-bold text-base text-txt">รายรับ</div>
          <div className="ml-auto text-xs font-semibold text-txt-soft">
            {selectedMonthLabel}
          </div>
        </div>
        {[
          {
            icon: (
              <IconBriefcase
                size={16}
                strokeWidth={2.2}
                color={COLORS.maroon}
              />
            ),
            main: "เงินเดือนพื้นฐาน",
            sub: "",
            value: salaryCalculation.baseSalary,
          },
          ...(salaryCalculation.usesSinglePieceRate
            ? [
                {
                  icon: (
                    <IconPackage
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.gold}
                    />
                  ),
                  main: "ค่าคอม",
                  sub: `${salaryCalculation.singleRatePieces} ชิ้น × ${formatThaiNumber(salaryCalculation.singlePieceRate)} ฿`,
                  value: salaryCalculation.singleRateCommission,
                },
              ]
            : [
                {
                  icon: (
                    <IconDiamond
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.gold}
                    />
                  ),
                  main: "ค่าคอมขาย (ทั่วไป)",
                  sub: poolShare
                    ? `กองกลาง ${
                        poolShare.excludedNormalPieces > 0
                          ? `${poolShare.grossSellPoolPieces} − ${poolShare.excludedNormalPieces} = ${poolShare.totalSellPoolPieces}`
                          : poolShare.totalSellPoolPieces
                      } ชิ้น · ได้ ${poolShare.sellSharePercent.toFixed(2)}% = ${salaryCalculation.normalSalePieces.toFixed(1)} ชิ้น × ${formatThaiNumber(salaryCalculation.normalSalePieceRate)} ฿`
                    : `${salaryCalculation.normalSalePieces} ชิ้น × ${formatThaiNumber(salaryCalculation.normalSalePieceRate)} ฿`,
                  value: salaryCalculation.normalSaleCommission,
                },
                {
                  icon: (
                    <IconSparkles
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.gold}
                    />
                  ),
                  main: "ค่าคอมขาย (พิเศษ)",
                  sub: `${salaryCalculation.specialSalePieces} ชิ้น × ${formatThaiNumber(salaryCalculation.specialSalePieceRate)} ฿`,
                  value: salaryCalculation.specialSaleCommission,
                },
                {
                  icon: (
                    <IconShoppingBag
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.maroon}
                    />
                  ),
                  main: "ค่าคอมรับซื้อ",
                  sub: poolShare
                    ? `กองกลาง ${
                        poolShare.excludedBuyPieces > 0
                          ? `${poolShare.grossBuyPoolPieces} − ${poolShare.excludedBuyPieces} = ${poolShare.totalBuyPoolPieces}`
                          : poolShare.totalBuyPoolPieces
                      } ชิ้น · ได้ ${poolShare.buySharePercent.toFixed(2)}% = ${salaryCalculation.buyPieces.toFixed(1)} ชิ้น × ${formatThaiNumber(salaryCalculation.buyPieceRate)} ฿`
                    : `${salaryCalculation.buyPieces} ชิ้น × ${formatThaiNumber(salaryCalculation.buyPieceRate)} ฿`,
                  value: salaryCalculation.buyCommission,
                },
              ]),
          {
            icon: (
              <IconTicket size={16} strokeWidth={2.2} color={COLORS.gold} />
            ),
            main: "โบนัสเชิญชวนสมัครบัตร",
            sub: `${salaryCalculation.invitePieces} ใบ × ${formatThaiNumber(salaryCalculation.invitePieceRate)} ฿`,
            value: salaryCalculation.inviteCommission,
          },
          {
            icon: (
              <IconRefresh size={16} strokeWidth={2.2} color={COLORS.gold} />
            ),
            main: "โบนัสย้ายข้อมูลบัตร",
            sub: `${salaryCalculation.transferPieces} ใบ × ${formatThaiNumber(salaryCalculation.transferPieceRate)} ฿`,
            value: salaryCalculation.transferCommission,
          },
          {
            icon: <IconStar size={16} strokeWidth={2.2} color={COLORS.gold} />,
            main: "โบนัสแห่งความขยัน(ไม่หยุด)",
            sub:
              salaryCalculation.leaveDays <= 2
                ? `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน → ${salaryCalculation.bonusDays} วัน × ${formatThaiNumber(Math.round(salaryCalculation.dailySalaryRate))} ฿`
                : `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน — ไม่ได้รับโบนัส`,
            value: salaryCalculation.attendanceBonus,
          },
          ...(Array.isArray(data.customEarnings)
            ? data.customEarnings.map((e) => ({
                icon: (
                  <IconPlus size={16} strokeWidth={2.2} color={COLORS.gold} />
                ),
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
                + {formatThaiNumber(row.value)} ฿
              </span>
            </div>
          ))}
        <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
          <span className="text-sm font-bold text-txt">รวมรายรับ</span>
          <span className="text-lg font-extrabold text-green">
            {formatThaiNumber(salaryCalculation.earnings)} ฿
          </span>
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-red" />
          <div className="font-bold text-base text-txt">รายการหัก</div>
          <div className="ml-auto text-xs font-semibold text-txt-soft">
            {selectedMonthLabel}
          </div>
        </div>
        {[
          {
            icon: (
              <IconBanknote size={16} strokeWidth={2.2} color={COLORS.red} />
            ),
            main: "หักเงินเบิกล่วงหน้า",
            sub:
              monthApprovedAdvances.length > 0
                ? `เบิกแล้ว ${monthApprovedAdvances.length} ครั้งในเดือนนี้`
                : "",
            value: salaryCalculation.advanceDeduction,
          },
          {
            icon: (
              <IconHandCoins size={16} strokeWidth={2.2} color={COLORS.red} />
            ),
            main: "หักผ่อนเงินกู้",
            sub: (() => {
              const notes = (salaryCalculation.loanBreakdown || [])
                .map(
                  (b) => (employeeLoans || []).find((l) => l.id === b.id)?.note,
                )
                .filter(Boolean);
              return notes.length > 0 ? notes.join(", ") : "";
            })(),
            value: salaryCalculation.loanDeduction,
          },
          {
            icon: (
              <IconBuildingBank
                size={16}
                strokeWidth={2.2}
                color={COLORS.red}
              />
            ),
            main: "หักประกันสังคม",
            sub: "",
            value: salaryCalculation.socialSecurity,
          },
          {
            icon: (
              <IconClipboardList
                size={16}
                strokeWidth={2.2}
                color={COLORS.red}
              />
            ),
            main: "หักลาเกินโควต้า",
            sub:
              overTotalDays > 0
                ? `${overInfo.weekdays > 0 ? `${overInfo.weekdays} วันธรรมดา` : ""}${overInfo.weekdays > 0 && overInfo.sundays > 0 ? " + " : ""}${overInfo.sundays > 0 ? `${overInfo.sundays} วันอาทิตย์ ×1.5` : ""}`
                : "",
            value: salaryCalculation.overQuotaDeduction,
          },
          ...(Array.isArray(data.customDeductions)
            ? data.customDeductions.map((d) => ({
                icon: (
                  <IconMinus size={16} strokeWidth={2.2} color={COLORS.red} />
                ),
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
                − {formatThaiNumber(row.value)} ฿
              </span>
            </div>
          ))}
        {salaryCalculation.deductions === 0 && (
          <div className="text-center text-txt-soft text-sm py-2 flex items-center justify-center gap-1.5">
            ไม่มีรายการหัก
            <IconSparkles size={14} strokeWidth={2} className="text-gold" />
          </div>
        )}
        {salaryCalculation.deductions > 0 && (
          <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
            <span className="text-sm font-bold text-txt">รวมรายหัก</span>
            <span className="text-lg font-extrabold text-red">
              {formatThaiNumber(salaryCalculation.deductions)} ฿
            </span>
          </div>
        )}
      </div>

      {data.note && (
        <div className="bg-gold-pale rounded-xl px-3.5 py-3 text-sm text-txt-mid border border-[#C9973A40]">
          <span className="inline-flex items-center gap-1">
            <IconNote size={14} strokeWidth={2.2} />
            หมายเหตุ: {data.note}
          </span>
        </div>
      )}

      <div className="text-center text-xs text-txt-soft mt-4">
        ข้อมูลกำหนดโดย ADMIN
      </div>

      {showCertModal && (
        <BaseModal onClose={() => setShowCertModal(false)}>
          <div className="bg-cream rounded-2xl p-5 w-full">
            <div className="text-lg font-bold text-maroon mb-1 flex items-center gap-1.5">
              <IconFileText size={18} strokeWidth={2.4} />
              พิมพ์ใบรับรองเงินเดือน
            </div>
            <div className="text-sm text-txt-mid mb-3.5">
              ระบุวัตถุประสงค์ — ข้อความจะถูกพิมพ์ลงในใบรับรอง
            </div>

            <div className="text-xs font-bold text-txt-soft uppercase tracking-wide mb-1.5">
              เลือกด่วน
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CERT_PURPOSE_OPTIONS.map((p) => {
                // preset ถือว่า active เฉพาะตอน user ยังไม่พิมพ์ custom
                const active = selectedPreset === p && !customPurpose.trim();
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(p);
                      setCustomPurpose("");
                    }}
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
              onClick={() => {
                setSelectedPreset(null);
                setCustomPurpose("");
              }}
              className={`w-full px-3 py-2 mb-4 rounded-lg text-sm font-semibold border-[1.5px] cursor-pointer font-[inherit] ${
                selectedPreset === null && !customPurpose.trim()
                  ? "bg-maroon text-white border-maroon"
                  : "bg-white text-txt-mid border-dashed border-bdr"
              }`}
            >
              — ไม่ระบุวัตถุประสงค์ —
            </button>

            <div className="text-xs font-bold text-txt-soft uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <IconPencil size={12} strokeWidth={2.4} />
              กำหนดเอง
            </div>
            <input
              type="text"
              value={customPurpose}
              onChange={(e) => setCustomPurpose(e.target.value)}
              placeholder="พิมพ์วัตถุประสงค์ที่ต้องการ..."
              className="w-full px-3 py-2.5 mb-4 rounded-lg border-[1.5px] border-bdr text-sm font-[inherit] bg-white outline-none focus:border-maroon"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-white text-txt-mid text-sm font-bold border border-bdr cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmPrintCert}
                disabled={issuingCert}
                className={`flex-1 py-2.5 rounded-lg bg-maroon text-white text-sm font-bold border-none font-[inherit] shadow-[0_3px_10px_var(--color-maroon)/0.25] ${issuingCert ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {issuingCert ? (
                    <>
                      <IconClock size={14} strokeWidth={2.4} />
                      กำลังออกเลขที่...
                    </>
                  ) : (
                    <>
                      <IconPrinter size={14} strokeWidth={2.4} />
                      พิมพ์
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </BaseModal>
      )}

      {showHistory &&
        (() => {
          const [y, mo] = selectedMonth.split("-");
          const label = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
          return (
            <AdvanceHistoryModal
              advanceRequests={monthAdvances}
              monthLabel={label}
              onClose={() => setShowHistory(false)}
            />
          );
        })()}

      {showPoolFlow && (
        <PoolFlowModal
          onClose={() => setShowPoolFlow(false)}
          isAdmin={false}
          currentEmployee={employeeInfo}
          employeeDirectory={employeeDirectory}
          salaryData={salaryData}
          allLeaves={allLeaves}
          roles={roles}
          initialMonth={selectedMonth}
          poolAdjustments={poolAdjustments}
          isConfirmed={!!payrollConfirms?.[selectedMonth]?.confirmedAt}
        />
      )}
    </div>
  );
}

const CERT_PURPOSE_OPTIONS = [
  "ยื่นกู้สินเชื่อ",
  "เปิดบัญชีธนาคาร",
  "ติดต่อราชการ",
  "ทำวีซ่า",
  "ขอเครดิตการ์ด",
  "ผ่อนสินค้า",
];

/* ─── Icon helpers ────────────────────────────────────────────── */

function PrintIcon() {
  return <IconPrinter size={12} strokeWidth={2.2} />;
}
