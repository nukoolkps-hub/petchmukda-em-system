import { IconCheck, IconCopy, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { calcSalary, computePoolSharesForGroup } from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Payroll Summary Panel ───────────────────────────────
   สรุปเงินเดือนสุทธิทุกคน + ข้อมูลธนาคาร พร้อมปุ่มคัดลอกเลขบัญชี
   ใช้ logic เดียวกับ SalaryAdminEdit เพื่อให้ตัวเลขตรงกัน           */
export default function PayrollSummaryPanel({
  empDir,
  salaryData,
  allLeaves,
  advanceRequests,
  roles,
  payrollConfirms,
  setPayrollConfirms,
  showToast,
}) {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function copyToClipboard(text, key) {
    if (!text) return;
    const cleaned = String(text).replace(/[-\s]/g, "");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(cleaned)
        .then(() => {
          setCopiedAcc(key);
          setTimeout(() => setCopiedAcc(null), 1500);
        })
        .catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = cleaned;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedAcc(key);
        setTimeout(() => setCopiedAcc(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }

  /* ─── Heavy computation: memoized ───────────────────────────────
     คำนวณเงินเดือนทุกคนใหม่ เฉพาะตอน salaryData/leaves/advances/roles เปลี่ยน
     สำคัญมาก — ก่อน memo: re-run ทุกครั้งที่กด/พิมพ์ในหน้านี้                */
  const rows = useMemo(() => {
    // group employees by role for shared Pool
    const groupedEmpsByPool = {};
    empDir.forEach((emp) => {
      const r = roles.find((rl) => rl.id === emp.roleId);
      if (r?.poolGroup) {
        if (!groupedEmpsByPool[r.poolGroup])
          groupedEmpsByPool[r.poolGroup] = [];
        groupedEmpsByPool[r.poolGroup].push(emp.id);
      }
    });

    // compute each employee's net salary
    return empDir
      .map((emp) => {
        const empRole = roles.find((r) => r.id === emp.roleId);
        const data = salaryData[emp.id]?.[selMonth] || null;
        const monthLeaves = allLeaves.filter(
          (lv) => lv.empName === emp.name && lv.start.startsWith(selMonth),
        );
        const overInfo = getOverQuotaDays(monthLeaves);
        const totalLeaveDays = countWeekdayLeaves(monthLeaves);
        const monthApprovedAdvances = (advanceRequests || []).filter(
          (r) =>
            r.empId === emp.id &&
            r.month === selMonth &&
            r.status === "approved",
        );
        const approvedAdvanceTotal = monthApprovedAdvances.reduce(
          (s, r) => s + r.amount,
          0,
        );

        let poolShare = null;
        if (empRole?.poolGroup) {
          const groupIds = groupedEmpsByPool[empRole.poolGroup] || [];
          const shares = computePoolSharesForGroup({
            groupEmpIds: groupIds,
            salaryData,
            allLeaves,
            ym: selMonth,
            empDir,
          });
          poolShare = shares[emp.id];
        }
        const calc = data
          ? calcSalary(
              data,
              overInfo,
              emp,
              totalLeaveDays,
              approvedAdvanceTotal,
              poolShare,
              empRole,
            )
          : null;
        return {
          emp,
          empRole,
          data,
          calc,
          advanceTotal: approvedAdvanceTotal,
          poolShare,
        };
      })
      .filter((r) => r.calc);
  }, [empDir, roles, salaryData, selMonth, allLeaves, advanceRequests]);

  // filter by search
  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.emp.name.includes(search.trim()) ||
          r.emp.role?.includes(search.trim()),
      )
    : rows;

  const totalPayout = filtered.reduce((s, r) => s + r.calc.net, 0);
  const totalAdvance = filtered.reduce((s, r) => s + r.advanceTotal, 0);

  // available months in salary data
  const monthSet = new Set<string>();
  Object.values(salaryData).forEach((m) => {
    Object.keys((m as Record<string, unknown>) || {}).forEach((k) => {
      monthSet.add(k);
    });
  });
  const months: string[] = [...monthSet].sort().reverse();
  if (!months.includes(selMonth)) months.unshift(selMonth);

  return (
    <div>
      {/* header bar */}
      <div className="flex items-center gap-2 mb-3.5">
        <div className="flex-1">
          <div className="text-sm font-bold text-maroon">
            💳 สรุปการจ่ายเงินเดือน
          </div>
          <div className="text-[11px] text-txt-soft mt-0.5">
            คัดลอกเลขบัญชีไปวางในแอปธนาคารได้
          </div>
        </div>
        <select
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="px-2.5 py-[7px] rounded-[9px] border border-bdr text-[13px] font-semibold text-txt bg-cream font-[inherit] outline-none"
        >
          {months.map((m) => {
            const [y, mo] = m.split("-");
            return (
              <option key={m} value={m}>
                {TH_MONTHS[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
              </option>
            );
          })}
        </select>
      </div>

      {/* grand total card */}
      <div className="bg-linear-135 from-maroon-dk to-maroon rounded-2xl px-5 pt-4.5 pb-5 mb-3.5 text-white shadow-[0_6px_20px_var(--color-maroon)/0.25] relative overflow-hidden">
        <svg
          className="absolute -top-2.5 -right-2.5 opacity-[0.12]"
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill={C.goldLt}
        >
          <path d="M6 3h12l4 6-10 12L2 9z" />
        </svg>
        <div className="relative">
          <div className="text-xs text-gold-lt/65 mb-[3px]">
            ยอดที่ต้องโอนเดือนนี้ ({filtered.length} คน)
          </div>
          <div className="text-[30px] font-extrabold text-gold-lt tracking-[-0.02em] mb-2">
            ฿{TH_NUMBER(totalPayout)}
          </div>
          {totalAdvance > 0 && (
            <div className="text-xs text-gold-lt/60 pt-2 border-t border-gold-lt/15">
              💵 หักเบิกล่วงหน้าไปแล้ว: <b>฿{TH_NUMBER(totalAdvance)}</b> (
              {filtered.filter((r) => r.advanceTotal > 0).length} คน)
            </div>
          )}
        </div>
      </div>

      {/* Confirm payroll status / button */}
      {(() => {
        const confirmed = payrollConfirms?.[selMonth];
        const totalForMonth = rows.reduce((s, r) => s + r.calc.net, 0);
        const empCountForMonth = rows.length;

        if (confirmed) {
          const dt = new Date(confirmed.confirmedAt);
          const dtStr = dt.toLocaleString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const isStale =
            confirmed.totalAmount !== totalForMonth ||
            confirmed.empCount !== empCountForMonth;
          return (
            <div
              className={`rounded-[14px] px-4 py-3.5 mb-3.5 border-[1.5px] ${isStale ? "bg-amber-lt border-amber/40" : "bg-green-lt border-green/25"}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center border-[1.5px]
                  ${isStale ? "bg-amber-lt border-amber" : "bg-white border-green"}`}
                >
                  {isStale ? "⚠️" : "✅"}
                </div>
                <div className="flex-1">
                  <div
                    className={`font-bold text-sm ${isStale ? "text-amber" : "text-green"}`}
                  >
                    {isStale ? "ข้อมูลเปลี่ยนหลังยืนยัน" : "ยืนยันยอดเรียบร้อยแล้ว"}
                  </div>
                  <div className="text-[11px] text-txt-soft mt-0.5">
                    📅 {dtStr}
                  </div>
                </div>
              </div>
              {isStale ? (
                <>
                  <div className="text-xs text-txt-mid px-3 py-2 bg-white rounded-lg mb-2 border border-dashed border-amber/25 leading-[1.5]">
                    <div>
                      ตอนยืนยัน: <b>{confirmed.empCount} คน</b> ·{" "}
                      <b>฿{TH_NUMBER(confirmed.totalAmount)}</b>
                    </div>
                    <div>
                      ตอนนี้: <b>{empCountForMonth} คน</b> ·{" "}
                      <b>฿{TH_NUMBER(totalForMonth)}</b>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPayrollConfirms((p) => ({
                        ...p,
                        [selMonth]: {
                          confirmedAt: new Date().toISOString(),
                          totalAmount: totalForMonth,
                          empCount: empCountForMonth,
                        },
                      }));
                      showToast?.("ยืนยันยอดใหม่เรียบร้อย");
                    }}
                    className="w-full py-[11px] rounded-[10px] border-none text-[13px] font-bold cursor-pointer font-[inherit] bg-linear-135 from-amber to-gold text-white shadow-[0_3px_10px_#D9770640]"
                  >
                    🔄 ยืนยันยอดใหม่
                  </button>
                </>
              ) : (
                <div className="text-xs text-txt-mid px-2.5 py-1.5 bg-white rounded-lg">
                  ยอด <b>฿{TH_NUMBER(confirmed.totalAmount)}</b> ·{" "}
                  {confirmed.empCount} คน
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            onClick={() => {
              if (
                !confirm(
                  `ยืนยันการโอนเงินเดือนเดือนนี้?\n\nยอดรวม ฿${TH_NUMBER(totalForMonth)}\nจำนวน ${empCountForMonth} คน\n\nคุณยังสามารถแก้ไขข้อมูลภายหลังได้`,
                )
              )
                return;
              setPayrollConfirms((p) => ({
                ...p,
                [selMonth]: {
                  confirmedAt: new Date().toISOString(),
                  totalAmount: totalForMonth,
                  empCount: empCountForMonth,
                },
              }));
              showToast?.("ยืนยันยอดเรียบร้อย");
            }}
            className="w-full p-3.5 mb-3.5 rounded-xl border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-[15px] font-bold cursor-pointer font-[inherit] shadow-[0_4px_14px_var(--color-gold)/0.3] flex items-center justify-center gap-2"
          >
            <IconCheck size={18} stroke={2.5} />
            ยืนยันยอดก่อนโอนเงิน
          </button>
        );
      })()}

      {/* search */}
      <div className="relative mb-3.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือตำแหน่ง..."
          className="w-full py-2.5 pr-3.5 pl-[38px] rounded-[10px] border-[1.5px] border-bdr text-sm outline-none font-[inherit] box-border text-txt bg-white"
        />
        <IconSearch
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
          size={14}
          color={C.textSoft}
          stroke={2.5}
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-txt-soft py-10 text-sm">
          {search.trim() ? `ไม่พบ "${search}"` : "ยังไม่มีข้อมูลเงินเดือนในเดือนนี้"}
        </div>
      )}

      {/* employee rows */}
      <div className="flex flex-col gap-2.5">
        {filtered.map(({ emp, empRole, calc, advanceTotal, poolShare }) => {
          const hasBank = emp.bank && emp.bankAcc;
          const lostBase = poolShare?.losesBaseSalary;
          return (
            <div
              key={emp.id}
              className={`bg-white rounded-[14px] p-3.5 border ${lostBase ? "border-[#C0392B40] shadow-[0_2px_10px_#C0392B15]" : "border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]"}`}
            >
              {/* row 1: name + role + net amount */}
              <div
                className={`flex items-center gap-3 ${hasBank ? "mb-2.5" : ""}`}
              >
                <AvatarCircle
                  av={emp.av}
                  avType={emp.avType}
                  img={emp.img}
                  size={42}
                  fontSize={13}
                  border={`2px solid ${C.gold}40`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-txt text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    {emp.name}
                  </div>
                  <div className="text-[11px] text-txt-soft flex items-center gap-1">
                    {empRole?.icon} {emp.role || "-"}
                    {emp.poolExclude &&
                      (() => {
                        const m = {
                          sell: "💎 ปิดขาย",
                          buy: "🛍 ปิดซื้อ",
                          both: "🔒 ปิดทั้งคู่",
                        };
                        return (
                          <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-[9px]">
                            {m[emp.poolExclude]}
                          </span>
                        );
                      })()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-txt-soft">เงินสุทธิ</div>
                  <div
                    className={`text-lg font-extrabold ${lostBase ? "text-red" : "text-maroon"}`}
                  >
                    ฿{TH_NUMBER(calc.net)}
                  </div>
                  {advanceTotal > 0 && (
                    <div className="text-[10px] text-txt-soft mt-px">
                      (หักเบิก ฿{TH_NUMBER(advanceTotal)})
                    </div>
                  )}
                </div>
              </div>

              {/* row 2: bank info with copy button */}
              {hasBank ? (
                <button
                  onClick={() => copyToClipboard(emp.bankAcc, emp.id)}
                  className={`w-full text-xs px-3 py-2.5 bg-cream rounded-[9px] cursor-pointer font-[inherit] flex items-center gap-2.5 transition-all
                    ${copiedAcc === emp.id ? "border border-green" : "border border-bdr"}`}
                >
                  <span className="text-sm">🏦</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-[11px] text-txt-soft mb-px">
                      {emp.bank}
                    </div>
                    <div className="text-sm font-bold text-txt tracking-[0.04em]">
                      {emp.bankAcc}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-[7px] text-[11px] font-bold whitespace-nowrap transition-all
                    ${copiedAcc === emp.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                  >
                    {copiedAcc === emp.id ? (
                      <>
                        <IconCheck size={13} stroke={3} />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <IconCopy size={13} stroke={2.2} />
                        คัดลอก
                      </>
                    )}
                  </div>
                </button>
              ) : (
                <div className="px-3 py-2 bg-red-lt rounded-[9px] text-[11px] text-red font-semibold flex items-center gap-1.5 border border-[#C0392B30]">
                  ⚠ พนักงานยังไม่กรอกข้อมูลธนาคาร
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
