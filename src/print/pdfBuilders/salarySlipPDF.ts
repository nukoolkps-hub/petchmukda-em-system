/* ─── Salary Slip — pdfmake document definition ─────────────
   สร้าง PDF จริงที่ text ค้นหา/copy ได้
   ไม่ใช่ image-based เหมือน html2pdf                          */

import { formatYmThai } from "../../utils/dateUtils";
import { rolePaysPieceCommission } from "../../utils/salaryUtils";

const COLORS = {
  maroon: "#7B1C1C",
  text: "#1A1A1A",
  textSoft: "#666666",
  border: "#CCCCCC",
  borderLight: "#ECECEC",
  netFill: "#FBF4F4",
};

const CONTENT_WIDTH = 523; // A4 (595.28) − pageMargins 36×2

const formatNumber = (value) => Number(value || 0).toLocaleString("th-TH");

/**
 * Build pdfmake document definition for salary slip
 * @returns {Object} pdfmake docDefinition
 */
export function buildSalarySlipDocDef({
  profile,
  employeeInfo,
  employeeRole,
  data,
  salaryCalculation,
  selectedMonth,
  monthApprovedAdvances,
}) {
  if (!data || !salaryCalculation) throw new Error("ไม่มีข้อมูลเงินเดือนเดือนนี้");

  const monthLabel = formatYmThai(selectedMonth);
  const printDate = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const employeeName = profile?.name || employeeInfo?.name || "-";
  const employeePosition = profile?.role || employeeInfo?.role || "-";
  const bank = employeeInfo?.bank || profile?.bank || "-";
  const bankAccountNumber =
    employeeInfo?.bankAccountNumber || profile?.bankAccountNumber || "-";

  /* ─── สร้าง earnings rows ─────────────────────────────── */
  const earnRows: [string, string][] = [];
  earnRows.push([
    "เงินเดือนพื้นฐานปัจจุบัน",
    formatNumber(salaryCalculation.baseSalary),
  ]);
  // ตำแหน่งไม่มี piece commission → ข้ามทั้ง piece + invite/transfer
  if (rolePaysPieceCommission(employeeRole)) {
    if (salaryCalculation.usesSinglePieceRate) {
      // multi-item — 1 แถวต่อรายการค่าคอม (เฉพาะที่ > 0)
      for (const item of salaryCalculation.pieceBreakdown || []) {
        if (item.amount > 0)
          earnRows.push([item.label, formatNumber(item.amount)]);
      }
    } else {
      // pool sales (multi-item · loop รวม custom)
      for (const it of salaryCalculation.poolItemsBreakdown || []) {
        if (it.amount > 0)
          earnRows.push([`ค่าคอม${it.label}`, formatNumber(it.amount)]);
      }
    }
    // โบนัสอื่นๆ (multi-item) — แสดงทุก item ที่มี amount > 0
    for (const bonus of salaryCalculation.bonusBreakdown || []) {
      if (bonus.amount > 0)
        earnRows.push([`โบนัส${bonus.label}`, formatNumber(bonus.amount)]);
    }
  }
  if (salaryCalculation.attendanceBonus > 0)
    earnRows.push([
      "โบนัสแห่งความขยัน (ไม่หยุด)",
      formatNumber(salaryCalculation.attendanceBonus),
    ]);
  if ((salaryCalculation.extraOpenSaturdayBonus || 0) > 0) {
    earnRows.push([
      `เสาร์เปิดพิเศษ (${salaryCalculation.extraOpenSaturdayDays} วัน)`,
      formatNumber(salaryCalculation.extraOpenSaturdayBonus),
    ]);
  }
  if ((salaryCalculation.coveragePay || 0) > 0) {
    const brk = Array.isArray(data.coveragePayBreakdown)
      ? data.coveragePayBreakdown
          .map((b: any) => `${b.dutyName} ${b.count}×${formatNumber(b.rate)}`)
          .join(", ")
      : "";
    earnRows.push([
      brk ? `เงินค่าแทน\n${brk}` : "เงินค่าแทน",
      formatNumber(salaryCalculation.coveragePay),
    ]);
  }
  if (Array.isArray(data.customEarnings))
    for (const e of data.customEarnings)
      if (e?.amount > 0)
        earnRows.push([e.label || "รายการรายรับ", formatNumber(e.amount)]);
  // รายรับประจำเดือน — อยู่ล่างสุดเสมอตามที่ ADMIN ขอ
  for (const it of salaryCalculation.recurringIncomes || []) {
    if (it.amount > 0)
      earnRows.push([it.label || "รายรับประจำ", formatNumber(it.amount)]);
  }

  /* ─── สร้าง deductions rows ───────────────────────────── */
  const dedRows: [string, string][] = [];
  if (salaryCalculation.advanceDeduction > 0)
    dedRows.push([
      "เบิกล่วงหน้า",
      formatNumber(salaryCalculation.advanceDeduction),
    ]);
  if (salaryCalculation.loanDeduction > 0)
    dedRows.push(["ผ่อนเงินกู้", formatNumber(salaryCalculation.loanDeduction)]);
  if (salaryCalculation.socialSecurity > 0)
    dedRows.push(["ประกันสังคม", formatNumber(salaryCalculation.socialSecurity)]);
  if (salaryCalculation.overQuotaDeduction > 0)
    dedRows.push([
      "ลาเกินโควต้า",
      formatNumber(salaryCalculation.overQuotaDeduction),
    ]);
  if (Array.isArray(data.customDeductions))
    for (const d of data.customDeductions)
      if (d?.amount > 0)
        dedRows.push([d.label || "รายการหัก", formatNumber(d.amount)]);
  // รายการหักประจำเดือน — อยู่ล่างสุดเสมอตามที่ ADMIN ขอ
  for (const it of salaryCalculation.recurringDeductions || []) {
    if (it.amount > 0)
      dedRows.push([it.label || "หักประจำ", formatNumber(it.amount)]);
  }

  /* ─── pdfmake doc definition ──────────────────────────── */
  return {
    pageSize: "A4",
    pageMargins: [36, 32, 36, 28],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 11,
      color: COLORS.text,
      lineHeight: 1.2,
    },
    info: {
      title: `สลิปเงินเดือน — ${employeeName} ${monthLabel}`,
      author: "ห้างเพชรทองมุกดา",
      subject: "Salary Slip",
    },
    content: [
      /* ─── Letterhead ─── */
      {
        text: "บริษัท ห้างเพชรทองมุกดา จำกัด",
        fontSize: 16,
        bold: true,
        color: COLORS.maroon,
        alignment: "center",
      },
      {
        text: "100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160",
        fontSize: 9,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 3, 0, 0],
      },
      {
        text: "เลขประจำตัวผู้เสียภาษี 0-7355-59006-56-8",
        fontSize: 9,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 1, 0, 6],
      },
      doubleRule(),

      /* ─── Title ─── */
      {
        text: "สลิปเงินเดือน",
        fontSize: 15,
        bold: true,
        alignment: "center",
        margin: [0, 8, 0, 2],
      },
      {
        text: `ประจำงวดเดือน ${monthLabel}`,
        fontSize: 11,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 0, 0, 10],
      },

      /* ─── Employee info ─── */
      {
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              { text: "ชื่อ-นามสกุล:", fontSize: 11, color: COLORS.textSoft },
              { text: employeeName, fontSize: 11, bold: true },
              { text: "ตำแหน่ง:", fontSize: 11, color: COLORS.textSoft },
              { text: employeePosition, fontSize: 11, bold: true },
            ],
            [
              { text: "ธนาคาร:", fontSize: 11, color: COLORS.textSoft },
              { text: bank, fontSize: 11, bold: true },
              { text: "เลขที่บัญชี:", fontSize: 11, color: COLORS.textSoft },
              { text: bankAccountNumber, fontSize: 11, bold: true },
            ],
            [
              { text: "วันที่ออกสลิป:", fontSize: 11, color: COLORS.textSoft },
              { text: printDate, fontSize: 11, bold: true },
              { text: "รอบเงินเดือน:", fontSize: 11, color: COLORS.textSoft },
              { text: monthLabel, fontSize: 11, bold: true },
            ],
          ],
        },
        layout: metaLayout(),
        margin: [0, 0, 0, 10],
      },

      /* ─── Earnings table ─── */
      sectionHeader("รายการรายรับ"),
      {
        table: {
          widths: ["*", 120],
          body: [
            ...earnRows.map(([label, value]) => [
              { text: label, fontSize: 11 },
              { text: value, fontSize: 11, alignment: "right" },
            ]),
            [
              { text: "รวมรายรับ", bold: true, fontSize: 11 },
              {
                text: formatNumber(salaryCalculation.earnings),
                bold: true,
                fontSize: 11,
                alignment: "right",
              },
            ],
          ],
        },
        layout: rowLayout(earnRows.length),
        margin: [0, 0, 0, 8],
      },

      /* ─── Deductions table ─── */
      sectionHeader("รายการหัก"),
      ...(dedRows.length > 0
        ? [
            {
              table: {
                widths: ["*", 120],
                body: [
                  ...dedRows.map(([label, value]) => [
                    { text: label, fontSize: 11 },
                    { text: value, fontSize: 11, alignment: "right" },
                  ]),
                  [
                    { text: "รวมรายการหัก", bold: true, fontSize: 11 },
                    {
                      text: formatNumber(salaryCalculation.deductions),
                      bold: true,
                      fontSize: 11,
                      alignment: "right",
                    },
                  ],
                ],
              },
              layout: rowLayout(dedRows.length),
              margin: [0, 0, 0, 8],
            },
          ]
        : [
            {
              text: "— ไม่มีรายการหัก —",
              fontSize: 11,
              color: COLORS.textSoft,
              alignment: "center",
              margin: [0, 3, 0, 8],
            },
          ]),

      /* ─── Net salary box ─── */
      {
        table: {
          widths: ["*", "auto"],
          body: [
            [
              {
                text: "เงินสุทธิที่ได้รับ",
                fontSize: 12,
                bold: true,
                color: COLORS.maroon,
                margin: [6, 4, 0, 4],
              },
              {
                text: `฿${formatNumber(salaryCalculation.netSalary)}`,
                fontSize: 18,
                bold: true,
                color: COLORS.maroon,
                alignment: "right",
                margin: [0, 2, 6, 2],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1.5,
          vLineWidth: () => 1.5,
          hLineColor: () => COLORS.maroon,
          vLineColor: () => COLORS.maroon,
          fillColor: () => COLORS.netFill,
        },
        margin: [0, 0, 0, 16],
      },

      /* ─── Signatures ─── */
      {
        columns: [
          signatureCol("ลงชื่อพนักงานผู้รับเงิน", `(${employeeName})`),
          signatureCol("ลงชื่อผู้มีอำนาจลงนาม", "บริษัท ห้างเพชรทองมุกดา จำกัด"),
        ],
        columnGap: 40,
      },

      /* ─── Footer ─── */
      {
        text: `เอกสารนี้จัดทำโดยระบบอัตโนมัติ · ออกเอกสารเมื่อ ${printDate}`,
        fontSize: 8,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 14, 0, 0],
      },
    ],
  };
}

/* ─── Reusable building blocks ──────────────────────────── */

// เส้นคู่ใต้หัวกระดาษ (letterhead) — สไตล์เอกสารทางการ
function doubleRule() {
  return {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: CONTENT_WIDTH,
        y2: 0,
        lineWidth: 1.5,
        lineColor: COLORS.maroon,
      },
      {
        type: "line",
        x1: 0,
        y1: 2.5,
        x2: CONTENT_WIDTH,
        y2: 2.5,
        lineWidth: 0.5,
        lineColor: COLORS.maroon,
      },
    ],
  };
}

// หัวข้อ section — มีเส้นขีดเส้นใต้
function sectionHeader(label: string) {
  return {
    table: {
      widths: ["*", 120],
      body: [
        [
          { text: label, fontSize: 11, bold: true },
          {
            text: "จำนวนเงิน (บาท)",
            fontSize: 11,
            bold: true,
            alignment: "right",
          },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 1.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => COLORS.text,
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 1,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 0],
  };
}

// คอลัมน์ลายเซ็น — เส้นบรรทัด + ชื่อกำกับ
function signatureCol(line: string, name: string) {
  return {
    width: "*",
    stack: [
      {
        canvas: [
          {
            type: "line",
            x1: 30,
            y1: 0,
            x2: 207,
            y2: 0,
            lineWidth: 0.8,
            lineColor: COLORS.text,
          },
        ],
        margin: [0, 32, 0, 0],
      },
      {
        text: line,
        fontSize: 11,
        bold: true,
        alignment: "center",
        margin: [0, 4, 0, 0],
      },
      {
        text: name,
        fontSize: 9,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 1, 0, 0],
      },
    ],
  };
}

// แถวข้อมูลพนักงาน — เส้นกรอบบางๆ พื้นเทาอ่อน
function metaLayout() {
  return {
    hLineWidth: (i: number, node) =>
      i === 0 || i === node.table.body.length ? 0.5 : 0,
    vLineWidth: () => 0,
    hLineColor: () => COLORS.border,
    fillColor: () => "#FAFAFA",
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };
}

// ตารางรายการ — เส้นคั่นบางๆ + เส้นหนาเหนือแถวรวม
function rowLayout(itemCount: number) {
  return {
    hLineWidth: (i: number, node) => {
      if (i === node.table.body.length) return 0; // ไม่มีเส้นล่างสุด
      if (i === itemCount) return 1; // เหนือแถว "รวม"
      return 0.5;
    },
    vLineWidth: () => 0,
    hLineColor: (i: number) =>
      i === itemCount ? "#999999" : COLORS.borderLight,
    paddingLeft: () => 2,
    paddingRight: () => 2,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };
}
