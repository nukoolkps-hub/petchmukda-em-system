import { IconCheck, IconTrash } from "@tabler/icons-react";
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

  /* ─── รายการหักที่เพิ่มเอง (customDeductions) ───────────────── */
  function currentCustomDeductions(d) {
    if (Array.isArray(d.customDeductions)) return d.customDeductions;
    if (Array.isArray(savedData.customDeductions))
      return savedData.customDeductions;
    return [];
  }
  function addCustomDeduction() {
    setDraft((d) => ({
      ...d,
      customDeductions: [
        ...currentCustomDeductions(d),
        { label: "", amount: 0 },
      ],
    }));
  }
  function updateCustomDeduction(index, field, value) {
    setDraft((d) => ({
      ...d,
      customDeductions: currentCustomDeductions(d).map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "amount" ? parseFloat(value) || 0 : value,
            }
          : item,
      ),
    }));
  }
  function removeCustomDeduction(index) {
    setDraft((d) => ({
      ...d,
      customDeductions: currentCustomDeductions(d).filter(
        (_, i) => i !== index,
      ),
    }));
  }

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
      {/* selectors */}
      <div className="flex gap-2 mb-3.5">
        <select
          value={selectedEmployeeId}
          onChange={(e) => tryChangeEmployee(e.target.value)}
          className="flex-2 pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
        >
          {employeeDirectory.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <div className="flex-1 px-3 py-2.5 rounded-[10px] text-sm font-semibold text-maroon bg-gold-pale font-[inherit] flex items-center justify-center gap-1.5 border-[1.5px] border-[#C9973A40]">
          📅 {THAI_MONTH_NAMES[now.getMonth()]} {now.getFullYear() + 543}
        </div>
      </div>

      {/* employee preview */}
      {employeeInfo && (
        <div className="bg-cream rounded-xl px-3.5 py-3 mb-3.5 flex items-center gap-3 border border-bdr">
          <AvatarCircle
            avatar={employeeInfo.avatar}
            avatarType={employeeInfo.avatarType}
            avatarImageUrl={employeeInfo.avatarImageUrl}
            size={40}
            fontSize={13}
            border={`2px solid ${COLORS.gold}40`}
          />
          <div className="flex-1">
            <div className="font-bold text-txt text-sm">
              {employeeInfo.name}
            </div>
            <div className="text-sm text-txt-soft">
              {employeeInfo.role || "-"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-txt-soft">เงินสุทธิ</div>
            <div className="text-base font-extrabold text-maroon">
              ฿{formatThaiNumber(salaryCalculation.netSalary)}
            </div>
          </div>
        </div>
      )}

      {/* Pool info card — แสดงตอนอยู่ใน group */}
      {poolShare && poolGroupEmployees.length > 1 && (
        <div className="rounded-xl p-3.5 mb-3.5 bg-[linear-gradient(135deg,#7B1C1C08,#C9973A10)] border border-[#C9973A40]">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="text-lg">🤝</div>
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
                  icon: "💎",
                  title: "ปิดฝั่งขายโดย Admin",
                  desc: "ไม่ได้ Pool ฝั่งขาย · ฝั่งรับซื้อยังใช้กฎ 80% ปกติ",
                },
                buy: {
                  icon: "🛍",
                  title: "ปิดฝั่งรับซื้อโดย Admin",
                  desc: "ไม่ได้ Pool ฝั่งรับซื้อ · ฝั่งขายยังใช้กฎ 80% ปกติ",
                },
                both: {
                  icon: "🔒",
                  title: "ปิดทั้งคู่โดย Admin",
                  desc: "ไม่ได้ Pool ทั้ง 2 ฝั่ง · ได้แค่ขาย-พิเศษ",
                },
              };
              const info = labels[exc] || labels.both;
              return (
                <div className="rounded-[9px] px-3 py-2.5 mb-1.5 text-sm text-red font-bold leading-relaxed flex items-center gap-2 bg-[linear-gradient(135deg,#C0392B15,#C0392B25)] border-[1.5px] border-[#C0392B50]">
                  <span className="text-lg">{info.icon}</span>
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
            <div className="bg-red rounded-[9px] px-3 py-2.5 mb-1.5 text-sm text-white font-bold leading-relaxed shadow-red-glow">
              💸 ไม่ได้รับเงินเดือนพื้นฐาน
              <div className="font-medium text-xs mt-[3px] text-[#FFE0E0]">
                ขาย {poolShare.employeeSellPieces} ชิ้น ·{" "}
                {poolShare.topSellPieces > 0
                  ? (
                      (poolShare.employeeSellPieces / poolShare.topSellPieces) *
                      100
                    ).toFixed(1)
                  : "0"}
                % ของ Top {poolShare.topSellPieces} (ต่ำกว่า 50%)
              </div>
            </div>
          )}

          {/* not eligible warnings (เฉพาะคนที่ไม่ถูก Admin ปิดในฝั่งนั้น) */}
          {poolShare.poolExclusion !== "sell" &&
            poolShare.poolExclusion !== "both" &&
            !poolShare.eligibleSell && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-1.5 text-sm text-red font-semibold leading-relaxed border border-[#C0392B40]">
                ⚠ ฝั่งขาย: ไม่ได้รับชิ้นจาก Pool
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
            )}
          {poolShare.poolExclusion !== "buy" &&
            poolShare.poolExclusion !== "both" &&
            !poolShare.eligibleBuy && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-2.5 text-sm text-red font-semibold leading-relaxed border border-[#C0392B40]">
                ⚠ ฝั่งรับซื้อ: ไม่ได้รับชิ้นจาก Pool
                <div className="font-medium text-xs mt-0.5">
                  รับซื้อ {poolShare.employeeBuyPieces} ชิ้น ·{" "}
                  {poolShare.topBuyPieces > 0
                    ? (
                        (poolShare.employeeBuyPieces / poolShare.topBuyPieces) *
                        100
                      ).toFixed(1)
                    : "0"}
                  % ของ Top {poolShare.topBuyPieces} (ขั้นต่ำ{" "}
                  {poolShare.buyEligibilityThreshold.toFixed(1)})
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
            {poolShare.eligibleSell && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                  <span>
                    💎 ฝั่งขาย ({poolShare.eligibleSellEmployeeCount} คน · Base{" "}
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
            {!poolShare.eligibleSell && (
              <div className="mb-1.5 px-2 py-1.5 bg-red-lt rounded-[7px] text-xs text-red font-semibold">
                💎 ฝั่งขาย: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            {/* ฝั่งรับซื้อ */}
            {poolShare.eligibleBuy && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-xs font-bold text-maroon mb-[3px] flex justify-between">
                  <span>
                    🛍 ฝั่งรับซื้อ ({poolShare.eligibleBuyEmployeeCount} คน · Base{" "}
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
            {!poolShare.eligibleBuy && (
              <div className="px-2 py-1.5 bg-red-lt rounded-[7px] text-xs text-red font-semibold">
                🛍 ฝั่งรับซื้อ: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            <div className="mt-1.5 px-2 py-1.5 rounded-md text-xs text-maroon text-center font-semibold leading-relaxed bg-[#C9973A15]">
              สูตร: % ที่ได้ = Base − % การหัก + Σ(% แบ่งเพื่อน)
              <br />✨ ขาย-พิเศษไม่เข้า Pool — ใครขายใครได้
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
                      className={`min-w-8 ${isMe ? "font-bold" : "font-medium"}`}
                    >
                      {g.avatar}
                    </span>
                    <span
                      className={`px-1.5 py-px rounded-md text-xs font-semibold ${gES ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                    >
                      ขาย {gSell} {gES ? "✓" : "✗"}
                    </span>
                    <span
                      className={`px-1.5 py-px rounded-md text-xs font-semibold ${gEB ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                    >
                      ซื้อ {gBuy} {gEB ? "✓" : "✗"}
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
                <div className="text-sm font-bold text-txt">📦 จำนวนชิ้น</div>
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
            <div className="text-xs text-txt-soft mt-2.5 text-center">
              💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
            </div>
          </div>
        ) : (
          /* Commission ยอดขาย & รับซื้อ — pieces × rate (3 ช่อง) */
          <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
              <div className="font-bold text-sm text-txt">ค่าคอมตามจำนวนชิ้น</div>
              <div className="ml-auto text-xs font-semibold text-txt-soft">
                🤝 คำนวณใน Pool
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
                      💎 ขาย (ทั่วไป)
                      {disabled && (
                        <span className="text-xs px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20]">
                          🔒 ถูกปิด
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
                <div className="text-sm font-bold text-txt">✨ ขาย (พิเศษ)</div>
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
                      🛍 รับซื้อ
                      {disabled && (
                        <span className="text-xs px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20]">
                          🔒 ถูกปิด
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

            <div className="text-xs text-txt-soft mt-2.5 text-center">
              💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
            </div>
            {poolShare && (
              <div className="mt-2 text-xs text-maroon text-center px-2.5 py-1.5 rounded-lg bg-[#C9973A15]">
                🤝 ค่าคอมจะถูกคำนวณจาก Pool หลังจากที่ Admin บันทึกชิ้นของทุกคนแล้ว
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
              <div className="text-sm font-bold text-txt">🎫 เชิญชวนสมัครบัตร</div>
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
              <div className="text-sm font-bold text-txt">🔄 ย้ายข้อมูลบัตร</div>
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
            <span className="text-base">💼</span>
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
            <span className="text-base">💎</span>
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
            <span className="text-base">🎫</span>
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
              🌟 โบนัสแห่งความขยัน(ไม่หยุด){" "}
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
            <span className="text-base">🏛</span>
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
              📋 หักลาเกินโควต้า{" "}
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
              💵 หักเงินเบิกล่วงหน้า{" "}
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
            <IconCheck size={14} stroke={2.5} />
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      )}
    </div>
  );
}
