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
        label: `ค่าคอมตามจำนวนชิ้น (${salaryCalculation.singleRatePieces} ชิ้น × ฿${formatNumber(salaryCalculation.singlePieceRate)})`,
        value: salaryCalculation.singleRateCommission,
      });
  } else {
    if (salaryCalculation.normalSaleCommission > 0)
      earnRows.push({
        label: `ค่าคอมขาย-ทั่วไป (${salaryCalculation.normalSalePieces.toFixed(1)} ชิ้น × ฿${formatNumber(salaryCalculation.normalSalePieceRate)})`,
        value: salaryCalculation.normalSaleCommission,
      });
    if (salaryCalculation.specialSaleCommission > 0)
      earnRows.push({
        label: `ค่าคอมขาย-พิเศษ (${salaryCalculation.specialSalePieces} ชิ้น × ฿${formatNumber(salaryCalculation.specialSalePieceRate)})`,
        value: salaryCalculation.specialSaleCommission,
      });
    if (salaryCalculation.buyCommission > 0)
      earnRows.push({
        label: `ค่าคอมรับซื้อ (${salaryCalculation.buyPieces.toFixed(1)} ชิ้น × ฿${formatNumber(salaryCalculation.buyPieceRate)})`,
        value: salaryCalculation.buyCommission,
      });
  }
  if (salaryCalculation.inviteCommission > 0)
    earnRows.push({
      label: `โบนัสเชิญชวนสมัครบัตร (${salaryCalculation.invitePieces} ใบ × ฿${formatNumber(salaryCalculation.invitePieceRate)})`,
      value: salaryCalculation.inviteCommission,
    });
  if (salaryCalculation.transferCommission > 0)
    earnRows.push({
      label: `โบนัสย้ายข้อมูลบัตร (${salaryCalculation.transferPieces} ใบ × ฿${formatNumber(salaryCalculation.transferPieceRate)})`,
      value: salaryCalculation.transferCommission,
    });
  if (salaryCalculation.attendanceBonus > 0)
    earnRows.push({
      label: `โบนัสแห่งความขยัน(ไม่หยุด) (${salaryCalculation.bonusDays} วัน × ฿${formatNumber(Math.round(salaryCalculation.dailySalaryRate))})`,
      value: salaryCalculation.attendanceBonus,
    });

  // ── รายการหัก ──
  const dedRows: { label: string; value: any }[] = [];
  if (data.lateDeduction > 0)
    dedRows.push({ label: "หักขาดงาน/มาสาย", value: data.lateDeduction });
  if (salaryCalculation.advanceDeduction > 0) {
    const detail =
      monthApprovedAdvances && monthApprovedAdvances.length > 0
        ? ` (${monthApprovedAdvances.length} รายการ)`
        : "";
    dedRows.push({
      label: `หักเงินเบิกล่วงหน้า${detail}`,
      value: salaryCalculation.advanceDeduction,
    });
  }
  if (salaryCalculation.socialSecurity > 0)
    dedRows.push({
      label: "หักประกันสังคม",
      value: salaryCalculation.socialSecurity,
    });
  if (salaryCalculation.overQuotaDeduction > 0) {
    const detail: string[] = [];
    if (salaryCalculation.weekdayOverQuotaDays > 0)
      detail.push(
        `วันธรรมดา ${salaryCalculation.weekdayOverQuotaDays} × ฿${formatNumber(Math.round(salaryCalculation.dailySalaryRate))}`,
      );
    if (salaryCalculation.sundayOverQuotaDays > 0)
      detail.push(
        `วันอาทิตย์ ${salaryCalculation.sundayOverQuotaDays} × ฿${formatNumber(Math.round(salaryCalculation.dailySalaryRate))} × 1.5`,
      );
    dedRows.push({
      label: `หักลาเกินโควต้า (${detail.join(" + ")})`,
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Prompt','Sarabun',sans-serif;
      background:#FDF8F0;color:#2D1A0E;padding:24px 16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    .slip{
      max-width:680px;margin:0 auto;background:#fff;
      border:2px solid #C9973A;border-radius:14px;
      padding:0;overflow:hidden;
      box-shadow:0 4px 20px rgba(123,28,28,0.12);
    }
    .header{
      background:linear-gradient(135deg,#5C1212 0%,#7B1C1C 60%,#9B3030 100%);
      color:#E8C87A;padding:18px 24px;position:relative;
    }
    .company{
      font-size:18px;font-weight:800;letter-spacing:0.02em;color:#fff;margin-bottom:4px;
    }
    .company-th{font-size:13px;color:#E8C87A;font-weight:500;line-height:1.6;}
    .gold-line{
      height:2px;background:linear-gradient(90deg,transparent,#E8C87A,transparent);margin:0;
    }
    .title-row{
      padding:14px 24px;display:flex;justify-content:space-between;align-items:center;
      border-bottom:1px solid #E8D5B0;background:#F5E6C8;
    }
    .title{font-size:17px;font-weight:800;color:#7B1C1C;}
    .month{font-size:14px;font-weight:700;color:#7A5C3A;}
    .body{padding:18px 24px;}
    .info-grid{
      display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;
      margin-bottom:16px;font-size:13px;
    }
    .info-grid .label{color:#7A5C3A;}
    .info-grid .value{color:#2D1A0E;font-weight:600;}
    .section-title{
      font-size:13px;font-weight:700;color:#7B1C1C;margin:14px 0 8px;
      padding:6px 10px;background:#F5E6C8;border-left:4px solid #C9973A;border-radius:4px;
    }
    table{width:100%;border-collapse:collapse;font-size:13px;}
    table td{padding:8px 4px;border-bottom:1px dashed #E8D5B0;color:#2D1A0E;}
    table td.amountValue{text-align:right;font-weight:600;font-family:'Prompt';white-space:nowrap;}
    table td.green{color:#1A6B3A;}
    table td.red{color:#C0392B;}
    .row-total{
      display:flex;justify-content:space-between;align-items:center;
      padding:8px 4px;font-weight:700;border-top:2px solid #C9973A;margin-top:4px;
    }
    .row-total .label{font-size:13px;color:#2D1A0E;}
    .row-total .amountValue{font-size:15px;}
    .netSalary-pay{
      margin-top:18px;background:linear-gradient(135deg,#5C1212,#7B1C1C);
      color:#E8C87A;padding:18px 22px;border-radius:10px;
      display:flex;justify-content:space-between;align-items:center;
    }
    .netSalary-pay .lbl{font-size:13px;color:#F5E6C8;font-weight:500;}
    .netSalary-pay .lbl-big{font-size:16px;color:#fff;font-weight:700;margin-top:2px;}
    .netSalary-pay .amountValue{font-size:28px;font-weight:800;color:#E8C87A;letter-spacing:-0.01em;}
    .signatures{
      margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:30px;
      padding:24px;
    }
    .sig-box{text-align:center;}
    .sig-line{
      border-top:1.5px dotted #7A5C3A;padding-top:6px;margin-top:50px;
      font-size:12px;color:#2D1A0E;font-weight:600;
    }
    .sig-name{font-size:11px;color:#7A5C3A;margin-top:2px;}
    .footer{
      padding:12px 24px;background:#FDF8F0;border-top:1px solid #E8D5B0;
      font-size:10px;color:#B89A72;text-align:center;
    }
    .warn{color:#C0392B;font-weight:600;}
    @media print{
      body{background:#fff;padding:0;}
      .slip{box-shadow:none;border:1.5px solid #C9973A;}
      .no-print{display:none !important;}
      @page{size:A5;margin:10mm;}
    }
    .print-btn{
      position:fixed;bottom:20px;right:20px;
      background:linear-gradient(135deg,#C9973A,#E8C87A);color:#5C1212;
      border:none;padding:12px 24px;border-radius:14px;font-size:15px;
      font-weight:700;cursor:pointer;font-family:inherit;
      box-shadow:0 6px 20px rgba(201,151,58,0.5);z-index:999;
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <div class="company">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      <div class="company-th">
        100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160<br/>
        เลขที่ผู้เสียภาษี <b style="letter-spacing:0.04em">0-7355-59006-56-8</b>
      </div>
    </div>
    <div class="gold-line"></div>

    <div class="title-row">
      <div class="title">💎 สลิปเงินเดือน</div>
      <div class="month">${monthLabel}</div>
    </div>

    <div class="body">
      <div class="info-grid">
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
      <div style="background:#FDECEA;border:1.5px solid #C0392B40;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#C0392B;font-weight:600;">
        ⚠ ไม่ได้รับเงินเดือนพื้นฐาน — ยอดขายต่ำกว่าเกณฑ์ขั้นต่ำ
      </div>`
          : ""
      }

      <div class="section-title">รายรับ</div>
      <table>
        ${earnRows
          .map(
            (r) => `
          <tr>
            <td>${r.label}</td>
            <td class="amountValue green">+ ฿${formatNumber(r.value)}</td>
          </tr>`,
          )
          .join("")}
      </table>
      <div class="row-total">
        <span class="label">รวมรายรับ</span>
        <span class="amountValue green" style="color:#1A6B3A">฿${formatNumber(salaryCalculation.earnings)}</span>
      </div>

      <div class="section-title">รายการหัก</div>
      ${
        dedRows.length > 0
          ? `
      <table>
        ${dedRows
          .map(
            (r) => `
          <tr>
            <td>${r.label}</td>
            <td class="amountValue red">− ฿${formatNumber(r.value)}</td>
          </tr>`,
          )
          .join("")}
      </table>
      <div class="row-total">
        <span class="label">รวมรายการหัก</span>
        <span class="amountValue red" style="color:#C0392B">฿${formatNumber(salaryCalculation.deductions)}</span>
      </div>`
          : `
      <div style="text-align:center;padding:14px;color:#7A5C3A;font-size:13px;">— ไม่มีรายการหัก —</div>`
      }

      <div class="netSalary-pay">
        <div>
          <div class="lbl">เงินสุทธิที่ได้รับ</div>
          <div class="lbl-big">Net Pay</div>
        </div>
        <div class="amountValue">฿${formatNumber(salaryCalculation.netSalary)}</div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">ลายเซ็นพนักงาน</div>
        <div class="sig-name">(${employeeName})</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">กรรมการผู้บริหาร</div>
        <div class="sig-name">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      </div>
    </div>

    <div class="footer">
      สลิปนี้สร้างโดยระบบอัตโนมัติ · พิมพ์เมื่อ ${printDate}
    </div>
  </div>

  ${
    includePrintControls
      ? `<button class="print-btn no-print" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>
  <script>
    // auto-trigger print dialog หลังโหลดเสร็จ
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
