/* ─── Salary Certificate — pdfmake document definition ───────
   หนังสือรับรองเงินเดือน — เป็น PDF text-searchable จริง          */

const COLORS = {
  maroon: "#7B1C1C",
  maroonDark: "#5C1212",
  gold: "#C9973A",
  goldLight: "#E8C87A",
  goldPale: "#F5E6C8",
  text: "#2D1A0E",
  textMedium: "#7A5C3A",
  textSoft: "#B89A72",
  border: "#E8D5B0",
};

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

/**
 * Build pdfmake document definition for salary certificate
 */
export function buildCertificateDocDef({
  profile,
  employeeInfo,
  data,
  startDate,
}) {
  const employeeName = profile?.name || employeeInfo?.name || "-";
  const employeeRole = profile?.role || employeeInfo?.role || "-";
  const baseSalary = data?.baseSalary || 0;
  const prefix = profile?.prefix || "นางสาว";
  const printDate = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startWork = startDate || "มีนาคม พ.ศ. 2566";

  // Reference number — ปี + เดือน + เลข random 3 หลัก
  const now = new Date();
  const refNo = `มก.${(now.getFullYear() + 543).toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 900) + 100)}`;

  return {
    pageSize: "A4",
    pageMargins: [60, 50, 60, 50],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 14,
      color: COLORS.text,
      lineHeight: 1.5,
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
            text: "ห้างเพชรทองมุกดา",
            fontSize: 22,
            bold: true,
            color: COLORS.maroon,
            alignment: "center",
          },
          {
            text: "Muktha Jewelry Co., Ltd.",
            fontSize: 11,
            color: COLORS.gold,
            alignment: "center",
            margin: [0, 2, 0, 0],
          },
          {
            text: "เลขที่ 123/45 ถนนเยาวราช แขวงสัมพันธวงศ์ เขตสัมพันธวงศ์ กรุงเทพมหานคร 10100",
            fontSize: 10,
            color: COLORS.textMedium,
            alignment: "center",
            margin: [0, 6, 0, 0],
          },
          {
            text: "โทรศัพท์: 02-123-4567   อีเมล: contact@muktha.co.th",
            fontSize: 10,
            color: COLORS.textMedium,
            alignment: "center",
            margin: [0, 1, 0, 0],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      /* ─── Gold divider ─── */
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 475,
            y2: 0,
            lineWidth: 1.5,
            lineColor: COLORS.gold,
          },
        ],
        margin: [0, 0, 0, 16],
      },

      /* ─── Reference number + date ─── */
      {
        columns: [
          { text: `เลขที่ ${refNo}`, fontSize: 11, color: COLORS.textMedium },
          {
            text: `วันที่ ${printDate}`,
            fontSize: 11,
            color: COLORS.textMedium,
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 24],
      },

      /* ─── Title ─── */
      {
        text: "หนังสือรับรองเงินเดือน",
        fontSize: 20,
        bold: true,
        color: COLORS.maroon,
        alignment: "center",
        margin: [0, 0, 0, 4],
      },
      {
        text: "Certificate of Employment & Salary",
        fontSize: 11,
        color: COLORS.textMedium,
        alignment: "center",
        italics: true,
        margin: [0, 0, 0, 28],
      },

      /* ─── Body paragraph ─── */
      {
        text: [
          { text: "         ขอรับรองว่า " },
          {
            text: `${prefix}${employeeName} `,
            bold: true,
            color: COLORS.maroon,
          },
          { text: "เป็นพนักงานประจำของ " },
          { text: "ห้างเพชรทองมุกดา ", bold: true },
          { text: "ตำแหน่ง " },
          { text: `${employeeRole} `, bold: true },
          { text: "เริ่มปฏิบัติงานตั้งแต่เดือน " },
          { text: `${startWork} `, bold: true },
          { text: "จนถึงปัจจุบัน โดยได้รับเงินเดือน เดือนละ " },
          {
            text: `${formatNumber(baseSalary)} บาท `,
            bold: true,
            color: COLORS.maroon,
          },
          {
            text: `(${formatThaiBahtText(baseSalary)})`,
            italics: true,
            color: COLORS.textMedium,
          },
        ],
        alignment: "justify",
        lineHeight: 1.8,
        margin: [0, 0, 0, 20],
      },

      {
        text: "         ออกหนังสือรับรองฉบับนี้ให้ไว้เพื่อแสดงต่อหน่วยงานหรือองค์กรที่เกี่ยวข้อง และยืนยันว่าข้อความข้างต้นเป็นความจริงทุกประการ",
        alignment: "justify",
        lineHeight: 1.8,
        margin: [0, 0, 0, 40],
      },

      /* ─── Signature block ─── */
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            stack: [
              {
                text: "ขอแสดงความนับถือ",
                alignment: "center",
                margin: [0, 0, 0, 50],
              },
              {
                canvas: [
                  {
                    type: "line",
                    x1: 0,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 0.8,
                    lineColor: COLORS.text,
                  },
                ],
              },
              {
                text: "( ____________________ )",
                fontSize: 11,
                alignment: "center",
                margin: [0, 6, 0, 2],
              },
              {
                text: "ผู้จัดการฝ่ายบุคคล",
                fontSize: 11,
                color: COLORS.textMedium,
                alignment: "center",
              },
              {
                text: "ห้างเพชรทองมุกดา",
                fontSize: 10,
                color: COLORS.textSoft,
                alignment: "center",
                margin: [0, 1, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 24],
      },

      /* ─── Footer note ─── */
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 475,
            y2: 0,
            lineWidth: 0.5,
            lineColor: COLORS.border,
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: "หนังสือรับรองนี้มีอายุ 30 วันนับจากวันที่ออกเอกสาร",
        fontSize: 9,
        italics: true,
        color: COLORS.textSoft,
        alignment: "center",
      },
    ],
  };
}
