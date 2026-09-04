/* ─── ตารางการคำนวณโดยรวม (payroll matrix) ──────────────────────────
   แถว = รายการคำนวณ · คอลัมน์ = พนักงาน + คอลัมน์ "รวม" ท้ายสุด
   (รูปแบบเดียวกับไฟล์ Excel ที่ร้านใช้ทำมือ — แต่ตัวเลขมาจากระบบทั้งหมด)

   **ไม่คำนวณเงินเองสักบาท** — รับ `EmployeeMonthRow[]` ที่ผ่าน
   `computeEmployeeMonthRow` (→ `calculateSalary` + `computePoolSharesForGroup`)
   มาแล้ว แล้ว "จัดเรียง" ลงตาราง → เลขตรงกับสลิป/หน้าจ่ายเงินเสมอ

   รายการที่แต่ละคนมีไม่เท่ากัน (pool item ต่างตำแหน่ง · รายการประจำ ·
   รายรับ/หักพิเศษ) → รวมเป็น union ของทุกคน · คนที่ไม่มี = ช่องว่าง       */

import type { EmployeeMonthRow } from "./payrollCompute";

export type MatrixValue = number | string | null;

export type MatrixRowKind =
  | "money" // ฿ ทศนิยม 2 ตำแหน่งตามระบบ
  | "int" // จำนวนเต็ม (วัน/ชิ้น/ครั้ง)
  | "pieces" // ชิ้นที่ได้จากกองกลาง (ทศนิยมได้)
  | "percent" // %
  | "text"; // ข้อความ (ตำแหน่ง/ธนาคาร/เลขบัญชี)

export interface MatrixRow {
  label: string;
  kind: MatrixRowKind;
  /** ค่าต่อพนักงาน — index ตรงกับ `PayrollMatrix.employees` · null = ไม่มี */
  values: MatrixValue[];
  /** คอลัมน์รวมท้ายแถว — null = ไม่มีความหมาย (เช่น %, ข้อความ) */
  total: number | null;
  /** เน้นแถว: `sum` = แถวรวมย่อย · `net` = เงินสุทธิ */
  emphasis?: "sum" | "net";
}

export interface MatrixSection {
  title: string;
  rows: MatrixRow[];
}

export interface MatrixEmployee {
  id: string;
  name: string;
  roleName: string;
}

export interface PayrollMatrix {
  yearMonth: string;
  employees: MatrixEmployee[];
  sections: MatrixSection[];
  /** รวมเงินสุทธิที่ต้องจ่ายทั้งเดือน */
  netTotal: number;
}

const num = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** รวมเฉพาะช่องที่เป็นตัวเลข — แถวที่ไม่มีใครมีค่าเลย total = 0 */
function sumValues(values: MatrixValue[]): number {
  return round2(
    values.reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0),
  );
}

/** สร้างแถวจากฟังก์ชันดึงค่าต่อคน · `blankZero` = ค่า 0 ให้แสดงเป็นช่องว่าง
 *  (ตารางจะได้ไม่เต็มไปด้วยเลข 0 เหมือนไฟล์ Excel ที่ร้านทำ)             */
function makeRow(
  label: string,
  kind: MatrixRowKind,
  rows: EmployeeMonthRow[],
  pick: (row: EmployeeMonthRow) => MatrixValue,
  opts: {
    blankZero?: boolean;
    emphasis?: "sum" | "net";
    /** แถวที่บวกกันแล้วไม่มีความหมาย (เช่น เรทต่อชิ้นของคนละคน) */
    noTotal?: boolean;
  } = {},
): MatrixRow {
  const blankZero = opts.blankZero ?? kind !== "text";
  const values = rows.map((r) => {
    const v = pick(r);
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return null;
      if (blankZero && v === 0) return null;
      return round2(v);
    }
    return v;
  });
  const total =
    !opts.noTotal && (kind === "money" || kind === "int" || kind === "pieces")
      ? sumValues(values)
      : null;
  return { label, kind, values, total, emphasis: opts.emphasis };
}

/** แถวที่ทุกช่องว่าง (ไม่มีใครมีรายการนี้) ตัดทิ้ง — ตารางไม่รก */
const hasAnyValue = (row: MatrixRow) => row.values.some((v) => v !== null);

/* ─── union ของรายการที่แต่ละคนมีไม่เท่ากัน ───────────────────────── */

interface ItemDef {
  id: string;
  label: string;
}

/** เก็บลำดับตามที่เจอครั้งแรก (ตำแหน่งแรกๆ มักเป็นตำแหน่งหลักของร้าน) */
function collectItems(
  rows: EmployeeMonthRow[],
  pickList: (row: EmployeeMonthRow) => { id?: string; label?: string }[],
): ItemDef[] {
  const byId = new Map<string, ItemDef>();
  for (const r of rows) {
    for (const it of pickList(r) || []) {
      const id = String(it?.id ?? it?.label ?? "");
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, label: String(it?.label || id) });
    }
  }
  return [...byId.values()];
}

function collectLabels(
  rows: EmployeeMonthRow[],
  pickList: (row: EmployeeMonthRow) => { label?: string }[],
): string[] {
  const seen: string[] = [];
  for (const r of rows) {
    for (const it of pickList(r) || []) {
      const label = String(it?.label || "").trim();
      if (label && !seen.includes(label)) seen.push(label);
    }
  }
  return seen;
}

interface BreakdownItem {
  id?: string;
  label?: string;
  pieces?: number;
  rate?: number;
  amount?: number;
}

const findById = (
  list: BreakdownItem[] | undefined,
  id: string,
): BreakdownItem | undefined =>
  (list || []).find((x) => String(x?.id ?? x?.label ?? "") === id);

const sumByLabel = (
  list: { label?: string; amount?: number }[] | undefined,
  label: string,
): number =>
  (list || [])
    .filter((x) => String(x?.label || "").trim() === label)
    .reduce((s, x) => s + num(x?.amount), 0);

/* ─── ตัวสร้างตาราง ───────────────────────────────────────────────── */

export function buildPayrollMatrix(
  rows: EmployeeMonthRow[],
  yearMonth: string,
  options: { includeBankInfo?: boolean } = {},
): PayrollMatrix {
  const includeBankInfo = options.includeBankInfo ?? true;
  const employees: MatrixEmployee[] = rows.map((r) => ({
    id: r.employee?.id,
    name: r.employee?.nickname || r.employee?.name || "-",
    roleName: r.employeeRole?.name || r.employee?.role || "-",
  }));

  const sections: MatrixSection[] = [];
  const push = (title: string, list: MatrixRow[]) => {
    const kept = list.filter(hasAnyValue);
    if (kept.length > 0) sections.push({ title, rows: kept });
  };

  /* 1. ข้อมูลพนักงาน */
  push("ข้อมูลพนักงาน", [
    makeRow("ตำแหน่ง", "text", rows, (r) => r.employeeRole?.name || "-"),
    makeRow("เงินเดือนพื้นฐาน", "money", rows, (r) =>
      num(r.salaryCalculation?.baseSalary),
    ),
    ...(includeBankInfo
      ? [
          makeRow("ธนาคาร", "text", rows, (r) => r.employee?.bank || ""),
          makeRow(
            "เลขบัญชี",
            "text",
            rows,
            (r) => r.employee?.bankAccountNumber || "",
          ),
        ]
      : []),
  ]);

  /* 2. วันหยุด + การหัก */
  push("วันหยุด", [
    makeRow("หยุดวันธรรมดา (วัน)", "int", rows, (r) =>
      num(r.salaryCalculation?.leaveDays),
    ),
    makeRow("เกินโควต้า (วัน)", "int", rows, (r) =>
      num(r.salaryCalculation?.weekdayOverQuotaDays),
    ),
    makeRow("หยุดวันอาทิตย์ (วัน)", "int", rows, (r) =>
      num(r.salaryCalculation?.sundayOverQuotaDays),
    ),
    makeRow("หักวันธรรมดา", "money", rows, (r) =>
      round2(
        num(r.salaryCalculation?.weekdayOverQuotaDays) *
          num(r.salaryCalculation?.dailySalaryRate),
      ),
    ),
    makeRow("หักวันอาทิตย์ (× 1.5)", "money", rows, (r) =>
      round2(
        num(r.salaryCalculation?.sundayOverQuotaDays) *
          num(r.salaryCalculation?.dailySalaryRate) *
          1.5,
      ),
    ),
    makeRow(
      "รวมหักวันหยุด",
      "money",
      rows,
      (r) => num(r.salaryCalculation?.overQuotaDeduction),
      { emphasis: "sum" },
    ),
  ]);

  /* 3. ค่าคอมกองกลาง — ทีละรายการ (ขาย / รับซื้อ / custom ของแต่ละตำแหน่ง) */
  const poolItems = collectItems(
    rows,
    (r) => r.salaryCalculation?.poolItemsBreakdown || [],
  );
  for (const item of poolItems) {
    const share = (r: EmployeeMonthRow) =>
      r.poolShare?.itemShares?.[item.id] || null;
    const brk = (r: EmployeeMonthRow) =>
      findById(r.salaryCalculation?.poolItemsBreakdown, item.id);
    push(`ค่าคอม: ${item.label}`, [
      makeRow("ชิ้นที่ขายได้", "int", rows, (r) =>
        num(r.poolShare?.itemPieces?.[item.id]),
      ),
      makeRow("% หักวันลา", "percent", rows, (r) =>
        share(r) ? round2(num(share(r)?.leaveDeductionPercent)) : null,
      ),
      makeRow("% แบ่งให้เพื่อน", "percent", rows, (r) =>
        share(r) ? round2(num(share(r)?.redistributedPercent)) : null,
      ),
      makeRow("% ที่ได้", "percent", rows, (r) =>
        share(r) ? round2(num(share(r)?.finalSharePercent)) : null,
      ),
      makeRow("ชิ้นที่ได้", "pieces", rows, (r) => num(brk(r)?.pieces)),
      makeRow("เรทต่อชิ้น", "money", rows, (r) => num(brk(r)?.rate), {
        noTotal: true,
      }),
      makeRow("เป็นเงิน", "money", rows, (r) => num(brk(r)?.amount), {
        emphasis: "sum",
      }),
    ]);
  }

  /* 4. ค่าคอมรายชิ้น (ตำแหน่งที่ไม่เข้ากองกลาง) */
  const pieceItems = collectItems(
    rows,
    (r) => r.salaryCalculation?.pieceBreakdown || [],
  );
  if (pieceItems.length > 0) {
    push("ค่าคอมรายชิ้น", [
      ...pieceItems.flatMap((item) => [
        makeRow(`${item.label} (ชิ้น)`, "int", rows, (r) =>
          num(findById(r.salaryCalculation?.pieceBreakdown, item.id)?.pieces),
        ),
        makeRow(`${item.label} (เงิน)`, "money", rows, (r) =>
          num(findById(r.salaryCalculation?.pieceBreakdown, item.id)?.amount),
        ),
      ]),
    ]);
  }

  /* 5. โบนัสอื่นๆ (บัตรสมาชิก ฯลฯ) */
  const bonusItems = collectItems(
    rows,
    (r) => r.salaryCalculation?.bonusBreakdown || [],
  );
  if (bonusItems.length > 0) {
    push("โบนัสอื่นๆ", [
      ...bonusItems.flatMap((item) => [
        makeRow(`${item.label} (ครั้ง)`, "int", rows, (r) =>
          num(findById(r.salaryCalculation?.bonusBreakdown, item.id)?.pieces),
        ),
        makeRow(`${item.label} (เงิน)`, "money", rows, (r) =>
          num(findById(r.salaryCalculation?.bonusBreakdown, item.id)?.amount),
        ),
      ]),
      makeRow(
        "รวมโบนัสอื่นๆ",
        "money",
        rows,
        (r) => num(r.salaryCalculation?.memberBonusTotal),
        { emphasis: "sum" },
      ),
    ]);
  }

  /* 6. รายรับอื่น */
  const recurringIncomeLabels = collectLabels(
    rows,
    (r) => r.salaryCalculation?.recurringIncomes || [],
  );
  const customEarningLabels = collectLabels(
    rows,
    (r) => r.data?.customEarnings || [],
  );
  push("รายรับอื่น", [
    makeRow("โบนัสแห่งความขยัน", "money", rows, (r) =>
      num(r.salaryCalculation?.attendanceBonus),
    ),
    makeRow("เงินค่าแทน", "money", rows, (r) =>
      num(r.salaryCalculation?.coveragePay),
    ),
    makeRow("เสาร์เปิดพิเศษ (จ่ายเพิ่ม)", "money", rows, (r) =>
      num(r.salaryCalculation?.extraOpenSaturdayBonus),
    ),
    ...recurringIncomeLabels.map((label) =>
      makeRow(label, "money", rows, (r) =>
        sumByLabel(r.salaryCalculation?.recurringIncomes, label),
      ),
    ),
    ...customEarningLabels.map((label) =>
      makeRow(label, "money", rows, (r) =>
        sumByLabel(r.data?.customEarnings, label),
      ),
    ),
  ]);

  /* 7. รายการหัก */
  const recurringDeductionLabels = collectLabels(
    rows,
    (r) => r.salaryCalculation?.recurringDeductions || [],
  );
  const customDeductionLabels = collectLabels(
    rows,
    (r) => r.data?.customDeductions || [],
  );
  push("รายการหัก", [
    makeRow("ประกันสังคม", "money", rows, (r) =>
      num(r.salaryCalculation?.socialSecurity),
    ),
    makeRow("หักวันหยุดเกินโควต้า", "money", rows, (r) =>
      num(r.salaryCalculation?.overQuotaDeduction),
    ),
    makeRow("หักเบิกเงินล่วงหน้า", "money", rows, (r) =>
      num(r.salaryCalculation?.advanceDeduction),
    ),
    makeRow("หักผ่อนเงินกู้", "money", rows, (r) =>
      num(r.salaryCalculation?.loanDeduction),
    ),
    ...recurringDeductionLabels.map((label) =>
      makeRow(label, "money", rows, (r) =>
        sumByLabel(r.salaryCalculation?.recurringDeductions, label),
      ),
    ),
    ...customDeductionLabels.map((label) =>
      makeRow(label, "money", rows, (r) =>
        sumByLabel(r.data?.customDeductions, label),
      ),
    ),
  ]);

  /* 8. สรุป */
  const netRow = makeRow(
    "รวมสุทธิ",
    "money",
    rows,
    (r) => num(r.salaryCalculation?.netSalary),
    { emphasis: "net", blankZero: false },
  );
  sections.push({
    title: "สรุป",
    rows: [
      makeRow(
        "รวมรายรับ",
        "money",
        rows,
        (r) => num(r.salaryCalculation?.earnings),
        { emphasis: "sum", blankZero: false },
      ),
      makeRow(
        "รวมรายจ่าย",
        "money",
        rows,
        (r) => num(r.salaryCalculation?.deductions),
        { emphasis: "sum", blankZero: false },
      ),
      netRow,
    ],
  });

  return {
    yearMonth,
    employees,
    sections,
    netTotal: netRow.total ?? 0,
  };
}

/* ─── Display formatting ─────────────────────────────────────────
   อยู่ใน utils (ไม่ใช่ print/) เพราะหน้าจอ PayrollMatrixPanel ใช้ด้วย — ถ้า
   import จาก payrollMatrixPDF จะดึง pdf module เข้า chunk หลักและทำให้
   dynamic import ของปุ่มดาวน์โหลด PDF ไม่แยก chunk                    */
export const formatMatrixMoney = (n: number) =>
  n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** จัดรูปค่าตามชนิดของแถว — ให้ตรงกับที่แสดงบนหน้าจอ */
export function formatMatrixValue(
  value: number | string | null,
  kind: MatrixRow["kind"],
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  switch (kind) {
    case "percent":
      return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`;
    case "int":
      return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
    case "pieces":
      return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
    default:
      return formatMatrixMoney(value);
  }
}
