import {
  AlertTriangle as IconAlertTriangle,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  Copy as IconCopy,
  CreditCard as IconCreditCard,
  Diamond as IconDiamond,
  Lock as IconLock,
  RefreshCw as IconRefresh,
  Search as IconSearch,
  ShoppingBag as IconShoppingBag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { COLORS, THAI_MONTH_NAMES } from "../../constants";
import { useApprovedAdvancesByMonth } from "../../firebase/hooks/useFirestore";
import { formatThaiNumber } from "../../utils/format";
import { countWeekdayLeaves, getOverQuotaDays } from "../../utils/leaveUtils";
import { getPayrollLock } from "../../utils/payrollLock";
import {
  calculateSalary,
  computePoolSharesForGroup,
} from "../../utils/salaryUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";

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
  poolAdjustments,
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
  const [submitting, setSubmitting] = useState(false);
  // กล่องยืนยันในแอป (แทน native confirm ที่เพี้ยน/ถูกบล็อกใน mobile webview)
  const [pendingConfirm, setPendingConfirm] = useState<{
    total: number;
    count: number;
  } | null>(null);
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
    // ตำแหน่งของแต่ละคน "ณ เดือนนั้น" — อ่าน roleId จาก snapshot ใน salary doc
    // ก่อน (frozen) fallback เป็น roleId ปัจจุบัน → เปลี่ยนตำแหน่งในอนาคตไม่
    // ทำให้การจัดกลุ่ม pool ของเดือนเก่าเปลี่ยน
    const roleIdForMonth = (employee) =>
      salaryData[employee.id]?.[selectedMonth]?.roleId ?? employee.roleId;

    // group employees by role for shared Pool
    const groupedEmpsByPool = {};
    employeeDirectory.forEach((employee) => {
      const r = roles.find((rl) => rl.id === roleIdForMonth(employee));
      if (r?.poolGroup) {
        if (!groupedEmpsByPool[r.poolGroup])
          groupedEmpsByPool[r.poolGroup] = [];
        groupedEmpsByPool[r.poolGroup].push(employee.id);
      }
    });

    // compute each employee's netSalary salary
    return employeeDirectory
      .map((employee) => {
        const employeeRole = roles.find(
          (r) => r.id === roleIdForMonth(employee),
        );
        const data = salaryData[employee.id]?.[selectedMonth] || null;
        const monthLeaves = allLeaves.filter(
          (lv) =>
            lv.employeeId === employee.id && lv.start.startsWith(selectedMonth),
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
            poolAdjustment: poolAdjustments?.[selectedMonth] || null,
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
    poolAdjustments,
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
    if (!onSaveSalary) return;
    // เขียน snapshot ให้ทุกคนที่มีค่าคอมเดือนนี้ + ทุกคนที่อยู่ใน pool group
    // (แม้ยังไม่กรอกค่าคอม) — เพื่อให้เพื่อนใน pool เห็นครบทุกคน ไม่งั้น
    // ฝั่งพนักงานจะนับสมาชิก pool ไม่ครบ → ส่วนแบ่งเพี้ยน
    const ids = new Set<string>();
    for (const row of rows) ids.add(row.employee.id);
    for (const emp of employeeDirectory) {
      const r = roles.find((rl) => rl.id === emp.roleId);
      if (r?.poolGroup) ids.add(emp.id);
    }
    // เขียนขนานกัน (เอกสารแต่ละคนแยกกัน) เก็บ error ไว้รายงานรวม
    const results = await Promise.allSettled(
      [...ids].map((id) => onSaveSalary(id, selectedMonth, {})),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.error(`[PayrollSummary] snapshot backfill failed: ${failed} คน`);
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
    // freeze แต่ละคนขนานกัน (เอกสาร/ไฟล์แยกกัน) — เร็วขึ้นมากเมื่อคนเยอะ
    const freezeOne = async (row: (typeof rows)[number]) => {
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
    };
    const results = await Promise.allSettled(rows.map(freezeOne));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    // เก็บ error แบบไม่ซ้ำ — ไม่ใช่แค่ตัวสุดท้าย
    const errMsgs = new Set<string>();
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const msg = (r.reason as Error)?.message || String(r.reason);
        console.error(
          "[PayrollSummary] freeze slip failed:",
          rows[i].employee.name,
          r.reason,
        );
        errMsgs.add(msg);
      }
    });
    const fail = results.length - ok;
    showToast?.(
      `บันทึกสลิปเข้าระบบ ${ok} คน${fail ? ` (ไม่สำเร็จ ${fail}: ${[...errMsgs].join(" / ")})` : ""}`,
    );
  }

  // ลายเซ็นยอดต่อคน — ใช้เทียบว่า "ข้อมูลเปลี่ยนหลังยืนยัน" แม้ยอดรวม/จำนวนคน
  // เท่าเดิมแต่มีการเกลี่ย pool ระหว่างคน (sort by id กันลำดับสลับ)
  const breakdownSig = rows
    .map((r) => `${r.employee.id}:${Math.round(r.salaryCalculation.netSalary)}`)
    .sort()
    .join("|");

  // ยืนยันยอด (ใช้ร่วมทั้งปุ่มยืนยันครั้งแรกและยืนยันใหม่) — กันกดซ้ำด้วย submitting
  // การยืนยันครั้งแรกถามผ่าน pendingConfirm modal ก่อน (ไม่ใช่ native confirm)
  // ขั้นที่ผู้ใช้รอ: onSetPayrollConfirm เดี่ยว (เขียน 1 doc — เร็ว) เสร็จแล้ว
  // ปลดล็อกปุ่ม ส่วน backfill snapshots + freeze สลิปทำเบื้องหลัง best-effort
  // กันบล็อก UI / แย่ network กับการบันทึกเดือนอื่นที่ admin อาจทำพร้อมกัน
  async function confirmPayroll(
    totalForMonth: number,
    empCountForMonth: number,
    isRenew: boolean,
  ) {
    if (advanceDataBlocked || submitting) return;
    setSubmitting(true);
    try {
      await onSetPayrollConfirm(selectedMonth, {
        confirmedAt: new Date().toISOString(),
        totalAmount: totalForMonth,
        employeeCount: empCountForMonth,
        breakdownSig,
      });
    } catch (err) {
      console.error("[PayrollSummary] confirm failed:", err);
      showToast?.("ยืนยันยอดไม่สำเร็จ");
      setSubmitting(false);
      return;
    }
    showToast?.(isRenew ? "ยืนยันยอดใหม่เรียบร้อย" : "ยืนยันยอดเรียบร้อย");
    setSubmitting(false);

    // งานเบื้องหลัง — ไม่ await ให้ปุ่มกลับมาใช้ได้ทันที
    (async () => {
      try {
        await backfillPoolSnapshots();
      } catch (err) {
        console.error("[PayrollSummary] backfill snapshots failed:", err);
      }
      try {
        await freezeAllSlips();
      } catch (err) {
        console.error("[PayrollSummary] freeze slips failed:", err);
        showToast?.("บันทึกสลิปเข้าระบบไม่สำเร็จบางส่วน");
      }
    })();
  }

  return (
    <div>
      {/* header bar */}
      <div className="flex items-center gap-2 mb-3.5">
        <div className="flex-1">
          <div className="text-sm font-bold text-maroon flex items-center gap-1.5">
            <IconCreditCard size={16} strokeWidth={2.4} />
            สรุปการจ่ายเงินเดือน
          </div>
          <div className="text-xs text-txt-soft mt-0.5">
            คัดลอกเลขบัญชีไปวางในแอปธนาคารได้
          </div>
        </div>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none cursor-pointer pl-2.5 pr-7 py-[7px] rounded-[9px] border border-bdr text-sm font-semibold text-txt bg-cream font-[inherit] outline-none"
          >
            {months.map((m) => {
              const [y, mo] = m.split("-");
              return (
                <option key={m} value={m}>
                  {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]}{" "}
                  {parseInt(y, 10) + 543}
                </option>
              );
            })}
          </select>
          <IconChevronDown
            size={12}
            strokeWidth={2.4}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
          />
        </div>
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
            <div className="text-sm text-gold-lt/60 pt-2 border-t border-gold-lt/15 flex items-center gap-1.5">
              <IconBanknote size={14} strokeWidth={2.4} className="shrink-0" />
              <span>
                หักเบิกล่วงหน้าไปแล้ว: <b>฿{formatThaiNumber(totalAdvance)}</b> (
                {filtered.filter((r) => r.advanceTotal > 0).length} คน)
              </span>
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
          const lock = getPayrollLock(confirmed);

          // ปิดรอบถาวรแล้ว (พ้น 7 วันหลังยืนยันครั้งแรก) — แก้ไขไม่ได้
          if (lock.locked) {
            return (
              <div className="rounded-[14px] px-4 py-3.5 mb-3.5 border-[1.5px] bg-cream border-bdr">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center border-[1.5px] bg-white border-txt-soft/40">
                    <IconLock
                      size={18}
                      strokeWidth={2.4}
                      className="text-txt-mid"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-txt">ปิดรอบแล้ว</div>
                    <div className="text-xs text-txt-soft mt-0.5">
                      ยอด ฿{formatThaiNumber(confirmed.totalAmount)} ·{" "}
                      {confirmed.employeeCount} คน · แก้ไขไม่ได้แล้ว
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const isStale =
            confirmed.totalAmount !== totalForMonth ||
            confirmed.employeeCount !== empCountForMonth ||
            (typeof confirmed.breakdownSig === "string" &&
              confirmed.breakdownSig !== breakdownSig);
          return (
            <div
              className={`rounded-[14px] px-4 py-3.5 mb-3.5 border-[1.5px] ${isStale ? "bg-amber-lt border-amber/40" : "bg-green-lt border-green/25"}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center border-[1.5px]
                  ${isStale ? "bg-amber-lt border-amber" : "bg-white border-green"}`}
                >
                  {isStale ? (
                    <IconAlertTriangle
                      size={18}
                      strokeWidth={2.4}
                      className="text-amber"
                    />
                  ) : (
                    <IconCircleCheck
                      size={20}
                      strokeWidth={2.4}
                      className="text-green"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`font-bold text-sm ${isStale ? "text-amber" : "text-green"}`}
                  >
                    {isStale ? "ข้อมูลเปลี่ยนหลังยืนยัน" : "ยืนยันยอดเรียบร้อยแล้ว"}
                  </div>
                  <div className="text-xs text-txt-soft mt-0.5 flex items-center gap-1">
                    <IconCalendar size={11} strokeWidth={2.4} />
                    {dateText}
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
                    onClick={() =>
                      confirmPayroll(totalForMonth, empCountForMonth, true)
                    }
                    disabled={advanceDataBlocked || submitting}
                    className={`w-full py-[11px] rounded-[10px] border-none text-sm font-bold font-[inherit] bg-linear-135 from-amber to-gold text-white shadow-[0_3px_10px_#D9770640] inline-flex items-center justify-center gap-1.5 ${advanceDataBlocked || submitting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <IconRefresh size={14} strokeWidth={2.4} />
                    {submitting ? "กำลังบันทึก..." : "ยืนยันยอดใหม่"}
                  </button>
                </>
              ) : (
                <div className="text-sm text-txt-mid px-2.5 py-1.5 bg-white rounded-lg">
                  ยอด <b>฿{formatThaiNumber(confirmed.totalAmount)}</b> ·{" "}
                  {confirmed.employeeCount} คน
                  <div className="text-xs text-txt-soft mt-1 inline-flex items-center gap-1">
                    <IconLock size={10} strokeWidth={2.4} />
                    แก้ไขได้อีก {lock.daysLeft} วัน แล้วปิดรอบถาวร
                  </div>
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            onClick={() =>
              setPendingConfirm({
                total: totalForMonth,
                count: empCountForMonth,
              })
            }
            disabled={advanceDataBlocked || submitting}
            className={`w-full p-3.5 mb-3.5 rounded-xl border-none bg-maroon text-white text-base font-bold font-[inherit] shadow-[0_4px_14px_var(--color-maroon)/0.25] flex items-center justify-center gap-2 ${advanceDataBlocked || submitting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <IconCheck size={18} strokeWidth={2.5} />
            {submitting ? "กำลังบันทึก..." : "ยืนยันยอดก่อนโอนเงิน"}
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
          strokeWidth={2.5}
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
                <div className="flex items-center gap-3 mb-2.5">
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
                      <IconBriefcase
                        size={11}
                        strokeWidth={2.4}
                        className="shrink-0"
                      />
                      {employee.role || "-"}
                      {employee.poolExclusion &&
                        (() => {
                          const m = {
                            sell: (
                              <span className="inline-flex items-center gap-0.5">
                                <IconDiamond size={11} strokeWidth={2.4} />
                                ปิดขาย
                              </span>
                            ),
                            buy: (
                              <span className="inline-flex items-center gap-0.5">
                                <IconShoppingBag size={11} strokeWidth={2.4} />
                                ปิดซื้อ
                              </span>
                            ),
                            both: (
                              <span className="inline-flex items-center gap-0.5">
                                <IconLock size={11} strokeWidth={2.4} />
                                ปิดทั้งคู่
                              </span>
                            ),
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
                    <BankLogo bank={employee.bank} size={28} />
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
                          <IconCheck size={13} strokeWidth={3} />
                          คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <IconCopy size={13} strokeWidth={2.2} />
                          คัดลอก
                        </>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="px-3 py-2 bg-red-lt rounded-[9px] text-xs text-red font-semibold flex items-center gap-1.5 border border-[#C0392B30]">
                    <IconAlertTriangle size={12} strokeWidth={2.4} />
                    พนักงานยังไม่กรอกข้อมูลธนาคาร
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {/* กล่องยืนยันยอด (in-app — แทน native confirm) */}
      {pendingConfirm && (
        <BaseModal
          onClose={() => setPendingConfirm(null)}
          zIndexClass="z-1000"
          maxWidthClass="max-w-[360px]"
          overlayClassName="px-6 bg-[rgba(45,26,14,0.55)] backdrop-blur-xs"
          contentClassName="rounded-[20px] px-6 py-7"
        >
          <div className="w-14 h-14 rounded-full bg-gold-pale flex items-center justify-center mx-auto mb-4">
            <IconCreditCard size={26} color={COLORS.maroon} strokeWidth={2.4} />
          </div>
          <div className="font-bold text-lg text-txt text-center mb-2">
            ยืนยันการโอนเงินเดือนเดือนนี้?
          </div>
          <div className="text-sm text-txt-mid text-center mb-2 leading-[1.9]">
            ยอดรวม{" "}
            <b className="text-maroon">
              ฿{formatThaiNumber(pendingConfirm.total)}
            </b>
            <br />
            จำนวน <b>{pendingConfirm.count} คน</b>
          </div>
          <div className="text-xs text-txt-soft text-center mb-5">
            คุณยังสามารถแก้ไขข้อมูลภายหลังได้
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setPendingConfirm(null)}
              className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                const p = pendingConfirm;
                setPendingConfirm(null);
                confirmPayroll(p.total, p.count, false);
              }}
              className="flex-1 p-3.5 rounded-xl border-none bg-maroon text-white text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_var(--color-maroon)/0.25] inline-flex items-center justify-center gap-1.5"
            >
              <IconCheck size={16} strokeWidth={2.6} />
              ยืนยัน
            </button>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
