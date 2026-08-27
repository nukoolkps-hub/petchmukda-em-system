/* ─── PDF: ตารางการคำนวณโดยรวม ───────────────────────────────────────
   แนวนอน (landscape) — คอลัมน์ = พนักงาน · แถว = รายการคำนวณ
   ใช้ pdfmake + ฟอนต์ Sarabun (lazy-load เหมือนสลิป/ใบรับรอง)
   หน้ากระดาษเลือกตามจำนวนคน: ≤6 คน = A4 · มากกว่านั้น = A3 (ไม่บีบจนอ่านไม่ออก) */

import type { MatrixRow, PayrollMatrix } from "../utils/payrollMatrix";
import { openPDFBlob } from "./webviewHelpers";

const MAROON = "#7B1C1C";
const GOLD_PALE = "#F5E6C8";
const CREAM = "#FDF8F0";
const BORDER = "#E8D5B0";
const TEXT = "#2D1A0E";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function monthLabelTH(yearMonth: string): string {
  const [y, m] = String(yearMonth || "")
    .split("-")
    .map(Number);
  if (!y || !m) return yearMonth;
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

const money = (n: number) =>
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
      return money(value);
  }
}

function buildDocDef(matrix: PayrollMatrix) {
  const colCount = matrix.employees.length;
  const widths = [110, ...matrix.employees.map(() => "*"), 70];

  const headerRow = [
    { text: "รายการ", style: "th", alignment: "left" as const },
    ...matrix.employees.map((e) => ({
      text: e.name,
      style: "th",
      alignment: "center" as const,
    })),
    { text: "รวม", style: "th", alignment: "right" as const },
  ];

  const body: unknown[][] = [headerRow];

  for (const section of matrix.sections) {
    // แถวหัวข้อกลุ่ม — span เต็มความกว้าง
    body.push([
      {
        text: section.title,
        style: "sectionHead",
        colSpan: colCount + 2,
        fillColor: GOLD_PALE,
      },
      ...Array(colCount + 1).fill({}),
    ]);
    for (const row of section.rows) {
      const emphasise = row.emphasis === "net";
      const isSum = row.emphasis === "sum";
      const fill = emphasise ? GOLD_PALE : isSum ? CREAM : undefined;
      body.push([
        {
          text: row.label,
          style: "cellLabel",
          bold: emphasise || isSum,
          fillColor: fill,
        },
        ...row.values.map((v) => ({
          text: formatMatrixValue(v, row.kind),
          style: "cell",
          alignment: row.kind === "text" ? "center" : "right",
          bold: emphasise,
          fillColor: fill,
        })),
        {
          text:
            row.total === null ? "" : formatMatrixValue(row.total, row.kind),
          style: "cell",
          alignment: "right",
          bold: true,
          fillColor: fill,
        },
      ]);
    }
  }

  return {
    pageSize: colCount > 6 ? "A3" : "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 28, 24, 30],
    defaultStyle: { font: "Sarabun", fontSize: 8, color: TEXT },
    footer: (currentPage: number, pageCount: number) => ({
      text: `หน้า ${currentPage}/${pageCount} · พิมพ์จากระบบพนักงาน ห้างเพชรทองมุกดา`,
      alignment: "center",
      fontSize: 7,
      color: "#B89A72",
      margin: [0, 6, 0, 0],
    }),
    content: [
      {
        columns: [
          {
            stack: [
              { text: "ตารางการคำนวณเงินเดือน", style: "title" },
              {
                text: `ประจำเดือน ${monthLabelTH(matrix.yearMonth)}`,
                style: "subtitle",
              },
            ],
          },
          {
            width: "auto",
            stack: [
              { text: "รวมสุทธิที่ต้องจ่าย", style: "subtitle", alignment: "right" },
              {
                text: `${money(matrix.netTotal)} บาท`,
                style: "netTotal",
                alignment: "right",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        table: { headerRows: 1, widths, body, dontBreakRows: true },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
      },
    ],
    styles: {
      title: { fontSize: 15, bold: true, color: MAROON },
      subtitle: { fontSize: 9, color: "#7A5C3A" },
      netTotal: { fontSize: 14, bold: true, color: MAROON },
      th: { fontSize: 8.5, bold: true, color: "#FFFFFF", fillColor: MAROON },
      sectionHead: { fontSize: 8.5, bold: true, color: MAROON },
      cellLabel: { fontSize: 8 },
      cell: { fontSize: 8 },
    },
  };
}

export async function downloadPayrollMatrixPDF(matrix: PayrollMatrix) {
  const [{ default: pdfMake }, { ensureThaiFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("../utils/pdfFonts"),
  ]);
  await ensureThaiFonts(pdfMake);
  // pdfmake 0.3.x: getBlob() คืน Promise (ไม่รับ callback แบบ 0.1.x)
  const blob: Blob = await pdfMake
    .createPdf(buildDocDef(matrix) as never)
    .getBlob();
  openPDFBlob(blob, `ตารางเงินเดือน-${matrix.yearMonth}.pdf`);
}
