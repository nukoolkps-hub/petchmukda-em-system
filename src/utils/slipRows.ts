/* ─── Salary Slip rows — shared catalog ─────────────────────────────
   Single source ของรายการ "รายรับ" + "รายการหัก" บนสลิปเงินเดือน · ใช้ทั้ง:
   - print/printSalarySlip.ts (HTML version · window.print)
   - print/pdfBuilders/salarySlipPDF.ts (PDF · pdfmake)
   - components/salary/SalaryView.tsx (modal เลือกรายการตอนพิมพ์)

   Row ID convention: ใช้ id ที่ stable per item · เพื่อให้ UI เลือก hide แล้ว
   print function map id ตรงกัน · กัน duplicate-logic divergence

   Convention:
   - "base"                 — เงินเดือนพื้นฐาน
   - "piece:<itemId>"       — pieceBreakdown (multi-piece commission)
   - "pool:<itemId>"        — poolItemsBreakdown (pool sales)
   - "bonus:<itemId>"       — bonusBreakdown (โบนัสอื่นๆ)
   - "attendance"           — โบนัสขยัน
   - "coverage"             — เงินค่าแทน
   - "saturday"             — เสาร์เปิดพิเศษ
   - "custom-earn:<index>"  — customEarnings[i]
   - "recurring-earn:<index>" — recurringIncomes[i]
   - "advance"              — หักเงินเบิกล่วงหน้า
   - "loan"                 — หักผ่อนเงินกู้
   - "social-security"      — หักประกันสังคม
   - "over-quota"           — หักลาเกินโควต้า
   - "custom-ded:<index>"   — customDeductions[i]
   - "recurring-ded:<index>" — recurringDeductions[i]                       */

import { rolePaysPieceCommission } from "./salaryUtils";

export interface SlipRow {
  id: string;
  /** label หลัก (plain text · ใช้ใน modal · print แต่ละ format render ตามสไตล์ตัวเอง) */
  label: string;
  /** sublabel optional (เช่น breakdown ของเงินค่าแทน · จำนวนวันเสาร์เปิด)
   *  HTML print: ใส่ `<span class="sublabel">(${sublabel})</span>` ต่อหลัง label
   *  PDF print:  ขึ้นบรรทัดใหม่ "\n${sublabel}"
   *  Modal:      แสดงเป็นข้อความเล็กใต้ label                                  */
  sublabel?: string;
  value: number;
}

export interface SlipRowsCatalog {
  earnRows: SlipRow[];
  dedRows: SlipRow[];
}

export function buildSlipRowsCatalog({
  data,
  salaryCalculation,
  employeeRole,
}: {
  data: any;
  salaryCalculation: any;
  employeeRole?: any;
}): SlipRowsCatalog {
  const earnRows: SlipRow[] = [];
  const dedRows: SlipRow[] = [];

  /* ─── EARNINGS ─── */
  earnRows.push({
    id: "base",
    label: "เงินเดือนพื้นฐานปัจจุบัน",
    value: salaryCalculation.baseSalary || 0,
  });

  // ค่าคอมรายชิ้น — multi-piece (non-pool roles) หรือ pool items (pool roles)
  if (rolePaysPieceCommission(employeeRole)) {
    if (salaryCalculation.usesSinglePieceRate) {
      for (const item of salaryCalculation.pieceBreakdown || []) {
        if ((item.amount || 0) > 0) {
          earnRows.push({
            id: `piece:${item.id || item.label}`,
            label: item.label,
            value: item.amount,
          });
        }
      }
    } else {
      for (const it of salaryCalculation.poolItemsBreakdown || []) {
        if ((it.amount || 0) > 0) {
          earnRows.push({
            id: `pool:${it.id || it.label}`,
            label: `ค่าคอม${it.label}`,
            value: it.amount,
          });
        }
      }
    }
    for (const bonus of salaryCalculation.bonusBreakdown || []) {
      if ((bonus.amount || 0) > 0) {
        earnRows.push({
          id: `bonus:${bonus.id || bonus.label}`,
          label: `โบนัส${bonus.label}`,
          value: bonus.amount,
        });
      }
    }
  }

  if ((salaryCalculation.attendanceBonus || 0) > 0) {
    earnRows.push({
      id: "attendance",
      label: "โบนัสแห่งความขยัน (ไม่หยุด)",
      value: salaryCalculation.attendanceBonus,
    });
  }

  if ((salaryCalculation.coveragePay || 0) > 0) {
    const brk = Array.isArray(data?.coveragePayBreakdown)
      ? data.coveragePayBreakdown
          .map(
            (b: any) =>
              `${b.dutyName} ${b.count}×${Number(b.rate || 0).toLocaleString("th-TH")}`,
          )
          .join(", ")
      : "";
    earnRows.push({
      id: "coverage",
      label: "เงินค่าแทน",
      sublabel: brk || undefined,
      value: salaryCalculation.coveragePay,
    });
  }

  if ((salaryCalculation.extraOpenSaturdayBonus || 0) > 0) {
    earnRows.push({
      id: "saturday",
      label: "เสาร์เปิดพิเศษ",
      sublabel: `${salaryCalculation.extraOpenSaturdayDays} วัน`,
      value: salaryCalculation.extraOpenSaturdayBonus,
    });
  }

  if (Array.isArray(data?.customEarnings)) {
    data.customEarnings.forEach((e: any, i: number) => {
      if ((e?.amount || 0) > 0) {
        earnRows.push({
          id: `custom-earn:${i}`,
          label: e.label || "รายรับพิเศษ",
          value: e.amount,
        });
      }
    });
  }

  (salaryCalculation.recurringIncomes || []).forEach((it: any, i: number) => {
    if ((it.amount || 0) > 0) {
      earnRows.push({
        id: `recurring-earn:${i}`,
        label: it.label || "รายรับประจำ",
        value: it.amount,
      });
    }
  });

  /* ─── DEDUCTIONS ─── */
  if ((salaryCalculation.advanceDeduction || 0) > 0) {
    dedRows.push({
      id: "advance",
      label: "หักเงินเบิกล่วงหน้า",
      value: salaryCalculation.advanceDeduction,
    });
  }
  if ((salaryCalculation.loanDeduction || 0) > 0) {
    dedRows.push({
      id: "loan",
      label: "หักผ่อนเงินกู้",
      value: salaryCalculation.loanDeduction,
    });
  }
  if ((salaryCalculation.socialSecurity || 0) > 0) {
    dedRows.push({
      id: "social-security",
      label: "หักประกันสังคม",
      value: salaryCalculation.socialSecurity,
    });
  }
  if ((salaryCalculation.overQuotaDeduction || 0) > 0) {
    dedRows.push({
      id: "over-quota",
      label: "หักลาเกินโควต้า",
      value: salaryCalculation.overQuotaDeduction,
    });
  }

  if (Array.isArray(data?.customDeductions)) {
    data.customDeductions.forEach((d: any, i: number) => {
      if ((d?.amount || 0) > 0) {
        dedRows.push({
          id: `custom-ded:${i}`,
          label: d.label || "รายการหัก",
          value: d.amount,
        });
      }
    });
  }

  (salaryCalculation.recurringDeductions || []).forEach((it: any, i: number) => {
    if ((it.amount || 0) > 0) {
      dedRows.push({
        id: `recurring-ded:${i}`,
        label: it.label || "หักประจำ",
        value: it.amount,
      });
    }
  });

  return { earnRows, dedRows };
}

/** Apply hidden filter — return rows ที่ user เลือกแสดง · รวม "อื่นๆ" ตอนท้าย
 *  ถ้ามีรายการถูกซ่อนและ sum > 0
 *  - otherId: "__other__" · ใช้กัน id ชน
 *  - otherLabel: "รายรับอื่นๆ" / "รายการหักอื่นๆ"                              */
export function applyHiddenFilter(
  rows: SlipRow[],
  hiddenIds: Set<string>,
  otherLabel: string,
): SlipRow[] {
  if (hiddenIds.size === 0) return rows;
  const visible: SlipRow[] = [];
  let hiddenSum = 0;
  for (const row of rows) {
    if (hiddenIds.has(row.id)) {
      hiddenSum += row.value;
    } else {
      visible.push(row);
    }
  }
  if (hiddenSum > 0) {
    visible.push({ id: "__other__", label: otherLabel, value: hiddenSum });
  }
  return visible;
}
