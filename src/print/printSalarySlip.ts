import { TH_MONTHS } from "../constants";
import { buildSalarySlipDocDef } from "./pdfBuilders/salarySlipPDF";

/* ─── Print Salary Slip ──────────────────────────────────────────
   2 modes:
   • printSalarySlip()       → window.print() (เลือก Save as PDF เอง, bundle 0KB)
   • downloadSalarySlipPDF() → pdfmake (PDF text-searchable, lazy-loaded ~400KB) */

function buildSalarySlipHTML({ profile, empInfo, empRole, data, calc, poolShare, selMonth, monthApprovedAdvances }: any, opts: { includePrintControls?: boolean } = {}) {
  if(!data || !calc) return null;

  // includePrintControls=true → มี banner + auto-print script
  const includePrintControls = opts.includePrintControls !== false;

  const [y,mo] = selMonth.split("-");
  const monthLabel = `${TH_MONTHS[parseInt(mo)-1]} ${parseInt(y)+543}`;
  const printDate = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});
  const empName = profile?.name || empInfo?.name || "-";
  const empPosition = profile?.role || empInfo?.role || "-";
  const bank = empInfo?.bank || profile?.bank || "-";
  const bankAcc = empInfo?.bankAcc || profile?.bankAcc || "-";

  const num = (n) => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const NUM = (n) => Number(n||0).toLocaleString("th-TH");

  // ── สร้างรายการรายรับ ──
  const earnRows: { label: string; value: any }[] = [];
  earnRows.push({ label:"เงินเดือนพื้นฐาน", value:calc.baseSalary });
  if(calc.isSingle){
    if(calc.commSingle>0)
      earnRows.push({ label:`ค่าคอมตามจำนวนชิ้น (${calc.pcsSingle} ชิ้น × ฿${NUM(calc.rSingle)})`, value:calc.commSingle });
  } else {
    if(calc.commNormal>0)
      earnRows.push({ label:`ค่าคอมขาย-ทั่วไป (${calc.pcsN.toFixed(1)} ชิ้น × ฿${NUM(calc.rNormal)})`, value:calc.commNormal });
    if(calc.commSpecial>0)
      earnRows.push({ label:`ค่าคอมขาย-พิเศษ (${calc.pcsS} ชิ้น × ฿${NUM(calc.rSpecial)})`, value:calc.commSpecial });
    if(calc.commBuy>0)
      earnRows.push({ label:`ค่าคอมรับซื้อ (${calc.pcsB.toFixed(1)} ชิ้น × ฿${NUM(calc.rBuy)})`, value:calc.commBuy });
  }
  if(calc.commInvite>0)
    earnRows.push({ label:`โบนัสเชิญชวนสมัครบัตร (${calc.pcsI} ใบ × ฿${NUM(calc.rInvite)})`, value:calc.commInvite });
  if(calc.commTransfer>0)
    earnRows.push({ label:`โบนัสย้ายข้อมูลบัตร (${calc.pcsT} ใบ × ฿${NUM(calc.rTransfer)})`, value:calc.commTransfer });
  if(calc.attendBonus>0)
    earnRows.push({ label:`โบนัสแห่งความขยัน(ไม่หยุด) (${calc.bonusDays} วัน × ฿${NUM(Math.round(calc.dayRate))})`, value:calc.attendBonus });

  // ── รายการหัก ──
  const dedRows: { label: string; value: any }[] = [];
  if(data.lateDeduction>0)
    dedRows.push({ label:"หักขาดงาน/มาสาย", value:data.lateDeduction });
  if(calc.advanceDed>0){
    const detail = monthApprovedAdvances && monthApprovedAdvances.length>0
      ? ` (${monthApprovedAdvances.length} รายการ)` : "";
    dedRows.push({ label:`หักเงินเบิกล่วงหน้า${detail}`, value:calc.advanceDed });
  }
  if(data.socialSecurity>0)
    dedRows.push({ label:"หักประกันสังคม", value:data.socialSecurity });
  if(calc.overQ>0){
    let detail: string[] = [];
    if(calc.wd>0) detail.push(`วันธรรมดา ${calc.wd} × ฿${NUM(Math.round(calc.dayRate))}`);
    if(calc.sun>0) detail.push(`วันอาทิตย์ ${calc.sun} × ฿${NUM(Math.round(calc.dayRate))} × 1.5`);
    dedRows.push({ label:`หักลาเกินโควต้า (${detail.join(" + ")})`, value:calc.overQ });
  }

  const slipHTML = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <title>สลิปเงินเดือน — ${empName} ${monthLabel}</title>
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
    table td.amt{text-align:right;font-weight:600;font-family:'Prompt';white-space:nowrap;}
    table td.green{color:#1A6B3A;}
    table td.red{color:#C0392B;}
    .row-total{
      display:flex;justify-content:space-between;align-items:center;
      padding:8px 4px;font-weight:700;border-top:2px solid #C9973A;margin-top:4px;
    }
    .row-total .label{font-size:13px;color:#2D1A0E;}
    .row-total .amt{font-size:15px;}
    .net-pay{
      margin-top:18px;background:linear-gradient(135deg,#5C1212,#7B1C1C);
      color:#E8C87A;padding:18px 22px;border-radius:10px;
      display:flex;justify-content:space-between;align-items:center;
    }
    .net-pay .lbl{font-size:13px;color:#F5E6C8;font-weight:500;}
    .net-pay .lbl-big{font-size:16px;color:#fff;font-weight:700;margin-top:2px;}
    .net-pay .amt{font-size:28px;font-weight:800;color:#E8C87A;letter-spacing:-0.01em;}
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
    /* Banner: แนะนำผู้ใช้ให้เลือก Save as PDF */
    .save-pdf-banner{
      position:fixed;top:20px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#7B1C1C,#5C1212);color:#fff;
      padding:14px 18px;border-radius:14px;display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 28px rgba(91,18,18,0.4);z-index:1000;
      max-width:560px;width:calc(100% - 40px);font-family:'Prompt',sans-serif;
      animation:slideDown 0.4s cubic-bezier(.22,.68,0,1.1);
    }
    @keyframes slideDown{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}
    .banner-icon{font-size:24px;flex-shrink:0;}
    .banner-text{flex:1;line-height:1.4;}
    .banner-title{font-weight:700;font-size:14px;color:#E8C87A;}
    .banner-sub{font-size:12px;opacity:0.92;margin-top:2px;}
    .banner-sub b{color:#E8C87A;}
    .banner-close{
      background:rgba(255,255,255,0.15);border:none;color:#fff;
      width:28px;height:28px;border-radius:50%;cursor:pointer;
      font-size:14px;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    }
    .banner-close:hover{background:rgba(255,255,255,0.25);}
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
        <div><span class="label">ชื่อ-นามสกุล:</span> <span class="value">${empName}</span></div>
        <div><span class="label">ตำแหน่ง:</span> <span class="value">${empPosition}</span></div>
        <div><span class="label">ธนาคาร:</span> <span class="value">${bank}</span></div>
        <div><span class="label">เลขที่บัญชี:</span> <span class="value" style="letter-spacing:0.05em">${bankAcc}</span></div>
        <div><span class="label">วันที่ออกสลิป:</span> <span class="value">${printDate}</span></div>
        <div><span class="label">รอบเงินเดือน:</span> <span class="value">${monthLabel}</span></div>
      </div>

      ${calc.losesBaseSalary ? `
      <div style="background:#FDECEA;border:1.5px solid #C0392B40;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#C0392B;font-weight:600;">
        ⚠ ไม่ได้รับเงินเดือนพื้นฐาน — ยอดขายต่ำกว่าเกณฑ์ขั้นต่ำ
      </div>` : ""}

      <div class="section-title">รายรับ</div>
      <table>
        ${earnRows.map(r=>`
          <tr>
            <td>${r.label}</td>
            <td class="amt green">+ ฿${num(r.value)}</td>
          </tr>`).join("")}
      </table>
      <div class="row-total">
        <span class="label">รวมรายรับ</span>
        <span class="amt green" style="color:#1A6B3A">฿${num(calc.earnings)}</span>
      </div>

      <div class="section-title">รายการหัก</div>
      ${dedRows.length>0 ? `
      <table>
        ${dedRows.map(r=>`
          <tr>
            <td>${r.label}</td>
            <td class="amt red">− ฿${num(r.value)}</td>
          </tr>`).join("")}
      </table>
      <div class="row-total">
        <span class="label">รวมรายการหัก</span>
        <span class="amt red" style="color:#C0392B">฿${num(calc.deductions)}</span>
      </div>` : `
      <div style="text-align:center;padding:14px;color:#7A5C3A;font-size:13px;">— ไม่มีรายการหัก —</div>`}

      <div class="net-pay">
        <div>
          <div class="lbl">เงินสุทธิที่ได้รับ</div>
          <div class="lbl-big">Net Pay</div>
        </div>
        <div class="amt">฿${num(calc.net)}</div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">ลายเซ็นพนักงาน</div>
        <div class="sig-name">(${empName})</div>
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

  ${includePrintControls ? `<div class="save-pdf-banner no-print" id="banner">
    <div class="banner-icon">💡</div>
    <div class="banner-text">
      <div class="banner-title">บันทึกเป็น PDF ได้</div>
      <div class="banner-sub">ในกล่องพิมพ์ → เลือก <b>"Save as PDF"</b> ที่ Destination → กด Save</div>
    </div>
    <button class="banner-close" onclick="document.getElementById('banner').style.display='none'">✕</button>
  </div>
  <button class="print-btn no-print" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>
  <script>
    // auto-trigger print dialog หลังโหลดเสร็จ + รอ user อ่าน banner
    window.addEventListener('load',()=>setTimeout(()=>window.print(),800));
  </script>` : ''}
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
export function printSalarySlip(args){
  const html = buildSalarySlipHTML(args, { includePrintControls: true });
  if(!html) return;
  const w = window.open("","_blank","width=800,height=900");
  if(!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * 📥 ดาวน์โหลด PDF อัตโนมัติ ผ่าน pdfmake (lazy-loaded)
 * ✅ ดาวน์โหลดทันที · text searchable + select ได้ · ขนาดไฟล์เล็ก
 * ⚠️  โหลด pdfmake ครั้งแรก ~400KB
 */
export async function downloadSalarySlipPDF(args){
  if(!args?.data || !args?.calc) throw new Error("ไม่มีข้อมูลเงินเดือนเดือนนี้");

  // Lazy-load pdfmake + Thai fonts (ทำครั้งแรกครั้งเดียว)
  const [{ default: pdfMake }, { ensureThaiFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("../utils/pdfFonts"),
  ]);
  await ensureThaiFonts(pdfMake);

  const docDef = buildSalarySlipDocDef(args);
  const empName = args.profile?.name || args.empInfo?.name || "employee";
  const safe = (s) => String(s||"").replace(/[\/\\?%*:|"<>]/g, "").replace(/\s+/g, "-").trim();
  const filename = `สลิปเงินเดือน-${safe(empName)}-${args.selMonth}.pdf`;

  pdfMake.createPdf(docDef).download(filename);
}

/** Default export — backward compat */
export default printSalarySlip;

