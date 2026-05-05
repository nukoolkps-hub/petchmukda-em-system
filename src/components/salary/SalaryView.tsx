import {
  IconArrowLeft,
  IconBuildingBank,
  IconCirclePlus,
  IconClock,
  IconDownload,
  IconLoader2,
  IconPrinter,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { C, TH_MONTHS } from "../../constants";
import {
  downloadSalaryCertificatePDF,
  printSalaryCertificate,
} from "../../print/printSalaryCertificate";
import {
  downloadSalarySlipPDF,
  printSalarySlip,
} from "../../print/printSalarySlip";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { calcSalary, computePoolSharesForGroup } from "../../utils/salaryUtils";

/* ─── Salary View (employee — read only) ───────────────────────── */
export default function SalaryView({
  profile,
  employeeId,
  salaryData,
  allLeaves,
  empDir,
  advanceRequests,
  onOpenAdvance,
  onOpenHistory,
  roles,
}) {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const empInfo =
    empDir.find((e) => e.id === employeeId) ||
    empDir.find((e) => e.name === profile?.name);
  const empId = empInfo?.id || employeeId || "";
  const [selMonth, setSelMonth] = useState(
    currentYM,
  );
  const months = useMemo(
    () =>
      Object.keys(salaryData[empId] || {})
        .sort()
        .reverse()
        .slice(0, 12),
    [salaryData, empId],
  );
  const selectMonths = months.includes(selMonth)
    ? months
    : [selMonth, ...months];

  useEffect(() => {
    if (months.length === 0) return;
    if (!months.includes(selMonth)) setSelMonth(months[0]);
  }, [months, selMonth]);

  const data = salaryData[empId]?.[selMonth];
  const empRole = roles?.find((r) => r.id === empInfo?.roleId);

  const {
    overInfo,
    overTotalDays,
    totalLeaveDays: _totalLeaveDays,
    monthApprovedAdvances,
    approvedAdvanceTotal: _approvedAdvanceTotal,
    poolShare,
    calc,
  } = useMemo(() => {
    const monthLeaves = profile
      ? allLeaves.filter(
          (lv) =>
            lv.employeeName === profile.name && lv.start.startsWith(selMonth),
        )
      : [];
    const _overInfo = getOverQuotaDays(monthLeaves);
    const _totalLeaveDays = countWeekdayLeaves(monthLeaves);
    const _monthApprovedAdvances = (advanceRequests || []).filter(
      (r) => r.month === selMonth && r.status === "approved",
    );
    const _approvedAdvanceTotal = _monthApprovedAdvances.reduce(
      (s, r) => s + r.amount,
      0,
    );
    let _poolShare: any = null;
    if (empRole?.poolGroup) {
      const groupEmps = empDir.filter((e) => {
        const r = roles.find((rl) => rl.id === e.roleId);
        return r?.poolGroup === empRole.poolGroup;
      });
      const shares = computePoolSharesForGroup({
        groupEmpIds: groupEmps.map((e) => e.id),
        salaryData,
        allLeaves,
        ym: selMonth,
        empDir,
      });
      _poolShare = shares[empInfo?.id];
    }
    const _calc = calcSalary(
      data,
      _overInfo,
      empInfo,
      _totalLeaveDays,
      _approvedAdvanceTotal,
      _poolShare,
      empRole,
    );
    return {
      overInfo: _overInfo,
      overTotalDays: _overInfo.weekdays + _overInfo.sundays,
      totalLeaveDays: _totalLeaveDays,
      monthApprovedAdvances: _monthApprovedAdvances,
      approvedAdvanceTotal: _approvedAdvanceTotal,
      poolShare: _poolShare,
      calc: _calc,
    };
  }, [
    profile,
    allLeaves,
    selMonth,
    advanceRequests,
    empRole,
    empDir,
    roles,
    salaryData,
    empInfo,
    data,
  ]);

  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  async function handleDownloadSlipPDF() {
    if (!data || !calc) {
      alert("ไม่มีข้อมูลเงินเดือนเดือนนี้");
      return;
    }
    setPdfLoading("slip");
    try {
      await downloadSalarySlipPDF({
        profile,
        empInfo,
        empRole,
        data,
        calc,
        poolShare,
        selMonth,
        monthApprovedAdvances,
      });
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPdfLoading(null);
    }
  }

  async function handleDownloadCertPDF() {
    if (!data) {
      alert("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง");
      return;
    }
    setPdfLoading("cert");
    try {
      await downloadSalaryCertificatePDF({ profile, empInfo, data });
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPdfLoading(null);
    }
  }

  function handlePrintSlip() {
    if (!data || !calc) {
      alert("ไม่มีข้อมูลเงินเดือนเดือนนี้");
      return;
    }
    printSalarySlip({
      profile,
      empInfo,
      empRole,
      data,
      calc,
      poolShare,
      selMonth,
      monthApprovedAdvances,
    });
  }

  function handlePrintCert() {
    if (!data) {
      alert("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง");
      return;
    }
    printSalaryCertificate({ profile, empInfo, data });
  }

  if (!data || !calc) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="text-[13px] text-txt-soft flex-1">สลิปเงินเดือน</div>
          <select
            value={selMonth}
            onChange={(e) => setSelMonth(e.target.value)}
            className="px-3 py-[7px] rounded-[9px] border border-bdr text-[13px] font-semibold text-txt bg-cream font-[inherit] outline-none"
          >
            {selectMonths.map((m) => {
              const [y, mo] = m.split("-");
              return (
                <option key={m} value={m}>
                  {TH_MONTHS[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
                </option>
              );
            })}
          </select>
        </div>
        <div className="text-center text-txt-soft py-[50px] px-6 text-[15px] bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="text-[42px] mb-3">💰</div>
          <div className="font-bold text-txt mb-1">ยังไม่มีข้อมูลเงินเดือน</div>
          <div className="text-[13px] text-txt-soft mb-5">
            เดือน {(() => {
              const [y, mo] = selMonth.split("-");
              return `${TH_MONTHS[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
            })()}
          </div>
          {months.includes(currentYM) && selMonth !== currentYM && (
            <button
              onClick={() => setSelMonth(currentYM)}
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
      {/* Bank info card */}
      <div className="bg-white rounded-[14px] px-4 py-3.5 mb-2.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-linear-135 from-gold to-gold-lt flex items-center justify-center shrink-0 shadow-[0_2px_8px_var(--color-gold)/0.25]">
          <IconBuildingBank size={19} color="#fff" stroke={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-txt-soft mb-0.5">โอนเข้าบัญชี</div>
          <div className="text-sm font-bold text-txt mb-px">
            {empInfo?.bank || "-"}
          </div>
          <div className="text-[13px] text-txt-mid tracking-wider">
            {empInfo?.bankAcc || "-"}
          </div>
        </div>
      </div>

      {/* Advance: 2 buttons */}
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <button
          onClick={onOpenAdvance}
          className="bg-linear-135 from-maroon to-maroon-lt rounded-[14px] px-3.5 py-3 border-none cursor-pointer font-[inherit] shadow-[0_3px_12px_var(--color-maroon)/0.25] text-left relative overflow-hidden"
        >
          <svg
            className="absolute -top-1.5 -right-1.5 opacity-15"
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill={C.goldLt}
          >
            <path d="M6 3h12l4 6-10 12L2 9z" />
          </svg>
          <div className="flex items-center gap-2 relative">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-white/18 flex items-center justify-center shrink-0">
              <IconCirclePlus size={17} color={C.goldLt} stroke={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-gold-lt leading-tight">
                เบิกเงิน
              </div>
              <div className="text-[11px] text-gold-lt/65 mt-px">ล่วงหน้า</div>
            </div>
          </div>
        </button>
        <button
          onClick={onOpenHistory}
          className="bg-white rounded-[14px] px-3.5 py-3 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(90,30,10,0.06)] text-left relative border-[1.5px] border-[#C9973A50]"
        >
          <div className="flex items-center gap-2">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-gold-pale flex items-center justify-center shrink-0 border border-[#C9973A40]">
              <IconClock size={17} color={C.maroon} stroke={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-maroon leading-tight">
                ประวัติ
              </div>
              <div className="text-[11px] text-txt-soft mt-px">
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

      {/* month selector */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[13px] text-txt-soft flex-1">สลิปเงินเดือน</div>
        <select
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="px-3 py-[7px] rounded-[9px] border border-bdr text-[13px] font-semibold text-txt bg-cream font-[inherit] outline-none"
        >
          {selectMonths.map((m) => {
            const [y, mo] = m.split("-");
            return (
              <option key={m} value={m}>
                {TH_MONTHS[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
              </option>
            );
          })}
        </select>
      </div>

      {/* Document buttons */}
      <div className="flex flex-col gap-2 mb-3.5 px-3 py-2.5 rounded-[11px] bg-gold-pale/20 border border-gold/15">
        <div className="flex items-center gap-1.5">
          <div className="flex-[1_1_80px] text-[11px] text-txt-mid font-semibold min-w-0">
            📋 สลิป
          </div>
          <button
            onClick={handleDownloadSlipPDF}
            disabled={pdfLoading !== null}
            title="ดาวน์โหลด PDF"
            className={`px-2.5 py-[7px] rounded-lg font-[inherit] text-[11px] font-bold flex items-center gap-1 whitespace-nowrap bg-linear-135 from-gold to-gold-lt text-maroon-dk shadow-[0_2px_6px_var(--color-gold)/0.2] border border-[#C9973A50] ${pdfLoading ? "cursor-wait" : "cursor-pointer"} ${pdfLoading && pdfLoading !== "slip" ? "opacity-50" : "opacity-100"}`}
          >
            {pdfLoading === "slip" ? (
              <>
                <Spinner />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <DownloadIcon />
                PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrintSlip}
            title="พิมพ์"
            className="px-2.5 py-[7px] rounded-lg border-[1.5px] border-bdr bg-white text-txt-mid text-[11px] font-semibold cursor-pointer font-[inherit] flex items-center gap-1 whitespace-nowrap"
          >
            <PrintIcon />
            พิมพ์
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-[1_1_80px] text-[11px] text-txt-mid font-semibold min-w-0">
            📄 รับรอง
          </div>
          <button
            onClick={handleDownloadCertPDF}
            disabled={pdfLoading !== null}
            title="ดาวน์โหลดหนังสือรับรอง"
            className={`px-2.5 py-[7px] rounded-lg font-[inherit] text-[11px] font-bold flex items-center gap-1 whitespace-nowrap bg-white text-maroon border-[1.5px] border-[#7B1C1C50] ${pdfLoading ? "cursor-wait" : "cursor-pointer"} ${pdfLoading && pdfLoading !== "cert" ? "opacity-50" : "opacity-100"}`}
          >
            {pdfLoading === "cert" ? (
              <>
                <Spinner />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <DownloadIcon />
                PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrintCert}
            title="พิมพ์"
            className="px-2.5 py-[7px] rounded-lg border-[1.5px] border-bdr bg-white text-txt-mid text-[11px] font-semibold cursor-pointer font-[inherit] flex items-center gap-1 whitespace-nowrap"
          >
            <PrintIcon />
            พิมพ์
          </button>
        </div>
        <div className="text-[10px] text-txt-soft leading-normal mt-0.5">
          💡 <b>PDF</b> = ดาวน์โหลดทันที (text ค้นหาได้) · <b>พิมพ์</b> = ในกล่องพิมพ์เลือก
          "Save as PDF"
        </div>
      </div>

      {/* Net pay big card */}
      <div className="bg-linear-135 from-maroon-dk to-maroon rounded-[18px] px-[22px] pt-[22px] pb-5 text-white mb-4.5 shadow-[0_8px_28px_var(--color-maroon)/0.25] relative overflow-hidden">
        <svg
          className="absolute -top-2.5 -right-2.5 opacity-15"
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill={C.goldLt}
        >
          <path d="M6 3h12l4 6-10 12L2 9z" />
        </svg>
        <div className="relative">
          <div className="text-[13px] text-gold-lt/65">เงินสุทธิที่ได้รับ</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-gold-lt tracking-[-0.02em]">
              ฿{TH_NUMBER(calc?.net ?? 0)}
            </span>
          </div>
          <div className="flex gap-3.5 mt-3.5 pt-3.5 border-t border-gold-lt/12">
            <div>
              <div className="text-[11px] text-gold-lt/50">รวมรายรับ</div>
              <div className="text-base font-bold text-[#7EE8B5]">
                +฿{TH_NUMBER(calc.earnings)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gold-lt/50">รวมรายหัก</div>
              <div className="text-base font-bold text-[#FCA5A5]">
                −฿{TH_NUMBER(calc.deductions)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-green" />
          <div className="font-bold text-[15px] text-txt">รายรับ</div>
        </div>
        {[
          { icon: "💼", main: "เงินเดือนพื้นฐาน", sub: "", value: calc.baseSalary },
          ...(calc.isSingle
            ? [
                {
                  icon: "📦",
                  main: "ค่าคอม",
                  sub: `${calc.pcsSingle} ชิ้น × ฿${TH_NUMBER(calc.rSingle)}`,
                  value: calc.commSingle,
                },
              ]
            : [
                {
                  icon: "💎",
                  main: "ค่าคอมขาย (ทั่วไป)",
                  sub: poolShare
                    ? `Pool ${poolShare.poolN} ชิ้น · ได้ ${poolShare.sellPct.toFixed(2)}% = ${calc.pcsN.toFixed(1)} ชิ้น × ฿${TH_NUMBER(calc.rNormal)}`
                    : `${calc.pcsN} ชิ้น × ฿${TH_NUMBER(calc.rNormal)}`,
                  value: calc.commNormal,
                },
                {
                  icon: "✨",
                  main: "ค่าคอมขาย (พิเศษ)",
                  sub: `${calc.pcsS} ชิ้น × ฿${TH_NUMBER(calc.rSpecial)}`,
                  value: calc.commSpecial,
                },
                {
                  icon: "🛍",
                  main: "ค่าคอมรับซื้อ",
                  sub: poolShare
                    ? `Pool ${poolShare.poolB} ชิ้น · ได้ ${poolShare.buyPct.toFixed(2)}% = ${calc.pcsB.toFixed(1)} ชิ้น × ฿${TH_NUMBER(calc.rBuy)}`
                    : `${calc.pcsB} ชิ้น × ฿${TH_NUMBER(calc.rBuy)}`,
                  value: calc.commBuy,
                },
              ]),
          {
            icon: "🎫",
            main: "โบนัสเชิญชวนสมัครบัตร",
            sub: `${calc.pcsI} ใบ × ฿${TH_NUMBER(calc.rInvite)}`,
            value: calc.commInvite,
          },
          {
            icon: "🔄",
            main: "โบนัสย้ายข้อมูลบัตร",
            sub: `${calc.pcsT} ใบ × ฿${TH_NUMBER(calc.rTransfer)}`,
            value: calc.commTransfer,
          },
          {
            icon: "🌟",
            main: "โบนัสแห่งความขยัน(ไม่หยุด)",
            sub:
              calc.lvDays <= 2
                ? `ลาวันธรรมดา ${calc.lvDays} วัน → ${calc.bonusDays} วัน × ฿${TH_NUMBER(Math.round(calc.dayRate))}`
                : `ลาวันธรรมดา ${calc.lvDays} วัน — ไม่ได้รับโบนัส`,
            value: calc.attendBonus,
          },
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
                  <div className="text-[11px] text-txt-soft mt-px">
                    {row.sub}
                  </div>
                )}
              </div>
              <span className="text-[15px] font-semibold text-green whitespace-nowrap">
                +฿{TH_NUMBER(row.value)}
              </span>
            </div>
          ))}
        <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
          <span className="text-sm font-bold text-txt">รวมรายรับ</span>
          <span className="text-lg font-extrabold text-green">
            ฿{TH_NUMBER(calc.earnings)}
          </span>
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-white rounded-[14px] p-4 mb-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-1.5 h-4.5 rounded-sm bg-red" />
          <div className="font-bold text-[15px] text-txt">รายการหัก</div>
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
            value: calc.advanceDed,
          },
          {
            icon: "🏛",
            main: "หักประกันสังคม",
            sub: "",
            value: data.socialSecurity,
          },
          {
            icon: "📋",
            main: "หักลาเกินโควต้า",
            sub:
              overTotalDays > 0
                ? `${overInfo.weekdays > 0 ? `${overInfo.weekdays} วันธรรมดา` : ""}${overInfo.weekdays > 0 && overInfo.sundays > 0 ? " + " : ""}${overInfo.sundays > 0 ? `${overInfo.sundays} วันอาทิตย์ ×1.5` : ""}`
                : "",
            value: calc.overQ,
          },
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
                  <div className="text-[11px] text-txt-soft mt-px">
                    {row.sub}
                  </div>
                )}
              </div>
              <span className="text-[15px] font-semibold text-red whitespace-nowrap">
                −฿{TH_NUMBER(row.value)}
              </span>
            </div>
          ))}
        {calc.deductions === 0 && (
          <div className="text-center text-txt-soft text-sm py-2">
            ไม่มีรายการหัก ✨
          </div>
        )}
        {calc.deductions > 0 && (
          <div className="flex justify-between items-center pt-3 border-t-[1.5px] border-cream-dk mt-2">
            <span className="text-sm font-bold text-txt">รวมรายหัก</span>
            <span className="text-lg font-extrabold text-red">
              ฿{TH_NUMBER(calc.deductions)}
            </span>
          </div>
        )}
      </div>

      {data.note && (
        <div className="bg-gold-pale rounded-xl px-3.5 py-3 text-[13px] text-txt-mid border border-[#C9973A40]">
          📝 หมายเหตุ: {data.note}
        </div>
      )}

      <div className="text-center text-[11px] text-txt-soft mt-4">
        ข้อมูลกำหนดโดย Admin · ติดต่อ HR หากมีข้อสงสัย
      </div>
    </div>
  );
}

/* ─── Icon helpers ────────────────────────────────────────────── */
function DownloadIcon() {
  return <IconDownload size={12} stroke={2.4} />;
}

function PrintIcon() {
  return <IconPrinter size={12} stroke={2.2} />;
}

function Spinner() {
  return <IconLoader2 size={12} stroke={2.4} className="animate-spin" />;
}
