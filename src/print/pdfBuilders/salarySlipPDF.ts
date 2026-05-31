/* ─── Salary Slip — pdfmake document definition ─────────────
   สร้าง PDF จริงที่ text ค้นหา/copy ได้
   ไม่ใช่ image-based เหมือน html2pdf                          */

import { THAI_MONTH_NAMES } from "../../constants";

const COLORS = {
  maroon: "#7B1C1C",
  text: "#1A1A1A",
  textSoft: "#666666",
  border: "#CCCCCC",
  borderLight: "#ECECEC",
  netFill: "#FBF4F4",
};

const CONTENT_WIDTH = 515; // A4 (595.28) − pageMargins 40×2

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
  poolShare,
  selectedMonth,
  monthApprovedAdvances,
}) {
  if (!data || !salaryCalculation) throw new Error("ไม่มีข้อมูลเงินเดือนเดือนนี้");

  const [y, mo] = selectedMonth.split("-");
  const monthLabel = `${THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} ${parseInt(y, 10) + 543}`;
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
  earnRows.push(["เงินเดือนพื้นฐาน", formatNumber(salaryCalculation.baseSalary)]);
  if (salaryCalculation.usesSinglePieceRate) {
    if (salaryCalculation.singleRateCommission > 0)
      earnRows.push([
        "ค่าคอมตามจำนวนชิ้น",
        formatNumber(salaryCalculation.singleRateCommission),
      ]);
  } else {
    if (salaryCalculation.normalSaleCommission > 0)
      earnRows.push([
        "ค่าคอมขาย-ทั่วไป",
        formatNumber(salaryCalculation.normalSaleCommission),
      ]);
    if (salaryCalculation.specialSaleCommission > 0)
      earnRows.push([
        "ค่าคอมขาย-พิเศษ",
        formatNumber(salaryCalculation.specialSaleCommission),
      ]);
    if (salaryCalculation.buyCommission > 0)
      earnRows.push([
        "ค่าคอมรับซื้อ",
        formatNumber(salaryCalculation.buyCommission),
      ]);
  }
  if (salaryCalculation.inviteCommission > 0)
    earnRows.push([
      "โบนัสเชิญชวนสมัครบัตร",
      formatNumber(salaryCalculation.inviteCommission),
    ]);
  if (salaryCalculation.transferCommission > 0)
    earnRows.push([
      "โบนัสย้ายข้อมูลบัตร",
      formatNumber(salaryCalculation.transferCommission),
    ]);
  if (salaryCalculation.attendanceBonus > 0)
    earnRows.push([
      "โบนัสแห่งความขยัน(ไม่หยุด)",
      formatNumber(salaryCalculation.attendanceBonus),
    ]);
  if (Array.isArray(data.customEarnings))
    for (const e of data.customEarnings)
      if (e?.amount > 0)
        earnRows.push([e.label || "รายการรายรับ", formatNumber(e.amount)]);

  /* ─── สร้าง deductions rows ───────────────────────────── */
  const dedRows: [string, string][] = [];
  if (data.lateDeduction > 0)
    dedRows.push(["มาสาย / ขาดงาน", formatNumber(data.lateDeduction)]);
  if (salaryCalculation.advanceDeduction > 0)
    dedRows.push([
      "เบิกล่วงหน้า",
      formatNumber(salaryCalculation.advanceDeduction),
    ]);
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

  /* ─── pdfmake doc definition ──────────────────────────── */
  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 44],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 12,
      color: COLORS.text,
      lineHeight: 1.3,
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
        fontSize: 17,
        bold: true,
        color: COLORS.maroon,
        alignment: "center",
      },
      {
        text: "100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160",
        fontSize: 10,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 4, 0, 0],
      },
      {
        text: "เลขประจำตัวผู้เสียภาษี 0-7355-59006-56-8",
        fontSize: 10,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 1, 0, 8],
      },
      doubleRule(),

      /* ─── Title ─── */
      {
        text: "สลิปเงินเดือน",
        fontSize: 16,
        bold: true,
        alignment: "center",
        margin: [0, 14, 0, 2],
      },
      {
        text: `ประจำงวดเดือน ${monthLabel}`,
        fontSize: 12,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 0, 0, 16],
      },

      /* ─── Employee info ─── */
      {
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              { text: "ชื่อ-นามสกุล:", fontSize: 12, color: COLORS.textSoft },
              { text: employeeName, fontSize: 12, bold: true },
              { text: "ตำแหน่ง:", fontSize: 12, color: COLORS.textSoft },
              { text: employeePosition, fontSize: 12, bold: true },
            ],
            [
              { text: "ธนาคาร:", fontSize: 12, color: COLORS.textSoft },
              { text: bank, fontSize: 12, bold: true },
              { text: "เลขที่บัญชี:", fontSize: 12, color: COLORS.textSoft },
              { text: bankAccountNumber, fontSize: 12, bold: true },
            ],
            [
              { text: "วันที่ออกสลิป:", fontSize: 12, color: COLORS.textSoft },
              { text: printDate, fontSize: 12, bold: true },
              { text: "รอบเงินเดือน:", fontSize: 12, color: COLORS.textSoft },
              { text: monthLabel, fontSize: 12, bold: true },
            ],
          ],
        },
        layout: metaLayout(),
        margin: [0, 0, 0, 16],
      },

      /* ─── Earnings table ─── */
      sectionHeader("รายการรายรับ"),
      {
        table: {
          widths: ["*", 120],
          body: [
            ...earnRows.map(([label, value]) => [
              { text: label, fontSize: 12 },
              { text: value, fontSize: 12, alignment: "right" },
            ]),
            [
              { text: "รวมรายรับ", bold: true, fontSize: 12 },
              {
                text: formatNumber(salaryCalculation.earnings),
                bold: true,
                fontSize: 12,
                alignment: "right",
              },
            ],
          ],
        },
        layout: rowLayout(earnRows.length),
        margin: [0, 0, 0, 14],
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
                    { text: label, fontSize: 12 },
                    { text: value, fontSize: 12, alignment: "right" },
                  ]),
                  [
                    { text: "รวมรายการหัก", bold: true, fontSize: 12 },
                    {
                      text: formatNumber(salaryCalculation.deductions),
                      bold: true,
                      fontSize: 12,
                      alignment: "right",
                    },
                  ],
                ],
              },
              layout: rowLayout(dedRows.length),
              margin: [0, 0, 0, 14],
            },
          ]
        : [
            {
              text: "— ไม่มีรายการหัก —",
              fontSize: 12,
              color: COLORS.textSoft,
              alignment: "center",
              margin: [0, 4, 0, 14],
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
                fontSize: 13,
                bold: true,
                color: COLORS.maroon,
                margin: [6, 6, 0, 6],
              },
              {
                text: `฿${formatNumber(salaryCalculation.netSalary)}`,
                fontSize: 20,
                bold: true,
                color: COLORS.maroon,
                alignment: "right",
                margin: [0, 4, 6, 4],
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
        margin: [0, 0, 0, 36],
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
        fontSize: 9,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 24, 0, 0],
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
          { text: label, fontSize: 12, bold: true },
          {
            text: "จำนวนเงิน (บาท)",
            fontSize: 12,
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
      paddingTop: () => 2,
      paddingBottom: () => 5,
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
        margin: [0, 50, 0, 0],
      },
      {
        text: line,
        fontSize: 12,
        bold: true,
        alignment: "center",
        margin: [0, 6, 0, 0],
      },
      {
        text: name,
        fontSize: 10,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 2, 0, 0],
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
    paddingTop: () => 4,
    paddingBottom: () => 4,
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
    paddingTop: () => 5,
    paddingBottom: () => 5,
  };
}
