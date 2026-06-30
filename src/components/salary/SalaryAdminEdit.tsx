import {
  AlertTriangle as IconAlertTriangle,
  Ban as IconBan,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarPlus as IconCalendarPlus,
  Check as IconCheck,
  ClipboardList as IconClipboardList,
  Diamond as IconDiamond,
  HandCoins as IconHandCoins,
  Handshake as IconHandshake,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  Minus as IconMinus,
  Network as IconNetwork,
  Package as IconPackage,
  Plus as IconPlus,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Ticket as IconTicket,
  Trash2 as IconTrash,
  TrendingDown as IconTrendingDown,
  X as IconX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../constants";
import { buildLoanContext } from "../../firebase/employeeLoans";
import { useApprovedAdvancesByMonth } from "../../firebase/hooks/useFirestore";
import { currentYearMonth, formatYmThai } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import {
  countWeekdayLeaves,
  getOverQuotaDays,
  leaveOverlapsMonth,
} from "../../utils/leaveUtils";
import { getPayrollLock, isMonthLocked } from "../../utils/payrollLock";
import {
  calculateSalary,
  computeExtraOpenSaturdayWorkedDates,
  computePoolSharesForGroup,
  resolvePoolExclusionItemIds,
  resolvePoolItemPieces,
  resolvePoolItemRate,
  rolePaysPieceCommission,
  rolePoolItems,
  rolePrimaryPoolItemId,
} from "../../utils/salaryUtils";
import PoolFlowModal from "../modals/PoolFlowModal";
import BaseModal from "../shared/BaseModal";
import MoneyInput from "../shared/MoneyInput";
import MonthChevronNav from "../shared/MonthChevronNav";
import Spinner from "../shared/Spinner";
import EmployeeCardGrid from "./EmployeeCardGrid";
import PoolAdjustmentModal from "./PoolAdjustmentModal";

/* ─── การ์ดรายการประจำเดือน (read-only) ─────────────────────────────
   รายรับ/หักประจำที่ engine แตกออกมา · admin แก้/ลบที่หน้า "พนักงาน"
   income = เขียว + IconPlus + "+" · deduction = แดง + IconMinus + "−"   */
function RecurringRow({
  item,
  kind,
}: {
  item: { label: string; amount: number };
  kind: "income" | "deduction";
}) {
  const isIncome = kind === "income";
  const toneClass = isIncome ? "text-green" : "text-red";
  return (
    <div className="bg-cream/50 rounded-[12px] p-3 mt-2.5 border border-dashed border-bdr">
      <div className={`font-bold mb-1 flex items-center gap-1.5 ${toneClass}`}>
        {isIncome ? (
          <IconPlus size={14} strokeWidth={2.4} />
        ) : (
          <IconMinus size={14} strokeWidth={2.4} />
        )}
        {item.label}
        <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
          ประจำเดือน
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-txt-soft">
          {isIncome ? "รายรับประจำจากข้อมูลพนักงาน" : "หักประจำจากข้อมูลพนักงาน"}
        </span>
        <span
          className={`text-base font-semibold whitespace-nowrap ${toneClass}`}
        >
          {isIncome ? "+" : "−"} {formatThaiNumber(item.amount)} ฿
        </span>
      </div>
    </div>
  );
}

/* ─── Salary Admin Edit ────────────────────────────────────────── */
export default function SalaryAdminEdit({
  employeeDirectory,
  salaryData,
  setSalaryData,
  onSaveSalary,
  allLeaves,
  advanceRequests,
  roles,
  payrollConfirms,
  poolAdjustments,
  onSetPoolAdjustment,
  employeeLoans,
  storeCalendar,
  setUnsavedDirty,
  // เดือนที่ดู (controlled โดย AdminPanel) — share กับ section อื่น
  selectedMonth,
  onSelectMonth,
  showToast,
}) {
  const currentYM = currentYearMonth();
  const setSelectedMonth = onSelectMonth;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    employeeDirectory[0]?.id || "",
  );
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPoolFlow, setShowPoolFlow] = useState(false);
  const [showPoolAdjust, setShowPoolAdjust] = useState(false);
  // กล่องเตือน "draft จะหาย" ในแอป (แทน window.confirm ที่เพี้ยนใน mobile webview)
  // รองรับทั้งเปลี่ยนพนักงานและเปลี่ยนเดือน
  const [pendingNav, setPendingNav] = useState<{
    kind: "employee" | "month";
    value: string;
  } | null>(null);
  const monthlyApprovedAdvances = useApprovedAdvancesByMonth(selectedMonth);

  // เดือนที่เลือกได้: ทุกเดือนที่มีข้อมูลเงินเดือน + เดือนปัจจุบัน + เดือนที่
  // controlled ส่งมา (ให้ label ใน MonthChevronNav ขึ้นได้แม้ยังไม่มีข้อมูล)
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(salaryData).forEach((byMonth) => {
      Object.keys((byMonth as Record<string, unknown>) || {}).forEach((m) => {
        set.add(m);
      });
    });
    set.add(currentYM);
    set.add(selectedMonth);
    return [...set].sort().reverse();
  }, [salaryData, currentYM, selectedMonth]);

  const employeeInfo = employeeDirectory.find(
    (e) => e.id === selectedEmployeeId,
  );
  // ตำแหน่ง "ณ เดือนที่เลือก" — ใช้ roleId จาก snapshot ใน salary doc ก่อน
  // (frozen) fallback เป็น roleId ปัจจุบัน → เปลี่ยนตำแหน่งในอนาคตไม่กระทบอดีต
  const employeeRole = roles?.find(
    (r) =>
      r.id ===
      (salaryData[selectedEmployeeId]?.[selectedMonth]?.roleId ??
        employeeInfo?.roleId),
  );
  // เดือนที่ยังไม่เคย save: ไม่ใส่ baseSalary/เรท ในนี้ — ปล่อยให้ calculateSalary
  // fallback ไปเรทปัจจุบันของพนักงาน (ถ้าใส่ baseSalary:0 จะทำให้คำนวณด้วย 0)
  const savedData = salaryData[selectedEmployeeId]?.[selectedMonth] || {
    normalSalePieces: 0,
    specialSalePieces: 0,
    buyPieces: 0,
    invitePieces: 0,
    transferPieces: 0,
    note: "",
  };
  const data = useMemo(() => ({ ...savedData, ...draft }), [savedData, draft]);
  const dirty = Object.keys(draft).length > 0;

  // sync dirty ขึ้น parent (สำหรับเตือนก่อนเปลี่ยน section)
  useEffect(() => {
    setUnsavedDirty?.(dirty);
  }, [dirty, setUnsavedDirty]);
  useEffect(() => () => setUnsavedDirty?.(false), [setUnsavedDirty]); // unmount → clear

  // ถ้าเปลี่ยน employee/เดือน ภายในหน้านี้ — ถ้ามี draft ให้เตือนก่อน
  function tryChangeEmployee(newId) {
    if (newId === selectedEmployeeId) return;
    if (dirty) {
      setPendingNav({ kind: "employee", value: newId });
      return;
    }
    setDraft({});
    setSelectedEmployeeId(newId);
  }
  function tryChangeMonth(newMonth: string) {
    if (newMonth === selectedMonth) return;
    if (dirty) {
      setPendingNav({ kind: "month", value: newMonth });
      return;
    }
    setDraft({});
    setSelectedMonth(newMonth);
  }

  useEffect(() => {
    setDraft({});
  }, []);

  // วันลาเดือนนี้ของพนักงานที่เลือก — memoize ให้ reference นิ่ง (กัน memo
  // หนักด้านล่าง recompute ทุก render · ค่าเลขเหมือนเดิมเป๊ะ แค่ ref คงที่)
  const monthLeaves = useMemo(
    () =>
      employeeInfo
        ? allLeaves.filter(
            (lv) =>
              lv.employeeId === employeeInfo.id &&
              leaveOverlapsMonth(lv, selectedMonth),
          )
        : [],
    [employeeInfo, allLeaves, selectedMonth],
  );
  const overInfo = useMemo(
    () => getOverQuotaDays(monthLeaves, storeCalendar, selectedMonth),
    [monthLeaves, storeCalendar, selectedMonth],
  );
  const overTotalDays = overInfo.weekdays + overInfo.sundays;
  const totalLeaveDays = useMemo(
    () => countWeekdayLeaves(monthLeaves, storeCalendar, selectedMonth),
    [monthLeaves, storeCalendar, selectedMonth],
  );
  const monthApprovedAdvances = (monthlyApprovedAdvances.data || []).filter(
    (r) => r.employeeId === selectedEmployeeId,
  );
  const approvedAdvanceTotal = monthApprovedAdvances.reduce(
    (s, r) => s + r.amount,
    0,
  );

  // Pool share — ใช้ data ปัจจุบัน (รวม draft) เพื่อให้ Pool คำนวณ realtime
  // สร้าง salaryData ชั่วคราวที่รวม draft ของคนนี้
  const liveSalaryData = dirty
    ? {
        ...salaryData,
        [selectedEmployeeId]: {
          ...(salaryData[selectedEmployeeId] || {}),
          [selectedMonth]: data,
        },
      }
    : salaryData;

  // ยอดกองกลาง "แยกตามตำแหน่ง (poolGroup)" — ใช้แสดง/หัก ในกล่องหักกองกลาง
  // (adjustment เป็นระดับเดือน แต่หักแยกตามกลุ่ม)
  const poolGroupsInfo = useMemo(() => {
    type GroupItem = { id: string; label: string; gross: number };
    type GroupInfo = {
      id: string;
      label: string;
      items: GroupItem[];
      itemsMap: Map<string, GroupItem>;
      normal: number; // legacy aggregate (backward-compat)
      buy: number;
    };
    const map = new Map<string, GroupInfo>();
    // label ของแต่ละกลุ่ม + items config (kind=pool · เอามาจาก role แรกใน group)
    for (const r of roles) {
      if (!r.poolGroup) continue;
      const prev = map.get(r.poolGroup);
      if (prev) {
        prev.label = `${prev.label} / ${r.name}`;
        // เพิ่ม items ของ role ถัดไปที่ยังไม่อยู่ใน map (กัน items ขาดเมื่อ
        // หลาย role share pool group แต่ items config ไม่ตรงกัน)
        rolePoolItems(r).forEach((it) => {
          if (it.kind === "pool" && !prev.itemsMap.has(it.id)) {
            const entry: GroupItem = { id: it.id, label: it.label, gross: 0 };
            prev.itemsMap.set(it.id, entry);
            prev.items.push(entry);
          }
        });
      } else {
        const items: GroupItem[] = [];
        const itemsMap = new Map<string, GroupItem>();
        rolePoolItems(r).forEach((it) => {
          if (it.kind === "pool") {
            const entry: GroupItem = { id: it.id, label: it.label, gross: 0 };
            items.push(entry);
            itemsMap.set(it.id, entry);
          }
        });
        map.set(r.poolGroup, {
          id: r.poolGroup,
          label: r.name,
          items,
          itemsMap,
          normal: 0,
          buy: 0,
        });
      }
    }
    // รวมชิ้นของแต่ละกลุ่ม per item · ใช้ resolvePoolItemPieces fallback chain
    for (const emp of employeeDirectory) {
      if (emp.salaryDisabled) continue;
      const roleId =
        liveSalaryData[emp.id]?.[selectedMonth]?.roleId ?? emp.roleId;
      const role = roles.find((r) => r.id === roleId);
      if (!role?.poolGroup) continue;
      const g = map.get(role.poolGroup);
      if (!g) continue;
      const sal = liveSalaryData[emp.id]?.[selectedMonth];
      if (!sal) continue;
      g.items.forEach((it) => {
        it.gross += resolvePoolItemPieces(it.id, sal);
      });
      // legacy aggregate (กรณี summary ตกหล่นใช้ fallback)
      g.normal += sal.normalSalePieces || 0;
      g.buy += sal.buyPieces || 0;
    }
    return [...map.values()].map((g) => ({
      id: g.id,
      label: g.label,
      items: g.items,
      normal: g.normal,
      buy: g.buy,
    }));
  }, [employeeDirectory, roles, liveSalaryData, selectedMonth]);

  /* ─── Heavy computation: memoized ───────────────────────────────── */
  const { poolShare, poolShares, poolGroupEmployees, salaryCalculation } =
    useMemo(() => {
      // เก็บ shares ทั้งกลุ่ม (ทุกคน) ไว้ใช้ render badge "คนในกลุ่ม" ให้ตรงกับ
      // การคำนวณจริง (รวม exempt จากหน้าที่ + ปิดสิทธิ์ + เกณฑ์ 50%)
      let groupShares: Record<string, any> = {};
      let employeePoolShare: any = null;
      let poolGroupEmployeesDraft: any[] = [];
      if (employeeRole?.poolGroup) {
        poolGroupEmployeesDraft = employeeDirectory.filter((employee) => {
          if (employee.salaryDisabled) return false;
          const roleIdForMonth =
            salaryData[employee.id]?.[selectedMonth]?.roleId ?? employee.roleId;
          const role = roles.find(
            (candidateRole) => candidateRole.id === roleIdForMonth,
          );
          return role?.poolGroup === employeeRole.poolGroup;
        });
        const shares = computePoolSharesForGroup({
          groupEmployeeIds: poolGroupEmployeesDraft.map(
            (employee) => employee.id,
          ),
          salaryData: liveSalaryData,
          allLeaves,
          yearMonth: selectedMonth,
          employeeDirectory,
          roles,
          poolAdjustment: poolAdjustments?.[selectedMonth] || null,
          poolGroup: employeeRole.poolGroup,
          storeCalendar,
          // เดือนยังไม่ freeze → personal (ขายพิเศษ) ยังจ่ายแม้ปิดกองกลางทั้งหมด
          payPersonalUnderAllExclusion: !isMonthLocked(
            payrollConfirms?.[selectedMonth],
          ),
        });
        groupShares = shares;
        employeePoolShare = shares[selectedEmployeeId];
      }
      // รายการยกเว้นค่าคอม "ระดับ piece" สำหรับพนักงานคนนี้ (multi-item)
      const monthExclusions = (poolAdjustments?.[selectedMonth]?.items || [])
        .filter(
          (it: any) =>
            it.kind === "piece" && it.employeeId === selectedEmployeeId,
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
        overInfo,
        employeeInfo,
        totalLeaveDays,
        approvedAdvanceTotal,
        employeePoolShare,
        employeeRole,
        buildLoanContext(employeeLoans, selectedEmployeeId, selectedMonth),
        monthExclusions,
        { workedDates: extraSatWorked },
      );
      return {
        poolShare: employeePoolShare,
        poolShares: groupShares,
        poolGroupEmployees: poolGroupEmployeesDraft,
        salaryCalculation: computedSalary,
      };
    }, [
      employeeRole,
      employeeDirectory,
      roles,
      liveSalaryData,
      salaryData,
      allLeaves,
      selectedMonth,
      selectedEmployeeId,
      data,
      overInfo,
      employeeInfo,
      monthLeaves,
      totalLeaveDays,
      approvedAdvanceTotal,
      poolAdjustments,
      employeeLoans,
      storeCalendar,
      payrollConfirms,
    ]);

  function update(field, value) {
    const num = field === "note" ? value : parseFloat(value) || 0;
    setDraft((d) => ({ ...d, [field]: num }));
  }

  // จำนวนชิ้นของรายการค่าคอม (multi-item) — เขียนลง piecePieces map ใน draft
  function updatePiecePiece(itemId: string, value: string) {
    const num = parseFloat(value) || 0;
    setDraft((d: any) => ({
      ...d,
      piecePieces: {
        ...((d.piecePieces ?? savedData.piecePieces) || {}),
        [itemId]: num,
      },
    }));
  }

  // จำนวนใบของ "โบนัสอื่นๆ" item — เขียนลง bonusCounts map ใน draft
  function updateBonusCount(itemId: string, value: string) {
    const num = parseFloat(value) || 0;
    setDraft((d: any) => ({
      ...d,
      bonusCounts: {
        ...((d.bonusCounts ?? savedData.bonusCounts) || {}),
        [itemId]: num,
      },
    }));
  }

  // จำนวนชิ้นของ pool item — เขียนลง poolItemPieces map ใน draft
  // mirror legacy fields (normalSalePieces/specialSalePieces/buyPieces) ด้วย
  // กัน pool calc (peer) อ่านจาก poolSnapshots แล้ว fallback chain ขาด
  function updatePoolItemPiece(itemId: string, value: string) {
    const num = parseFloat(value) || 0;
    setDraft((d: any) => {
      const next = {
        ...d,
        poolItemPieces: {
          ...((d.poolItemPieces ?? savedData.poolItemPieces) || {}),
          [itemId]: num,
        },
      };
      // backward compat mirror สำหรับ id เก่า (normal/special/buy)
      if (itemId === "normal") next.normalSalePieces = num;
      else if (itemId === "special") next.specialSalePieces = num;
      else if (itemId === "buy") next.buyPieces = num;
      return next;
    });
  }

  /* ─── รายการ custom (รายรับ/รายหัก) ที่ Admin เพิ่มเอง ──────── */
  function currentCustomList(d, key: "customEarnings" | "customDeductions") {
    if (Array.isArray(d[key])) return d[key];
    if (Array.isArray(savedData[key])) return savedData[key];
    return [];
  }
  function addCustomItem(key: "customEarnings" | "customDeductions") {
    setDraft((d) => ({
      ...d,
      [key]: [...currentCustomList(d, key), { label: "", amount: 0 }],
    }));
  }
  function updateCustomItem(
    key: "customEarnings" | "customDeductions",
    index: number,
    field: "label" | "amount",
    value: string,
  ) {
    setDraft((d) => ({
      ...d,
      [key]: currentCustomList(d, key).map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "amount" ? parseFloat(value) || 0 : value,
            }
          : item,
      ),
    }));
  }
  function removeCustomItem(
    key: "customEarnings" | "customDeductions",
    index: number,
  ) {
    setDraft((d) => ({
      ...d,
      [key]: currentCustomList(d, key).filter((_, i) => i !== index),
    }));
  }
  const addCustomEarning = () => addCustomItem("customEarnings");
  const updateCustomEarning = (i: number, f: "label" | "amount", v: string) =>
    updateCustomItem("customEarnings", i, f, v);
  const removeCustomEarning = (i: number) =>
    removeCustomItem("customEarnings", i);
  const addCustomDeduction = () => addCustomItem("customDeductions");
  const updateCustomDeduction = (i: number, f: "label" | "amount", v: string) =>
    updateCustomItem("customDeductions", i, f, v);
  const removeCustomDeduction = (i: number) =>
    removeCustomItem("customDeductions", i);

  async function saveAll() {
    if (!dirty || saving) return;
    const nextMonthData = { ...savedData, ...draft };
    setSaving(true);
    try {
      if (onSaveSalary) {
        // resyncConfirmed: ถ้าเดือนนี้ยืนยันยอดแล้ว (grace) → ให้ data layer
        // settle + sync ยอดทางการ + บันทึกประวัติการแก้จำนวนชิ้น ให้ consistent
        // กับการแก้เรท (เดือนเปิด/ยังไม่ยืนยัน → flag ไม่มีผล)
        await onSaveSalary(
          selectedEmployeeId,
          selectedMonth,
          nextMonthData,
          undefined,
          {
            resyncConfirmed: true,
          },
        );
      } else {
        setSalaryData((d) => {
          const next = { ...d };
          if (!next[selectedEmployeeId]) next[selectedEmployeeId] = {};
          next[selectedEmployeeId][selectedMonth] = nextMonthData;
          return next;
        });
      }
      setDraft({});
      showToast?.("บันทึกเรียบร้อยแล้ว");
    } catch (err) {
      console.error("[SalaryAdminEdit] save salary failed:", err);
      showToast?.("บันทึกเงินเดือนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  function cancelAll() {
    setDraft({});
  }

  const FIELDS_EARN: { key: string; label: string; icon: string }[] = [];

  if (!salaryCalculation)
    return <div className="p-5 text-txt-soft text-center">ไม่มีข้อมูลเงินเดือน</div>;

  const sc = salaryCalculation;
  // breakdown ของ "รวมค่าคอมตามจำนวนชิ้น" — แสดงว่ามาจากชิ้นไหน × เรท ·
  // pool role อ่านจาก poolItemsBreakdown (รวม custom item ที่ admin เพิ่ม) ·
  // เดิม hardcode normal/special/buy → custom item หาย + ยอดรวมต่ำกว่า net จริง
  const commissionBreakdown = !rolePaysPieceCommission(employeeRole)
    ? []
    : sc.usesSinglePieceRate
      ? (sc.pieceBreakdown || []).map((b) => ({
          label: b.label,
          pieces: b.pieces,
          rate: b.rate,
          amount: b.amount,
        }))
      : (sc.poolItemsBreakdown || []).map((b) => ({
          label: b.label,
          pieces: b.pieces,
          rate: b.rate,
          amount: b.amount,
        }));
  // ยอดรวม = ผลรวม breakdown (รวม custom pool item) → ตรงกับส่วน commission
  // ใน earnings/net เสมอ
  const pieceCommissionTotal = commissionBreakdown.reduce(
    (s, b) => s + (b.amount || 0),
    0,
  );
  // โบนัสอื่นๆ (multi-item) — มาจาก salaryCalculation.bonusBreakdown โดยตรง
  // ไม่ผูกกับ piece commission · admin ตั้ง bonusItems แยกได้
  const memberBonusBreakdown = (sc.bonusBreakdown || []).map((b) => ({
    label: b.label,
    pieces: b.pieces,
    rate: b.rate,
    amount: b.amount,
  }));

  // ปิดรอบถาวรแล้ว (พ้น 7 วันหลังยืนยันยอดครั้งแรก) → ห้ามแก้เดือนนี้
  const monthLock = getPayrollLock(payrollConfirms?.[selectedMonth]);
  const locked = monthLock.locked;

  return (
    <div>
      {/* ปุ่มแผนผังเงินเดือน + รายการยกเว้น + dropdown เลือกเดือน
          ฝั่ง admin โชว์ตลอด · เปิด modal แล้วเลือก pool group ใน dropdown
          ของ modal ได้ (ดูได้ทุกกลุ่ม pool แม้พนักงานที่ select เป็น non-pool) */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPoolFlow(true)}
            title="แผนผังเงินเดือน"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream cursor-pointer text-sm font-semibold text-maroon font-[inherit]"
          >
            <IconNetwork size={14} strokeWidth={2.4} />
            แผนผังเงินเดือน
          </button>
          <button
            type="button"
            onClick={() => setShowPoolAdjust(true)}
            title="รายการยกเว้นค่าคอม"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-bdr bg-cream cursor-pointer text-sm font-semibold text-maroon font-[inherit]"
          >
            <IconMinus size={14} strokeWidth={2.4} />
            รายการยกเว้นค่าคอม
          </button>
        </div>
        <MonthChevronNav
          months={monthOptions}
          selected={selectedMonth}
          onSelect={tryChangeMonth}
        />
      </div>

      {locked && (
        <div className="flex items-start gap-2 px-3.5 py-3 mb-3 rounded-[12px] bg-cream border-[1.5px] border-bdr">
          <IconLock
            size={16}
            strokeWidth={2.4}
            className="text-txt-mid mt-0.5 shrink-0"
          />
          <div className="text-sm text-txt-mid leading-normal">
            <b className="text-txt">ปิดรอบแล้ว</b> — เดือนนี้พ้น 7 วันหลังยืนยันยอด
            จึงแก้ไขค่าคอม/เงินเดือนไม่ได้แล้ว
          </div>
        </div>
      )}

      {/* employee cards — เลือกพนักงานแบบการ์ด (เลือกอย่างเดียว)
         การเรียงลำดับพนักงานย้ายไปทำที่ ตั้งค่า > พนักงาน แทนแล้ว
         จุดสถานะ: เขียว=บันทึกชิ้นเดือนนี้แล้ว, เทา=ยังไม่บันทึก */}
      <EmployeeCardGrid
        employees={employeeDirectory.filter((e) => !e.salaryDisabled)}
        selectedId={selectedEmployeeId}
        onSelect={tryChangeEmployee}
        salaryData={salaryData}
        selectedMonth={selectedMonth}
      />

      {/* Pool info card — แสดงตอนอยู่ใน group */}
      {poolShare && poolGroupEmployees.length > 1 && (
        <div className="rounded-xl p-3.5 mb-3.5 bg-[linear-gradient(135deg,#7B1C1C08,#C9973A10)] border border-[#C9973A40]">
          <div className="flex items-center gap-2 mb-2.5">
            <IconHandshake size={18} strokeWidth={2.2} color={COLORS.gold} />
            <div className="text-sm font-bold text-maroon">
              ค่าคอมกองกลาง "{employeeRole?.name}"
            </div>
            <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              {poolGroupEmployees.length} คน
            </span>
          </div>
          <div className="text-xs text-txt-mid mb-2 leading-relaxed">
            แต่ละ pool item คิดแยกกัน · &lt; threshold ของ Top = ตัดออก
            <br />
            แบ่งกองกลางตามสูตร: % ได้ = Base − % หัก + Σ(% ที่เพื่อนร่วมงานแบ่งให้)
          </div>

          {/* Admin-locked: ปิดสิทธิ์ Pool — รองรับทั้ง "all"/legacy "both" + per-item
              array · per-item แสดง label ของ item ที่ถูกปิดจริง ไม่ hardcode ฝั่ง */}
          {poolShare.poolExclusion &&
            (() => {
              const exc = poolShare.poolExclusion;
              const poolItemsCfg = rolePoolItems(employeeRole);
              const { excludedIds, isAll } = resolvePoolExclusionItemIds(
                exc as any,
                poolItemsCfg,
              );
              if (excludedIds.size === 0) return null;
              const excludedItems = poolItemsCfg.filter((it) =>
                excludedIds.has(it.id),
              );
              const title = isAll
                ? "ปิดสิทธิ์ทั้งหมดโดย ADMIN"
                : `ปิดบางรายการโดย ADMIN (${excludedItems.length} รายการ)`;
              const desc = isAll
                ? "ไม่ได้กองกลางเลย · ถ้ายอด primary item < 50% ของ top → ไม่ได้เงินเดือนพื้นฐาน"
                : excludedItems.map((it) => it.label).join(" · ");
              const ExclusionIcon = isAll ? IconLock : IconBan;
              return (
                <div className="rounded-[9px] px-3 py-2.5 mb-1.5 text-sm text-red font-bold leading-relaxed flex items-center gap-2 bg-[linear-gradient(135deg,#C0392B15,#C0392B25)] border-[1.5px] border-[#C0392B50]">
                  <ExclusionIcon size={18} strokeWidth={2.4} />
                  <div className="flex-1">
                    <div>{title}</div>
                    <div className="font-medium text-[10.5px] mt-0.5 text-[#C0392BCC]">
                      {desc}
                    </div>
                  </div>
                </div>
              );
            })()}
          {poolShare.losesBaseSalary && (
            <div className="bg-red rounded-[9px] px-3 py-2.5 mb-1.5 text-sm text-white font-bold leading-relaxed shadow-red-glow flex items-start gap-1.5">
              <IconTrendingDown
                size={16}
                strokeWidth={2.4}
                className="shrink-0 mt-0.5"
              />
              <div className="flex-1">
                ไม่ได้รับเงินเดือนพื้นฐาน
                <div className="font-medium text-xs mt-[3px] text-[#FFE0E0]">
                  ขาย {poolShare.employeeSellPieces} ชิ้น ·{" "}
                  {poolShare.topSellPieces > 0
                    ? (
                        (poolShare.employeeSellPieces /
                          poolShare.topSellPieces) *
                        100
                      ).toFixed(1)
                    : "0"}
                  % ของ Top {poolShare.topSellPieces} (ต่ำกว่า 50%)
                </div>
              </div>
            </div>
          )}

          {/* not eligible warnings — loop pool items (kind=pool) ที่
              ผ่าน threshold ไม่ได้ + ยังไม่ถูก admin exclude */}
          {rolePoolItems(employeeRole)
            .filter((it) => it.kind === "pool")
            .map((item) => {
              const itemShare = poolShare.itemShares?.[item.id];
              const isExcluded = (poolShare.excludedItemIds || []).includes(
                item.id,
              );
              if (isExcluded || itemShare?.eligible) return null;
              const myPieces = poolShare.itemPieces?.[item.id] || 0;
              const topPieces = poolShare.topItemPieces?.[item.id] || 0;
              const thresholdPct = item.threshold ?? 80;
              const thresholdPieces = (topPieces * thresholdPct) / 100;
              const myPercent =
                topPieces > 0 ? (myPieces / topPieces) * 100 : 0;
              return (
                <div
                  key={item.id}
                  className="bg-red-lt rounded-[9px] px-3 py-2 mb-1.5 text-sm text-red font-semibold leading-relaxed border border-[#C0392B40] flex items-start gap-1.5"
                >
                  <IconAlertTriangle
                    size={14}
                    strokeWidth={2.4}
                    className="shrink-0 mt-0.5"
                  />
                  <div className="flex-1">
                    {item.label}: ไม่ได้รับชิ้นจากกองกลาง
                    <div className="font-medium text-xs mt-0.5">
                      {myPieces} ชิ้น · {myPercent.toFixed(1)}% ของ Top{" "}
                      {topPieces} (ขั้นต่ำ {thresholdPieces.toFixed(1)})
                    </div>
                  </div>
                </div>
              );
            })}

          {/* this employee's share — loop ทุก pool items */}
          <div className="bg-white rounded-[10px] px-3 py-2.5 border border-bdr">
            <div className="flex justify-between text-sm mb-[5px]">
              <span className="text-txt-mid">หยุดทั้งหมด</span>
              <span className="font-bold text-txt">
                {poolShare.leaveDays} วัน
              </span>
            </div>
            <div className="h-px bg-bdr my-1.5" />

            {rolePoolItems(employeeRole).map((item) => {
              const itemShare = poolShare.itemShares?.[item.id];
              if (!itemShare) return null;

              // ส่วนตัว — ใครทำคนนั้นได้ · ไม่แบ่งกองกลาง
              if (item.kind === "personal") {
                return (
                  <div
                    key={item.id}
                    className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]"
                  >
                    <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                      <span className="inline-flex items-center gap-1">
                        <IconSparkles size={12} strokeWidth={2.4} />
                        {item.label}{" "}
                        <span className="text-txt-soft font-normal">
                          (ส่วนตัว)
                        </span>
                      </span>
                      <span className="text-green">
                        {itemShare.allocatedPieces.toFixed(1)} ชิ้น
                      </span>
                    </div>
                    <div className="text-xs text-txt-soft leading-relaxed">
                      ใครทำคนนั้นได้ · ไม่เข้ากองกลาง
                    </div>
                  </div>
                );
              }

              // kind=pool · ผ่าน threshold ไม่ได้ → red strip
              if (!itemShare.eligible) {
                return (
                  <div
                    key={item.id}
                    className="mb-1.5 px-2 py-1.5 bg-red-lt rounded-[7px] text-xs text-red font-semibold flex items-center gap-1"
                  >
                    <IconDiamond size={12} strokeWidth={2.4} />
                    {item.label}:
                    <IconX size={12} strokeWidth={3} />
                    ไม่ได้รับชิ้นจากกองกลาง
                  </div>
                );
              }

              // kind=pool · eligible · แสดง breakdown เต็ม
              const eligibleCount =
                poolShare.eligibleCountByItemId?.[item.id] || 0;
              const baseSharePct =
                poolShare.baseSharePercentByItemId?.[item.id] || 0;
              const grossPool = poolShare.grossItemPool?.[item.id] || 0;
              const totalPool = poolShare.totalItemPool?.[item.id] || 0;
              const excludedPieces = grossPool - totalPool;
              return (
                <div
                  key={item.id}
                  className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]"
                >
                  <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                    <span className="inline-flex items-center gap-1">
                      <IconDiamond size={12} strokeWidth={2.4} />
                      {item.label} ({eligibleCount} คน · Base{" "}
                      {baseSharePct.toFixed(1)}%)
                    </span>
                    <span>{itemShare.finalSharePercent.toFixed(2)}%</span>
                  </div>
                  <div className="text-xs text-txt-soft leading-relaxed">
                    หัก: <b>{itemShare.leaveDeductionPercent.toFixed(2)}%</b> ·
                    แบ่งให้เพื่อนร่วมงาน:{" "}
                    <b>{itemShare.redistributedPercent.toFixed(2)}%</b>
                    <br />
                    ได้ชิ้น:{" "}
                    <b className="text-green">
                      {itemShare.allocatedPieces.toFixed(1)}
                    </b>{" "}
                    / {totalPool}
                    {excludedPieces > 0 && (
                      <span className="text-red">
                        {" "}
                        (กอง {grossPool} − {excludedPieces} = {totalPool})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="mt-1.5 px-2 py-1.5 rounded-md text-xs text-maroon text-center font-semibold leading-relaxed bg-[#C9973A15]">
              สูตร: % ที่ได้ = Base − % การหัก + Σ(% ที่เพื่อนร่วมงานแบ่งให้)
              <br />
              <span className="inline-flex items-center gap-1 text-txt-soft font-normal">
                <IconSparkles size={11} strokeWidth={2.4} />
                รายการ "ส่วนตัว" — ใครทำคนนั้นได้ · ไม่เข้ากองกลาง
              </span>
            </div>
          </div>

          {/* members — badge ต่อคน · สะท้อนการคำนวณจริง:
              · pool item (ขายทั่วไป/รับซื้อ) ✓/✗ จาก eligible จริง — คนทำหน้าที่
                ประจำเดือน (เช่น ONLINE) ได้สิทธิ์แม้ < 80% (โชว์ดาว "ได้จากหน้าที่")
              · คนปิดกองกลางทั้งหมด → แทน badge กองกลางด้วยเกณฑ์ "primary ≥ 50%"
              · ขายพิเศษ (ส่วนตัว) โชว์ให้ทุกคนที่ทำ — คนปิดทั้งหมดก็ยังได้ */}
          <div className="mt-2.5">
            <div className="text-xs text-txt-soft mb-1.5">คนในกลุ่ม:</div>
            {/* legend — อธิบายสัญลักษณ์ (mobile ไม่มี hover) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5 text-[10px] text-txt-soft">
              <span className="inline-flex items-center gap-1">
                <IconStar
                  size={10}
                  strokeWidth={2.6}
                  className="fill-current text-green"
                />
                ได้กองกลางจากหน้าที่ (เช่น ONLINE)
              </span>
              <span className="inline-flex items-center gap-1">
                <IconLock size={10} strokeWidth={2.6} />
                ปิดกองกลาง — เช็คเกณฑ์ 50%
              </span>
              <span className="inline-flex items-center gap-1">
                <IconSparkles size={10} strokeWidth={2.6} />
                ขายพิเศษ (ส่วนตัว)
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {poolGroupEmployees.map((g) => {
                const gSal = salaryData[g.id]?.[selectedMonth];
                const gShare = poolShares?.[g.id];
                const isMe = g.id === selectedEmployeeId;
                const poolItemsCfg = rolePoolItems(employeeRole);
                const { isAll: isAllClosed } = resolvePoolExclusionItemIds(
                  gShare?.poolExclusion ?? null,
                  poolItemsCfg,
                );
                const exemptDuty = gShare?.poolThresholdExempt === true;
                const piecesOf = (id: string) =>
                  gShare?.itemPieces?.[id] ?? resolvePoolItemPieces(id, gSal);
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-[9px] text-xs text-txt-mid border ${isMe ? "bg-gold-pale border-gold" : "bg-white border-bdr"}`}
                  >
                    <span
                      className={`flex-1 min-w-0 truncate ${isMe ? "font-bold text-maroon" : "font-medium"}`}
                    >
                      {g.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {/* ปิดกองกลางทั้งหมด → เกณฑ์ "primary ≥ 50%" แทน pool badges */}
                      {isAllClosed
                        ? (() => {
                            const primaryId = gShare?.primaryPoolItemId;
                            const primaryItem = poolItemsCfg.find(
                              (it) => it.id === primaryId,
                            );
                            const primaryPieces = primaryId
                              ? piecesOf(primaryId)
                              : 0;
                            const topPrimary =
                              gShare?.topItemPieces?.[primaryId] || 0;
                            // losesBaseSalary=false → ผ่าน (รวมเคส top=0)
                            const pass50 = !gShare?.losesBaseSalary;
                            const pct =
                              topPrimary > 0
                                ? (primaryPieces / topPrimary) * 100
                                : 0;
                            return (
                              <div
                                title={`ปิดกองกลางทั้งหมด · ${primaryItem?.label || "ขาย"} ${primaryPieces} ชิ้น = ${pct.toFixed(1)}% ของ Top ${topPrimary} · ${pass50 ? "ผ่านเกณฑ์ 50% (ได้เงินเดือนพื้นฐาน)" : "ต่ำกว่า 50% (ไม่ได้เงินเดือนพื้นฐาน)"}`}
                                className={`shrink-0 min-w-[64px] px-2 py-1 rounded-md flex flex-col items-center justify-center leading-tight ${pass50 ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                              >
                                <span className="text-[10px] font-semibold opacity-80 inline-flex items-center gap-0.5 max-w-[88px]">
                                  <IconLock size={9} strokeWidth={2.6} />
                                  <span className="truncate">
                                    {primaryItem?.label || "ขาย"} ≥50%
                                  </span>
                                  {pass50 ? (
                                    <IconCheck size={9} strokeWidth={3} />
                                  ) : (
                                    <IconX size={9} strokeWidth={3} />
                                  )}
                                </span>
                                <span className="text-sm font-extrabold">
                                  {primaryPieces}
                                </span>
                              </div>
                            );
                          })()
                        : poolItemsCfg
                            .filter((it) => it.kind === "pool")
                            .map((item) => {
                              const eligible =
                                gShare?.itemShares?.[item.id]?.eligible ??
                                false;
                              const pieces = piecesOf(item.id);
                              const topPieces =
                                gShare?.topItemPieces?.[item.id] || 0;
                              const thresholdPct = item.threshold ?? 80;
                              const thresholdPieces =
                                topPieces > 0
                                  ? (topPieces * thresholdPct) / 100
                                  : 0;
                              // ผ่านเพราะทำหน้าที่ประจำเดือน (exempt) ทั้งที่ < เกณฑ์
                              const viaDuty =
                                exemptDuty &&
                                eligible &&
                                topPieces > 0 &&
                                pieces < thresholdPieces;
                              return (
                                <div
                                  key={item.id}
                                  title={`${item.label} · ${pieces} ชิ้น · ${
                                    eligible
                                      ? viaDuty
                                        ? "ได้สิทธิ์กองกลางจากหน้าที่ประจำเดือน (เช่น ONLINE)"
                                        : "ผ่านเกณฑ์"
                                      : `ต้องการ ≥ ${thresholdPieces.toFixed(1)} (${thresholdPct}% ของ ${topPieces})`
                                  }`}
                                  className={`shrink-0 min-w-[54px] px-2 py-1 rounded-md flex flex-col items-center justify-center leading-tight ${eligible ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                                >
                                  <span className="text-[10px] font-semibold opacity-80 inline-flex items-center gap-0.5 max-w-[72px]">
                                    <span className="truncate">
                                      {item.label}
                                    </span>
                                    {viaDuty && (
                                      <IconStar
                                        size={9}
                                        strokeWidth={2.6}
                                        className="fill-current"
                                      />
                                    )}
                                    {eligible ? (
                                      <IconCheck size={9} strokeWidth={3} />
                                    ) : (
                                      <IconX size={9} strokeWidth={3} />
                                    )}
                                  </span>
                                  <span className="text-sm font-extrabold">
                                    {pieces}
                                  </span>
                                </div>
                              );
                            })}
                      {/* ขายพิเศษ (ส่วนตัว) — โชว์เฉพาะคนที่ทำ (>0) · คนปิดทั้งหมด
                          ก็ยังได้ค่าคอมนี้ (เดือนที่ยังไม่ freeze) */}
                      {poolItemsCfg
                        .filter((it) => it.kind === "personal")
                        .map((item) => {
                          const pieces = piecesOf(item.id);
                          if (pieces <= 0) return null;
                          const paid =
                            gShare?.itemShares?.[item.id]?.eligible ?? true;
                          return (
                            <div
                              key={item.id}
                              title={`${item.label} (ส่วนตัว) · ${pieces} ชิ้น · ${paid ? "ได้ค่าคอม (ไม่เข้ากองกลาง)" : "ถูกปิดรายการนี้"}`}
                              className={`shrink-0 min-w-[54px] px-2 py-1 rounded-md flex flex-col items-center justify-center leading-tight ${paid ? "bg-green-lt text-green" : "bg-cream-dk/40 text-txt-soft line-through"}`}
                            >
                              <span className="text-[10px] font-semibold opacity-80 inline-flex items-center gap-0.5 max-w-[72px]">
                                <IconSparkles size={9} strokeWidth={2.6} />
                                <span className="truncate">{item.label}</span>
                              </span>
                              <span className="text-sm font-extrabold">
                                {pieces}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: 2 คอลัมน์ — ซ้าย ค่าคอม+รายรับ / ขวา บัตรสมาชิก+รายการหัก (มือถือเรียงเดี่ยวเหมือนเดิม) */}
      <div className="md:grid md:grid-cols-2 md:gap-x-3.5 md:items-start">
        {/* Commission section — single rate or 3 sub-sections (ถ้าตำแหน่งไม่มี
            piece commission เลย → ซ่อนกล่องนี้ทั้งกล่อง) */}
        {!rolePaysPieceCommission(employeeRole) ? null : employeeRole &&
          !employeeRole.poolGroup ? (
          /* Multi-item piece rate (เช่น ฝ่ายบัญชี — "ทำบิล", "นับสต๊อก") */
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
              <div className="font-bold text-sm text-txt">ค่าคอมต่อชิ้น</div>
              <div className="ml-auto text-sm font-bold text-gold">
                + {formatThaiNumber(salaryCalculation.singleRateCommission)} ฿
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {(salaryCalculation.pieceBreakdown || []).map((item) => {
                // input bind กับ gross (ค่าที่ admin พิมพ์) ไม่ใช่ item.pieces
                // ของ pieceBreakdown ซึ่งเป็น "หลังหักรายการยกเว้น" — ไม่งั้น
                // user พิมพ์ 6 มี exclusion 5 จะ display 1 (เพี้ยน)
                const grossPieces =
                  data.piecePieces?.[item.id] ??
                  (item.id === "default" ? (data.singleRatePieces ?? 0) : 0);
                // excluded = ผลรวมจริงที่ admin ใส่ (ไม่ cap) จาก calculateSalary
                // — ถ้า admin ใส่ 10 แต่พนักงานทำ 5 ต้องโชว์ "หัก 10" ไม่ใช่ 5
                const excluded = item.excluded || 0;
                const grossAmount = grossPieces * item.rate;
                return (
                  <div
                    key={item.id}
                    className="bg-gold-pale rounded-[10px] p-3 border border-[#C9973A30]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-txt flex items-center gap-1.5">
                        <IconPackage size={16} strokeWidth={2.2} />
                        {item.label}
                      </div>
                      <div className="text-xs text-txt-soft">
                        Rate:{" "}
                        <b className="text-maroon">
                          {formatThaiNumber(item.rate)} ฿/ชิ้น
                        </b>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={grossPieces || ""}
                          onChange={(e) =>
                            updatePiecePiece(item.id, e.target.value)
                          }
                          className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-txt bg-white text-center"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                          ชิ้น
                        </span>
                      </div>
                      <div className="text-sm text-txt-soft font-semibold">
                        =
                      </div>
                      <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-base font-bold text-green text-right border border-bdr">
                        {formatThaiNumber(grossAmount)} ฿
                      </div>
                    </div>
                    {excluded > 0 &&
                      (() => {
                        // ถ้า admin ใส่ exclusion เกิน gross → cap arithmetic
                        // แต่โชว์ "เกิน X ชิ้น" เพื่อ admin รู้ว่าใส่เกิน
                        const overExclusion = Math.max(
                          0,
                          excluded - grossPieces,
                        );
                        const effExcluded = Math.min(excluded, grossPieces);
                        const effExcludedAmount = effExcluded * item.rate;
                        return (
                          <div className="mt-2 pt-2 border-t border-dashed border-[#C9973A40] flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-red font-semibold">
                                − หักรายการยกเว้น {formatThaiNumber(excluded)} ชิ้น
                                {overExclusion > 0 && (
                                  <span className="ml-1 text-amber font-bold">
                                    (เกิน {formatThaiNumber(overExclusion)} ชิ้น ·
                                    คิดได้แค่ {formatThaiNumber(effExcluded)})
                                  </span>
                                )}
                              </span>
                              <span className="text-red font-bold tabular-nums">
                                − {formatThaiNumber(effExcludedAmount)} ฿
                              </span>
                            </div>
                            {/* รายละเอียดเหตุผลของแต่ละ exclusion row */}
                            {(item.exclusionEntries || []).length > 0 && (
                              <div className="pl-2 flex flex-col gap-0.5">
                                {(item.exclusionEntries || []).map((ex, ix) => (
                                  <div
                                    key={ix}
                                    className="flex justify-between text-[11px] text-red/80"
                                  >
                                    <span className="truncate">
                                      · {ex.label || "(ไม่ระบุเหตุผล)"}
                                    </span>
                                    <span className="tabular-nums shrink-0 ml-2">
                                      {formatThaiNumber(ex.pieces)} ชิ้น
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#C9973A30]">
                              <span className="text-txt font-bold">
                                คิดค่าคอม {formatThaiNumber(item.pieces)} ชิ้น
                              </span>
                              <span className="text-green font-extrabold tabular-nums">
                                + {formatThaiNumber(item.amount)} ฿
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
            {/* legacy orphan warning: ถ้า salary doc มี singleRatePieces > 0
                แต่ role.pieceItems ไม่มี id="default" → ข้อมูลเก่าค้างไม่ถูกคิด */}
            {(() => {
              const legacy = Number(data.singleRatePieces) || 0;
              if (legacy <= 0) return null;
              const hasDefault = (salaryCalculation.pieceBreakdown || []).some(
                (b) => b.id === "default",
              );
              if (hasDefault) return null;
              return (
                <div className="mt-2.5 px-3 py-2 rounded-[9px] bg-amber-lt border border-amber/40 flex items-start gap-1.5 text-xs text-amber font-semibold">
                  <IconLightbulb
                    size={12}
                    strokeWidth={2.4}
                    className="shrink-0 mt-0.5"
                  />
                  <span className="leading-relaxed">
                    มีข้อมูลเก่าค้างอยู่: {formatThaiNumber(legacy)} ชิ้น (legacy)
                    ไม่ถูกคิดค่าคอม — กรุณาย้ายเข้ารายการใหม่ด้านบนหรือลบทิ้ง
                  </span>
                </div>
              );
            })()}
            <div className="text-xs text-txt-soft mt-2.5 text-center inline-flex items-center justify-center gap-1 w-full">
              <IconLightbulb
                size={12}
                strokeWidth={2.4}
                className="text-gold"
              />
              Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
            </div>
          </div>
        ) : (
          /* Commission ยอดขาย & รับซื้อ — pieces × rate (3 ช่อง) */
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
              <div className="font-bold text-sm text-txt">ค่าคอมตามจำนวนชิ้น</div>
              <div className="ml-auto text-xs font-semibold text-txt-soft inline-flex items-center gap-1">
                <IconHandshake
                  size={12}
                  strokeWidth={2.4}
                  color={COLORS.gold}
                />
                คำนวณในกองกลาง
              </div>
            </div>

            {/* Pool items — loop ตาม role.poolItems (รวม custom items)
                kind=pool: ถูก poolExclusion ปิดได้ · kind=personal: ส่วนตัว    */}
            {(() => {
              const poolItems = rolePoolItems(employeeRole);
              const exc = employeeInfo?.poolExclusion;
              const { excludedIds, isAll } = resolvePoolExclusionItemIds(
                exc as any,
                poolItems,
              );
              const primaryItemId = rolePrimaryPoolItemId(employeeRole);
              return poolItems.map((it) => {
                // primary item ต้อง input ได้แม้ตอน isAll (ปิดทั้งหมด) เพราะ
                // ต้องใช้ pieces เพื่อเช็คเกณฑ์ < 50% → losesBaseSalary
                const isPrimaryWhileAll = isAll && it.id === primaryItemId;
                const poolDisabled =
                  excludedIds.has(it.id) &&
                  it.kind === "pool" &&
                  !isPrimaryWhileAll;
                const disabled = poolDisabled || locked;
                const value = poolDisabled
                  ? ""
                  : resolvePoolItemPieces(it.id, data) || "";
                // resolve rate ผ่าน chain: salary snapshot > live employee
                // (กัน past month ที่ rate ตอนนั้นกับตอนนี้ต่างกัน · admin/
                // employee จะเห็น rate ของเดือนนั้นๆ ตรงกับ commission calc)
                const rate = resolvePoolItemRate(it.id, data, employeeInfo);
                const Icon =
                  it.id === "normal"
                    ? IconDiamond
                    : it.id === "special"
                      ? IconSparkles
                      : it.id === "buy"
                        ? IconShoppingBag
                        : IconDiamond;
                return (
                  <div
                    key={it.id}
                    className={`rounded-[10px] p-3 mb-2.5 relative border ${disabled ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`text-sm font-bold flex items-center gap-1.5 ${disabled ? "text-txt-soft" : "text-txt"}`}
                      >
                        <Icon size={14} strokeWidth={2.4} />
                        {it.label}
                        {it.kind === "personal" && (
                          <span className="text-[10px] text-txt-soft font-normal">
                            (ส่วนตัว)
                          </span>
                        )}
                        {poolDisabled && (
                          <span className="text-xs px-1.5 py-1 rounded-lg text-red font-bold bg-[#C0392B20] inline-flex items-center gap-0.5">
                            <IconLock size={11} strokeWidth={2.4} />
                            ถูกปิด
                          </span>
                        )}
                        {isPrimaryWhileAll && (
                          <span className="text-[10px] px-1.5 py-1 rounded-lg text-amber font-bold bg-amber-lt/60 inline-flex items-center gap-0.5">
                            หลัก · ใช้เช็ค 50%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-txt-soft">
                        Rate:{" "}
                        <b className="text-maroon">
                          {formatThaiNumber(rate)} ฿/ชิ้น
                        </b>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value}
                          disabled={disabled}
                          onChange={(e) =>
                            updatePoolItemPiece(it.id, e.target.value)
                          }
                          className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${disabled ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                          ชิ้น
                        </span>
                      </div>
                    </div>
                    {isPrimaryWhileAll && (
                      <div className="text-[11px] text-amber mt-1.5 text-center font-semibold">
                        ⚠ ใส่จำนวนเพื่อตรวจสอบเกณฑ์ &lt; 50% (ไม่นับเป็นค่าคอม)
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            <div className="text-xs text-txt-soft mt-2.5 text-center inline-flex items-center justify-center gap-1 w-full">
              <IconLightbulb
                size={12}
                strokeWidth={2.4}
                className="text-gold"
              />
              Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
            </div>
            {poolShare && (
              <div className="mt-2 text-xs text-maroon px-3 py-2.5 rounded-lg bg-[#C9973A15] flex items-start gap-2">
                <IconHandshake
                  size={18}
                  strokeWidth={2.2}
                  className="shrink-0 mt-0.5"
                />
                <div className="leading-relaxed">
                  <div className="font-bold">ค่าคอมจะถูกคำนวณจากกองกลาง</div>
                  <div className="text-txt-soft">
                    หลังจากที่ ADMIN บันทึกชิ้นของทุกคนแล้ว
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* โบนัสอื่นๆ — multi-item (เดิม: บัตรสมาชิก hardcode invite + transfer)
            admin custom รายการเองในแท็บ "ตำแหน่ง" → role.bonusItems
            ซ่อน section ถ้า role ไม่มีรายการเลย ([]) — ไม่ผูกกับ piece commission */}
        {(salaryCalculation.bonusBreakdown || []).length > 0 && (
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-maroon-lt" />
              <div className="font-bold text-sm text-txt">โบนัสอื่นๆ</div>
              <div className="ml-auto text-sm font-bold text-maroon">
                + {formatThaiNumber(salaryCalculation.memberBonusTotal)} ฿
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {(salaryCalculation.bonusBreakdown || []).map((item) => {
                const count =
                  data.bonusCounts?.[item.id] ??
                  (item.id === "invite"
                    ? (data.invitePieces ?? 0)
                    : item.id === "transfer"
                      ? (data.transferPieces ?? 0)
                      : 0);
                return (
                  <div
                    key={item.id}
                    className={`rounded-[10px] p-3 border ${locked ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`text-sm font-bold flex items-center gap-1.5 ${locked ? "text-txt-soft" : "text-txt"}`}
                      >
                        <IconTicket size={16} strokeWidth={2.2} />
                        {item.label}
                      </div>
                      <div className="text-xs text-txt-soft">
                        Rate:{" "}
                        <b className="text-maroon">
                          {formatThaiNumber(item.rate)} ฿/ครั้ง
                        </b>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={count || ""}
                          disabled={locked}
                          onChange={(e) =>
                            updateBonusCount(item.id, e.target.value)
                          }
                          className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${locked ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                          ครั้ง
                        </span>
                      </div>
                      <div className="text-sm text-txt-soft font-semibold">
                        =
                      </div>
                      <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-base font-bold text-green text-right border border-bdr">
                        {formatThaiNumber(item.amount)} ฿
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-txt-soft mt-2.5 text-center inline-flex items-center justify-center gap-1 w-full">
              <IconLightbulb
                size={12}
                strokeWidth={2.4}
                className="text-gold"
              />
              รายการ/Rate กำหนดในแท็บ "ตำแหน่ง" และ "ข้อมูลพนักงาน"
            </div>
          </div>
        )}

        {/* Earnings inputs */}
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-green" />
            <div className="font-bold text-sm text-txt">รายรับ</div>
            <div className="ml-auto text-sm font-bold text-green">
              + {formatThaiNumber(salaryCalculation.earnings)} ฿
            </div>
          </div>

          {/* Base salary — read-only (กำหนดในข้อมูลพนักงาน) */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconBriefcase size={16} strokeWidth={2.2} color={COLORS.green} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold flex items-center gap-1.5">
                <span>เงินเดือนพื้นฐาน</span>
                <span className="text-xs px-1.5 py-1 rounded-lg bg-gold-pale text-maroon font-bold">
                  แก้ในแท็บ "ข้อมูลพนักงาน"
                </span>
              </div>
              <div className="text-base font-bold text-txt mt-px">
                {formatThaiNumber(salaryCalculation.baseSalary || 0)} ฿
              </div>
            </div>
          </div>

          {/* Commission total — สรุปจากค่าคอมด้านบน */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr">
            <div className="flex items-center gap-2.5">
              <IconDiamond size={16} strokeWidth={2.2} color={COLORS.green} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-txt-soft font-semibold">
                  รวมค่าคอมตามจำนวนชิ้น
                </div>
                <div className="text-base font-bold text-green mt-px">
                  + {formatThaiNumber(pieceCommissionTotal)} ฿
                </div>
              </div>
            </div>
            {commissionBreakdown.some((b) => b.amount > 0) && (
              <div className="mt-2 pt-2 border-t border-dashed border-bdr flex flex-col gap-1">
                {commissionBreakdown
                  .filter((b) => b.amount > 0)
                  .map((b) => (
                    <div
                      key={b.label}
                      className="flex justify-between text-[11px] text-txt-soft"
                    >
                      <span>
                        {b.label} ·{" "}
                        {formatThaiNumber(Number(b.pieces.toFixed(1)))} ชิ้น ×{" "}
                        {formatThaiNumber(b.rate)} ฿
                      </span>
                      <span className="font-semibold text-txt-mid">
                        + {formatThaiNumber(b.amount)} ฿
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* เงินค่าแทน (coverage) — admin stamp ตอน save · auto-computed */}
          {(salaryCalculation.coveragePay || 0) > 0 && (
            <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr">
              <div className="flex items-center gap-2.5">
                <IconHandshake
                  size={16}
                  strokeWidth={2.2}
                  color={COLORS.green}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-txt-soft font-semibold">
                    เงินค่าแทน (แทนคนลาเดือนนี้)
                  </div>
                  <div className="text-base font-bold text-green mt-px">
                    + {formatThaiNumber(salaryCalculation.coveragePay || 0)} ฿
                  </div>
                </div>
              </div>
              {Array.isArray(data.coveragePayBreakdown) &&
                data.coveragePayBreakdown.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed border-bdr flex flex-col gap-1">
                    {data.coveragePayBreakdown.map((b) => (
                      <div
                        key={b.dutyId}
                        className="flex justify-between text-[11px] text-txt-soft"
                      >
                        <span>
                          {b.dutyName} · {b.count} ครั้ง ×{" "}
                          {formatThaiNumber(b.rate)} ฿
                        </span>
                        <span className="font-semibold text-txt-mid">
                          + {formatThaiNumber(b.subtotal)} ฿
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Bonus total — สรุปจากโบนัสอื่นๆ ด้านบน (เฉพาะตำแหน่งที่มี piece
              commission + role กำหนดรายการ ≥ 1) */}
          {(sc.bonusBreakdown || []).length > 0 && (
            <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr">
              <div className="flex items-center gap-2.5">
                <IconTicket size={16} strokeWidth={2.2} color={COLORS.green} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-txt-soft font-semibold">
                    รวมโบนัสอื่นๆ
                  </div>
                  <div className="text-base font-bold text-green mt-px">
                    + {formatThaiNumber(salaryCalculation.memberBonusTotal)} ฿
                  </div>
                </div>
              </div>
              {memberBonusBreakdown.some((b) => b.amount > 0) && (
                <div className="mt-2 pt-2 border-t border-dashed border-bdr flex flex-col gap-1">
                  {memberBonusBreakdown
                    .filter((b) => b.amount > 0)
                    .map((b) => (
                      <div
                        key={b.label}
                        className="flex justify-between text-[11px] text-txt-soft"
                      >
                        <span>
                          {b.label} · {formatThaiNumber(b.pieces)} ครั้ง ×{" "}
                          {formatThaiNumber(b.rate)} ฿
                        </span>
                        <span className="font-semibold text-txt-mid">
                          + {formatThaiNumber(b.amount)} ฿
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* เงินเสาร์เปิดพิเศษ — admin tick ใน storeCalendar · auto-computed */}
          {(salaryCalculation.extraOpenSaturdayBonus || 0) > 0 && (
            <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr">
              <div className="flex items-center gap-2.5">
                <IconCalendarPlus
                  size={16}
                  strokeWidth={2.2}
                  color={COLORS.green}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-txt-soft font-semibold">
                    เสาร์เปิดพิเศษ ({salaryCalculation.extraOpenSaturdayDays} วัน ×{" "}
                    {formatThaiNumber(
                      Math.round(salaryCalculation.dailySalaryRate),
                    )}{" "}
                    ฿)
                  </div>
                  <div className="text-base font-bold text-green mt-px">
                    +{" "}
                    {formatThaiNumber(
                      salaryCalculation.extraOpenSaturdayBonus || 0,
                    )}{" "}
                    ฿
                  </div>
                </div>
              </div>
            </div>
          )}

          {FIELDS_EARN.map((f) => (
            <div key={f.key} className="mb-2.5">
              <label className="flex text-sm text-txt-mid mb-[5px] font-medium">
                {f.icon} {f.label}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                  ฿
                </span>
                <MoneyInput
                  min="0"
                  value={data[f.key] || ""}
                  onChange={(raw) => update(f.key, raw)}
                  className="w-full py-2.5 pr-3.5 pl-[30px] rounded-[10px] border border-bdr text-base font-semibold outline-none font-[inherit] text-txt bg-cream"
                />
              </div>
            </div>
          ))}

          {/* auto perfect-attendance bonus */}
          <div
            className={`rounded-[9px] px-3.5 py-3 mt-1.5 text-sm leading-[1.7] border ${salaryCalculation.attendanceBonus > 0 ? "bg-green-lt border-[#1A6B3A30]" : "bg-cream border-bdr"}`}
          >
            <div
              className={`font-bold mb-1 flex items-center gap-1.5 ${salaryCalculation.attendanceBonus > 0 ? "text-green" : "text-txt-mid"}`}
            >
              <IconStar size={14} strokeWidth={2.4} color={COLORS.green} />
              โบนัสแห่งความขยัน (ไม่หยุด){" "}
              <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                อัตโนมัติ
              </span>
            </div>
            <div className="text-txt-mid">
              เรท/วัน = {formatThaiNumber(salaryCalculation.baseSalary || 0)} ฿ ÷
              30 ={" "}
              <b>
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ฿
              </b>
            </div>
            <div className="text-txt-mid">
              เดือนนี้ลาวันธรรมดา <b>{salaryCalculation.leaveDays}</b> วัน{" "}
              <span className="text-xs text-txt-soft">(ไม่นับวันอาทิตย์)</span>
            </div>
            {salaryCalculation.leaveDays <= 2 ? (
              <div className="text-green font-bold mt-1 pt-1 border-t border-dashed border-[#1A6B3A40]">
                ได้โบนัส (2 − {salaryCalculation.leaveDays}) ×{" "}
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ฿ = + {formatThaiNumber(salaryCalculation.attendanceBonus)} ฿
              </div>
            ) : (
              <div className="text-txt-soft mt-1 pt-1 border-t border-dashed border-bdr">
                ลาวันธรรมดาเกิน 2 วัน — ไม่ได้รับโบนัส
              </div>
            )}
          </div>

          {/* custom earnings — รายการรายรับที่เพิ่มเอง */}
          {(Array.isArray(data.customEarnings) ? data.customEarnings : []).map(
            (item, index) => (
              <div key={index} className="flex items-center gap-2 mt-2.5">
                <input
                  type="text"
                  value={item?.label || ""}
                  disabled={locked}
                  onChange={(e) =>
                    updateCustomEarning(index, "label", e.target.value)
                  }
                  placeholder="ชื่อรายการ"
                  className={`flex-1 min-w-0 px-3 py-2.5 rounded-[10px] border border-bdr text-sm font-semibold outline-none font-[inherit] text-txt bg-cream ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                />
                <div className="relative w-[110px] shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                    ฿
                  </span>
                  <MoneyInput
                    min="0"
                    value={item?.amount || ""}
                    disabled={locked}
                    onChange={(raw) =>
                      updateCustomEarning(index, "amount", raw)
                    }
                    className={`w-full py-2.5 pr-2 pl-[26px] rounded-[10px] border border-bdr text-sm font-bold text-right outline-none font-[inherit] text-txt bg-cream ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
                <button
                  type="button"
                  aria-label="ลบรายการ"
                  disabled={locked}
                  onClick={() => removeCustomEarning(index)}
                  className={`w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center border-[1.5px] border-[#C0392B30] ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
                </button>
              </div>
            ),
          )}
          {!locked && (
            <button
              type="button"
              onClick={addCustomEarning}
              className="w-full mt-2.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-green/40 bg-green-lt text-green text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
            >
              <IconPlus size={14} strokeWidth={2.4} />
              เพิ่มรายการรายรับ
            </button>
          )}

          {/* รายรับประจำเดือน (recurring incomes) — read-only · มาจาก employee
              profile · admin แก้/ลบที่หน้า "พนักงาน" · อยู่ล่างสุดตามที่ ADMIN ขอ */}
          {salaryCalculation.recurringIncomes?.map(
            (it: { label: string; amount: number }, i: number) => (
              <RecurringRow
                key={`ri-${i}-${it.label}`}
                item={it}
                kind="income"
              />
            ),
          )}
        </div>

        {/* Deductions inputs */}
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-red" />
            <div className="font-bold text-sm text-txt">รายการหัก</div>
            <div className="ml-auto text-sm font-bold text-red">
              − {formatThaiNumber(salaryCalculation.deductions)} ฿
            </div>
          </div>
          {/* Social security — read-only (กำหนดในข้อมูลพนักงาน) */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconBuildingBank size={16} strokeWidth={2.2} color={COLORS.red} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold flex items-center gap-1.5">
                <span>หักประกันสังคม</span>
                <span className="text-xs px-1.5 py-1 rounded-lg bg-gold-pale text-maroon font-bold">
                  แก้ในแท็บ "ข้อมูลพนักงาน"
                </span>
              </div>
              <div className="text-base font-bold text-txt mt-px">
                − {formatThaiNumber(salaryCalculation.socialSecurity || 0)} ฿
              </div>
            </div>
          </div>
          {/* over-quota auto note */}
          <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-sm text-txt-mid leading-[1.7] border border-[#C9973A30]">
            <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
              <IconClipboardList
                size={14}
                strokeWidth={2.4}
                color={COLORS.red}
              />
              หักลาเกินโควต้า{" "}
              <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                อัตโนมัติ
              </span>
            </div>
            <div>
              เรท/วัน = {formatThaiNumber(salaryCalculation.baseSalary || 0)} ฿ ÷
              30 ={" "}
              <b>
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ฿
              </b>
            </div>
            {overInfo.weekdays > 0 && (
              <div>
                วันธรรมดา {overInfo.weekdays} วัน ×{" "}
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ฿ ={" "}
                <b>
                  {formatThaiNumber(
                    Math.round(
                      overInfo.weekdays *
                        (salaryCalculation.dailySalaryRate || 0),
                    ),
                  )}{" "}
                  ฿
                </b>
              </div>
            )}
            {overInfo.sundays > 0 && (
              <div>
                วันอาทิตย์ {overInfo.sundays} วัน ×{" "}
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ฿ × 1.5 ={" "}
                <b>
                  {formatThaiNumber(
                    Math.round(
                      overInfo.sundays *
                        (salaryCalculation.dailySalaryRate || 0) *
                        1.5,
                    ),
                  )}{" "}
                  ฿
                </b>
              </div>
            )}
            {overTotalDays === 0 && (
              <div className="text-txt-soft">ไม่มีการลาเกินโควต้า</div>
            )}
            {overTotalDays > 0 && (
              <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                หักเดือนนี้: −{" "}
                {formatThaiNumber(salaryCalculation.overQuotaDeduction)} ฿
              </div>
            )}
          </div>

          {/* auto advance deduction note */}
          <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-sm text-txt-mid leading-[1.7] border border-[#C9973A30]">
            <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
              <IconBanknote size={14} strokeWidth={2.4} color={COLORS.red} />
              หักเงินเบิกล่วงหน้า{" "}
              <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                อัตโนมัติ
              </span>
            </div>
            {monthApprovedAdvances.length === 0 ? (
              <div className="text-txt-soft">ไม่มีการเบิกเงินที่ได้รับอนุมัติเดือนนี้</div>
            ) : (
              <>
                {monthApprovedAdvances.map((r, i) => {
                  const date = new Date(r.approvedAt || r.submittedAt);
                  return (
                    <div
                      key={i}
                      className="flex justify-between items-center py-[3px]"
                    >
                      <span>
                        {date.toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {r.reason || "-"}
                      </span>
                      <b>{formatThaiNumber(r.amount)} ฿</b>
                    </div>
                  );
                })}
                <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                  หักเดือนนี้: −{" "}
                  {formatThaiNumber(salaryCalculation.advanceDeduction)} ฿
                </div>
              </>
            )}
          </div>

          {/* auto loan repayment note */}
          {salaryCalculation.loanDeduction > 0 && (
            <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-sm text-txt-mid leading-[1.7] border border-[#C9973A30]">
              <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
                <IconHandCoins size={14} strokeWidth={2.4} color={COLORS.red} />
                หักผ่อนเงินกู้{" "}
                <span className="text-xs font-semibold px-[7px] py-1 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                  อัตโนมัติ
                </span>
              </div>
              {salaryCalculation.loanBreakdown.map((b) => {
                const loan = (employeeLoans || []).find((l) => l.id === b.id);
                return (
                  <div
                    key={b.id}
                    className="flex justify-between items-center py-[3px]"
                  >
                    <span>{loan?.note || "เงินกู้"}</span>
                    <b>{formatThaiNumber(b.amount)} ฿</b>
                  </div>
                );
              })}
              <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                หักเดือนนี้: − {formatThaiNumber(salaryCalculation.loanDeduction)} ฿
              </div>
            </div>
          )}

          {/* custom deductions — รายการหักที่เพิ่มเอง */}
          {(Array.isArray(data.customDeductions)
            ? data.customDeductions
            : []
          ).map((item, index) => (
            <div key={index} className="flex items-center gap-2 mt-2.5">
              <input
                type="text"
                value={item?.label || ""}
                disabled={locked}
                onChange={(e) =>
                  updateCustomDeduction(index, "label", e.target.value)
                }
                placeholder="ชื่อรายการ"
                className={`flex-1 min-w-0 px-3 py-2.5 rounded-[10px] border border-bdr text-sm font-semibold outline-none font-[inherit] text-txt bg-cream ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <div className="relative w-[110px] shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                  ฿
                </span>
                <MoneyInput
                  min="0"
                  value={item?.amount || ""}
                  disabled={locked}
                  onChange={(raw) =>
                    updateCustomDeduction(index, "amount", raw)
                  }
                  className={`w-full py-2.5 pr-2 pl-[26px] rounded-[10px] border border-bdr text-sm font-bold text-right outline-none font-[inherit] text-txt bg-cream ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
              <button
                type="button"
                aria-label="ลบรายการ"
                disabled={locked}
                onClick={() => removeCustomDeduction(index)}
                className={`w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center border-[1.5px] border-[#C0392B30] ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          {!locked && (
            <button
              type="button"
              onClick={addCustomDeduction}
              className="w-full mt-2.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#C0392B40] bg-red-lt text-red text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
            >
              <IconPlus size={14} strokeWidth={2.4} />
              เพิ่มรายการหัก
            </button>
          )}

          {/* รายการหักประจำเดือน (recurring deductions) — read-only · มาจาก
              employee profile · admin แก้/ลบที่หน้า "พนักงาน" · อยู่ล่างสุดตามที่ ADMIN ขอ */}
          {salaryCalculation.recurringDeductions?.map(
            (it: { label: string; amount: number }, i: number) => (
              <RecurringRow
                key={`rd-${i}-${it.label}`}
                item={it}
                kind="deduction"
              />
            ),
          )}
        </div>
      </div>

      {/* note */}
      <div className="mb-3.5">
        <label className="block text-sm text-txt-mid mb-1.5 font-semibold">
          หมายเหตุ (ถ้ามี)
        </label>
        <textarea
          value={data.note || ""}
          disabled={locked}
          onChange={(e) => update("note", e.target.value)}
          rows={2}
          placeholder="ระบุหมายเหตุ..."
          className={`w-full px-3.5 py-3 rounded-[10px] border border-bdr text-sm resize-none outline-none font-[inherit] text-txt bg-white ${locked ? "opacity-60 cursor-not-allowed bg-cream-dk" : ""}`}
        />
      </div>

      {/* Net summary */}
      <div className="bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-[18px] py-4 text-white flex items-center justify-between shadow-maroon-glow">
        <div>
          <div className="text-sm text-[#E8C87AAA]">
            เงินสุทธิ{" "}
            {dirty && (
              <span className="px-1.5 py-1 rounded-md text-xs font-bold ml-[5px] bg-[#D9770640] text-gold-lt">
                ยังไม่บันทึก
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold text-gold-lt mt-0.5">
            <span
              key={Math.round(salaryCalculation.netSalary)}
              className="inline-block animate-[valuePop_0.28s_ease-out]"
            >
              {formatThaiNumber(salaryCalculation.netSalary)}
            </span>{" "}
            ฿
          </div>
          <div className="text-xs text-[#E8C87A80] mt-1">
            เดือน {formatYmThai(selectedMonth)}
          </div>
        </div>
        <div className="text-right text-sm leading-[1.7] text-[#E8C87A99]">
          รายรับ + {formatThaiNumber(salaryCalculation.earnings)} ฿
          <br />
          รายหัก − {formatThaiNumber(salaryCalculation.deductions)} ฿
        </div>
      </div>

      {/* Sticky Save / Cancel bar — fixed bottom · clear BottomNav (mobile)
          · style เดียวกับ EmployeeEditModal save bar (PR #467 spec) */}
      {dirty && (
        <>
          {/* spacer ใต้ content กัน sticky bar ทับเนื้อหา */}
          <div className="h-[80px]" />
          <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[800px] bottom-[68px] md:bottom-3 z-50 px-3 md:px-6">
            <div className="bg-white border-[1.5px] border-bdr rounded-2xl shadow-[0_-6px_24px_rgba(90,30,10,0.15)] p-2.5 flex gap-2">
              <button
                onClick={cancelAll}
                className="basis-[34%] shrink-0 py-3.5 rounded-2xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveAll}
                disabled={saving || locked}
                className={`flex-1 py-3.5 rounded-2xl border-none bg-maroon text-white text-base font-bold font-[inherit] flex items-center justify-center gap-2 shadow-maroon-glow ${saving || locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {locked ? (
                  <IconLock size={16} strokeWidth={2.5} />
                ) : saving ? (
                  <Spinner size={16} />
                ) : (
                  <IconCheck size={16} strokeWidth={2.5} />
                )}
                {locked ? "ปิดรอบแล้ว" : saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* กล่องเตือนก่อนสลับพนักงาน/เดือน ทั้งที่ยังมี draft ค้าง (in-app) */}
      {pendingNav && (
        <BaseModal
          onClose={() => setPendingNav(null)}
          zIndexClass="z-1000"
          maxWidthClass="max-w-[360px]"
          overlayClassName="px-6 bg-[rgba(45,26,14,0.55)] backdrop-blur-xs"
          contentClassName="rounded-[20px] px-6 py-7"
        >
          <div className="w-14 h-14 rounded-full bg-amber-lt flex items-center justify-center mx-auto mb-4">
            <IconAlertTriangle
              size={26}
              className="text-amber"
              strokeWidth={2.5}
            />
          </div>
          <div className="font-bold text-lg text-txt text-center mb-2">
            ยังไม่ได้บันทึกการเปลี่ยนแปลง
          </div>
          <div className="text-sm text-txt-mid text-center mb-5 leading-[1.8]">
            หากเปลี่ยน{pendingNav.kind === "month" ? "เดือน" : "พนักงาน"}{" "}
            ข้อมูลที่แก้ไขจะหายไป
            <br />
            ต้องการเปลี่ยนใช่ไหม?
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setPendingNav(null)}
              className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              อยู่ต่อ
            </button>
            <button
              onClick={() => {
                const nav = pendingNav;
                setPendingNav(null);
                setDraft({});
                if (nav.kind === "employee") setSelectedEmployeeId(nav.value);
                else setSelectedMonth(nav.value);
              }}
              className="flex-1 p-3.5 rounded-xl border-none bg-amber text-white text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_#D9770640]"
            >
              ยืนยัน
            </button>
          </div>
        </BaseModal>
      )}

      {showPoolFlow && (
        <PoolFlowModal
          onClose={() => setShowPoolFlow(false)}
          isAdmin={true}
          currentEmployee={null}
          employeeDirectory={employeeDirectory}
          salaryData={liveSalaryData}
          allLeaves={allLeaves}
          roles={roles}
          initialMonth={selectedMonth}
          poolAdjustments={poolAdjustments}
          isConfirmed={!!payrollConfirms?.[selectedMonth]?.confirmedAt}
          payPersonalUnderAllExclusion={
            !isMonthLocked(payrollConfirms?.[selectedMonth])
          }
        />
      )}

      {showPoolAdjust && (
        <PoolAdjustmentModal
          yearMonth={selectedMonth}
          locked={locked}
          adjustment={poolAdjustments?.[selectedMonth]}
          poolGroups={poolGroupsInfo}
          roles={roles}
          employeeDirectory={employeeDirectory}
          onSave={onSetPoolAdjustment}
          onClose={() => setShowPoolAdjust(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
