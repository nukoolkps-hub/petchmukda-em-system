/* ─── Salary Certificate — pdfmake document definition ───────
   หนังสือรับรองเงินเดือน — เป็น PDF text-searchable จริง          */

import { THAI_MONTH_NAMES } from "../../constants";
import { getEffectiveBaseSalary } from "../../utils/salaryUtils";

const COLORS = {
  maroon: "#7B1C1C",
  text: "#1A1A1A",
  textMedium: "#666666",
  textSoft: "#999999",
  border: "#E0E0E0",
};

const CONTENT_WIDTH = 475; // A4 (595.28) − pageMargins 60×2 (≈475)

/* ─── Number → Thai text (basic, รองรับ 0 - 9,999,999) ───── */
const DIGITS = [
  "ศูนย์",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function formatThaiBahtText(n) {
  if (!n || n <= 0) return "ศูนย์บาทถ้วน";
  let str = "";
  const roundedAmount = Math.floor(n);
  const amountText = String(roundedAmount);
  const digitCount = amountText.length;

  for (let digitIndex = 0; digitIndex < digitCount; digitIndex++) {
    const digit = parseInt(amountText[digitIndex], 10);
    const place = digitCount - 1 - digitIndex;
    if (digit === 0) continue;
    if (place === 0 && digit === 1 && digitCount > 1) str += "เอ็ด";
    else if (place === 1 && digit === 2) str += "ยี่";
    else if (place === 1 && digit === 1) str += "";
    else str += DIGITS[digit];
    str += PLACES[place];
  }
  return `${str}บาทถ้วน`;
}

const formatNumber = (n) => Number(n || 0).toLocaleString("th-TH");

/* "YYYY-MM" → "มีนาคม พ.ศ. 2566" (คืน "" ถ้า format ไม่ถูก) */
function formatThaiStartWork(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return "";
  const [y, m] = yearMonth.split("-");
  const monthIndex = parseInt(m, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return "";
  return `${THAI_MONTH_NAMES[monthIndex]} พ.ศ. ${parseInt(y, 10) + 543}`;
}

/**
 * Build pdfmake document definition for salary certificate
 */
export function buildCertificateDocDef({
  profile,
  employeeInfo,
  data,
  startDate,
}) {
  // ข้อมูล "ทางการ" ให้ใช้จาก employeeInfo (ที่ Admin ตั้งไว้) ก่อน profile (LINE)
  const employeeName = employeeInfo?.name || profile?.name || "-";
  const employeeRole = employeeInfo?.role || profile?.role || "-";
  // เงินเดือนพื้นฐาน "ปัจจุบัน" = baseSalary + raises สะสมถึงปีนี้
  // ใบรับรองใช้ยื่นกู้/สมัครงาน → ต้องเป็นเลขจริงของวันออกใบ ไม่ใช่ค่าเริ่มต้น
  const baseSalary = employeeInfo
    ? getEffectiveBaseSalary({
        baseSalary: employeeInfo.baseSalary ?? 0,
        startWorkMonth: employeeInfo.startWorkMonth ?? null,
        annualRaiseAmount: employeeInfo.annualRaiseAmount ?? 0,
        annualRaises: employeeInfo.annualRaises ?? {},
      }) || data?.baseSalary || 0
    : data?.baseSalary || 0;
  const prefix = employeeInfo?.prefix || profile?.prefix || "นางสาว";
  const printDate = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startWork =
    formatThaiStartWork(employeeInfo?.startWorkMonth) ||
    startDate ||
    "มีนาคม พ.ศ. 2566";

  // Reference number — ปี + เดือน + เลข random 3 หลัก
  const now = new Date();
  const refNo = `มก.${(now.getFullYear() + 543).toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 900) + 100)}`;

  return {
    pageSize: "A4",
    pageMargins: [60, 50, 60, 50],
    defaultStyle: {
      // เนื้อความ 16pt ตามมาตรฐานหนังสือราชการ (ระเบียบงานสารบรรณ + Sarabun)
      font: "Sarabun",
      fontSize: 16,
      color: COLORS.text,
      lineHeight: 1.4,
    },
    info: {
      title: `หนังสือรับรองเงินเดือน — ${employeeName}`,
      author: "ห้างเพชรทองมุกดา",
      subject: "Salary Certificate",
    },
    content: [
      /* ─── Letterhead ─── */
      {
        stack: [
          {
            text: "บริษัท ห้างเพชรทองมุกดา จำกัด",
            fontSize: 20,
            bold: true,
            color: COLORS.maroon,
            alignment: "center",
          },
          {
            text: "100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160",
            fontSize: 11,
            color: COLORS.textMedium,
            alignment: "center",
            margin: [0, 6, 0, 0],
          },
          {
            text: "โทร. 02-420-6075   เลขประจำตัวผู้เสียภาษี 0-7355-59006-56-8",
            fontSize: 11,
            color: COLORS.textMedium,
            alignment: "center",
            margin: [0, 1, 0, 0],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      /* ─── เส้นคู่ใต้ letterhead (สไตล์เอกสารทางการ) ─── */
      {
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
        margin: [0, 0, 0, 20],
      },

      /* ─── Reference number ─── */
      {
        text: `เลขที่ ${refNo}`,
        fontSize: 16,
        bold: true,
        color: COLORS.text,
        margin: [0, 0, 0, 0],
      },

      /* ─── Title ─── */
      {
        text: "หนังสือรับรองเงินเดือน",
        fontSize: 20,
        bold: true,
        color: COLORS.text,
        alignment: "center",
        margin: [0, 18, 0, 2],
      },
      {
        text: "Certificate of Salary",
        fontSize: 11,
        color: COLORS.textSoft,
        alignment: "center",
        margin: [0, 0, 0, 26],
      },

      /* ─── Body paragraph ─── */
      {
        text: [
          { text: "          หนังสือฉบับนี้ออกให้เพื่อแสดงว่า " },
          { text: `${prefix} ${employeeName} `, bold: true },
          { text: "ได้ปฏิบัติหน้าที่ในตำแหน่ง " },
          { text: `${employeeRole} `, bold: true },
          { text: "ของ " },
          { text: "บริษัท ห้างเพชรทองมุกดา จำกัด ", bold: true },
          { text: "โดยปฏิบัติงานตั้งแต่ " },
          { text: `${startWork} `, bold: true },
          { text: "มีอัตราเงินเดือนประจำเดือนละ " },
          { text: `${formatNumber(baseSalary)} บาท `, bold: true },
          { text: `(${formatThaiBahtText(baseSalary)}) ` },
          { text: "ซึ่งอัตรานี้ยังไม่รวมค่าตอบแทนและเงินพิเศษอื่น ๆ" },
        ],
        alignment: "justify",
        lineHeight: 1.9,
        margin: [0, 0, 0, 18],
      },

      {
        text: "          ออกหนังสือรับรองฉบับนี้ให้ไว้เพื่อแสดงต่อหน่วยงานหรือองค์กรที่เกี่ยวข้อง และยืนยันว่าข้อความข้างต้นเป็นความจริงทุกประการ",
        alignment: "justify",
        lineHeight: 1.9,
        margin: [0, 0, 0, 30],
      },

      /* ─── Date line ─── */
      {
        text: `ออกให้ ณ วันที่ ${printDate}`,
        alignment: "right",
        fontSize: 16,
        margin: [0, 0, 40, 0],
      },

      /* ─── Signature block ─── */
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 220,
            stack: [
              {
                canvas: [
                  {
                    type: "line",
                    x1: 10,
                    y1: 0,
                    x2: 210,
                    y2: 0,
                    lineWidth: 0.8,
                    lineColor: COLORS.text,
                  },
                ],
                margin: [0, 64, 0, 0],
              },
              {
                text: "ลงชื่อผู้มีอำนาจลงนาม",
                fontSize: 16,
                bold: true,
                alignment: "center",
                margin: [0, 6, 0, 0],
              },
              {
                text: "บริษัท ห้างเพชรทองมุกดา จำกัด",
                fontSize: 13,
                color: COLORS.textMedium,
                alignment: "center",
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 6, 0, 30],
      },

      /* ─── Footer note ─── */
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: CONTENT_WIDTH,
            y2: 0,
            lineWidth: 0.5,
            lineColor: COLORS.border,
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: "หนังสือฉบับนี้มีอายุ 30 วัน นับจากวันที่ออกเอกสาร",
        fontSize: 11,
        color: COLORS.textSoft,
        alignment: "center",
      },
    ],
  };
}
