import { IconCheck } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { calcSalary, computePoolSharesForGroup } from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Salary Admin Edit ────────────────────────────────────────── */
export default function SalaryAdminEdit({
  empDir,
  salaryData,
  setSalaryData,
  allLeaves,
  advanceRequests,
  roles,
  setUnsavedDirty,
}) {
  const now = new Date();
  const [selEmp, setSelEmp] = useState(empDir[0]?.id || "");
  const [selMonth, _setSelMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [draft, setDraft] = useState({});

  const empInfo = empDir.find((e) => e.id === selEmp);
  const empRole = roles?.find((r) => r.id === empInfo?.roleId);
  const savedData = salaryData[selEmp]?.[selMonth] || {
    base: 0,
    piecesNormal: 0,
    piecesSpecial: 0,
    piecesBuy: 0,
    piecesInvite: 0,
    piecesTransfer: 0,
    lateDeduction: 0,
    socialSecurity: 0,
    note: "",
  };
  const data = useMemo(() => ({ ...savedData, ...draft }), [savedData, draft]);
  const dirty = Object.keys(draft).length > 0;

  // sync dirty ขึ้น parent (สำหรับเตือนก่อนเปลี่ยน section)
  useEffect(() => {
    setUnsavedDirty?.(dirty);
  }, [dirty, setUnsavedDirty]);
  useEffect(() => () => setUnsavedDirty?.(false), [setUnsavedDirty]); // unmount → clear

  // ถ้าเปลี่ยน emp ภายในหน้านี้ — ถ้ามี draft ให้เตือนก่อน
  function tryChangeEmp(newId) {
    if (dirty) {
      const ok = window.confirm(
        "⚠️ คุณยังไม่ได้บันทึกการเปลี่ยนแปลง\n\nหากเปลี่ยนพนักงาน ข้อมูลที่แก้ไขจะหายไป\n\nต้องการเปลี่ยนพนักงานใช่ไหม?",
      );
      if (!ok) return;
    }
    setDraft({});
    setSelEmp(newId);
  }

  useEffect(() => {
    setDraft({});
  }, []);

  const monthLeaves = empInfo
    ? allLeaves.filter(
        (lv) =>
          lv.employeeName === empInfo.name && lv.start.startsWith(selMonth),
      )
    : [];
  const overInfo = getOverQuotaDays(monthLeaves);
  const overTotalDays = overInfo.weekdays + overInfo.sundays;
  const totalLeaveDays = countWeekdayLeaves(monthLeaves);
  const monthApprovedAdvances = (advanceRequests || []).filter(
    (r) =>
      r.empId === selEmp && r.month === selMonth && r.status === "approved",
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
        [selEmp]: {
          ...(salaryData[selEmp] || {}),
          [selMonth]: data,
        },
      }
    : salaryData;

  /* ─── Heavy computation: memoized ───────────────────────────────── */
  const { poolShare, poolGroupEmps, calc } = useMemo(() => {
    let _poolShare: any = null;
    let _poolGroupEmps: any[] = [];
    if (empRole?.poolGroup) {
      _poolGroupEmps = empDir.filter((e) => {
        const r = roles.find((rl) => rl.id === e.roleId);
        return r?.poolGroup === empRole.poolGroup;
      });
      const shares = computePoolSharesForGroup({
        groupEmpIds: _poolGroupEmps.map((e) => e.id),
        salaryData: liveSalaryData,
        allLeaves,
        ym: selMonth,
        empDir,
      });
      _poolShare = shares[selEmp];
    }
    const _calc = calcSalary(
      data,
      overInfo,
      empInfo,
      totalLeaveDays,
      approvedAdvanceTotal,
      _poolShare,
      empRole,
    );
    return {
      poolShare: _poolShare,
      poolGroupEmps: _poolGroupEmps,
      calc: _calc,
    };
  }, [
    empRole,
    empDir,
    roles,
    liveSalaryData,
    allLeaves,
    selMonth,
    selEmp,
    data,
    overInfo,
    empInfo,
    totalLeaveDays,
    approvedAdvanceTotal,
  ]);

  function update(field, value) {
    const num = field === "note" ? value : parseFloat(value) || 0;
    setDraft((d) => ({ ...d, [field]: num }));
  }

  function saveAll() {
    if (!dirty) return;
    setSalaryData((d) => {
      const next = { ...d };
      if (!next[selEmp]) next[selEmp] = {};
      next[selEmp][selMonth] = { ...savedData, ...draft };
      return next;
    });
    setDraft({});
  }
  function cancelAll() {
    setDraft({});
  }

  const FIELDS_EARN: { key: string; label: string; icon: string }[] = [];
  const FIELDS_DED = [
    { key: "lateDeduction", label: "หักขาดงาน/มาสาย", icon: "⏰" },
    { key: "socialSecurity", label: "หักประกันสังคม", icon: "🏛" },
  ];

  if (!calc)
    return <div className="p-5 text-txt-soft text-center">ไม่มีข้อมูลเงินเดือน</div>;

  return (
    <div>
      {/* selectors */}
      <div className="flex gap-2 mb-3.5">
        <select
          value={selEmp}
          onChange={(e) => tryChangeEmp(e.target.value)}
          className="flex-2 px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
        >
          {empDir.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <div className="flex-1 px-3 py-2.5 rounded-[10px] text-sm font-semibold text-maroon bg-gold-pale font-[inherit] flex items-center justify-center gap-1.5 border-[1.5px] border-[#C9973A40]">
          📅 {TH_MONTHS[now.getMonth()]} {now.getFullYear() + 543}
        </div>
      </div>

      {/* employee preview */}
      {empInfo && (
        <div className="bg-cream rounded-xl px-3.5 py-3 mb-3.5 flex items-center gap-3 border border-bdr">
          <AvatarCircle
            av={empInfo.av}
            avType={empInfo.avType}
            img={empInfo.img}
            size={40}
            fontSize={13}
            border={`2px solid ${C.gold}40`}
          />
          <div className="flex-1">
            <div className="font-bold text-txt text-sm">{empInfo.name}</div>
            <div className="text-xs text-txt-soft">{empInfo.role || "-"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-txt-soft">เงินสุทธิ</div>
            <div className="text-base font-extrabold text-maroon">
              ฿{TH_NUMBER(calc.net)}
            </div>
          </div>
        </div>
      )}

      {/* Pool info card — แสดงตอนอยู่ใน group */}
      {poolShare && poolGroupEmps.length > 1 && (
        <div className="rounded-xl p-3.5 mb-3.5 bg-[linear-gradient(135deg,#7B1C1C08,#C9973A10)] border border-[#C9973A40]">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="text-lg">🤝</div>
            <div className="text-[13px] font-bold text-maroon">
              Pool ค่าคอม "{empRole?.name}"
            </div>
            <span className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              {poolGroupEmps.length} คน
            </span>
          </div>
          <div className="text-[11px] text-txt-mid mb-2 leading-relaxed">
            ตัดสิทธิ์ฝั่งขาย/รับซื้อ แยกกัน · &lt; 80% ของ Top = ตัดออก
            <br />
            แบ่ง Pool ตามสูตร: % ได้ = Base − % หัก + Σ% แบ่งเพื่อน
          </div>

          {/* Admin-locked: ปิดสิทธิ์ Pool */}
          {poolShare.poolExclude &&
            (() => {
              const exc = poolShare.poolExclude;
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
                <div className="rounded-[9px] px-3 py-2.5 mb-1.5 text-xs text-red font-bold leading-relaxed flex items-center gap-2 bg-[linear-gradient(135deg,#C0392B15,#C0392B25)] border-[1.5px] border-[#C0392B50]">
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
            <div className="bg-red rounded-[9px] px-3 py-2.5 mb-1.5 text-xs text-white font-bold leading-relaxed shadow-red-glow">
              💸 ไม่ได้รับเงินเดือนพื้นฐาน
              <div className="font-medium text-[11px] mt-[3px] text-[#FFE0E0]">
                ขาย {poolShare.mySell} ชิ้น ·{" "}
                {poolShare.topSell > 0
                  ? ((poolShare.mySell / poolShare.topSell) * 100).toFixed(1)
                  : "0"}
                % ของ Top {poolShare.topSell} (ต่ำกว่า 50%)
              </div>
            </div>
          )}

          {/* not eligible warnings (เฉพาะคนที่ไม่ถูก Admin ปิดในฝั่งนั้น) */}
          {poolShare.poolExclude !== "sell" &&
            poolShare.poolExclude !== "both" &&
            !poolShare.eligibleSell && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-1.5 text-xs text-red font-semibold leading-relaxed border border-[#C0392B40]">
                ⚠ ฝั่งขาย: ไม่ได้รับชิ้นจาก Pool
                <div className="font-medium text-[11px] mt-0.5">
                  ขาย {poolShare.mySell} ชิ้น ·{" "}
                  {poolShare.topSell > 0
                    ? ((poolShare.mySell / poolShare.topSell) * 100).toFixed(1)
                    : "0"}
                  % ของ Top {poolShare.topSell} (ขั้นต่ำ{" "}
                  {poolShare.sellThreshold.toFixed(1)})
                </div>
              </div>
            )}
          {poolShare.poolExclude !== "buy" &&
            poolShare.poolExclude !== "both" &&
            !poolShare.eligibleBuy && (
              <div className="bg-red-lt rounded-[9px] px-3 py-2 mb-2.5 text-xs text-red font-semibold leading-relaxed border border-[#C0392B40]">
                ⚠ ฝั่งรับซื้อ: ไม่ได้รับชิ้นจาก Pool
                <div className="font-medium text-[11px] mt-0.5">
                  รับซื้อ {poolShare.myBuy} ชิ้น ·{" "}
                  {poolShare.topBuy > 0
                    ? ((poolShare.myBuy / poolShare.topBuy) * 100).toFixed(1)
                    : "0"}
                  % ของ Top {poolShare.topBuy} (ขั้นต่ำ{" "}
                  {poolShare.buyThreshold.toFixed(1)})
                </div>
              </div>
            )}

          {/* this employee's share */}
          <div className="bg-white rounded-[10px] px-3 py-2.5 border border-bdr">
            <div className="flex justify-between text-xs mb-[5px]">
              <span className="text-txt-mid">หยุดทั้งหมด</span>
              <span className="font-bold text-txt">
                {poolShare.leaveDays} วัน
              </span>
            </div>
            <div className="h-px bg-bdr my-1.5" />

            {/* ฝั่งขาย */}
            {poolShare.eligibleSell && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-[11px] font-bold text-maroon mb-[3px] flex justify-between">
                  <span>
                    💎 ฝั่งขาย ({poolShare.sellN} คน · Base{" "}
                    {poolShare.sellBase.toFixed(1)}%)
                  </span>
                  <span>{poolShare.sellPct.toFixed(2)}%</span>
                </div>
                <div className="text-[10px] text-txt-soft leading-relaxed">
                  หัก: <b>{poolShare.sellDeductPct.toFixed(2)}%</b> · แบ่งเพื่อน:{" "}
                  <b>{poolShare.sellSharePct.toFixed(2)}%</b>
                  <br />
                  ได้ชิ้น: <b className="text-green">{calc.pcsN.toFixed(1)}</b> /{" "}
                  {poolShare.poolN}
                </div>
              </div>
            )}
            {!poolShare.eligibleSell && (
              <div className="mb-1.5 px-2 py-1.5 bg-red-lt rounded-[7px] text-[11px] text-red font-semibold">
                💎 ฝั่งขาย: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            {/* ฝั่งรับซื้อ */}
            {poolShare.eligibleBuy && (
              <div className="mb-1.5 px-2 py-1.5 bg-cream rounded-[7px]">
                <div className="text-[11px] font-bold text-maroon mb-[3px] flex justify-between">
                  <span>
                    🛍 ฝั่งรับซื้อ ({poolShare.buyN} คน · Base{" "}
                    {poolShare.buyBase.toFixed(1)}%)
                  </span>
                  <span>{poolShare.buyPct.toFixed(2)}%</span>
                </div>
                <div className="text-[10px] text-txt-soft leading-relaxed">
                  หัก: <b>{poolShare.buyDeductPct.toFixed(2)}%</b> · แบ่งเพื่อน:{" "}
                  <b>{poolShare.buySharePct.toFixed(2)}%</b>
                  <br />
                  ได้ชิ้น: <b className="text-green">{calc.pcsB.toFixed(1)}</b> /{" "}
                  {poolShare.poolB}
                </div>
              </div>
            )}
            {!poolShare.eligibleBuy && (
              <div className="px-2 py-1.5 bg-red-lt rounded-[7px] text-[11px] text-red font-semibold">
                🛍 ฝั่งรับซื้อ: ❌ ไม่ได้รับชิ้นจาก Pool
              </div>
            )}

            <div className="mt-1.5 px-2 py-1.5 rounded-md text-[10px] text-maroon text-center font-semibold leading-relaxed bg-[#C9973A15]">
              สูตร: % ที่ได้ = Base − % การหัก + Σ(% แบ่งเพื่อน)
              <br />✨ ขาย-พิเศษไม่เข้า Pool — ใครขายใครได้
            </div>
          </div>

          {/* members */}
          <div className="mt-2.5">
            <div className="text-[11px] text-txt-soft mb-1.5">สมาชิกในกลุ่ม:</div>
            <div className="flex flex-col gap-1">
              {poolGroupEmps.map((g) => {
                const gSal = salaryData[g.id]?.[selMonth];
                const gSell =
                  (gSal?.piecesNormal || 0) + (gSal?.piecesSpecial || 0);
                const gBuy = gSal?.piecesBuy || 0;
                const gES =
                  poolShare.topSell === 0
                    ? true
                    : gSell >= poolShare.sellThreshold;
                const gEB =
                  poolShare.topBuy === 0
                    ? true
                    : gBuy >= poolShare.buyThreshold;
                const isMe = g.id === selEmp;
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-1.5 px-2.5 py-[5px] rounded-[9px] text-[11px] text-txt-mid border ${isMe ? "bg-gold-pale border-gold" : "bg-white border-bdr"}`}
                  >
                    <span
                      className={`min-w-8 ${isMe ? "font-bold" : "font-medium"}`}
                    >
                      {g.av}
                    </span>
                    <span
                      className={`px-1.5 py-px rounded-md text-[10px] font-semibold ${gES ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
                    >
                      ขาย {gSell} {gES ? "✓" : "✗"}
                    </span>
                    <span
                      className={`px-1.5 py-px rounded-md text-[10px] font-semibold ${gEB ? "bg-green-lt text-green" : "bg-red-lt text-red"}`}
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

      {/* Commission section — single rate or 3 sub-sections */}
      {empRole && !empRole.poolGroup ? (
        /* Single rate (เช่น ฝ่ายบัญชี) */
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
            <div className="font-bold text-sm text-txt">ค่าคอม</div>
            <div className="ml-auto text-sm font-bold text-gold">
              +฿{TH_NUMBER(calc.commSingle)}
            </div>
          </div>
          <div className="bg-gold-pale rounded-[10px] p-3 border border-[#C9973A30]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-bold text-txt">📦 จำนวนชิ้น</div>
              <div className="text-[11px] text-txt-soft">
                Rate:{" "}
                <b className="text-maroon">
                  ฿{TH_NUMBER(empInfo?.ratePerPiece || 0)}/ชิ้น
                </b>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.pieces || 0}
                  onChange={(e) => update("pieces", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-txt bg-white text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                  ชิ้น
                </span>
              </div>
              <div className="text-sm text-txt-soft font-semibold">=</div>
              <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-green text-right border border-bdr">
                ฿{TH_NUMBER(calc.commSingle)}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-txt-soft mt-2.5 text-center">
            💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
          </div>
        </div>
      ) : (
        /* Commission ยอดขาย & รับซื้อ — pieces × rate (3 ช่อง) */
        <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-1.5 h-4.5 rounded-sm bg-gold" />
            <div className="font-bold text-sm text-txt">ค่าคอมตามจำนวนชิ้น</div>
            <div className="ml-auto text-sm font-bold text-gold">
              +฿{TH_NUMBER(calc.commNormal + calc.commSpecial + calc.commBuy)}
            </div>
          </div>

          {/* Pre-compute disabled flags */}
          {(() => {
            const exc = empInfo?.poolExclude;
            const _sellDisabled = exc === "sell" || exc === "both";
            const _buyDisabled = exc === "buy" || exc === "both";
            return null;
          })()}

          {/* Normal */}
          {(() => {
            const exc = empInfo?.poolExclude;
            const disabled = exc === "sell" || exc === "both";
            return (
              <div
                className={`rounded-[10px] p-3 mb-2.5 relative border ${disabled ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`text-[13px] font-bold flex items-center gap-1.5 ${disabled ? "text-txt-soft" : "text-txt"}`}
                  >
                    💎 ขาย (ทั่วไป)
                    {disabled && (
                      <span className="text-[9px] px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20]">
                        🔒 ถูกปิด
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-txt-soft">
                    Rate:{" "}
                    <b className="text-maroon">
                      ฿{TH_NUMBER(empInfo?.ratePerPieceNormal || 0)}/ชิ้น
                    </b>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={disabled ? 0 : data.piecesNormal || 0}
                      disabled={disabled}
                      onChange={(e) => update("piecesNormal", e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-center ${disabled ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                      ชิ้น
                    </span>
                  </div>
                  <div className="text-sm text-txt-soft font-semibold">=</div>
                  <div
                    className={`min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-right border border-bdr ${disabled ? "text-txt-soft" : "text-green"}`}
                  >
                    ฿{TH_NUMBER(disabled ? 0 : calc.commNormal)}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Special — ใครขายใครได้ ไม่ขึ้นกับ poolExclude */}
          <div className="bg-gold-pale rounded-[10px] p-3 mb-2.5 border border-[#C9973A30]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-bold text-txt">
                ✨ ขาย (พิเศษ)
              </div>
              <div className="text-[11px] text-txt-soft">
                Rate:{" "}
                <b className="text-maroon">
                  ฿{TH_NUMBER(empInfo?.ratePerPieceSpecial || 0)}/ชิ้น
                </b>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.piecesSpecial || 0}
                  onChange={(e) => update("piecesSpecial", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-txt bg-white text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                  ชิ้น
                </span>
              </div>
              <div className="text-sm text-txt-soft font-semibold">=</div>
              <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-green text-right border border-bdr">
                ฿{TH_NUMBER(calc.commSpecial)}
              </div>
            </div>
          </div>

          {/* Buy */}
          {(() => {
            const exc = empInfo?.poolExclude;
            const disabled = exc === "buy" || exc === "both";
            return (
              <div
                className={`rounded-[10px] p-3 relative border ${disabled ? "bg-cream border-bdr opacity-60" : "bg-gold-pale border-[#C9973A30]"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`text-[13px] font-bold flex items-center gap-1.5 ${disabled ? "text-txt-soft" : "text-txt"}`}
                  >
                    🛍 รับซื้อ
                    {disabled && (
                      <span className="text-[9px] px-1.5 py-px rounded-lg text-red font-bold bg-[#C0392B20]">
                        🔒 ถูกปิด
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-txt-soft">
                    Rate:{" "}
                    <b className="text-maroon">
                      ฿{TH_NUMBER(empInfo?.ratePerPieceBuy || 0)}/ชิ้น
                    </b>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={disabled ? 0 : data.piecesBuy || 0}
                      disabled={disabled}
                      onChange={(e) => update("piecesBuy", e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-center ${disabled ? "text-txt-soft bg-cream-dk cursor-not-allowed" : "text-txt bg-white cursor-text"}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                      ชิ้น
                    </span>
                  </div>
                  <div className="text-sm text-txt-soft font-semibold">=</div>
                  <div
                    className={`min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-right border border-bdr ${disabled ? "text-txt-soft" : "text-green"}`}
                  >
                    ฿{TH_NUMBER(disabled ? 0 : calc.commBuy)}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="text-[11px] text-txt-soft mt-2.5 text-center">
            💡 Rate ต่อชิ้นกำหนดในแท็บ "ข้อมูลพนักงาน"
          </div>
          {poolShare && (
            <div className="mt-2 text-[11px] text-maroon text-center px-2.5 py-1.5 rounded-lg bg-[#C9973A15]">
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
            +฿{TH_NUMBER(calc.memberBonusTotal)}
          </div>
        </div>

        {/* Invite */}
        <div className="bg-gold-pale rounded-[10px] p-3 mb-2.5 border border-[#C9973A30]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-bold text-txt">
              🎫 เชิญชวนสมัครบัตร
            </div>
            <div className="text-[11px] text-txt-soft">
              Rate:{" "}
              <b className="text-maroon">
                ฿{TH_NUMBER(empInfo?.ratePerPieceInvite || 0)}/ใบ
              </b>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                inputMode="numeric"
                value={data.piecesInvite || 0}
                onChange={(e) => update("piecesInvite", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-txt bg-white text-center"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                ใบ
              </span>
            </div>
            <div className="text-sm text-txt-soft font-semibold">=</div>
            <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-green text-right border border-bdr">
              ฿{TH_NUMBER(calc.commInvite)}
            </div>
          </div>
        </div>

        {/* Transfer */}
        <div className="bg-gold-pale rounded-[10px] p-3 border border-[#C9973A30]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-bold text-txt">🔄 ย้ายข้อมูลบัตร</div>
            <div className="text-[11px] text-txt-soft">
              Rate:{" "}
              <b className="text-maroon">
                ฿{TH_NUMBER(empInfo?.ratePerPieceTransfer || 0)}/ใบ
              </b>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                inputMode="numeric"
                value={data.piecesTransfer || 0}
                onChange={(e) => update("piecesTransfer", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[9px] border border-bdr text-[15px] font-bold outline-none font-[inherit] text-txt bg-white text-center"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-soft text-[11px] font-semibold pointer-events-none">
                ใบ
              </span>
            </div>
            <div className="text-sm text-txt-soft font-semibold">=</div>
            <div className="min-w-[90px] px-3 py-2.5 rounded-[9px] bg-cream text-[15px] font-bold text-green text-right border border-bdr">
              ฿{TH_NUMBER(calc.commTransfer)}
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
            +฿{TH_NUMBER(calc.earnings)}
          </div>
        </div>

        {/* Base salary — read-only (กำหนดในข้อมูลพนักงาน) */}
        <div className="px-3 py-2.5 bg-cream rounded-[10px] mb-2.5 border border-dashed border-bdr flex items-center gap-2.5">
          <span className="text-base">💼</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-txt-soft font-semibold flex items-center gap-1.5">
              <span>เงินเดือนพื้นฐาน</span>
              <span className="text-[9px] px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                แก้ในแท็บ "ข้อมูลพนักงาน"
              </span>
            </div>
            <div className="text-base font-bold text-txt mt-px">
              ฿{TH_NUMBER(empInfo?.baseSalary || 0)}
            </div>
          </div>
        </div>

        {FIELDS_EARN.map((f) => (
          <div key={f.key} className="mb-2.5">
            <label className="flex text-xs text-txt-mid mb-[5px] font-medium">
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
                value={data[f.key] || 0}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full py-2.5 pr-3.5 pl-[30px] rounded-[10px] border border-bdr text-[15px] font-semibold outline-none font-[inherit] text-txt bg-cream"
              />
            </div>
          </div>
        ))}

        {/* auto perfect-attendance bonus */}
        <div
          className={`rounded-[9px] px-3.5 py-3 mt-1.5 text-xs leading-[1.7] border ${calc.attendBonus > 0 ? "bg-green-lt border-[#1A6B3A30]" : "bg-cream border-bdr"}`}
        >
          <div
            className={`font-bold mb-1 flex items-center gap-1.5 ${calc.attendBonus > 0 ? "text-green" : "text-txt-mid"}`}
          >
            🌟 โบนัสแห่งความขยัน(ไม่หยุด){" "}
            <span className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              อัตโนมัติ
            </span>
          </div>
          <div className="text-txt-mid">
            เรท/วัน = ฿{TH_NUMBER(empInfo?.baseSalary || 0)} ÷ 30 ={" "}
            <b>฿{TH_NUMBER(Math.round(calc.dayRate || 0))}</b>
          </div>
          <div className="text-txt-mid">
            เดือนนี้ลาวันธรรมดา <b>{calc.lvDays}</b> วัน{" "}
            <span className="text-[10px] text-txt-soft">(ไม่นับวันอาทิตย์)</span>
          </div>
          {calc.lvDays <= 2 ? (
            <div className="text-green font-bold mt-1 pt-1 border-t border-dashed border-[#1A6B3A40]">
              ได้โบนัส (2 − {calc.lvDays}) × ฿
              {TH_NUMBER(Math.round(calc.dayRate || 0))} = +฿
              {TH_NUMBER(calc.attendBonus)}
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
            −฿{TH_NUMBER(calc.deductions)}
          </div>
        </div>
        {FIELDS_DED.map((f) => (
          <div key={f.key} className="mb-2.5">
            <label className="flex text-xs text-txt-mid mb-[5px] font-medium">
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
                value={data[f.key] || 0}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full py-2.5 pr-3.5 pl-[30px] rounded-[10px] border border-bdr text-[15px] font-semibold outline-none font-[inherit] text-txt bg-cream"
              />
            </div>
          </div>
        ))}
        {/* over-quota auto note */}
        <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-xs text-txt-mid leading-[1.7] border border-[#C9973A30]">
          <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
            📋 หักลาเกินโควต้า{" "}
            <span className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              อัตโนมัติ
            </span>
          </div>
          <div>
            เรท/วัน = ฿{TH_NUMBER(empInfo?.baseSalary || 0)} ÷ 30 ={" "}
            <b>฿{TH_NUMBER(Math.round(calc.dayRate || 0))}</b>
          </div>
          {overInfo.weekdays > 0 && (
            <div>
              วันธรรมดา {overInfo.weekdays} วัน × ฿
              {TH_NUMBER(Math.round(calc.dayRate || 0))} ={" "}
              <b>
                ฿
                {TH_NUMBER(Math.round(overInfo.weekdays * (calc.dayRate || 0)))}
              </b>
            </div>
          )}
          {overInfo.sundays > 0 && (
            <div>
              วันอาทิตย์ {overInfo.sundays} วัน × ฿
              {TH_NUMBER(Math.round(calc.dayRate || 0))} × 1.5 ={" "}
              <b>
                ฿
                {TH_NUMBER(
                  Math.round(overInfo.sundays * (calc.dayRate || 0) * 1.5),
                )}
              </b>
            </div>
          )}
          {overTotalDays === 0 && (
            <div className="text-txt-soft">ไม่มีการลาเกินโควต้า</div>
          )}
          {overTotalDays > 0 && (
            <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
              รวมหัก: −฿{TH_NUMBER(calc.overQ)}
            </div>
          )}
        </div>

        {/* auto advance deduction note */}
        <div className="bg-gold-pale rounded-[9px] px-3.5 py-3 mt-2.5 text-xs text-txt-mid leading-[1.7] border border-[#C9973A30]">
          <div className="font-bold text-maroon mb-1 flex items-center gap-1.5">
            💵 หักเงินเบิกล่วงหน้า{" "}
            <span className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[20px] text-maroon ml-auto bg-[#C9973A30]">
              อัตโนมัติ
            </span>
          </div>
          {monthApprovedAdvances.length === 0 ? (
            <div className="text-txt-soft">ไม่มีการเบิกเงินที่ได้รับอนุมัติเดือนนี้</div>
          ) : (
            <>
              {monthApprovedAdvances.map((r, i) => {
                const dt = new Date(r.approvedAt || r.submittedAt);
                return (
                  <div
                    key={i}
                    className="flex justify-between items-center py-[3px]"
                  >
                    <span>
                      {dt.toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {r.reason || "-"}
                    </span>
                    <b>฿{TH_NUMBER(r.amount)}</b>
                  </div>
                );
              })}
              <div className="text-red font-bold mt-1 pt-1 border-t border-dashed border-[#C9973A50]">
                รวมหัก: −฿{TH_NUMBER(calc.advanceDed)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* note */}
      <div className="mb-3.5">
        <label className="block text-[13px] text-txt-mid mb-1.5 font-semibold">
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
          <div className="text-xs text-[#E8C87AAA]">
            เงินสุทธิ{" "}
            {dirty && (
              <span className="px-1.5 py-px rounded-md text-[9px] font-bold ml-[5px] bg-[#D9770640] text-gold-lt">
                ยังไม่บันทึก
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold text-gold-lt mt-0.5">
            ฿{TH_NUMBER(calc.net)}
          </div>
        </div>
        <div className="text-right text-xs leading-[1.7] text-[#E8C87A99]">
          รายรับ +฿{TH_NUMBER(calc.earnings)}
          <br />
          รายหัก −฿{TH_NUMBER(calc.deductions)}
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
            className="flex-2 py-3 rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-[15px] font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-gold-glow"
          >
            <IconCheck size={14} stroke={2.5} />
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      )}
    </div>
  );
}
