/* ─── Admin: ตารางการคำนวณโดยรวม ─────────────────────────────────────
   แถว = รายการคำนวณ · คอลัมน์ = พนักงาน (เหมือนไฟล์ Excel ที่ร้านทำมือ)
   แต่ตัวเลขมาจากระบบล้วนๆ — ใช้ `computeEmployeeMonthRow` ตัวเดียวกับ
   หน้า "จ่ายเงิน" และสลิป → เลขตรงกันเสมอ (single source of truth)

   ดาวน์โหลด PDF ได้ (แนวนอน · ฟอนต์ Sarabun)                             */

import {
  Download as IconDownload,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Table as IconTable,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApprovedAdvancesByMonth } from "../../firebase/hooks/useFirestore";
import {
  buildPoolSharesByGroup,
  computeEmployeeMonthRow,
} from "../../utils/payrollCompute";
import { isMonthLocked } from "../../utils/payrollLock";
import {
  buildPayrollMatrix,
  formatMatrixValue,
  type MatrixRow,
} from "../../utils/payrollMatrix";
import MonthChevronNav from "../shared/MonthChevronNav";

interface Props {
  employeeDirectory: any[];
  salaryData: any;
  allLeaves: any[];
  roles: any[];
  payrollConfirms: any;
  poolAdjustments: any;
  employeeLoans: any[];
  storeCalendar: any;
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
  showToast?: (msg: string) => void;
}

export default function PayrollMatrixPanel({
  employeeDirectory,
  salaryData,
  allLeaves,
  roles,
  payrollConfirms,
  poolAdjustments,
  employeeLoans,
  storeCalendar,
  selectedMonth,
  onSelectMonth,
  showToast,
}: Props) {
  const [showBank, setShowBank] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const monthlyApprovedAdvances = useApprovedAdvancesByMonth(selectedMonth);

  const matrix = useMemo(() => {
    const activeEmps = (employeeDirectory || []).filter(
      (e) => !e.salaryDisabled,
    );
    const payPersonalUnderAllExclusion = !isMonthLocked(
      payrollConfirms?.[selectedMonth],
    );
    const sharesByPoolGroup = buildPoolSharesByGroup({
      activeEmployees: activeEmps,
      yearMonth: selectedMonth,
      salaryData,
      allLeaves,
      employeeDirectory,
      roles,
      poolAdjustment: poolAdjustments?.[selectedMonth] || null,
      storeCalendar,
      payPersonalUnderAllExclusion,
    });
    const monthApprovedAdvances = monthlyApprovedAdvances.data || [];
    const rows = activeEmps
      .map((employee) =>
        computeEmployeeMonthRow({
          employee,
          yearMonth: selectedMonth,
          salaryData,
          allLeaves,
          employeeDirectory,
          roles,
          employeeLoans,
          monthApprovedAdvances,
          poolAdjustment: poolAdjustments?.[selectedMonth] || null,
          storeCalendar,
          poolSharesByGroup: sharesByPoolGroup,
          payPersonalUnderAllExclusion,
        }),
      )
      .filter((r): r is NonNullable<typeof r> => !!r?.salaryCalculation);
    return buildPayrollMatrix(rows, selectedMonth, {
      includeBankInfo: showBank,
    });
  }, [
    employeeDirectory,
    salaryData,
    allLeaves,
    roles,
    payrollConfirms,
    poolAdjustments,
    employeeLoans,
    storeCalendar,
    selectedMonth,
    monthlyApprovedAdvances.data,
    showBank,
  ]);

  const empCount = matrix.employees.length;

  // เดือนที่มีข้อมูลเงินเดือน (เหมือนหน้า "จ่ายเงิน") — เดือนที่เลือกอยู่ต้องมีเสมอ
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const byMonth of Object.values(salaryData || {})) {
      for (const ym of Object.keys(
        (byMonth as Record<string, unknown>) || {},
      )) {
        set.add(ym);
      }
    }
    const list = [...set].sort().reverse();
    if (!list.includes(selectedMonth)) list.unshift(selectedMonth);
    return list;
  }, [salaryData, selectedMonth]);

  async function download() {
    if (empCount === 0) return;
    setDownloading(true);
    try {
      const { downloadPayrollMatrixPDF } = await import(
        "../../print/payrollMatrixPDF"
      );
      await downloadPayrollMatrixPDF(matrix);
    } catch (err) {
      console.error("[PayrollMatrix] download failed:", err);
      showToast?.("สร้าง PDF ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconTable size={18} strokeWidth={2.4} className="text-maroon" />
        <h2 className="text-lg font-extrabold text-txt">ตารางการคำนวณโดยรวม</h2>
      </div>
      <p className="text-sm text-txt-soft mb-3.5 leading-relaxed">
        ทุกคน ทุกรายการ ในหน้าเดียว — ตัวเลขชุดเดียวกับหน้า "จ่ายเงิน" และสลิปเงินเดือน
      </p>

      <MonthChevronNav
        months={months}
        selected={selectedMonth}
        onSelect={onSelectMonth}
        subtitle={empCount > 0 ? `${empCount} คน` : undefined}
      />

      {/* แถบเครื่องมือ */}
      <div className="flex items-center gap-2 mt-3 mb-3">
        <button
          type="button"
          onClick={() => setShowBank((v) => !v)}
          className="px-3 py-2 rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-xs font-semibold cursor-pointer font-[inherit] inline-flex items-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          {showBank ? (
            <IconEyeOff size={13} strokeWidth={2.4} />
          ) : (
            <IconEye size={13} strokeWidth={2.4} />
          )}
          {showBank ? "ซ่อนเลขบัญชี" : "แสดงเลขบัญชี"}
        </button>
        <button
          type="button"
          disabled={downloading || empCount === 0}
          onClick={download}
          className={`flex-1 px-3 py-2 rounded-[10px] border-none text-white text-sm font-bold cursor-pointer font-[inherit] inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${
            downloading || empCount === 0
              ? "bg-bdr cursor-not-allowed"
              : "bg-maroon shadow-maroon-glow"
          }`}
        >
          <IconDownload size={15} strokeWidth={2.5} />
          {downloading ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
        </button>
      </div>

      {empCount === 0 ? (
        <div className="rounded-[12px] border border-bdr bg-white p-6 text-center text-sm text-txt-soft">
          ยังไม่มีข้อมูลเงินเดือนของเดือนนี้
        </div>
      ) : (
        <>
          {/* สรุปยอดรวม */}
          <div className="rounded-[12px] bg-gold-pale border border-gold/30 px-3.5 py-3 mb-3 flex items-center justify-between">
            <span className="text-sm text-txt-mid">
              รวมสุทธิที่ต้องจ่าย ({empCount} คน)
            </span>
            <span className="text-lg font-extrabold text-maroon">
              {formatMatrixValue(matrix.netTotal, "money")} ฿
            </span>
          </div>

          {/* ตาราง — เลื่อนแนวนอนได้ · คอลัมน์แรกตรึงไว้ */}
          <div className="rounded-[12px] border border-bdr bg-white overflow-x-auto">
            <table className="border-collapse text-xs min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-maroon text-white text-left font-bold px-2.5 py-2 whitespace-nowrap border-r border-white/20">
                    รายการ
                  </th>
                  {matrix.employees.map((e) => (
                    <th
                      key={e.id}
                      className="bg-maroon text-white font-bold px-2.5 py-2 whitespace-nowrap text-center"
                    >
                      {e.name}
                    </th>
                  ))}
                  <th className="bg-maroon-dk text-white font-bold px-2.5 py-2 whitespace-nowrap text-right">
                    รวม
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.sections.map((section) => (
                  <SectionRows
                    key={section.title}
                    title={section.title}
                    rows={section.rows}
                    colCount={empCount}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-txt-soft mt-2 leading-relaxed">
            เลื่อนตารางไปทางซ้าย-ขวาเพื่อดูพนักงานทุกคน · ช่องว่าง = ไม่มีรายการนั้น · แถว %
            ไม่มีคอลัมน์รวม (บวกกันไม่มีความหมาย)
          </div>
        </>
      )}
    </div>
  );
}

function SectionRows({
  title,
  rows,
  colCount,
}: {
  title: string;
  rows: MatrixRow[];
  colCount: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colCount + 2}
          className="bg-gold-pale text-maroon font-bold px-2.5 py-1.5 sticky left-0"
        >
          {title}
        </td>
      </tr>
      {rows.map((row) => {
        const isNet = row.emphasis === "net";
        const isSum = row.emphasis === "sum";
        const rowBg = isNet ? "bg-gold-pale" : isSum ? "bg-cream" : "bg-white";
        const weight = isNet ? "font-extrabold" : isSum ? "font-bold" : "";
        return (
          <tr key={row.label} className={`${rowBg} border-t border-bdr`}>
            <td
              className={`sticky left-0 z-10 ${rowBg} px-2.5 py-1.5 whitespace-nowrap text-txt-mid border-r border-bdr ${weight}`}
            >
              {row.label}
            </td>
            {row.values.map((v, i) => (
              <td
                key={`${row.label}-${matrixKey(i)}`}
                className={`px-2.5 py-1.5 whitespace-nowrap text-txt ${weight} ${
                  row.kind === "text" ? "text-center" : "text-right"
                }`}
              >
                {formatMatrixValue(v, row.kind) || "—"}
              </td>
            ))}
            <td
              className={`px-2.5 py-1.5 whitespace-nowrap text-right font-bold ${
                isNet ? "text-maroon" : "text-txt-mid"
              }`}
            >
              {row.total === null ? "" : formatMatrixValue(row.total, row.kind)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** key ของ cell — index พอ เพราะลำดับคอลัมน์ = ลำดับพนักงานที่คงที่ทั้งตาราง */
const matrixKey = (i: number) => `c${i}`;
