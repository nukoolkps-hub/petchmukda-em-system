import {
  AlertTriangle as IconAlertTriangle,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  ClipboardList as IconClipboardList,
  Diamond as IconDiamond,
  Handshake as IconHandshake,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  Minus as IconMinus,
  Package as IconPackage,
  Plus as IconPlus,
  RefreshCw as IconRefresh,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Star as IconStar,
  Ticket as IconTicket,
  Trash2 as IconTrash,
  TrendingDown as IconTrendingDown,
  X as IconX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { useApprovedAdvancesByMonth } from "../../firebase/hooks/useFirestore";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import {
  calculateSalary,
  computePoolSharesForGroup,
} from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Salary Admin Edit ────────────────────────────────────────── */
export default function SalaryAdminEdit({
  employeeDirectory,
  salaryData,
  setSalaryData,
  onSaveSalary,
  allLeaves,
  advanceRequests,
  roles,
  setUnsavedDirty,
}) {
  const now = new Date();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    employeeDirectory[0]?.id || "",
  );
  const [selectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const monthlyApprovedAdvances = useApprovedAdvancesByMonth(selectedMonth);

  const employeeInfo = employeeDirectory.find(
    (e) => e.id === selectedEmployeeId,
  );
  const employeeRole = roles?.find((r) => r.id === employeeInfo?.roleId);
  const savedData = salaryData[selectedEmployeeId]?.[selectedMonth] || {
    baseSalary: 0,
    normalSalePieces: 0,
    specialSalePieces: 0,
    buyPieces: 0,
    invitePieces: 0,
    transferPieces: 0,
    lateDeduction: 0,
    note: "",
  };
  const data = useMemo(() => ({ ...savedData, ...draft }), [savedData, draft]);
  const dirty = Object.keys(draft).length > 0;

  // sync dirty ขึ้น parent (สำหรับเตือนก่อนเปลี่ยน section)
  useEffect(() => {
    setUnsavedDirty?.(dirty);
  }, [dirty, setUnsavedDirty]);
  useEffect(() => () => setUnsavedDirty?.(false), [setUnsavedDirty]); // unmount → clear

  // ถ้าเปลี่ยน employee ภายในหน้านี้ — ถ้ามี draft ให้เตือนก่อน
  function tryChangeEmployee(newId) {
    if (dirty) {
      const ok = window.confirm(
        "⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากเปลี่ยนพนักงาน ข้อมูลที่แก้ไขจะหายไป\n\nต้องการเปลี่ยนพนักงานใช่ไหม?",
      );
      if (!ok) return;
    }
    setDraft({});
    setSelectedEmployeeId(newId);
  }

  useEffect(() => {
    setDraft({});
  }, []);

  const monthLeaves = employeeInfo
    ? allLeaves.filter(
        (lv) =>
          lv.employeeName === employeeInfo.name &&
          lv.start.startsWith(selectedMonth),
      )
    : [];
  const overInfo = getOverQuotaDays(monthLeaves);
  const overTotalDays = overInfo.weekdays + overInfo.sundays;
  const totalLeaveDays = countWeekdayLeaves(monthLeaves);
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

  /* ─── Heavy computation: memoized ───────────────────────────────── */
  const { poolShare, poolGroupEmployees, salaryCalculation } = useMemo(() => {
    let employeePoolShare: any = null;
    let poolGroupEmployeesDraft: any[] = [];
    if (employeeRole?.poolGroup) {
      poolGroupEmployeesDraft = employeeDirectory.filter((employee) => {
        const role = roles.find(
          (candidateRole) => candidateRole.id === employee.roleId,
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
      });
      employeePoolShare = shares[selectedEmployeeId];
    }
    const computedSalary = calculateSalary(
      data,
      overInfo,
      employeeInfo,
      totalLeaveDays,
      approvedAdvanceTotal,
      employeePoolShare,
      employeeRole,
    );
    return {
      poolShare: employeePoolShare,
      poolGroupEmployees: poolGroupEmployeesDraft,
      salaryCalculation: computedSalary,
    };
  }, [
    employeeRole,
    employeeDirectory,
    roles,
    liveSalaryData,
    allLeaves,
    selectedMonth,
    selectedEmployeeId,
    data,
    overInfo,
    employeeInfo,
    totalLeaveDays,
    approvedAdvanceTotal,
  ]);

  function update(field, value) {
    const num = field === "note" ? value : parseFloat(value) || 0;
    setDraft((d) => ({ ...d, [field]: num }));
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
        await onSaveSalary(selectedEmployeeId, selectedMonth, nextMonthData);
      } else {
        setSalaryData((d) => {
          const next = { ...d };
          if (!next[selectedEmployeeId]) next[selectedEmployeeId] = {};
          next[selectedEmployeeId][selectedMonth] = nextMonthData;
          return next;
        });
      }
      setDraft({});
    } catch (err) {
      console.error("[SalaryAdminEdit] save salary failed:", err);
      alert("บันทึกเงินเดือนไม่สำเร็จ");
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

  const pieceCommissionTotal =
    (salaryCalculation.singleRateCommission || 0) +
    (salaryCalculation.normalSaleCommission || 0) +
    (salaryCalculation.specialSaleCommission || 0) +
    (salaryCalculation.buyCommission || 0);

  return (
    <div>
      {/* month display */}
      <div className="flex justify-end mb-2.5">
        <div className="px-3 py-2 rounded-[10px] text-sm font-semibold text-maroon bg-gold-pale font-[inherit] flex items-center gap-1.5 border-[1.5px] border-[#C9973A40]">
          <IconCalendar size={14} strokeWidth={2.4} />
          {THAI_MONTH_NAMES[now.getMonth()]} {now.getFullYear() + 543}
        </div>
      </div>

      {/* employee cards — เลือกพนักงานแบบการ์ด มองง่ายกว่า dropdown
         จุดสถานะ: เขียว=บันทึกชิ้นเดือนนี้แล้ว, เทา=ยังไม่บันทึก */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-3.5">
        {employeeDirectory.map((employee) => {
          const selected = employee.id === selectedEmployeeId;
          const role = roles?.find((r) => r.id === employee.roleId);
          const monthData = salaryData[employee.id]?.[selectedMonth];
          const hasData = !!(
            monthData &&
            ((monthData.singleRatePieces || 0) > 0 ||
              (monthData.normalSalePieces || 0) > 0 ||
              (monthData.specialSalePieces || 0) > 0 ||
              (monthData.buyPieces || 0) > 0 ||
              (monthData.invitePieces || 0) > 0 ||
              (monthData.transferPieces || 0) > 0)
          );
          return (
            <button
              key={employee.id}
              type="button"
              onClick={() => tryChangeEmployee(employee.id)}
              className={`relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 rounded-xl border-[1.5px] cursor-pointer font-[inherit] transition-colors ${
                selected
                  ? "border-gold bg-gold-pale shadow-[0_2px_8px_rgba(201,151,58,0.25)]"
                  : "border-bdr bg-white"
              }`}
            >
              <span
                aria-label={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                title={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
                  hasData ? "bg-green" : "bg-txt-soft/40"
                }`}
              />
              <AvatarCircle
                avatar={employee.avatar}
                avatarType={employee.avatarType}
                avatarImageUrl={employee.avatarImageUrl}
                size={44}
                fontSize={14}
                border={`2px solid ${COLORS.gold}40`}
              />
              <div className="w-full min-w-0 text-center">
                <div
                  className={`font-bold text-sm truncate leading-tight ${selected ? "text-maroon" : "text-txt"}`}
                >
                  {employee.name}
                </div>
                <div className="text-xs text-txt-soft truncate leading-tight mt-0.5 inline-flex items-center gap-1">
                  <IconBriefcase size={11} strokeWidth={2.4} />
                  {employee.role || "-"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pool info card — แสดงตอนอยู่ใน group */}
      {poolShare && poolGroupEmployees.length > 1 && (
        <div className="rounded-xl p-3.5 mb-3.5 bg-[linear-gradient(135deg,#7B1C1C08,#C9973A10)] border border-[#C9973A40]">
          <div className="flex items-center gap-2 mb-2.5">
            <IconHandshake size={18} strokeWidth={2.2} color={COLORS.gold} />
            <div className="text-sm font-bold text-maroon">
              Pool ค่าคอม "{employeeRole?.name}"
            </div>
            <span className="text-xs font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              {poolGroupEmployees.length} คน
            </span>
          </div>
          <div className="text-xs text-txt-mid mb-2 leading-relaxed">
            ตัดสิทธิ์ฝั่งขาย/รับซื้อ แยกกัน · &lt; 80% ของ Top = ตัดออก
            <br />
            แบ่ง Pool ตามสูตร: % ได้ = Base − % หัก + Σ% แบ่งเพื่อน
          </div>

          {/* Admin-locked: ปิดสิทธิ์ Pool */}
          {poolShare.poolExclusion &&
            (() => {
              const exc = poolShare.poolExclusion;
              const labels = {
                sell: {
                  Icon: IconDiamond,
                  title: "ปิดฝั่งขายโดย Admin",
                  desc: "ไม่ได้ Pool ฝั่งขาย · ฝั่งรับซื้อยังใช้กฎ 80% ปกติ",
                },
                buy: {
                  Icon: IconShoppingBag,
                  title: "ปิดฝั่งรับซื้อโดย Admin",
                  desc: "ไม่ได้ Pool ฝั่งรับซื้อ · ฝั่งขายยังใช้กฎ 80% ปกติ",
                },
                both: {
                  Icon: IconLock,
                  title: "ปิดทั้งคู่โดย Admin",
                  desc: "ไม่ได้ Pool ทั้ง 2 ฝั่ง · ได้แค่ขาย-พิเศษ",
                },
              };
              const info = labels[exc] || labels.both;
              const ExclusionIcon = info.Icon;
              return (
                <div className="rounded-[9px] px-3 py-2.5 mb-1.5 text-sm text-red font-bold leading-relaxed flex items-center gap-2 bg-[linear-gradient(135deg,#C0392B15,#C0392B25)] border-[1.5px] border-[#C0392B50]">
                  <ExclusionIcon size={18} strokeWidth={2.4} />
                  <div className="flex-1">
                    <div>{info.title}</div>
                    <div className="font-medium text-[10.5px] mt-0.5 text-[#C0392BCC]">
                      {info.desc}
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

          {/* not eligible warnings (เฉพาะคนที่ไม่ถูก Admin ปิดในฝั่งนั้น) */}
          {poolShare.poolExclusion !== "sell" &&
            poolShare.poolExclusion !== "both" &&
            !poolShare.eligibleForSellPool && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-1.5 text-sm text-red font-semibold leading-relaxed border border-[#C0392B40] flex items-start gap-1.5">
                <IconAlertTriangle
                  size={14}
                  strokeWidth={2.4}
                  className="shrink-0 mt-0.5"
                />
                <div className="flex-1">
                  ฝั่งขาย: ไม่ได้รับชิ้นจาก Pool
                  <div className="font-medium text-xs mt-0.5">
                    ขาย {poolShare.employeeSellPieces} ชิ้น ·{" "}
                    {poolShare.topSellPieces > 0
                      ? (
                          (poolShare.employeeSellPieces /
                            poolShare.topSellPieces) *
                          100
                        ).toFixed(1)
                      : "0"}
                    % ของ Top {poolShare.topSellPieces} (ขั้นต่ำ{" "}
                    {poolShare.sellEligibilityThreshold.toFixed(1)})
                  </div>
                </div>
              </div>
            )}
          {poolShare.poolExclusion !== "buy" &&
            poolShare.poolExclusion !== "both" &&
            !poolShare.eligibleForBuyPool && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-2.5 text-sm text-red font-semibold leading-relaxed border border-[#C0392B40] flex items-start gap-1.5">
                <IconAlertTriangle
                  size={14}
                  strokeWidth={2.4}
                  className="shrink-0 mt-0.5"
                />
                <div className="flex-1">
                  ฝั่งรับซื้อ: ไม่ได้รับชิ้นจาก Pool
                  <div className="font-medium text-xs mt-0.5">
                    รับซื้อ {poolShare.employeeBuyPieces} ชิ้น ·{" "}
                    {poolShare.topBuyPieces > 0
                      ? (
                          (poolShare.employeeBuyPieces /
                            poolShare.topBuyPieces) *
                          100
                        ).toFixed(1)
                      : "0"}
                    % ของ Top {poolShare.topBuyPieces} (ขั้นต่ำ{" "}
                    {poolShare.buyEligibilityThreshold.toFixed(1)})
                  </div>
                </div>
              </div>
            )}

          {/* this employee's share */}
          <div className="bg-white rounded-[10px] px-3 py-2.5 border border-bdr">
            <div className="flex justify-between text-sm mb-[5px]">
              <span className="text-txt-mid">หยุดทั้งหมด</span>
              <span className="font-bold text-txt">
                {poolShare.leaveDays} วัน
              </span>
            </div>
            <div className="h-px bg-bdr my-1.5" />

            {/* ฝั่งขาย */}
            {poolShare.eligibleForSellPool && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                  <span className="inline-flex items-center gap-1">
                    <IconDiamond size={12} strokeWidth={2.4} />
                    ฝั่งขาย ({poolShare.eligibleSellEmployeeCount} คน · Base{" "}
                    {poolShare.sellBaseSharePercent.toFixed(1)}%)
                  </span>
                  <span>{poolShare.sellSharePercent.toFixed(2)}%</span>
                </div>
                <div className="text-xs text-txt-soft leading-relaxed">
                  หัก: <b>{poolShare.sellLeaveDeductionPercent.toFixed(2)}%</b> ·
                  แบ่งเพื่อน:{" "}
                  <b>{poolShare.sellRedistributedPercent.toFixed(2)}%</b>
                  <br />
                  ได้ชิ้น:{" "}
                  <b className="text-green">
                    {salaryCalculation.normalSalePieces.toFixed(1)}
                  </b>{" "}
                  / {poolShare.totalSellPoolPieces}
                </div>
              </div>
            )}
            {!poolShare.eligibleForSellPool && (
              <div className="mb-1.5 px-2 py-1.5 bg-red-lt rounded-[7px] text-xs text-red font-semibold flex items-center gap-1">
                <IconDiamond size={12} strokeWidth={2.4} />
                ฝั่งขาย:
                <IconX size={12} strokeWidth={3} />
                ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            {/* ฝั่งรับซื้อ */}
            {poolShare.eligibleForBuyPool && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                  <span className="inline-flex items-center gap-1">
                    <IconShoppingBag size={12} strokeWidth={2.4} />
                    ฝั่งรับซื้อ ({poolShare.eligibleBuyEmployeeCount} คน · Base{" "}
                    {poolShare.buyBaseSharePercent.toFixed(1)}%)
                  </span>
                  <span>{poolShare.buySharePercent.toFixed(2)}%</span>
                </div>
                <div className="text-xs text-txt-soft leading-relaxed">
                  หัก: <b>{poolShare.buyLeaveDeductionPercent.toFixed(2)}%</b> ·
                  แบ่งเพื่อน:{" "}
                  <b>{poolShare.buyRedistributedPercent.toFixed(2)}%</b>
                  <br />
                  ได้ชิ้น:{" "}
                  <b className="text-green">
                    {salaryCalculation.buyPieces.toFixed(1)}
                  </b>{" "}
                  / {poolShare.totalBuyPoolPieces}
                </div>
              </div>
            )}
            {!poolShare.eligibleForBuyPool && (
              <div className="px-2 py-1.5 bg-red-lt rounded-[7px] text-xs text-red font-semibold flex items-center gap-1">
                <IconShoppingBag size={12} strokeWidth={2.4} />
                ฝั่งรับซื้อ:
                <IconX size={12} strokeWidth={3} />
                ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            <div className="mt-1.5 px-2 py-1.5 rounded-md text-xs text-maroon text-center font-semibold leading-relaxed bg-[#C9973A15]">
              สูตร: % ที่ได้ = Base − % การหัก + Σ(% แบ่งเพื่อน)
              <br />
              <span className="inline-flex items-center gap-1">
                <IconSparkles size={11} strokeWidth={2.4} />
                ขาย-พิเศษไม่เข้า Pool — ใครขายใครได้
              </span>
            </div>
          </div>

          {/* members */}
          <div className="mt-2.5">
            <div className="text-xs text-txt-soft mb-1.5">สมาชิกในกลุ่ม:</div>
            <div className="flex flex-col gap-1">
              {poolGroupEmployees.map((g) => {
                const gSal = salaryData[g.id]?.[selectedMonth];
                const gSell =
                  (gSal?.normalSalePieces || 0) +
                  (gSal?.specialSalePieces || 0);
                const gBuy = gSal?.buyPieces || 0;
                const gES =
                  poolShare.topSellPieces === 0
                    ? true
                    : gSell >= poolShare.sellEligibilityThreshold;
                const gEB =
                  poolShare.topBuyPieces === 0
                    ? true
                    : gBuy >= poolShare.buyEligibilityThreshold;
                const isMe = g.id === selectedEmployeeId;
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-1.5 px-2.5 py-[5px] rounded-[9px] text-xs text-txt-mid border ${isMe ? "bg-gold-pale border-gold" : "bg-white border-bdr"}`}
                  >
                    <span
                      className={`flex-1 min-w-0 truncate ${isMe ? "font-bold text-maroon" : "font-medium"}`}
                    >
                      {g.name}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-px rounded-md text-xs font-semibold inline-flex items-center gap-0.5 ${gES ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                    >
                      ขาย {gSell}
                      {gES ? (
                        <IconCheck size={11} strokeWidth={3} />
                      ) : (
                        <IconX size={11} strokeWidth={3} />
                      )}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-px rounded-md text-xs font-semibold inline-flex items-center gap-0.5 ${gEB ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                    >
                      ซื้อ {gBuy}
                      {gEB ? (
                        <IconCheck size={11} strokeWidth={3} />
                      ) : (
                        <IconX size={11} strokeWidth={3} />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: 2 คอลัมน์ — ซ้าย ค่าคอม+รายรับ / ขวา บัตรสมาชิก+รายการหัก (มือถือเรียงเดี่ยวเหมือนเดิม) */}
      <div className="md:grid md:grid-cols-2 md:gap-x-3.5 md:items-start">
        {/* Commission section — single rate or 3 sub-sections */}
        {employeeRole && !employeeRole.poolGroup ? (
          /* Single rate (เช่น ฝ่ายบัญชี) */
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
              <div className="font-bold text-sm text-txt">ค่าคอม</div>
              <div className="ml-auto text-sm font-bold text-gold">
                +฿{formatThaiNumber(salaryCalculation.singleRateCommission)}
              </div>
            </div>
            <div className="bg-gold-pale rounded-[10px] p-3 border border-[#C9973A30]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-txt flex items-center gap-1.5">
                  <IconPackage size={16} strokeWidth={2.2} />
                  จำนวนชิ้น
                </div>
                <div className="text-xs text-txt-soft">
                  Rate:{" "}
                  <b className="text-maroon">
                    ฿{formatThaiNumber(employeeInfo?.singlePieceRate || 0)}/ชิ้น
                  </b>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={data.singleRatePieces || ""}
                    onChange={(e) => update("singleRatePieces", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-txt bg-white text-center"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                    ชิ้น
                  </span>
                </div>
                <div className="text-sm text-txt-soft font-semibold">=</div>
                <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-base font-bold text-green text-right border border-bdr">
                  ฿{formatThaiNumber(salaryCalculation.singleRateCommission)}
                </div>
              </div>
            </div>
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
                คำนวณใน Pool
              </div>
            </div>

            {/* Pre-compute disabled flags */}
            {(() => {
              const exc = employeeInfo?.poolExclusion;
              const _sellDisabled = exc === "sell" || exc === "both";
              const _buyDisabled = exc === "buy" || exc === "both";
              return null;
            })()}

            {/* Normal */}
            {(() => {
              const exc = employeeInfo?.poolExclusion;
              const disabled = exc === "sell" || exc === "both";
              return (
                <div
                  className={`rounded-[10px] p-3 mb-2.5 relative border ${disabled ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`text-sm font-bold flex items-center gap-1.5 ${disabled ? "text-txt-soft" : "text-txt"}`}
                    >
                      <IconDiamond size={14} strokeWidth={2.4} />
                      ขาย (ทั่วไป)
                      {disabled && (
                        <span className="text-xs px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20] inline-flex items-center gap-0.5">
                          <IconLock size={11} strokeWidth={2.4} />
                          ถูกปิด
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-txt-soft">
                      Rate:{" "}
                      <b className="text-maroon">
                        ฿
                        {formatThaiNumber(
                          employeeInfo?.normalSalePieceRate || 0,
                        )}
                        /ชิ้น
                      </b>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={disabled ? "" : data.normalSalePieces || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          update("normalSalePieces", e.target.value)
                        }
                        className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${disabled ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                        ชิ้น
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Special — ใครขายใครได้ ไม่ขึ้นกับ poolExclusion */}
            <div className="bg-gold-pale rounded-[10px] p-3 mb-2.5 border border-[#C9973A30]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-txt flex items-center gap-1.5">
                  <IconSparkles size={16} strokeWidth={2.2} />
                  ขาย (พิเศษ)
                </div>
                <div className="text-xs text-txt-soft">
                  Rate:{" "}
                  <b className="text-maroon">
                    ฿{formatThaiNumber(employeeInfo?.specialSalePieceRate || 0)}
                    /ชิ้น
                  </b>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={data.specialSalePieces || ""}
                    onChange={(e) =>
                      update("specialSalePieces", e.target.value)
                    }
                    className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-txt bg-white text-center"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                    ชิ้น
                  </span>
                </div>
              </div>
            </div>

            {/* Buy */}
            {(() => {
              const exc = employeeInfo?.poolExclusion;
              const disabled = exc === "buy" || exc === "both";
              return (
                <div
                  className={`rounded-[10px] p-3 relative border ${disabled ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`text-sm font-bold flex items-center gap-1.5 ${disabled ? "text-txt-soft" : "text-txt"}`}
                    >
                      <IconShoppingBag size={14} strokeWidth={2.4} />
                      รับซื้อ
                      {disabled && (
                        <span className="text-xs px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20] inline-flex items-center gap-0.5">
                          <IconLock size={11} strokeWidth={2.4} />
                          ถูกปิด
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-txt-soft">
                      Rate:{" "}
                      <b className="text-maroon">
                        ฿{formatThaiNumber(employeeInfo?.buyPieceRate || 0)}/ชิ้น
                      </b>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={disabled ? "" : data.buyPieces || ""}
                        disabled={disabled}
                        onChange={(e) => update("buyPieces", e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-center ${disabled ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                        ชิ้น
                      </span>
                    </div>
                  </div>
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
            {poolShare && (
              <div className="mt-2 text-xs text-maroon text-center px-2.5 py-1.5 rounded-lg bg-[#C9973A15] inline-flex items-center justify-center gap-1 w-full">
                <IconHandshake size={12} strokeWidth={2.4} />
                ค่าคอมจะถูกคำนวณจาก Pool หลังจากที่ Admin บันทึกชิ้นของทุกคนแล้ว
              </div>
            )}
          </div>
        )}

        {/* บัตรสมาชิก — pieces × rate */}
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-maroon-lt" />
            <div className="font-bold text-sm text-txt">โบนัสบัตรสมาชิก</div>
            <div className="ml-auto text-sm font-bold text-maroon">
              +฿{formatThaiNumber(salaryCalculation.memberBonusTotal)}
            </div>
          </div>

          {/* Invite */}
          <div className="bg-gold-pale rounded-[10px] p-3 mb-2.5 border border-[#C9973A30]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-txt flex items-center gap-1.5">
                <IconTicket size={16} strokeWidth={2.2} />
                เชิญชวนสมัครบัตร
              </div>
              <div className="text-xs text-txt-soft">
                Rate:{" "}
                <b className="text-maroon">
                  ฿{formatThaiNumber(employeeInfo?.invitePieceRate || 0)}/ใบ
                </b>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.invitePieces || ""}
                  onChange={(e) => update("invitePieces", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-txt bg-white text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                  ใบ
                </span>
              </div>
              <div className="text-sm text-txt-soft font-semibold">=</div>
              <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-base font-bold text-green text-right border border-bdr">
                ฿{formatThaiNumber(salaryCalculation.inviteCommission)}
              </div>
            </div>
          </div>

          {/* Transfer */}
          <div className="bg-gold-pale rounded-[10px] p-3 border border-[#C9973A30]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-txt flex items-center gap-1.5">
                <IconRefresh size={16} strokeWidth={2.2} />
                ย้ายข้อมูลบัตร
              </div>
              <div className="text-xs text-txt-soft">
                Rate:{" "}
                <b className="text-maroon">
                  ฿{formatThaiNumber(employeeInfo?.transferPieceRate || 0)}/ใบ
                </b>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.transferPieces || ""}
                  onChange={(e) => update("transferPieces", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-base font-bold outline-none font-[inherit] text-txt bg-white text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-xs font-semibold pointer-events-none">
                  ใบ
                </span>
              </div>
              <div className="text-sm text-txt-soft font-semibold">=</div>
              <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-base font-bold text-green text-right border border-bdr">
                ฿{formatThaiNumber(salaryCalculation.transferCommission)}
              </div>
            </div>
          </div>
        </div>

        {/* Earnings inputs */}
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-green" />
            <div className="font-bold text-sm text-txt">รายรับ</div>
            <div className="ml-auto text-sm font-bold text-green">
              +฿{formatThaiNumber(salaryCalculation.earnings)}
            </div>
          </div>

          {/* Base salary — read-only (กำหนดในข้อมูลพนักงาน) */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconBriefcase size={16} strokeWidth={2.2} color={COLORS.maroon} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold flex items-center gap-1.5">
                <span>เงินเดือนพื้นฐาน</span>
                <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                  แก้ในแท็บ "ข้อมูลพนักงาน"
                </span>
              </div>
              <div className="text-base font-bold text-txt mt-px">
                ฿{formatThaiNumber(employeeInfo?.baseSalary || 0)}
              </div>
            </div>
          </div>

          {/* Commission total — สรุปจากค่าคอมด้านบน */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconDiamond size={16} strokeWidth={2.2} color={COLORS.gold} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold">
                รวมค่าคอมตามจำนวนชิ้น
              </div>
              <div className="text-base font-bold text-green mt-px">
                +฿{formatThaiNumber(pieceCommissionTotal)}
              </div>
            </div>
          </div>

          {/* Member-card bonus total — สรุปจากโบนัสบัตรสมาชิกด้านบน */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconTicket size={16} strokeWidth={2.2} color={COLORS.gold} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold">
                รวมโบนัสบัตรสมาชิก
              </div>
              <div className="text-base font-bold text-green mt-px">
                +฿{formatThaiNumber(salaryCalculation.memberBonusTotal)}
              </div>
            </div>
          </div>

          {FIELDS_EARN.map((f) => (
            <div key={f.key} className="mb-2.5">
              <label className="flex text-sm text-txt-mid mb-[5px] font-medium">
                {f.icon} {f.label}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                  ฿
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={data[f.key] || ""}
                  onChange={(e) => update(f.key, e.target.value)}
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
              <IconStar size={14} strokeWidth={2.4} />
              โบนัสแห่งความขยัน(ไม่หยุด){" "}
              <span className="text-xs font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                อัตโนมัติ
              </span>
            </div>
            <div className="text-txt-mid">
              เรท/วัน = ฿{formatThaiNumber(employeeInfo?.baseSalary || 0)} ÷ 30 ={" "}
              <b>
                ฿
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}
              </b>
            </div>
            <div className="text-txt-mid">
              เดือนนี้ลาวันธรรมดา <b>{salaryCalculation.leaveDays}</b> วัน{" "}
              <span className="text-xs text-txt-soft">(ไม่นับวันอาทิตย์)</span>
            </div>
            {salaryCalculation.leaveDays <= 2 ? (
              <div className="text-green font-bold mt-1 pt-1 border-t border-dashed border-[#1A6B3A40]">
                ได้โบนัส (2 − {salaryCalculation.leaveDays}) × ฿
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                = +฿
                {formatThaiNumber(salaryCalculation.attendanceBonus)}
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
                  onChange={(e) =>
                    updateCustomEarning(index, "label", e.target.value)
                  }
                  placeholder="ชื่อรายการ"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-[10px] border border-bdr text-sm font-semibold outline-none font-[inherit] text-txt bg-cream"
                />
                <div className="relative w-[110px] shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                    ฿
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item?.amount || ""}
                    onChange={(e) =>
                      updateCustomEarning(index, "amount", e.target.value)
                    }
                    className="w-full py-2.5 pr-2 pl-[26px] rounded-[10px] border border-bdr text-sm font-bold text-right outline-none font-[inherit] text-txt bg-cream"
                  />
                </div>
                <button
                  type="button"
                  aria-label="ลบรายการ"
                  onClick={() => removeCustomEarning(index)}
                  className="w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
                >
                  <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            onClick={addCustomEarning}
            className="w-full mt-2.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-green/40 bg-green-lt text-green text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            เพิ่มรายการรายรับ
          </button>
        </div>

        {/* Deductions inputs */}
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-red" />
            <div className="font-bold text-sm text-txt">รายการหัก</div>
            <div className="ml-auto text-sm font-bold text-red">
              −฿{formatThaiNumber(salaryCalculation.deductions)}
            </div>
          </div>
          {/* Social security — read-only (กำหนดในข้อมูลพนักงาน) */}
          <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
            <IconBuildingBank size={16} strokeWidth={2.2} color={COLORS.red} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-txt-soft font-semibold flex items-center gap-1.5">
                <span>หักประกันสังคม</span>
                <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                  แก้ในแท็บ "ข้อมูลพนักงาน"
                </span>
              </div>
              <div className="text-base font-bold text-txt mt-px">
                −฿{formatThaiNumber(salaryCalculation.socialSecurity || 0)}
              </div>
            </div>
          </div>
          {/* over-quota auto note */}
          <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-sm text-txt-mid leading-[1.7] border border-[#C9973A30]">
            <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
              <IconClipboardList size={14} strokeWidth={2.4} />
              หักลาเกินโควต้า{" "}
              <span className="text-xs font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
                อัตโนมัติ
              </span>
            </div>
            <div>
              เรท/วัน = ฿{formatThaiNumber(employeeInfo?.baseSalary || 0)} ÷ 30 ={" "}
              <b>
                ฿
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}
              </b>
            </div>
            {overInfo.weekdays > 0 && (
              <div>
                วันธรรมดา {overInfo.weekdays} วัน × ฿
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                ={" "}
                <b>
                  ฿
                  {formatThaiNumber(
                    Math.round(
                      overInfo.weekdays *
                        (salaryCalculation.dailySalaryRate || 0),
                    ),
                  )}
                </b>
              </div>
            )}
            {overInfo.sundays > 0 && (
              <div>
                วันอาทิตย์ {overInfo.sundays} วัน × ฿
                {formatThaiNumber(
                  Math.round(salaryCalculation.dailySalaryRate || 0),
                )}{" "}
                × 1.5 ={" "}
                <b>
                  ฿
                  {formatThaiNumber(
                    Math.round(
                      overInfo.sundays *
                        (salaryCalculation.dailySalaryRate || 0) *
                        1.5,
                    ),
                  )}
                </b>
              </div>
            )}
            {overTotalDays === 0 && (
              <div className="text-txt-soft">ไม่มีการลาเกินโควต้า</div>
            )}
            {overTotalDays > 0 && (
              <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                รวมหัก: −฿
                {formatThaiNumber(salaryCalculation.overQuotaDeduction)}
              </div>
            )}
          </div>

          {/* auto advance deduction note */}
          <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-sm text-txt-mid leading-[1.7] border border-[#C9973A30]">
            <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
              <IconBanknote size={14} strokeWidth={2.4} />
              หักเงินเบิกล่วงหน้า{" "}
              <span className="text-xs font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
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
                      <b>฿{formatThaiNumber(r.amount)}</b>
                    </div>
                  );
                })}
                <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                  รวมหัก: −฿
                  {formatThaiNumber(salaryCalculation.advanceDeduction)}
                </div>
              </>
            )}
          </div>

          {/* custom deductions — รายการหักที่เพิ่มเอง */}
          {(Array.isArray(data.customDeductions)
            ? data.customDeductions
            : []
          ).map((item, index) => (
            <div key={index} className="flex items-center gap-2 mt-2.5">
              <input
                type="text"
                value={item?.label || ""}
                onChange={(e) =>
                  updateCustomDeduction(index, "label", e.target.value)
                }
                placeholder="ชื่อรายการ"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-[10px] border border-bdr text-sm font-semibold outline-none font-[inherit] text-txt bg-cream"
              />
              <div className="relative w-[110px] shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold">
                  ฿
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={item?.amount || ""}
                  onChange={(e) =>
                    updateCustomDeduction(index, "amount", e.target.value)
                  }
                  className="w-full py-2.5 pr-2 pl-[26px] rounded-[10px] border border-bdr text-sm font-bold text-right outline-none font-[inherit] text-txt bg-cream"
                />
              </div>
              <button
                type="button"
                aria-label="ลบรายการ"
                onClick={() => removeCustomDeduction(index)}
                className="w-9 h-9 shrink-0 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
              >
                <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCustomDeduction}
            className="w-full mt-2.5 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#C0392B40] bg-red-lt text-red text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
          >
            <IconPlus size={14} strokeWidth={2.4} />
            เพิ่มรายการหัก
          </button>
        </div>
      </div>

      {/* note */}
      <div className="mb-3.5">
        <label className="block text-sm text-txt-mid mb-1.5 font-semibold">
          หมายเหตุ (ถ้ามี)
        </label>
        <textarea
          value={data.note || ""}
          onChange={(e) => update("note", e.target.value)}
          rows={2}
          placeholder="ระบุหมายเหตุ..."
          className="w-full px-3.5 py-3 rounded-[10px] border border-bdr text-sm resize-none outline-none font-[inherit] text-txt bg-white"
        />
      </div>

      {/* Net summary */}
      <div className="bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-[18px] py-4 text-white flex items-center justify-between shadow-maroon-glow">
        <div>
          <div className="text-sm text-[#E8C87AAA]">
            เงินสุทธิ{" "}
            {dirty && (
              <span className="px-1.5 py-px rounded-md text-xs font-bold ml-[5px] bg-[#D9770640] text-gold-lt">
                ยังไม่บันทึก
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold text-gold-lt mt-0.5">
            ฿{formatThaiNumber(salaryCalculation.netSalary)}
          </div>
        </div>
        <div className="text-right text-sm leading-[1.7] text-[#E8C87A99]">
          รายรับ +฿{formatThaiNumber(salaryCalculation.earnings)}
          <br />
          รายหัก −฿{formatThaiNumber(salaryCalculation.deductions)}
        </div>
      </div>

      {/* Save / Cancel buttons */}
      {dirty && (
        <div className="mt-3.5 pt-3.5 border-t border-dashed border-bdr flex gap-2">
          <button
            onClick={cancelAll}
            className="flex-1 py-3 rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
          >
            ยกเลิกการแก้ไข
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className={`flex-2 py-3 rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-base font-bold font-[inherit] flex items-center justify-center gap-1.5 shadow-gold-glow ${saving ? "cursor-wait opacity-70" : "cursor-pointer"}`}
          >
            <IconCheck size={14} strokeWidth={2.5} />
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      )}
    </div>
  );
}
