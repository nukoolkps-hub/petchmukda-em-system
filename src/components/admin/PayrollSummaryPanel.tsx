import { IconCheck, IconCopy, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { useApprovedAdvancesByMonth } from "../../firebase/hooks/useFirestore";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import {
  calculateSalary,
  computePoolSharesForGroup,
} from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";

/* ─── Admin: Payroll Summary Panel ───────────────────────────────
   สรุปเงินเดือนสุทธิทุกคน + ข้อมูลธนาคาร พร้อมปุ่มคัดลอกเลขบัญชี
   ใช้ logic เดียวกับ SalaryAdminEdit เพื่อให้ตัวเลขตรงกัน           */
export default function PayrollSummaryPanel({
  employeeDirectory,
  salaryData,
  allLeaves,
  advanceRequests,
  roles,
  payrollConfirms,
  onSetPayrollConfirm,
  onSaveSalary,
  showToast,
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const monthlyApprovedAdvances = useApprovedAdvancesByMonth(selectedMonth);
  const advanceDataBlocked =
    monthlyApprovedAdvances.loading || Boolean(monthlyApprovedAdvances.error);

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
    employeeDirectory.forEach((employee) => {
      const r = roles.find((rl) => rl.id === employee.roleId);
      if (r?.poolGroup) {
        if (!groupedEmpsByPool[r.poolGroup])
          groupedEmpsByPool[r.poolGroup] = [];
        groupedEmpsByPool[r.poolGroup].push(employee.id);
      }
    });

    // compute each employee's netSalary salary
    return employeeDirectory
      .map((employee) => {
        const employeeRole = roles.find((r) => r.id === employee.roleId);
        const data = salaryData[employee.id]?.[selectedMonth] || null;
        const monthLeaves = allLeaves.filter(
          (lv) =>
            lv.employeeName === employee.name &&
            lv.start.startsWith(selectedMonth),
        );
        const overInfo = getOverQuotaDays(monthLeaves);
        const totalLeaveDays = countWeekdayLeaves(monthLeaves);
        const monthApprovedAdvances = (
          monthlyApprovedAdvances.data || []
        ).filter((r) => r.employeeId === employee.id);
        const approvedAdvanceTotal = monthApprovedAdvances.reduce(
          (s, r) => s + r.amount,
          0,
        );

        let poolShare = null;
        if (employeeRole?.poolGroup) {
          const groupIds = groupedEmpsByPool[employeeRole.poolGroup] || [];
          const shares = computePoolSharesForGroup({
            groupEmployeeIds: groupIds,
            salaryData,
            allLeaves,
            yearMonth: selectedMonth,
            employeeDirectory,
          });
          poolShare = shares[employee.id];
        }
        const salaryCalculation = data
          ? calculateSalary(
              data,
              overInfo,
              employee,
              totalLeaveDays,
              approvedAdvanceTotal,
              poolShare,
              employeeRole,
            )
          : null;
        return {
          employee,
          employeeRole,
          data,
          salaryCalculation,
          advanceTotal: approvedAdvanceTotal,
          monthApprovedAdvances,
          poolShare,
        };
      })
      .filter((r) => r.salaryCalculation);
  }, [
    employeeDirectory,
    roles,
    salaryData,
    selectedMonth,
    allLeaves,
    monthlyApprovedAdvances.data,
  ]);

  // filter by search
  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.employee.name.includes(search.trim()) ||
          r.employee.role?.includes(search.trim()),
      )
    : rows;

  const totalPayout = filtered.reduce(
    (s, r) => s + r.salaryCalculation.netSalary,
    0,
  );
  const totalAdvance = filtered.reduce((s, r) => s + r.advanceTotal, 0);

  // available months in salary data
  const monthSet = new Set<string>();
  Object.values(salaryData).forEach((m) => {
    Object.keys((m as Record<string, unknown>) || {}).forEach((k) => {
      monthSet.add(k);
    });
  });
  const months: string[] = [...monthSet].sort().reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  /* ─── เขียน pool snapshot ลงเอกสารเงินเดือนทุกคน ──────────────────
     onSaveSalary (= updateSalary) จะ inject roleId / poolExclusion /
     totalLeaveDays ให้เอง. แยกจากการ freeze สลิป เพราะการ freeze
     อาจ fail (PDF/Storage) แต่ snapshot ต้องเขียนให้ได้เสมอ ไม่งั้น
     พนักงานคำนวณ pool ผิด (เห็น 100%)                              */
  async function backfillPoolSnapshots() {
    if (!onSaveSalary || rows.length === 0) return;
    for (const row of rows) {
      try {
        await onSaveSalary(row.employee.id, selectedMonth, {});
      } catch (err) {
        console.error(
          "[PayrollSummary] snapshot backfill failed:",
          row.employee.id,
          err,
        );
      }
    }
  }

  /* ─── Freeze สลิปทุกคนลง Storage หลังยืนยันยอด ─────────────────
     best-effort: สร้าง PDF + อัปโหลด + เก็บ slipUrl ในเอกสารเงินเดือน
     ถ้าคนไหน fail ก็ข้าม ไม่ให้กระทบการยืนยันยอดที่ทำไปแล้ว        */
  async function freezeAllSlips() {
    if (!onSaveSalary || rows.length === 0) return;
    const [{ generateSalarySlipBlob }, { uploadSalarySlip }] =
      await Promise.all([
        import("../../print/printSalarySlip"),
        import("../../firebase/storage"),
      ]);
    let ok = 0;
    let fail = 0;
    let lastError = "";
    for (const row of rows) {
      try {
        const blob = await generateSalarySlipBlob({
          employeeInfo: row.employee,
          employeeRole: row.employeeRole,
          data: row.data,
          salaryCalculation: row.salaryCalculation,
          poolShare: row.poolShare,
          selectedMonth,
          monthApprovedAdvances: row.monthApprovedAdvances,
        });
        const slipUrl = await uploadSalarySlip(
          row.employee.id,
          selectedMonth,
          blob,
        );
        await onSaveSalary(row.employee.id, selectedMonth, {
          slipUrl,
          slipFrozenAt: new Date().toISOString(),
        });
        ok++;
      } catch (err) {
        console.error(
          "[PayrollSummary] freeze slip failed:",
          row.employee.id,
          err,
        );
        lastError = (err as Error)?.message || String(err);
        fail++;
      }
    }
    showToast?.(
      `บันทึกสลิปเข้าระบบ ${ok} คน${fail ? ` (ไม่สำเร็จ ${fail}: ${lastError})` : ""}`,
    );
  }

  return (
    <div>
      {/* header bar */}
      <div className="flex items-center gap-2 mb-3.5">
        <div className="flex-1">
          <div className="text-sm font-bold text-maroon">
            💳 สรุปการจ่ายเงินเดือน
          </div>
          <div className="text-xs text-txt-soft mt-0.5">
            คัดลอกเลขบัญชีไปวางในแอปธนาคารได้
          </div>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="pl-2.5 pr-8 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-cream font-[inherit] outline-none"
        >
          {months.map((m) => {
            const [y, mo] = m.split("-");
            return (
              <option key={m} value={m}>
                {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
              </option>
            );
          })}
        </select>
      </div>

      {monthlyApprovedAdvances.loading && (
        <div className="mb-3.5 px-3.5 py-2.5 rounded-[10px] bg-cream border border-bdr text-sm text-txt-soft">
          กำลังโหลดข้อมูลเบิกเงินเดือนนี้...
        </div>
      )}

      {monthlyApprovedAdvances.error && (
        <div className="mb-3.5 px-3.5 py-2.5 rounded-[10px] bg-red-lt border border-red/25 text-sm text-red">
          โหลดข้อมูลเบิกเงินเดือนนี้ไม่สำเร็จ
        </div>
      )}

      {/* grand total card */}
      <div className="bg-linear-135 from-maroon-dk to-maroon rounded-2xl px-5 pt-4.5 pb-5 mb-3.5 text-white shadow-[0_6px_20px_var(--color-maroon)/0.25] relative overflow-hidden">
        <svg
          className="absolute -top-2.5 -right-2.5 opacity-[0.12]"
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill={COLORS.goldLight}
        >
          <path d="M6 3h12l4 6-10 12L2 9z" />
        </svg>
        <div className="relative">
          <div className="text-sm text-gold-lt/65 mb-[3px]">
            ยอดที่ต้องโอนเดือนนี้ ({filtered.length} คน)
          </div>
          <div className="text-3xl font-extrabold text-gold-lt tracking-[-0.02em] mb-2">
            ฿{formatThaiNumber(totalPayout)}
          </div>
          {totalAdvance > 0 && (
            <div className="text-sm text-gold-lt/60 pt-2 border-t border-gold-lt/15">
              💵 หักเบิกล่วงหน้าไปแล้ว: <b>฿{formatThaiNumber(totalAdvance)}</b> (
              {filtered.filter((r) => r.advanceTotal > 0).length} คน)
            </div>
          )}
        </div>
      </div>

      {/* Confirm payroll status / button */}
      {(() => {
        const confirmed = payrollConfirms?.[selectedMonth];
        const totalForMonth = rows.reduce(
          (s, r) => s + r.salaryCalculation.netSalary,
          0,
        );
        const empCountForMonth = rows.length;

        if (confirmed) {
          const date = new Date(confirmed.confirmedAt);
          const dateText = date.toLocaleString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const isStale =
            confirmed.totalAmount !== totalForMonth ||
            confirmed.employeeCount !== empCountForMonth;
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
                  <div className="text-xs text-txt-soft mt-0.5">
                    📅 {dateText}
                  </div>
                </div>
              </div>
              {isStale ? (
                <>
                  <div className="text-sm text-txt-mid px-3 py-2 bg-white rounded-lg mb-2 border border-dashed border-amber/25 leading-normal">
                    <div>
                      ตอนยืนยัน: <b>{confirmed.employeeCount} คน</b> ·{" "}
                      <b>฿{formatThaiNumber(confirmed.totalAmount)}</b>
                    </div>
                    <div>
                      ตอนนี้: <b>{empCountForMonth} คน</b> ·{" "}
                      <b>฿{formatThaiNumber(totalForMonth)}</b>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (advanceDataBlocked) return;
                      try {
                        await onSetPayrollConfirm(selectedMonth, {
                          confirmedAt: new Date().toISOString(),
                          totalAmount: totalForMonth,
                          employeeCount: empCountForMonth,
                        });
                        showToast?.("ยืนยันยอดใหม่เรียบร้อย");
                        await backfillPoolSnapshots();
                        await freezeAllSlips();
                      } catch (err) {
                        console.error("[PayrollSummary] confirm failed:", err);
                        showToast?.("ยืนยันยอดไม่สำเร็จ");
                      }
                    }}
                    disabled={advanceDataBlocked}
                    className={`w-full py-[11px] rounded-[10px] border-none text-sm font-bold font-[inherit] bg-linear-135 from-amber to-gold text-white shadow-[0_3px_10px_#D9770640] ${advanceDataBlocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    🔄 ยืนยันยอดใหม่
                  </button>
                </>
              ) : (
                <div className="text-sm text-txt-mid px-2.5 py-1.5 bg-white rounded-lg">
                  ยอด <b>฿{formatThaiNumber(confirmed.totalAmount)}</b> ·{" "}
                  {confirmed.employeeCount} คน
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            onClick={async () => {
              if (advanceDataBlocked) return;
              if (
                !confirm(
                  `ยืนยันการโอนเงินเดือนเดือนนี้?\n\nยอดรวม ฿${formatThaiNumber(totalForMonth)}\nจำนวน ${empCountForMonth} คน\n\nคุณยังสามารถแก้ไขข้อมูลภายหลังได้`,
                )
              )
                return;
              try {
                await onSetPayrollConfirm(selectedMonth, {
                  confirmedAt: new Date().toISOString(),
                  totalAmount: totalForMonth,
                  employeeCount: empCountForMonth,
                });
                showToast?.("ยืนยันยอดเรียบร้อย");
                await backfillPoolSnapshots();
                await freezeAllSlips();
              } catch (err) {
                console.error("[PayrollSummary] confirm failed:", err);
                showToast?.("ยืนยันยอดไม่สำเร็จ");
              }
            }}
            disabled={advanceDataBlocked}
            className={`w-full p-3.5 mb-3.5 rounded-xl border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-base font-bold font-[inherit] shadow-[0_4px_14px_var(--color-gold)/0.3] flex items-center justify-center gap-2 ${advanceDataBlocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
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
          color={COLORS.textSoft}
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
        {filtered.map(
          ({
            employee,
            employeeRole,
            salaryCalculation,
            advanceTotal,
            poolShare,
          }) => {
            const hasBank = employee.bank && employee.bankAccountNumber;
            const lostBase = poolShare?.losesBaseSalary;
            return (
              <div
                key={employee.id}
                className={`bg-white rounded-[14px] p-3.5 border ${lostBase ? "border-[#C0392B40] shadow-[0_2px_10px_#C0392B15]" : "border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.06)]"}`}
              >
                {/* row 1: name + role + netSalary amount */}
                <div
                  className={`flex items-center gap-3 ${hasBank ? "mb-2.5" : ""}`}
                >
                  <AvatarCircle
                    avatar={employee.avatar}
                    avatarType={employee.avatarType}
                    avatarImageUrl={employee.avatarImageUrl}
                    size={42}
                    fontSize={13}
                    border={`2px solid ${COLORS.gold}40`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                      {employee.name}
                    </div>
                    <div className="text-xs text-txt-soft flex items-center gap-1">
                      {employeeRole?.icon} {employee.role || "-"}
                      {employee.poolExclusion &&
                        (() => {
                          const m = {
                            sell: "💎 ปิดขาย",
                            buy: "🛍 ปิดซื้อ",
                            both: "🔒 ปิดทั้งคู่",
                          };
                          return (
                            <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-xs">
                              {m[employee.poolExclusion]}
                            </span>
                          );
                        })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-txt-soft">เงินสุทธิ</div>
                    <div
                      className={`text-lg font-extrabold ${lostBase ? "text-red" : "text-maroon"}`}
                    >
                      ฿{formatThaiNumber(salaryCalculation.netSalary)}
                    </div>
                    {advanceTotal > 0 && (
                      <div className="text-xs text-txt-soft mt-px">
                        (หักเบิก ฿{formatThaiNumber(advanceTotal)})
                      </div>
                    )}
                  </div>
                </div>

                {/* row 2: bank info with copy button */}
                {hasBank ? (
                  <button
                    onClick={() =>
                      copyToClipboard(employee.bankAccountNumber, employee.id)
                    }
                    className={`w-full text-sm px-3 py-2.5 bg-cream rounded-[9px] cursor-pointer font-[inherit] flex items-center gap-2.5 transition-all
                    ${copiedAcc === employee.id ? "border border-green" : "border border-bdr"}`}
                  >
                    <span className="text-sm">🏦</span>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs text-txt-soft mb-px">
                        {employee.bank}
                      </div>
                      <div className="text-sm font-bold text-txt tracking-[0.04em]">
                        {employee.bankAccountNumber}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-[7px] text-xs font-bold whitespace-nowrap transition-all
                    ${copiedAcc === employee.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                    >
                      {copiedAcc === employee.id ? (
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
                  <div className="px-3 py-2 bg-red-lt rounded-[9px] text-xs text-red font-semibold flex items-center gap-1.5 border border-[#C0392B30]">
                    ⚠ พนักงานยังไม่กรอกข้อมูลธนาคาร
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
