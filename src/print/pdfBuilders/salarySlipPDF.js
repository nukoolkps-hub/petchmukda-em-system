/* ─── Salary Slip — pdfmake document definition ─────────────
   สร้าง PDF จริงที่ text ค้นหา/copy ได้
   ไม่ใช่ image-based เหมือน html2pdf                          */

import { TH_MONTHS } from "../../constants";

const COLORS = {
  maroon:   "#7B1C1C",
  maroonDk: "#5C1212",
  gold:     "#C9973A",
  goldLt:   "#E8C87A",
  goldPale: "#F5E6C8",
  cream:    "#FDF8F0",
  text:     "#2D1A0E",
  textMid:  "#7A5C3A",
  textSoft: "#B89A72",
  border:   "#E8D5B0",
  red:      "#C0392B",
  green:    "#1A6B3A",
};

const num = (n) => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2, maximumFractionDigits:2});
const NUM = (n) => Number(n||0).toLocaleString("th-TH");

/**
 * Build pdfmake document definition for salary slip
 * @returns {Object} pdfmake docDefinition
 */
export function buildSalarySlipDocDef({ profile, empInfo, empRole, data, calc, poolShare, selMonth, monthApprovedAdvances }){
  if(!data || !calc) throw new Error("ไม่มีข้อมูลเงินเดือนเดือนนี้");

  const [y, mo] = selMonth.split("-");
  const monthLabel = `${TH_MONTHS[parseInt(mo)-1]} ${parseInt(y)+543}`;
  const printDate = new Date().toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });
  const empName = profile?.name || empInfo?.name || "-";
  const empPosition = profile?.role || empInfo?.role || "-";
  const bank = empInfo?.bank || profile?.bank || "-";
  const bankAcc = empInfo?.bankAcc || profile?.bankAcc || "-";

  /* ─── สร้าง earnings rows ─────────────────────────────── */
  const earnRows = [];
  earnRows.push(["เงินเดือนพื้นฐาน", num(calc.baseSalary)]);
  if(calc.isSingle){
    if(calc.commSingle > 0)
      earnRows.push([`ค่าคอมตามจำนวนชิ้น (${calc.pcsSingle} ชิ้น × ฿${NUM(calc.rSingle)})`, num(calc.commSingle)]);
  } else {
    if(calc.commNormal > 0)
      earnRows.push([`ค่าคอมขาย-ทั่วไป (${calc.pcsN.toFixed(1)} ชิ้น × ฿${NUM(calc.rNormal)})`, num(calc.commNormal)]);
    if(calc.commSpecial > 0)
      earnRows.push([`ค่าคอมขาย-พิเศษ (${calc.pcsS} ชิ้น × ฿${NUM(calc.rSpecial)})`, num(calc.commSpecial)]);
    if(calc.commBuy > 0)
      earnRows.push([`ค่าคอมรับซื้อ (${calc.pcsB.toFixed(1)} ชิ้น × ฿${NUM(calc.rBuy)})`, num(calc.commBuy)]);
  }
  if(calc.commInvite > 0)
    earnRows.push([`โบนัสเชิญชวนสมัครบัตร (${calc.pcsI} ใบ × ฿${NUM(calc.rInvite)})`, num(calc.commInvite)]);
  if(calc.commTransfer > 0)
    earnRows.push([`โบนัสย้ายข้อมูลบัตร (${calc.pcsT} ใบ × ฿${NUM(calc.rTransfer)})`, num(calc.commTransfer)]);
  if(calc.attendBonus > 0)
    earnRows.push([`โบนัสแห่งความขยัน (${calc.bonusDays} วัน × ฿${NUM(Math.round(calc.dayRate))})`, num(calc.attendBonus)]);

  /* ─── สร้าง deductions rows ───────────────────────────── */
  const dedRows = [];
  if(data.lateDeduction > 0)
    dedRows.push(["มาสาย / ขาดงาน", num(data.lateDeduction)]);
  if(calc.advanceDed > 0)
    dedRows.push([`เบิกล่วงหน้า (${monthApprovedAdvances?.length || 0} รายการ)`, num(calc.advanceDed)]);
  if(data.socialSecurity > 0)
    dedRows.push(["ประกันสังคม", num(data.socialSecurity)]);
  if(calc.overQ > 0)
    dedRows.push([`ลาเกินโควต้า (${calc.wd} วันธรรมดา + ${calc.sun} วันอาทิตย์)`, num(calc.overQ)]);

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
      title: `สลิปเงินเดือน — ${empName} ${monthLabel}`,
      author: "ห้างเพชรทองมุกดา",
      subject: "Salary Slip",
    },
    content: [
      /* ─── Header ─── */
      {
        table: {
          widths: ["*"],
          body: [[{
            text: [
              { text: "ห้างเพชรทองมุกดา\n", fontSize: 16, bold: true, color: "#FFFFFF" },
              { text: "Muktha Jewelry Co., Ltd.", fontSize: 10, color: COLORS.goldLt },
            ],
            fillColor: COLORS.maroonDk,
            margin: [12, 10, 12, 10],
            alignment: "center",
          }]],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 0],
      },

      /* ─── Title ─── */
      {
        table: {
          widths: ["*"],
          body: [[{
            text: "สลิปเงินเดือน",
            fontSize: 18,
            bold: true,
            color: COLORS.maroon,
            alignment: "center",
            fillColor: COLORS.goldPale,
            margin: [0, 8, 0, 8],
          }]],
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
              { text: empName, fontSize: 13, bold: true, margin: [0, 1, 0, 6] },
              { text: "ตำแหน่ง", fontSize: 9, color: COLORS.textSoft },
              { text: empPosition, fontSize: 11, margin: [0, 1, 0, 0] },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "ประจำเดือน", fontSize: 9, color: COLORS.textSoft },
              { text: monthLabel, fontSize: 13, bold: true, color: COLORS.maroon, margin: [0, 1, 0, 6] },
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
              { text: "จำนวนเงิน (฿)", style: "tableHeader", alignment: "right" },
            ],
            ...earnRows.map(([label, value]) => [
              { text: label, fontSize: 10 },
              { text: value, fontSize: 10, alignment: "right" },
            ]),
            [
              { text: "รวมรายรับ", bold: true, fontSize: 11, fillColor: "#E8F5EE" },
              { text: num(calc.earnings), bold: true, fontSize: 11, color: COLORS.green, alignment: "right", fillColor: "#E8F5EE" },
            ],
          ],
        },
        layout: tableLayout(COLORS.green),
        margin: [0, 0, 0, 14],
      },

      /* ─── Deductions table ─── */
      ...(dedRows.length > 0 ? [
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
                { text: "จำนวนเงิน (฿)", style: "tableHeader", alignment: "right" },
              ],
              ...dedRows.map(([label, value]) => [
                { text: label, fontSize: 10 },
                { text: value, fontSize: 10, alignment: "right", color: COLORS.red },
              ]),
              [
                { text: "รวมรายการหัก", bold: true, fontSize: 11, fillColor: "#FDECEA" },
                { text: num(calc.deductions), bold: true, fontSize: 11, color: COLORS.red, alignment: "right", fillColor: "#FDECEA" },
              ],
            ],
          },
          layout: tableLayout(COLORS.red),
          margin: [0, 0, 0, 14],
        },
      ] : []),

      /* ─── Net salary box ─── */
      {
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              { text: "เงินเดือนสุทธิ", fontSize: 12, color: COLORS.goldLt, alignment: "center" },
              { text: `฿${num(calc.net)}`, fontSize: 26, bold: true, color: "#FFFFFF", alignment: "center", margin: [0, 4, 0, 0] },
            ],
            fillColor: COLORS.maroon,
            margin: [12, 12, 12, 12],
          }]],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 14],
      },

      /* ─── Bank info ─── */
      {
        table: {
          widths: ["auto", "*"],
          body: [[
            { text: "🏦 โอนเข้าบัญชี", fontSize: 10, color: COLORS.maroon, fillColor: COLORS.goldPale, margin: [10, 8, 6, 8] },
            { text: `${bank}  ${bankAcc}`, fontSize: 11, bold: true, fillColor: COLORS.goldPale, margin: [6, 8, 10, 8] },
          ]],
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
function tableLayout(headerColor){
  return {
    hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: (i, node) => {
      if(i === 0) return headerColor;
      if(i === node.table.body.length) return headerColor;
      return COLORS.border;
    },
    paddingLeft:   () => 8,
    paddingRight:  () => 8,
    paddingTop:    () => 5,
    paddingBottom: () => 5,
  };
}
