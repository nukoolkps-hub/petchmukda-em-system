import {
  ArrowLeft as IconArrowLeft,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarPlus as IconCalendarPlus,
  CirclePlus as IconCirclePlus,
  ClipboardList as IconClipboardList,
  Clock as IconClock,
  Diamond as IconDiamond,
  FileText as IconFileText,
  HandCoins as IconHandCoins,
  Lightbulb as IconLightbulb,
  Handshake as IconHandshake,
  Minus as IconMinus,
  Network as IconNetwork,
  StickyNote as IconNote,
  Package as IconPackage,
  Pencil as IconPencil,
  Plus as IconPlus,
  Printer as IconPrinter,
  Receipt as IconReceipt,
  RefreshCw as IconRefresh,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Ticket as IconTicket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../constants";
import {
  buildLoanContext,
  loanRemainingAsOfMonth,
} from "../../firebase/employeeLoans";
import { printSalaryCertificate } from "../../print/printSalaryCertificate";
import { printSalarySlip } from "../../print/printSalarySlip";
import {
  isLineWebview,
  openInExternalBrowser,
} from "../../print/webviewHelpers";
import { currentYearMonth, formatYmThai } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import {
  calculateSalary,
  computeExtraOpenSaturdayWorkedDates,
  computePoolSharesForGroup,
  getEffectiveBaseSalary,
  rolePaysPieceCommission,
} from "../../utils/salaryUtils";
import { buildSlipRowsCatalog } from "../../utils/slipRows";
import AdvanceHistoryModal from "../modals/AdvanceHistoryModal";
import PoolFlowModal from "../modals/PoolFlowModal";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";
import MonthChevronNav from "../shared/MonthChevronNav";

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
  // lookup ด้วย employeeId เสมอ — profile.name อาจไม่ตรง employee.name หลัง rename
  const employeeInfo = employeeDirectory.find(
    (employee) => employee.id === profileEmployeeId,
  );
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
    previewSalary,
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
        roles,
        poolAdjustment: poolAdjustments?.[selectedMonth] || null,
        poolGroup: employeeRole.poolGroup,
        storeCalendar,
      });
      employeePoolShare = shares[employeeInfo?.id];
    }
    // รายการยกเว้นค่าคอม "ระดับ piece" สำหรับพนักงานคนนี้ (multi-item)
    const monthExclusions = (poolAdjustments?.[selectedMonth]?.items || [])
      .filter(
        (it: any) => it.kind === "piece" && it.employeeId === salaryEmployeeId,
      )
      .map((it: any) => ({
        pieceItemId: it.pieceItemId,
        pieces: Number(it.pieces) || 0,
        label: it.label,
      }));
    const extraSatWorked = computeExtraOpenSaturdayWorkedDates(
      selectedMonth,
      storeCalendar,
      monthLeaves,
    );
    const computedSalary = calculateSalary(
      data,
      overQuotaInfo,
      employeeInfo,
      leaveDays,
      approvedAdvanceAmountTotal,
      employeePoolShare,
      employeeRole,
      buildLoanContext(employeeLoans, salaryEmployeeId, selectedMonth),
      monthExclusions,
      { workedDates: extraSatWorked },
    );
    // ถ้ายังไม่มี salary doc → คำนวณ preview จากข้อมูลที่มี (เงินเดือนพื้นฐาน +
    // โบนัสขยัน + เสาร์เปิดพิเศษ + หักลาเกินโควต้า) เพื่อให้พนักงานเห็นแรงจูงใจ
    // ก่อน ADMIN กรอกค่าคอม (โดยเฉพาะโบนัสแห่งความขยัน)
    const previewSalary = data
      ? null
      : calculateSalary(
          {},
          overQuotaInfo,
          employeeInfo,
          leaveDays,
          approvedAdvanceAmountTotal,
          null,
          employeeRole,
          buildLoanContext(employeeLoans, salaryEmployeeId, selectedMonth),
          null,
          { workedDates: extraSatWorked },
        );
    return {
      overInfo: overQuotaInfo,
      overTotalDays: overQuotaInfo.weekdays + overQuotaInfo.sundays,
      totalLeaveDays: leaveDays,
      monthApprovedAdvances: approvedAdvancesForMonth,
      approvedAdvanceTotal: approvedAdvanceAmountTotal,
      poolShare: employeePoolShare,
      salaryCalculation: computedSalary,
      previewSalary,
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
    // เปิด modal ให้เลือก "ทั้งหมด" หรือ "บางส่วน" ก่อนพิมพ์
    setShowSlipPrintModal(true);
  }

  function doPrintSlip(opts: {
    hiddenEarnIds?: Set<string>;
    hiddenDedIds?: Set<string>;
  }) {
    printSalarySlip({
      profile,
      employeeInfo,
      employeeRole,
      data,
      salaryCalculation,
      poolShare,
      selectedMonth,
      monthApprovedAdvances,
      hiddenEarnIds: opts.hiddenEarnIds,
      hiddenDedIds: opts.hiddenDedIds,
    });
  }

  const [showCertModal, setShowCertModal] = useState(false);
  const [showPoolFlow, setShowPoolFlow] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Slip print modal — ก่อนพิมพ์เลือก "ทั้งหมด" / "บางส่วน (เลือกรายการ)"
  // บางส่วน → tick ออกได้ทีละรายการ · ยอดที่ tick ออกจะถูกรวมไว้ใน
  // "รายรับอื่นๆ" / "รายการหักอื่นๆ" บนสลิป
  const [showSlipPrintModal, setShowSlipPrintModal] = useState(false);
  const [slipPrintMode, setSlipPrintMode] = useState<"full" | "partial">(
    "full",
  );
  const [hiddenSlipIds, setHiddenSlipIds] = useState<Set<string>>(new Set());
  // url สลิปโอนเงินกู้ที่กำลังเปิดดู · null = ไม่เปิด
  const [viewingLoanSlipUrl, setViewingLoanSlipUrl] = useState<string | null>(
    null,
  );
  // preset และ custom เก็บแยกกัน — custom (ถ้าพิมพ์) override preset
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    "ยื่นกู้สินเชื่อ",
  );
  const [customPurpose, setCustomPurpose] = useState("");
  // เงินเดือนที่จะใส่ในใบรับรอง · default = ปัจจุบัน (effective base) ·
  // ผู้ใช้แก้ลงได้ (เช่น ยื่นกู้บัตรเครดิตที่ไม่อยากโชว์ยอดเต็ม) แต่ห้ามเกิน
  // (server-side clamp ในตัว print function อีกชั้น)
  const [salaryOverrideText, setSalaryOverrideText] = useState("");

  function handlePrintCert() {
    // ใบรับรองเงินเดือนใช้ employeeInfo (เงินเดือนพื้นฐาน · ตำแหน่ง · ชื่อ ·
    // วันเริ่มงาน) จาก admin config — ไม่ต้องรอ salary doc รายเดือน
    // (printSalaryCertificate ใช้ employeeInfo.baseSalary ก่อน · data?.baseSalary
    // เป็น fallback เท่านั้น)
    if (!employeeInfo) {
      showToast?.("ไม่มีข้อมูลพนักงาน — ลองเข้าใหม่ภายหลัง");
      return;
    }
    setShowCertModal(true);
  }

  // listen header button (MobileHeader dispatches event เมื่อกด "ใบรับรอง")
  // ใช้ window event แทน prop drilling · header ไม่ต้องรู้จัก data/state
  useEffect(() => {
    const handler = () => handlePrintCert();
    window.addEventListener("openSalaryCert", handler);
    return () => window.removeEventListener("openSalaryCert", handler);
    // handlePrintCert ใช้ data จาก closure · re-attach ทุกครั้งที่ data เปลี่ยน
    // เพื่อให้ event handler มี data ล่าสุด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const [issuingCert, setIssuingCert] = useState(false);

  // เงินเดือนปัจจุบัน (effective) — เพดานยอด override ใน modal ใบรับรอง
  const certMaxSalary = employeeInfo
    ? getEffectiveBaseSalary({
        baseSalary: employeeInfo.baseSalary ?? 0,
        startWorkMonth: employeeInfo.startWorkMonth ?? null,
        annualRaiseAmount: employeeInfo.annualRaiseAmount ?? 0,
        annualRaises: employeeInfo.annualRaises ?? {},
      }) || 0
    : 0;
  // parse + clamp · 0 = ใช้ค่า default (effective)
  const salaryOverrideNum = (() => {
    const raw = parseFloat(salaryOverrideText.replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(raw, certMaxSalary);
  })();
  const salaryOverrideExceeds = (() => {
    const raw = parseFloat(salaryOverrideText.replace(/,/g, ""));
    return Number.isFinite(raw) && raw > certMaxSalary;
  })();

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
      // ส่ง override ถ้า user กรอก · ฟังก์ชัน print clamp อีกชั้น (defense)
      salaryOverride: salaryOverrideNum > 0 ? salaryOverrideNum : undefined,
    });
  }

  // เดือนนี้ admin ยืนยันยอดแล้วหรือยัง — ถ้ายัง ยังโชว์เงินเดือนรวมคร่าวๆ
  // ได้ (preview) แต่ banner เตือนชัดว่า "ยอดอาจเปลี่ยน" + ปิดปุ่มพิมพ์ +
  // PoolFlowModal ล็อกด้วย isConfirmed prop (ปิดแผนผังจนกว่าจะ confirm)
  const isMonthConfirmed = !!payrollConfirms?.[selectedMonth]?.confirmedAt;
  const selectedMonthLabel = formatYmThai(selectedMonth);

  // ใบรับรอง modal — render ที่เดียวกันในทุก state · ใช้ใน empty + main view
  // เพื่อให้ปุ่ม "ใบรับรอง" บน MobileHeader เปิด modal ได้แม้ยังไม่มี salary doc
  const certModal = showCertModal && (
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

        {/* เงินเดือนที่จะใส่ในใบ — default = ปัจจุบัน · ลดลงได้แต่ห้ามเกิน */}
        <div className="text-xs font-bold text-txt-soft uppercase tracking-wide mb-1.5">
          เงินเดือนที่จะระบุในใบรับรอง
        </div>
        <div className="relative mb-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-maroon font-bold">
            ฿
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={salaryOverrideText}
            onChange={(e) => setSalaryOverrideText(e.target.value)}
            placeholder={formatThaiNumber(certMaxSalary)}
            className={`w-full pl-8 pr-3 py-2.5 rounded-lg border-[1.5px] text-sm font-[inherit] bg-white outline-none ${salaryOverrideExceeds ? "border-red focus:border-red" : "border-bdr focus:border-maroon"}`}
          />
        </div>
        <div className="text-[11px] text-txt-soft mb-4">
          {salaryOverrideExceeds ? (
            <span className="text-red font-semibold">
              เกินเงินเดือนพื้นฐานปัจจุบัน · ระบบจะใช้ ฿
              {formatThaiNumber(certMaxSalary)} แทน
            </span>
          ) : salaryOverrideNum > 0 && salaryOverrideNum < certMaxSalary ? (
            <span>
              ระบุน้อยกว่าจริง · ปัจจุบัน ฿{formatThaiNumber(certMaxSalary)}
            </span>
          ) : (
            <span>
              เว้นว่าง = ใช้เงินเดือนพื้นฐานปัจจุบัน ฿
              {formatThaiNumber(certMaxSalary)} · ห้ามระบุมากกว่านี้
            </span>
          )}
        </div>

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
  );

  // ── Slip Print Options modal ─────────────────────────────────────
  // เปิดก่อนพิมพ์สลิป · 2 mode: full (ทุกรายการ) / partial (เลือก checkbox)
  // unticked items → รวมเป็น "รายรับอื่นๆ" / "รายการหักอื่นๆ" บนสลิป
  const slipCatalog = useMemo(() => {
    if (!data || !salaryCalculation)
      return { earnRows: [], dedRows: [] };
    return buildSlipRowsCatalog({
      data,
      salaryCalculation,
      employeeRole,
    });
  }, [data, salaryCalculation, employeeRole]);
  function toggleHidden(id: string) {
    setHiddenSlipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function closeSlipPrintModal() {
    setShowSlipPrintModal(false);
    setSlipPrintMode("full");
    setHiddenSlipIds(new Set());
  }
  function confirmPrintSlip() {
    const opts: {
      hiddenEarnIds?: Set<string>;
      hiddenDedIds?: Set<string>;
    } = {};
    if (slipPrintMode === "partial" && hiddenSlipIds.size > 0) {
      const earnIds = new Set<string>();
      const dedIds = new Set<string>();
      for (const id of hiddenSlipIds) {
        // "base" lock — เงินเดือนพื้นฐานต้องโชว์เสมอ · กันเคสที่ id หลุดเข้ามา
        if (id === "base") continue;
        if (slipCatalog.earnRows.some((r) => r.id === id)) earnIds.add(id);
        if (slipCatalog.dedRows.some((r) => r.id === id)) dedIds.add(id);
      }
      opts.hiddenEarnIds = earnIds;
      opts.hiddenDedIds = dedIds;
    }
    closeSlipPrintModal();
    doPrintSlip(opts);
  }
  const slipPrintModal = showSlipPrintModal && (
    <BaseModal onClose={closeSlipPrintModal} maxWidthClass="max-w-[460px]">
      <div className="bg-cream rounded-2xl p-5 w-full">
        <div className="text-lg font-bold text-maroon mb-1 flex items-center gap-1.5">
          <IconPrinter size={18} strokeWidth={2.4} />
          พิมพ์สลิปเงินเดือน
        </div>
        <div className="text-sm text-txt-mid mb-3.5">
          เลือกว่าจะให้แสดงรายการอะไรในสลิป — เงินสุทธิเท่าเดิม
        </div>

        {/* Mode picker — 2 radio buttons */}
        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSlipPrintMode("full")}
            className={`text-left px-3.5 py-3 rounded-xl border-[1.5px] cursor-pointer font-[inherit] ${
              slipPrintMode === "full"
                ? "bg-maroon text-white border-maroon"
                : "bg-white text-txt border-bdr"
            }`}
          >
            <div className="text-sm font-bold">รายละเอียดทั้งหมด</div>
            <div
              className={`text-xs mt-0.5 ${slipPrintMode === "full" ? "text-white/80" : "text-txt-soft"}`}
            >
              พิมพ์ทุกรายการที่ ADMIN ยืนยันแล้ว (ค่าเริ่มต้น)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSlipPrintMode("partial")}
            className={`text-left px-3.5 py-3 rounded-xl border-[1.5px] cursor-pointer font-[inherit] ${
              slipPrintMode === "partial"
                ? "bg-maroon text-white border-maroon"
                : "bg-white text-txt border-bdr"
            }`}
          >
            <div className="text-sm font-bold">รายละเอียดบางส่วน</div>
            <div
              className={`text-xs mt-0.5 ${slipPrintMode === "partial" ? "text-white/80" : "text-txt-soft"}`}
            >
              เลือกรายการที่ต้องการ · ที่เหลือรวมเป็น "อื่นๆ"
            </div>
          </button>
        </div>

        {/* Checklist — แสดงเฉพาะ partial mode */}
        {slipPrintMode === "partial" && (
          <div className="bg-white rounded-xl border border-bdr p-3 mb-4 max-h-[44vh] overflow-y-auto">
            {slipCatalog.earnRows.length > 0 && (
              <>
                <div className="text-xs font-bold text-green uppercase tracking-wide mb-2">
                  รายรับ
                </div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {slipCatalog.earnRows.map((r) => (
                    <SlipRowCheckbox
                      key={r.id}
                      row={r}
                      checked={r.id === "base" || !hiddenSlipIds.has(r.id)}
                      locked={r.id === "base"}
                      onToggle={() => toggleHidden(r.id)}
                    />
                  ))}
                </div>
              </>
            )}
            {slipCatalog.dedRows.length > 0 && (
              <>
                <div className="text-xs font-bold text-red uppercase tracking-wide mb-2">
                  รายการหัก
                </div>
                <div className="flex flex-col gap-1.5">
                  {slipCatalog.dedRows.map((r) => (
                    <SlipRowCheckbox
                      key={r.id}
                      row={r}
                      checked={!hiddenSlipIds.has(r.id)}
                      onToggle={() => toggleHidden(r.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeSlipPrintModal}
            className="flex-1 py-2.5 rounded-lg bg-white text-txt-mid text-sm font-bold border border-bdr cursor-pointer font-[inherit]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirmPrintSlip}
            className="flex-1 py-2.5 rounded-lg bg-maroon text-white text-sm font-bold border-none cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5"
          >
            <IconPrinter size={14} strokeWidth={2.4} />
            พิมพ์
          </button>
        </div>
      </div>
    </BaseModal>
  );

  if (!data || !salaryCalculation) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="text-sm text-txt-soft flex-1">สลิปเงินเดือน</div>
          <MonthChevronNav
            months={selectMonths}
            selected={selectedMonth}
            onSelect={setSelectedMonth}
          />
        </div>
        {/* Banner: รอ ADMIN ยืนยันยอด */}
        <div className="bg-amber-50 border border-amber-300 rounded-[14px] px-4 py-3 mb-3 flex items-start gap-2.5">
          <IconLightbulb
            size={18}
            strokeWidth={2.4}
            className="text-amber-800 shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-900 mb-0.5">
              รอ ADMIN ยืนยันยอด
            </div>
            <div className="text-xs text-amber-800/90 leading-relaxed">
              ค่าคอมขาย + รายการที่ ADMIN กรอกเอง จะเพิ่มหลังยืนยันยอด ·
              ตอนนี้เห็นได้แต่ที่ระบบรู้แล้ว
            </div>
            {months.includes(currentYM) && selectedMonth !== currentYM && (
              <button
                onClick={() => setSelectedMonth(currentYM)}
                className="mt-2 px-3 py-1 rounded-[8px] border-none bg-maroon text-white text-xs font-bold cursor-pointer font-[inherit] inline-flex items-center gap-1.5"
              >
                <IconArrowLeft size={11} strokeWidth={2.5} />
                กลับไปเดือนปัจจุบัน
              </button>
            )}
          </div>
        </div>

        {/* Net salary card — เงินประมาณการสุทธิ */}
        {previewSalary && (
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
              <div className="text-sm text-gold-lt/65 flex items-center gap-1.5">
                เงินประมาณการสุทธิ
                <span className="text-[9px] font-bold px-1.5 py-px rounded-[10px] bg-amber-200/25 text-gold-lt border border-amber-200/40">
                  preview
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold text-gold-lt tracking-[-0.02em]">
                  {formatThaiNumber(previewSalary.netSalary ?? 0)} ฿
                </span>
              </div>
              <div className="flex gap-3.5 mt-3.5 pt-3.5 border-t border-gold-lt/12">
                <div>
                  <div className="text-xs text-gold-lt/50">รวมรายรับ</div>
                  <div className="text-base font-bold text-[#7EE8B5]">
                    + {formatThaiNumber(previewSalary.earnings)} ฿
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gold-lt/50">รวมรายหัก</div>
                  <div className="text-base font-bold text-[#FFB4A3]">
                    − {formatThaiNumber(previewSalary.deductions)} ฿
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bank info card */}
        {(employeeInfo?.bank || employeeInfo?.bankAccountNumber) && (
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
        )}

        {/* Advance row + Print panel — empty state:
            เบิกเงิน enabled (รู้ baseSalary แล้ว · 50% cap) ·
            สลิป + ใบรับรอง disabled (รอ ADMIN ยืนยันยอด) */}
        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          {/* Left col: เบิกเงิน + ประวัติเบิกเงิน — stacked */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onOpenAdvance}
              className="bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-3.5 py-3 border-none cursor-pointer font-[inherit] shadow-[0_3px_12px_var(--color-maroon)/0.25] text-left relative overflow-hidden active:scale-[0.97] transition-transform duration-100 ease-out"
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
              className="bg-white rounded-[14px] px-3.5 py-3 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(90,30,10,0.06)] text-left relative border-[1.5px] border-[#C9973A50] active:scale-[0.97] transition-transform duration-100 ease-out"
            >
              <div className="flex items-center gap-2">
                <div className="w-[34px] h-[34px] rounded-[10px] bg-gold-pale flex items-center justify-center shrink-0 border border-[#C9973A40]">
                  <IconClock
                    size={17}
                    color={COLORS.maroon}
                    strokeWidth={2.2}
                  />
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

          {/* Right col: Print panel — สลิปเงินเดือน (disabled · รอยืนยันยอด)
              label centered + ปุ่มพิมพ์ บรรทัดล่าง */}
          <div className="flex flex-col gap-2 px-3 py-2.5 rounded-[14px] bg-gold-pale/20 border border-gold/15">
            <div className="text-sm text-txt-mid font-semibold flex items-center justify-center gap-1.5">
              <IconClipboardList size={14} strokeWidth={2.4} />
              สลิปเงินเดือน
            </div>
            <button
              type="button"
              disabled
              title="รอยืนยันยอด"
              className="w-full px-3.5 py-2 rounded-lg text-sm font-bold font-[inherit] flex items-center justify-center gap-1.5 border-[1.5px] bg-bdr/30 text-txt-soft border-bdr cursor-not-allowed"
            >
              <IconClock size={14} strokeWidth={2.4} />
              พิมพ์
            </button>
            <div className="text-[11px] text-txt-soft leading-snug mt-auto pt-1 flex items-start gap-1">
              <IconLightbulb
                size={12}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-gold"
              />
              <span>เปิดได้หลัง ADMIN ยืนยันยอด</span>
            </div>
          </div>
        </div>

        {/* เงินกู้ของคุณ (ถ้ามี) */}
        {(() => {
          const myLoans = (employeeLoans || []).filter(
            (l) =>
              l.employeeId === salaryEmployeeId && l.status !== "cancelled",
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
                <div className="font-bold text-base text-txt">
                  เงินกู้ของคุณ
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {myLoans.map((loan) => {
                  const remaining = loanRemainingAsOfMonth(
                    loan,
                    selectedMonth,
                  );
                  const paid = (loan.principal || 0) - remaining;
                  const pct =
                    loan.principal > 0
                      ? Math.min(
                          100,
                          Math.round((paid / loan.principal) * 100),
                        )
                      : 0;
                  const thisMonth =
                    previewSalary?.loanBreakdown?.find(
                      (b: any) => b.id === loan.id,
                    )?.amount || 0;
                  const done = remaining <= 0;
                  return (
                    <div
                      key={loan.id}
                      className="bg-cream rounded-[10px] p-3 border border-bdr"
                    >
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-txt truncate">
                            {loan.note || "เงินกู้"}
                          </div>
                          {done ? (
                            <span className="text-xs font-bold text-green">
                              ผ่อนครบแล้ว
                            </span>
                          ) : thisMonth > 0 ? (
                            <span className="text-xs font-semibold text-red">
                              เดือนนี้หัก − {formatThaiNumber(thisMonth)} ฿
                            </span>
                          ) : null}
                        </div>
                        {loan.slipImageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingLoanSlipUrl(loan.slipImageUrl)
                            }
                            aria-label="ดูสลิปโอนเงิน"
                            title="สลิปโอนเงิน"
                            className="shrink-0 inline-flex items-center gap-1 px-2 h-8 rounded-[9px] bg-maroon text-white text-xs font-bold cursor-pointer border-none font-[inherit] shadow-[0_2px_8px_rgba(123,28,28,0.2)]"
                          >
                            <IconReceipt size={13} strokeWidth={2.4} />
                            สลิป
                          </button>
                        )}
                      </div>
                      <div className="h-1.5 rounded-full bg-cream-dk overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-maroon rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-txt-soft">
                        <span>
                          ผ่อนเดือนละ{" "}
                          {formatThaiNumber(loan.monthlyDeduction)} ฿
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

        {/* รายรับ — เน้นโบนัสขยัน · ซ่อนรายการ ≤ 0 */}
        {previewSalary && (
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-green" />
              <div className="font-bold text-base text-txt">รายรับ</div>
              <div className="ml-auto text-xs font-semibold text-txt-soft">
                {selectedMonthLabel}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {/* base */}
              <div className="flex items-center gap-2.5 py-1.5">
                <IconBriefcase
                  size={16}
                  strokeWidth={2.2}
                  color={COLORS.green}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-txt-mid">เงินเดือนพื้นฐานปัจจุบัน</div>
                  <div className="text-[11px] text-txt-soft">
                    เรท/วัน ={" "}
                    {formatThaiNumber(
                      Math.round(previewSalary.dailySalaryRate),
                    )}{" "}
                    ฿
                  </div>
                </div>
                <span className="text-base font-semibold text-green whitespace-nowrap">
                  + {formatThaiNumber(previewSalary.baseSalary)} ฿
                </span>
              </div>

              {/* attendance bonus — highlight ชัด */}
              <div
                className={`rounded-[10px] px-3 py-3 leading-[1.7] border ${
                  previewSalary.attendanceBonus > 0
                    ? "bg-green-lt border-[#1A6B3A30]"
                    : "bg-cream border-bdr"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <IconStar size={16} strokeWidth={2.4} color={COLORS.green} />
                  <div className="text-sm font-bold text-txt flex-1">
                    โบนัสแห่งความขยัน (ไม่หยุด)
                  </div>
                  <span
                    className={`text-base font-bold whitespace-nowrap ${
                      previewSalary.attendanceBonus > 0
                        ? "text-green"
                        : "text-txt-soft"
                    }`}
                  >
                    +{" "}
                    {formatThaiNumber(previewSalary.attendanceBonus || 0)}{" "}
                    ฿
                  </span>
                </div>
                <div className="text-xs text-txt-mid leading-relaxed pl-6">
                  ลาวันธรรมดาเดือนนี้:{" "}
                  <b
                    className={
                      previewSalary.leaveDays >= 2
                        ? "text-red"
                        : "text-green"
                    }
                  >
                    {previewSalary.leaveDays} วัน
                  </b>
                  <br />
                  <span className="text-[11px] text-txt-soft">
                    ลา 0 วัน → +
                    {formatThaiNumber(
                      Math.round(previewSalary.dailySalaryRate * 2),
                    )}{" "}
                    ฿ · ลา 1 วัน → +
                    {formatThaiNumber(
                      Math.round(previewSalary.dailySalaryRate),
                    )}{" "}
                    ฿ · ลา 2+ วัน → ไม่ได้โบนัส
                  </span>
                </div>
              </div>

              {/* เงินค่าแทน (coverage) — ใน preview = 0 เสมอ (admin stamp ตอน
                  save salary doc · ก่อนนั้นไม่มีค่า) — บรรทัด render อยู่ใน
                  final slip rows ที่อ่าน salaryCalculation.coveragePay แทน */}

              {/* Saturday bonus (ถ้ามี) */}
              {(previewSalary.extraOpenSaturdayBonus || 0) > 0 && (
                <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk">
                  <IconCalendarPlus
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.green}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-txt-mid">
                      เสาร์เปิดพิเศษ
                    </div>
                    <div className="text-[11px] text-txt-soft">
                      {previewSalary.extraOpenSaturdayDays} วัน ×{" "}
                      {formatThaiNumber(
                        Math.round(previewSalary.dailySalaryRate),
                      )}{" "}
                      ฿
                    </div>
                  </div>
                  <span className="text-base font-semibold text-green whitespace-nowrap">
                    +{" "}
                    {formatThaiNumber(previewSalary.extraOpenSaturdayBonus)}{" "}
                    ฿
                  </span>
                </div>
              )}

              {/* รายรับประจำ (recurring incomes) */}
              {(previewSalary.recurringIncomes || []).map(
                (it: any, i: number) => (
                  <div
                    key={`ri-${i}-${it.label}`}
                    className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk"
                  >
                    <IconPlus
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.green}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-txt-mid">{it.label}</div>
                      <div className="text-[11px] text-txt-soft">
                        รายรับประจำเดือน
                      </div>
                    </div>
                    <span className="text-base font-semibold text-green whitespace-nowrap">
                      + {formatThaiNumber(it.amount)} ฿
                    </span>
                  </div>
                ),
              )}

            </div>
            <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
              <span className="text-sm font-bold text-txt">รวมรายรับ</span>
              <span className="text-lg font-extrabold text-green">
                + {formatThaiNumber(previewSalary.earnings)} ฿
              </span>
            </div>
          </div>
        )}

        {/* รายการหัก — เฉพาะถ้ามีจริง (deductions > 0) */}
        {previewSalary && previewSalary.deductions > 0 && (
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-red" />
              <div className="font-bold text-base text-txt">รายการหัก</div>
            </div>
            <div className="flex flex-col gap-2.5">
              {previewSalary.socialSecurity > 0 && (
                <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk">
                  <IconBuildingBank
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.red}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-txt-mid">หักประกันสังคม</div>
                    <div className="text-[11px] text-txt-soft">หักรายเดือน</div>
                  </div>
                  <span className="text-base font-semibold text-red whitespace-nowrap">
                    − {formatThaiNumber(previewSalary.socialSecurity)} ฿
                  </span>
                </div>
              )}
              {previewSalary.overQuotaDeduction > 0 && (
                <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk">
                  <IconClipboardList
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.red}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-txt-mid">
                      หักลาเกินโควต้า
                    </div>
                    <div className="text-[11px] text-txt-soft">
                      เกินวันธรรมดา {previewSalary.weekdayOverQuotaDays} +
                      อาทิตย์ {previewSalary.sundayOverQuotaDays} วัน
                    </div>
                  </div>
                  <span className="text-base font-semibold text-red whitespace-nowrap">
                    − {formatThaiNumber(previewSalary.overQuotaDeduction)} ฿
                  </span>
                </div>
              )}
              {previewSalary.advanceDeduction > 0 && (
                <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk">
                  <IconBanknote
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.red}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-txt-mid">หักเงินเบิกล่วงหน้า</div>
                    <div className="text-[11px] text-txt-soft">
                      หักเงินที่เบิกไปก่อน
                    </div>
                  </div>
                  <span className="text-base font-semibold text-red whitespace-nowrap">
                    − {formatThaiNumber(previewSalary.advanceDeduction)} ฿
                  </span>
                </div>
              )}
              {previewSalary.loanDeduction > 0 && (
                <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk">
                  <IconHandCoins
                    size={16}
                    strokeWidth={2.2}
                    color={COLORS.red}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-txt-mid">หักผ่อนเงินกู้</div>
                    <div className="text-[11px] text-txt-soft">
                      หักตามรอบที่ตั้งไว้
                    </div>
                  </div>
                  <span className="text-base font-semibold text-red whitespace-nowrap">
                    − {formatThaiNumber(previewSalary.loanDeduction)} ฿
                  </span>
                </div>
              )}
              {/* รายการหักประจำเดือน — อยู่ล่างสุดเสมอตามที่ ADMIN ขอ */}
              {(previewSalary.recurringDeductions || []).map(
                (it: any, i: number) => (
                  <div
                    key={`rd-${i}-${it.label}`}
                    className="flex items-center gap-2.5 py-2 border-b border-dashed border-cream-dk"
                  >
                    <IconMinus
                      size={16}
                      strokeWidth={2.2}
                      color={COLORS.red}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-txt-mid">{it.label}</div>
                      <div className="text-[11px] text-txt-soft">
                        หักประจำเดือน
                      </div>
                    </div>
                    <span className="text-base font-semibold text-red whitespace-nowrap">
                      − {formatThaiNumber(it.amount)} ฿
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
              <span className="text-sm font-bold text-txt">รวมรายหัก</span>
              <span className="text-lg font-extrabold text-red">
                − {formatThaiNumber(previewSalary.deductions)} ฿
              </span>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-txt-soft mt-2">
          * ค่าคอม + รายการที่ ADMIN กรอกเอง จะเพิ่มหลังยืนยันยอด
        </div>

        {/* AdvanceHistoryModal + Cert Modal · ใช้ใน empty state ด้วย ·
            ถ้าไม่ render ที่นี่ ปุ่มจะกดแล้วไม่มีอะไรเกิดขึ้น */}
        {showHistory && (
          <AdvanceHistoryModal
            advanceRequests={monthAdvances}
            monthLabel={formatYmThai(selectedMonth)}
            onClose={() => setShowHistory(false)}
          />
        )}
        {certModal}
        {slipPrintModal}
        {/* Loan slip modal · ปุ่ม "สลิป" บน loan card อยู่ใน early return นี้
            ด้วย ถ้าไม่ render ที่นี่ พนักงานที่ยังไม่มี salary doc กดแล้วไม่ขึ้น */}
        {viewingLoanSlipUrl && (
          <BaseModal
            onClose={() => setViewingLoanSlipUrl(null)}
            maxWidthClass="max-w-[500px]"
            contentClassName="px-4 pt-4 pb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <IconReceipt
                size={18}
                strokeWidth={2.2}
                className="text-maroon"
              />
              <div className="font-bold text-base text-txt">สลิปโอนเงิน</div>
            </div>
            <img
              src={viewingLoanSlipUrl}
              alt="สลิปโอนเงิน"
              className="block w-full rounded-[10px] border border-bdr"
            />
          </BaseModal>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* month selector + ปุ่มแผนผังเงินเดือน — บนสุด
          แผนผังโผล่เฉพาะ pool sales · ใบรับรองอยู่ main header (MobileHeader) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {employeeRole?.poolGroup ? (
          <button
            type="button"
            onClick={() => setShowPoolFlow(true)}
            title="แผนผังเงินเดือน"
            className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] border border-bdr bg-cream cursor-pointer text-sm font-semibold text-maroon font-[inherit]"
          >
            <IconNetwork size={14} strokeWidth={2.4} />
            แผนผังเงินเดือน
          </button>
        ) : (
          <div />
        )}
        <MonthChevronNav
          months={selectMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
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
            พิมพ์สลิป/ใบรับรอง
            {employeeRole?.poolGroup ? " + แผนผังเงินเดือน" : ""} เปิดได้หลังยืนยันยอด
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
        {/* Left col: เบิกเงิน + ประวัติเบิกเงิน — stacked
            เบิกเงิน disabled หลัง ADMIN ยืนยันยอด (รอบนั้นจบแล้ว) */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onOpenAdvance}
            disabled={isMonthConfirmed}
            title={isMonthConfirmed ? "ยืนยันยอดแล้ว — เบิกเงินรอบใหม่" : ""}
            className={`rounded-[14px] px-3.5 py-3 border-none font-[inherit] text-left relative overflow-hidden transition-transform duration-100 ease-out ${
              isMonthConfirmed
                ? "bg-bdr/30 cursor-not-allowed"
                : "bg-linear-135 from-maroon to-maroon-lt cursor-pointer shadow-[0_3px_12px_var(--color-maroon)/0.25] active:scale-[0.97]"
            }`}
          >
            <svg
              className={`absolute -top-1.5 -right-1.5 ${isMonthConfirmed ? "opacity-5" : "opacity-15"}`}
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill={COLORS.goldLight}
            >
              <path d="M6 3h12l4 6-10 12L2 9z" />
            </svg>
            <div className="flex items-center gap-2 relative">
              <div
                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ${
                  isMonthConfirmed ? "bg-bdr/40" : "bg-white/18"
                }`}
              >
                <IconCirclePlus
                  size={17}
                  color={isMonthConfirmed ? COLORS.textSoft : COLORS.goldLight}
                  strokeWidth={2.4}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-bold leading-tight ${isMonthConfirmed ? "text-txt-soft" : "text-gold-lt"}`}
                >
                  เบิกเงิน
                </div>
                <div
                  className={`text-xs mt-px ${isMonthConfirmed ? "text-txt-soft/70" : "text-gold-lt/65"}`}
                >
                  {isMonthConfirmed ? "ยืนยันยอดแล้ว" : "ล่วงหน้า"}
                </div>
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

        {/* Right col: Print panel — สลิปเงินเดือน · label centered + ปุ่มบรรทัดล่าง */}
        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-[14px] bg-gold-pale/20 border border-gold/15">
          <div className="text-sm text-txt-mid font-semibold flex items-center justify-center gap-1.5">
            <IconClipboardList size={14} strokeWidth={2.4} />
            สลิปเงินเดือน
          </div>
          <button
            type="button"
            onClick={handlePrintSlip}
            disabled={!isMonthConfirmed}
            title={isMonthConfirmed ? "พิมพ์ / บันทึก PDF" : "รอยืนยันยอด"}
            className={`w-full px-3.5 py-2 rounded-lg text-sm font-bold font-[inherit] flex items-center justify-center gap-1.5 border-[1.5px] ${
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
                // remaining ณ สิ้นเดือนที่ดู (snapshot) — ไม่นับ repayments
                // ของเดือนอนาคต เลื่อนดูเดือนเก่าเห็นภาพชัดเจน
                const remaining = loanRemainingAsOfMonth(loan, selectedMonth);
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
                    <div className="flex items-start justify-between mb-1.5 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-txt truncate">
                          {loan.note || "เงินกู้"}
                        </div>
                        {done ? (
                          <span className="text-xs font-bold text-green">
                            ผ่อนครบแล้ว
                          </span>
                        ) : thisMonth > 0 ? (
                          <span className="text-xs font-semibold text-red">
                            เดือนนี้หัก − {formatThaiNumber(thisMonth)} ฿
                          </span>
                        ) : null}
                      </div>
                      {loan.slipImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingLoanSlipUrl(loan.slipImageUrl)
                          }
                          aria-label="ดูสลิปโอนเงิน"
                          title="สลิปโอนเงิน"
                          className="shrink-0 inline-flex items-center gap-1 px-2 h-8 rounded-[9px] bg-maroon text-white text-xs font-bold cursor-pointer border-none font-[inherit] shadow-[0_2px_8px_rgba(123,28,28,0.2)]"
                        >
                          <IconReceipt size={13} strokeWidth={2.4} />
                          สลิป
                        </button>
                      )}
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
                color={COLORS.green}
              />
            ),
            main: "เงินเดือนพื้นฐานปัจจุบัน",
            sub: "",
            value: salaryCalculation.baseSalary,
          },
          // ตำแหน่งไม่มีค่าคอมรายชิ้น → ไม่ใส่ rows ของ piece + invite/transfer
          ...(!rolePaysPieceCommission(employeeRole)
            ? []
            : salaryCalculation.usesSinglePieceRate
              ? // multi-item — 1 แถวต่อรายการค่าคอม · ถ้ามี exclusion พ่วง
                // "หัก N ชิ้น (เหตุผล1, เหตุผล2)" ใน sub ให้พนักงานเห็นเหตุผล
                (salaryCalculation.pieceBreakdown || []).map((item) => {
                  let sub = `${item.pieces} ชิ้น × ${formatThaiNumber(item.rate)} ฿`;
                  if ((item.excluded || 0) > 0) {
                    const reasons = (item.exclusionEntries || [])
                      .map((ex) => ex.label.trim())
                      .filter((l) => l.length > 0)
                      .join(", ");
                    sub += ` · หัก ${formatThaiNumber(item.excluded)} ชิ้น`;
                    if (reasons) sub += ` (${reasons})`;
                  }
                  return {
                    icon: (
                      <IconPackage
                        size={16}
                        strokeWidth={2.2}
                        color={COLORS.green}
                      />
                    ),
                    main: item.label,
                    sub,
                    value: item.amount,
                  };
                })
              : (salaryCalculation.poolItemsBreakdown || []).map((it: any) => {
                  // sub text: pool item → กองกลาง + share% · personal → pieces × rate
                  const itemShare = poolShare?.itemShares?.[it.id];
                  const itemPool = poolShare?.totalItemPool?.[it.id];
                  const itemGross = poolShare?.grossItemPool?.[it.id];
                  let sub: string;
                  if (it.kind === "pool" && itemShare && itemPool != null) {
                    const excluded = (itemGross ?? 0) - (itemPool ?? 0);
                    const poolStr =
                      excluded > 0
                        ? `${itemGross} − ${excluded} = ${itemPool}`
                        : `${itemPool}`;
                    sub = `กองกลาง ${poolStr} ชิ้น · ได้ ${itemShare.finalSharePercent.toFixed(2)}% = ${it.pieces.toFixed(1)} ชิ้น × ${formatThaiNumber(it.rate)} ฿`;
                  } else {
                    sub = `${it.pieces} ชิ้น × ${formatThaiNumber(it.rate)} ฿`;
                  }
                  const Icon =
                    it.id === "buy"
                      ? IconShoppingBag
                      : it.id === "special"
                        ? IconSparkles
                        : IconDiamond;
                  return {
                    icon: (
                      <Icon
                        size={16}
                        strokeWidth={2.2}
                        color={COLORS.green}
                      />
                    ),
                    main: `ค่าคอม${it.label}`,
                    sub,
                    value: it.amount,
                  };
                })),
          // โบนัสอื่นๆ (multi-item) — role กำหนดรายการ (bonusItems != []) · ไม่
          // ผูกกับ piece commission · ลูปแสดงทุก item ที่มี amount > 0
          ...(salaryCalculation.bonusBreakdown || [])
            .filter((b) => b.amount > 0)
            .map((b) => ({
              icon: (
                <IconTicket size={16} strokeWidth={2.2} color={COLORS.green} />
              ),
              main: `โบนัส${b.label}`,
              sub: `${b.pieces} ครั้ง × ${formatThaiNumber(b.rate)} ฿`,
              value: b.amount,
            })),
          {
            icon: <IconStar size={16} strokeWidth={2.2} color={COLORS.green} />,
            main: "โบนัสแห่งความขยัน (ไม่หยุด)",
            sub:
              salaryCalculation.leaveDays <= 2
                ? `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน → ${salaryCalculation.bonusDays} วัน × ${formatThaiNumber(Math.round(salaryCalculation.dailySalaryRate))} ฿`
                : `ลาวันธรรมดา ${salaryCalculation.leaveDays} วัน — ไม่ได้รับโบนัส`,
            value: salaryCalculation.attendanceBonus,
          },
          {
            icon: (
              <IconCalendarPlus
                size={16}
                strokeWidth={2.2}
                color={COLORS.green}
              />
            ),
            main: "เสาร์เปิดพิเศษ",
            sub:
              salaryCalculation.extraOpenSaturdayDays > 0
                ? `${salaryCalculation.extraOpenSaturdayDays} วัน × ${formatThaiNumber(Math.round(salaryCalculation.dailySalaryRate))} ฿`
                : "",
            value: salaryCalculation.extraOpenSaturdayBonus,
          },
          {
            icon: (
              <IconHandshake
                size={16}
                strokeWidth={2.2}
                color={COLORS.green}
              />
            ),
            main: "เงินค่าแทน",
            sub:
              Array.isArray(data.coveragePayBreakdown) &&
              data.coveragePayBreakdown.length > 0
                ? data.coveragePayBreakdown
                    .map(
                      (b: {
                        dutyName: string;
                        count: number;
                        rate: number;
                      }) =>
                        `${b.dutyName} ${b.count}×${formatThaiNumber(b.rate)}`,
                    )
                    .join(" · ")
                : "แทนคนลาเดือนนี้",
            value: salaryCalculation.coveragePay || 0,
          },
          ...(Array.isArray(data.customEarnings)
            ? data.customEarnings.map((e) => ({
                icon: (
                  <IconPlus size={16} strokeWidth={2.2} color={COLORS.green} />
                ),
                main: e.label || "รายการรายรับ",
                sub: "",
                value: e.amount,
              }))
            : []),
          // รายรับประจำเดือน — อยู่ล่างสุดเสมอตามที่ ADMIN ขอ
          ...(salaryCalculation.recurringIncomes || []).map(
            (it: { label: string; amount: number }) => ({
              icon: (
                <IconPlus size={16} strokeWidth={2.2} color={COLORS.green} />
              ),
              main: it.label || "รายรับประจำ",
              sub: "รายรับประจำเดือน",
              value: it.amount,
            }),
          ),
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
          // หักประจำเดือน — อยู่ล่างสุดเสมอตามที่ ADMIN ขอ
          ...(salaryCalculation.recurringDeductions || []).map(
            (it: { label: string; amount: number }) => ({
              icon: (
                <IconMinus size={16} strokeWidth={2.2} color={COLORS.red} />
              ),
              main: it.label || "หักประจำ",
              sub: "รายการหักประจำเดือน",
              value: it.amount,
            }),
          ),
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

      {certModal}
      {slipPrintModal}

      {showHistory &&
        (() => {
          return (
            <AdvanceHistoryModal
              advanceRequests={monthAdvances}
              monthLabel={formatYmThai(selectedMonth)}
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

      {viewingLoanSlipUrl && (
        <BaseModal
          onClose={() => setViewingLoanSlipUrl(null)}
          maxWidthClass="max-w-[500px]"
          contentClassName="px-4 pt-4 pb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <IconReceipt
              size={18}
              strokeWidth={2.2}
              className="text-maroon"
            />
            <div className="font-bold text-base text-txt">สลิปโอนเงิน</div>
          </div>
          <img
            src={viewingLoanSlipUrl}
            alt="สลิปโอนเงิน"
            className="block w-full rounded-[10px] border border-bdr"
          />
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
  "ขอเครดิตการ์ด",
  "ผ่อนสินค้า",
];

/* ─── Slip Print Modal checkbox row ───────────────────────────── */

function SlipRowCheckbox({
  row,
  checked,
  locked,
  onToggle,
}: {
  row: { id: string; label: string; sublabel?: string; value: number };
  checked: boolean;
  /** locked = ติ๊กออกไม่ได้ (เช่น เงินเดือนพื้นฐาน · ฟิลด์หลักต้องโชว์เสมอ) */
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${
        locked
          ? "bg-cream/70 border-bdr cursor-not-allowed"
          : checked
            ? "bg-cream border-bdr cursor-pointer"
            : "bg-white border-bdr/40 opacity-60 cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={locked ? undefined : onToggle}
        className={`w-4 h-4 accent-maroon ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-txt truncate">
          {row.label}
          {locked && (
            <span className="ml-1.5 text-[10px] font-normal text-txt-soft">
              (บังคับแสดง)
            </span>
          )}
        </div>
        {row.sublabel && (
          <div className="text-[10px] text-txt-soft truncate">
            {row.sublabel}
          </div>
        )}
      </div>
      <div className="text-sm font-bold text-maroon shrink-0 tabular-nums">
        {row.value.toLocaleString("th-TH")} ฿
      </div>
    </label>
  );
}

/* ─── Icon helpers ────────────────────────────────────────────── */

function PrintIcon() {
  return <IconPrinter size={12} strokeWidth={2.2} />;
}
