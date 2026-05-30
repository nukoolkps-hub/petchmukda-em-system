/* ─── Salary Slip — pdfmake document definition ─────────────
   สร้าง PDF จริงที่ text ค้นหา/copy ได้
   ไม่ใช่ image-based เหมือน html2pdf                          */

import { THAI_MONTH_NAMES } from "../../constants";

const COLORS = {
  maroon: "#7B1C1C",
  maroonDark: "#5C1212",
  gold: "#C9973A",
  goldLight: "#E8C87A",
  goldPale: "#F5E6C8",
  cream: "#FDF8F0",
  text: "#2D1A0E",
  textMedium: "#7A5C3A",
  textSoft: "#B89A72",
  border: "#E8D5B0",
  red: "#C0392B",
  green: "#1A6B3A",
};

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
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 11,
      color: COLORS.text,
      lineHeight: 1.3,
    },
    info: {
      title: `สลิปเงินเดือน — ${employeeName} ${monthLabel}`,
      author: "ห้างเพชรทองมุกดา",
      subject: "Salary Slip",
    },
    content: [
      /* ─── Header ─── */
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: [
                  {
                    text: "ห้างเพชรทองมุกดา\n",
                    fontSize: 16,
                    bold: true,
                    color: "#FFFFFF",
                  },
                  {
                    text: "Muktha Jewelry Co., Ltd.",
                    fontSize: 10,
                    color: COLORS.goldLight,
                  },
                ],
                fillColor: COLORS.maroonDark,
                margin: [12, 10, 12, 10],
                alignment: "center",
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 0],
      },

      /* ─── Title ─── */
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "สลิปเงินเดือน",
                fontSize: 18,
                bold: true,
                color: COLORS.maroon,
                alignment: "center",
                fillColor: COLORS.goldPale,
                margin: [0, 8, 0, 8],
              },
            ],
          ],
        },
        layout: "noBorders",
      },

      { text: " ", margin: [0, 0, 0, 4] },

      /* ─── Employee info ─── */
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "ชื่อ-นามสกุล", fontSize: 9, color: COLORS.textSoft },
              {
                text: employeeName,
                fontSize: 13,
                bold: true,
                margin: [0, 1, 0, 6],
              },
              { text: "ตำแหน่ง", fontSize: 9, color: COLORS.textSoft },
              { text: employeePosition, fontSize: 11, margin: [0, 1, 0, 0] },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "ประจำเดือน", fontSize: 9, color: COLORS.textSoft },
              {
                text: monthLabel,
                fontSize: 13,
                bold: true,
                color: COLORS.maroon,
                margin: [0, 1, 0, 6],
              },
              { text: "วันที่ออกเอกสาร", fontSize: 9, color: COLORS.textSoft },
              { text: printDate, fontSize: 11, margin: [0, 1, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },

      /* ─── Earnings table ─── */
      {
        text: "▸ รายรับ",
        fontSize: 12,
        bold: true,
        color: COLORS.green,
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 110],
          body: [
            [
              { text: "รายการ", style: "tableHeader" },
              {
                text: "จำนวนเงิน (฿)",
                style: "tableHeader",
                alignment: "right",
              },
            ],
            ...earnRows.map(([label, value]) => [
              { text: label, fontSize: 10 },
              { text: value, fontSize: 10, alignment: "right" },
            ]),
            [
              {
                text: "รวมรายรับ",
                bold: true,
                fontSize: 11,
                fillColor: "#E8F5EE",
              },
              {
                text: formatNumber(salaryCalculation.earnings),
                bold: true,
                fontSize: 11,
                color: COLORS.green,
                alignment: "right",
                fillColor: "#E8F5EE",
              },
            ],
          ],
        },
        layout: tableLayout(COLORS.green),
        margin: [0, 0, 0, 14],
      },

      /* ─── Deductions table ─── */
      ...(dedRows.length > 0
        ? [
            {
              text: "▸ รายการหัก",
              fontSize: 12,
              bold: true,
              color: COLORS.red,
              margin: [0, 0, 0, 6],
            },
            {
              table: {
                headerRows: 1,
                widths: ["*", 110],
                body: [
                  [
                    { text: "รายการ", style: "tableHeader" },
                    {
                      text: "จำนวนเงิน (฿)",
                      style: "tableHeader",
                      alignment: "right",
                    },
                  ],
                  ...dedRows.map(([label, value]) => [
                    { text: label, fontSize: 10 },
                    {
                      text: value,
                      fontSize: 10,
                      alignment: "right",
                      color: COLORS.red,
                    },
                  ]),
                  [
                    {
                      text: "รวมรายการหัก",
                      bold: true,
                      fontSize: 11,
                      fillColor: "#FDECEA",
                    },
                    {
                      text: formatNumber(salaryCalculation.deductions),
                      bold: true,
                      fontSize: 11,
                      color: COLORS.red,
                      alignment: "right",
                      fillColor: "#FDECEA",
                    },
                  ],
                ],
              },
              layout: tableLayout(COLORS.red),
              margin: [0, 0, 0, 14],
            },
          ]
        : []),

      /* ─── Net salary box ─── */
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: "เงินเดือนสุทธิ",
                    fontSize: 12,
                    color: COLORS.goldLight,
                    alignment: "center",
                  },
                  {
                    text: `฿${formatNumber(salaryCalculation.netSalary)}`,
                    fontSize: 26,
                    bold: true,
                    color: "#FFFFFF",
                    alignment: "center",
                    margin: [0, 4, 0, 0],
                  },
                ],
                fillColor: COLORS.maroon,
                margin: [12, 12, 12, 12],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 14],
      },

      /* ─── Bank info ─── */
      {
        table: {
          widths: ["auto", "*"],
          body: [
            [
              {
                text: "🏦 โอนเข้าบัญชี",
                fontSize: 10,
                color: COLORS.maroon,
                fillColor: COLORS.goldPale,
                margin: [10, 8, 6, 8],
              },
              {
                text: `${bank}  ${bankAccountNumber}`,
                fontSize: 11,
                bold: true,
                fillColor: COLORS.goldPale,
                margin: [6, 8, 10, 8],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 14],
      },

      /* ─── Footer ─── */
      {
        text: "เอกสารนี้สร้างจากระบบอัตโนมัติ — กรุณาเก็บไว้เพื่อเป็นหลักฐาน",
        fontSize: 9,
        italics: true,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 12, 0, 0],
      },
    ],
    styles: {
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: "#FFFFFF",
        fillColor: COLORS.maroon,
      },
    },
  };
}

/**
 * Custom table layout with colored top border
 */
function tableLayout(headerColor) {
  return {
    hLineWidth: (i, node) =>
      i === 0 || i === node.table.body.length ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: (i, node) => {
      if (i === 0) return headerColor;
      if (i === node.table.body.length) return headerColor;
      return COLORS.border;
    },
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  };
}
