import { THAI_MONTH_NAMES } from "../constants";
import { buildSalarySlipDocDef } from "./pdfBuilders/salarySlipPDF";
import { openPDFBlob, printHTMLInIframe } from "./webviewHelpers";

/* ─── Print Salary Slip ──────────────────────────────────────────
   2 modes:
   • printSalarySlip()       → window.print() (เลือก Save as PDF เอง, bundle 0KB)
   • downloadSalarySlipPDF() → pdfmake (PDF text-searchable, lazy-loaded ~400KB) */

function buildSalarySlipHTML(
  {
    profile,
    employeeInfo,
    employeeRole,
    data,
    salaryCalculation,
    poolShare,
    selectedMonth,
    monthApprovedAdvances,
  }: any,
  opts: { includePrintControls?: boolean } = {},
) {
  if (!data || !salaryCalculation) return null;

  // includePrintControls=true → มีปุ่มพิมพ์ + auto-print script
  const includePrintControls = opts.includePrintControls !== false;

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

  const formatNumber = (value) => Number(value || 0).toLocaleString("th-TH");

  // ── สร้างรายการรายรับ ──
  const earnRows: { label: string; value: any }[] = [];
  earnRows.push({ label: "เงินเดือนพื้นฐาน", value: salaryCalculation.baseSalary });
  if (salaryCalculation.usesSinglePieceRate) {
    if (salaryCalculation.singleRateCommission > 0)
      earnRows.push({
        label: "ค่าคอมตามจำนวนชิ้น",
        value: salaryCalculation.singleRateCommission,
      });
  } else {
    if (salaryCalculation.normalSaleCommission > 0)
      earnRows.push({
        label: "ค่าคอมขาย-ทั่วไป",
        value: salaryCalculation.normalSaleCommission,
      });
    if (salaryCalculation.specialSaleCommission > 0)
      earnRows.push({
        label: "ค่าคอมขาย-พิเศษ",
        value: salaryCalculation.specialSaleCommission,
      });
    if (salaryCalculation.buyCommission > 0)
      earnRows.push({
        label: "ค่าคอมรับซื้อ",
        value: salaryCalculation.buyCommission,
      });
  }
  if (salaryCalculation.inviteCommission > 0)
    earnRows.push({
      label: "โบนัสเชิญชวนสมัครบัตร",
      value: salaryCalculation.inviteCommission,
    });
  if (salaryCalculation.transferCommission > 0)
    earnRows.push({
      label: "โบนัสย้ายข้อมูลบัตร",
      value: salaryCalculation.transferCommission,
    });
  if (salaryCalculation.attendanceBonus > 0)
    earnRows.push({
      label: "โบนัสแห่งความขยัน(ไม่หยุด)",
      value: salaryCalculation.attendanceBonus,
    });

  // ── รายการหัก ──
  const dedRows: { label: string; value: any }[] = [];
  if (salaryCalculation.advanceDeduction > 0) {
    dedRows.push({
      label: "หักเงินเบิกล่วงหน้า",
      value: salaryCalculation.advanceDeduction,
    });
  }
  if (salaryCalculation.socialSecurity > 0)
    dedRows.push({
      label: "หักประกันสังคม",
      value: salaryCalculation.socialSecurity,
    });
  if (salaryCalculation.overQuotaDeduction > 0) {
    dedRows.push({
      label: "หักลาเกินโควต้า",
      value: salaryCalculation.overQuotaDeduction,
    });
  }
  if (Array.isArray(data.customDeductions))
    for (const d of data.customDeductions)
      if (d?.amount > 0)
        dedRows.push({ label: d.label || "รายการหัก", value: d.amount });

  const slipHTML = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <title>สลิปเงินเดือน — ${employeeName} ${monthLabel}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Sarabun',sans-serif;
      background:#ECECEC;color:#1A1A1A;padding:24px 16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    .slip{
      max-width:680px;margin:0 auto;background:#fff;
      border:1px solid #333;padding:34px 40px 28px;
    }
    .letterhead{text-align:center;padding-bottom:12px;margin-bottom:18px;
      border-bottom:3px double #7B1C1C;}
    /* ขนาดอิงหน่วย pt ให้คุมตอนพิมพ์ได้แน่นอน — เนื้อความสลิป 12pt (อ่านง่าย พอดี A4) */
    .company{font-size:18pt;font-weight:700;color:#7B1C1C;margin-bottom:5px;letter-spacing:0.01em;}
    .addr{font-size:11pt;color:#444;line-height:1.6;}
    .doc-title{text-align:center;font-size:16pt;font-weight:700;color:#1A1A1A;
      letter-spacing:0.06em;margin-bottom:3px;}
    .doc-period{text-align:center;font-size:12pt;color:#555;margin-bottom:20px;}
    .meta{
      display:grid;grid-template-columns:1fr 1fr;gap:7px 28px;
      margin-bottom:18px;font-size:12pt;
      border:1px solid #DADADA;padding:13px 16px;background:#FAFAFA;
    }
    .meta .label{color:#666;}
    .meta .value{color:#1A1A1A;font-weight:600;}
    .sec-label{font-size:12pt;font-weight:700;color:#1A1A1A;
      margin:16px 0 0;padding-bottom:5px;border-bottom:1.5px solid #1A1A1A;
      display:flex;justify-content:space-between;letter-spacing:0.02em;}
    table{width:100%;border-collapse:collapse;font-size:12pt;}
    table td{padding:6px 2px;border-bottom:1px solid #ECECEC;color:#1A1A1A;}
    table tr:last-child td{border-bottom:none;}
    table td.amt{text-align:right;font-weight:600;white-space:nowrap;}
    .subtotal{display:flex;justify-content:space-between;align-items:center;
      padding:7px 2px;font-weight:700;font-size:12pt;border-top:1.5px solid #999;}
    .net{
      margin-top:20px;border:2px solid #7B1C1C;padding:14px 20px;
      display:flex;justify-content:space-between;align-items:center;background:#FBF4F4;
    }
    .net .lbl{font-size:13pt;font-weight:700;color:#7B1C1C;}
    .net .amt{font-size:22pt;font-weight:700;color:#7B1C1C;letter-spacing:-0.01em;}
    .warn{background:#FBF4F4;border:1px solid #7B1C1C;padding:9px 14px;
      margin-bottom:14px;font-size:11pt;color:#7B1C1C;font-weight:600;}
    .signatures{
      margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:40px;
    }
    .sig-box{text-align:center;}
    .sig-line{border-top:1px solid #1A1A1A;padding-top:6px;margin-top:54px;
      font-size:12pt;color:#1A1A1A;font-weight:600;}
    .sig-name{font-size:10.5pt;color:#666;margin-top:2px;}
    .footer{margin-top:24px;padding-top:10px;border-top:1px solid #E0E0E0;
      font-size:9pt;color:#999;text-align:center;}
    @page{size:A4 portrait;margin:8mm;}
    @media print{
      html,body{width:210mm;height:297mm;}
      body{background:#fff;padding:0;line-height:1.3;}
      .slip{border:1px solid #333 !important;max-width:194mm !important;
        margin:0 auto !important;page-break-inside:avoid;break-inside:avoid;}
      .slip *{page-break-inside:avoid;break-inside:avoid;}
      .no-print{display:none !important;}
    }
    .print-btn{
      position:fixed;bottom:20px;right:20px;
      background:#7B1C1C;color:#fff;
      border:none;padding:11px 22px;border-radius:6px;font-size:14px;
      font-weight:600;cursor:pointer;font-family:inherit;
      box-shadow:0 4px 14px rgba(0,0,0,0.25);z-index:999;
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="letterhead">
      <div class="company">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      <div class="addr">
        100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160<br/>
        เลขประจำตัวผู้เสียภาษี 0-7355-59006-56-8
      </div>
    </div>

    <div class="doc-title">สลิปเงินเดือน</div>
    <div class="doc-period">ประจำงวดเดือน ${monthLabel}</div>

    <div class="meta">
      <div><span class="label">ชื่อ-นามสกุล:</span> <span class="value">${employeeName}</span></div>
      <div><span class="label">ตำแหน่ง:</span> <span class="value">${employeePosition}</span></div>
      <div><span class="label">ธนาคาร:</span> <span class="value">${bank}</span></div>
      <div><span class="label">เลขที่บัญชี:</span> <span class="value" style="letter-spacing:0.05em">${bankAccountNumber}</span></div>
      <div><span class="label">วันที่ออกสลิป:</span> <span class="value">${printDate}</span></div>
      <div><span class="label">รอบเงินเดือน:</span> <span class="value">${monthLabel}</span></div>
    </div>

    ${
      salaryCalculation.losesBaseSalary
        ? `
    <div class="warn">ไม่ได้รับเงินเดือนพื้นฐาน — ยอดขายต่ำกว่าเกณฑ์ขั้นต่ำ</div>`
        : ""
    }

    <div class="sec-label"><span>รายการรายรับ</span><span>จำนวนเงิน (บาท)</span></div>
    <table>
      ${earnRows
        .map(
          (r) => `
        <tr>
          <td>${r.label}</td>
          <td class="amt">${formatNumber(r.value)}</td>
        </tr>`,
        )
        .join("")}
    </table>
    <div class="subtotal">
      <span>รวมรายรับ</span>
      <span>${formatNumber(salaryCalculation.earnings)}</span>
    </div>

    <div class="sec-label"><span>รายการหัก</span><span>จำนวนเงิน (บาท)</span></div>
    ${
      dedRows.length > 0
        ? `
    <table>
      ${dedRows
        .map(
          (r) => `
        <tr>
          <td>${r.label}</td>
          <td class="amt">${formatNumber(r.value)}</td>
        </tr>`,
        )
        .join("")}
    </table>
    <div class="subtotal">
      <span>รวมรายการหัก</span>
      <span>${formatNumber(salaryCalculation.deductions)}</span>
    </div>`
        : `
    <div style="text-align:center;padding:12px;color:#777;font-size:13px;">— ไม่มีรายการหัก —</div>`
    }

    <div class="net">
      <span class="lbl">เงินสุทธิที่ได้รับ</span>
      <span class="amt">฿${formatNumber(salaryCalculation.netSalary)}</span>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">ลงชื่อพนักงานผู้รับเงิน</div>
        <div class="sig-name">(${employeeName})</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">ลงชื่อผู้มีอำนาจลงนาม</div>
        <div class="sig-name">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      </div>
    </div>

    <div class="footer">
      เอกสารนี้จัดทำโดยระบบอัตโนมัติ · ออกเอกสารเมื่อ ${printDate}
    </div>
  </div>

  ${
    includePrintControls
      ? `<button class="print-btn no-print" onclick="window.print()">พิมพ์ / บันทึก PDF</button>
  <script>
    window.addEventListener('load',()=>setTimeout(()=>window.print(),800));
  </script>`
      : ""
  }
</body>
</html>`;

  return slipHTML;
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * 🖨 พิมพ์ / บันทึก PDF ผ่าน window.print()
 * ✅ Bundle 0KB · ทำงานเร็ว · text searchable ใน PDF (ถ้าผู้ใช้เลือก Save as PDF)
 * ⚠️  ต้องให้ผู้ใช้กด "Save as PDF" เองในกล่องพิมพ์
 */
export function printSalarySlip(args) {
  const html = buildSalarySlipHTML(args, { includePrintControls: true });
  if (!html) return;
  printHTMLInIframe(html);
}

/**
 * 📥 ดาวน์โหลด PDF อัตโนมัติ ผ่าน pdfmake (lazy-loaded)
 * ✅ ดาวน์โหลดทันที · text searchable + select ได้ · ขนาดไฟล์เล็ก
 * ⚠️  โหลด pdfmake ครั้งแรก ~400KB
 */
/**
 * สร้างสลิปเป็น Blob (ไม่เปิด/ไม่ดาวน์โหลด) — ใช้ตอน freeze ลง Storage
 */
export async function generateSalarySlipBlob(args): Promise<Blob> {
  if (!args?.data || !args?.salaryCalculation)
    throw new Error("ไม่มีข้อมูลเงินเดือนเดือนนี้");

  // Lazy-load pdfmake + Thai fonts (ทำครั้งแรกครั้งเดียว)
  const [{ default: pdfMake }, { ensureThaiFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("../utils/pdfFonts"),
  ]);
  await ensureThaiFonts(pdfMake);

  const docDef = buildSalarySlipDocDef(args);
  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => resolve(blob));
    } catch (err) {
      reject(err);
    }
  });
}

export async function downloadSalarySlipPDF(args) {
  const blob = await generateSalarySlipBlob(args);
  const employeeName =
    args.profile?.name || args.employeeInfo?.name || "employee";
  const safe = (s) =>
    String(s || "")
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  const filename = `สลิปเงินเดือน-${safe(employeeName)}-${args.selectedMonth}.pdf`;
  openPDFBlob(blob, filename);
}

/** Default export — backward compat */
export default printSalarySlip;
