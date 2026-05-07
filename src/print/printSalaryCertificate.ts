import { buildCertificateDocDef } from "./pdfBuilders/salaryCertificatePDF";

/* ─── Print Salary Certificate (หนังสือรับรองเงินเดือน) ─────────
   2 modes:
   • printSalaryCertificate()       → window.print() (เลือก Save as PDF)
   • downloadSalaryCertificatePDF() → pdfmake (PDF text-searchable)    */

function buildCertificateHTML(
  { profile, employeeInfo, data, startDate }: any,
  opts: { includePrintControls?: boolean } = {},
) {
  const employeeName = profile?.name || employeeInfo?.name || "-";
  const employeeRole = profile?.role || employeeInfo?.role || "-";
  const baseSalary = data?.baseSalary || 0;

  // mode='pdf' → ไม่ต้องมีปุ่ม + auto-print
  const includePrintControls = opts.includePrintControls !== false;

  // ใช้คำนำหน้า "นางสาว / นาย" — default = นางสาว ถ้าไม่ระบุ
  const prefix = profile?.prefix || "นางสาว";

  const printDate = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startWork = startDate || "มีนาคม พ.ศ. 2566";

  const formatNumber = (n) => Number(n || 0).toLocaleString("th-TH");
  // แปลงตัวเลขเงินเป็นภาษาไทย (basic — รองรับ 0-9,999,999)
  const formatThaiBahtText = (n) => {
    const digits = [
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
    const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    if (!n || n <= 0) return "ศูนย์บาทถ้วน";
    let str = "";
    const s = String(Math.floor(n));
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(s[i], 10);
      const place = len - i - 1;
      if (d === 0) continue;
      // หลักหน่วย ตัวเลข = 1 → "เอ็ด" (ไม่ใช่หนึ่ง)
      if (place === 0 && d === 1 && len > 1) str += "เอ็ด";
      // หลักสิบ ตัวเลข = 1 → ไม่ต้องอ่าน "หนึ่ง"
      else if (place === 1 && d === 1) {
        /* ข้าม */
      }
      // หลักสิบ ตัวเลข = 2 → "ยี่"
      else if (place === 1 && d === 2) str += "ยี่";
      else str += digits[d];
      if (place > 0) str += places[place];
    }
    return `${str}บาทถ้วน`;
  };
  const baseInWords = formatThaiBahtText(baseSalary);

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <title>หนังสือรับรองเงินเดือน — ${employeeName}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Prompt','Sarabun',sans-serif;
      background:#FDF8F0;color:#2D1A0E;padding:20px 16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    .doc{
      max-width:760px;margin:0 auto;background:#fff;
      border:2px solid #C9973A;border-radius:14px;
      padding:0;overflow:hidden;
      box-shadow:0 4px 24px rgba(123,28,28,0.12);
      min-height:1000px;display:flex;flex-direction:column;
    }
    .header{
      background:linear-gradient(135deg,#5C1212 0%,#7B1C1C 60%,#9B3030 100%);
      color:#E8C87A;padding:22px 32px;position:relative;
      text-align:center;
    }
    .company{
      font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:0.01em;
    }
    .addr{font-size:13px;color:#E8C87A;line-height:1.7;font-weight:500;}
    .gold-line{
      height:3px;background:linear-gradient(90deg,#C9973A,#E8C87A 40%,#E8C87A 60%,#C9973A);
    }
    .title-section{
      padding:30px 32px 18px;text-align:center;
      border-bottom:1px dashed #E8D5B0;
    }
    .title{
      font-size:26px;font-weight:800;color:#7B1C1C;letter-spacing:0.05em;
      margin-bottom:8px;
    }
    .title-deco{
      display:inline-flex;align-items:center;gap:14px;color:#C9973A;font-size:13px;margin-top:4px;
    }
    .title-deco::before, .title-deco::after{
      content:"";width:60px;height:1px;background:linear-gradient(to right,transparent,#C9973A);
    }
    .title-deco::after{background:linear-gradient(to left,transparent,#C9973A);}
    .body{
      padding:30px 48px 20px;font-size:16px;line-height:2.1;color:#2D1A0E;flex:1;
    }
    .body p{margin-bottom:12px;text-indent:60px;}
    .body p.no-indent{text-indent:0;}
    .body b{font-weight:700;color:#7B1C1C;}
    .date-line{
      margin-top:30px;text-align:right;font-size:15px;color:#2D1A0E;padding-right:80px;
    }
    .signatures{
      margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:30px;
      padding:0 48px 30px;
    }
    .sig-box{text-align:center;}
    .sig-line{
      border-top:1.5px dotted #7A5C3A;padding-top:8px;margin-top:80px;
      font-size:13px;color:#2D1A0E;font-weight:600;
    }
    .sig-name{font-size:11px;color:#7A5C3A;margin-top:3px;}
    .stamp{
      width:120px;height:120px;border:3px solid #C9973A;border-radius:50%;
      margin:14px auto 0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      color:#7B1C1C;opacity:0.5;font-size:11px;text-align:center;line-height:1.4;
    }
    .footer{
      padding:14px 32px;background:#FDF8F0;border-top:1px solid #E8D5B0;
      font-size:11px;color:#B89A72;text-align:center;
    }
    @media print{
      body{background:#fff;padding:0;}
      .doc{box-shadow:none;border:1.5px solid #C9973A;min-height:auto;}
      .no-print{display:none !important;}
      @page{size:A4;margin:14mm;}
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
  <div class="doc">
    <div class="header">
      <div class="company">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      <div class="addr">
        100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160<br/>
        เลขที่ผู้เสียภาษี <b style="letter-spacing:0.04em">0-7355-59006-56-8</b>
      </div>
    </div>
    <div class="gold-line"></div>

    <div class="title-section">
      <div class="title">หนังสือรับรองเงินเดือน</div>
      <div class="title-deco">CERTIFICATE OF SALARY</div>
    </div>

    <div class="body">
      <p>
        หนังสือฉบับนี้ออกให้เพื่อแสดงว่า <b>${prefix} ${employeeName}</b>
        ได้ปฏิบัติหน้าที่ ในตำแหน่ง<b>${employeeRole}</b>
        ของ <b>บริษัท ห้างเพชรทองมุกดา จำกัด</b>
        และปฏิบัติงานตั้งแต่ <b>${startWork}</b>
        มีอัตราเงินเดือน ประจำเดือนละ <b>${formatNumber(baseSalary)} บาท</b>
        (<b>${baseInWords}</b>)
        ซึ่งอัตรานี้ยังไม่รวมค่าตอบแทนและเงินพิเศษอื่น ๆ
      </p>

      <div class="date-line">ออกให้เมื่อวันที่ ${printDate}</div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">ลายเซ็นพนักงาน</div>
        <div class="sig-name">(${prefix} ${employeeName})</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">กรรมการผู้บริหาร</div>
        <div class="sig-name">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
        <div class="stamp">
          ตราประทับ<br/>บริษัท
        </div>
      </div>
    </div>

    <div class="footer">
      เอกสารนี้สร้างโดยระบบอัตโนมัติ · พิมพ์เมื่อ ${printDate}
    </div>
  </div>

  ${
    includePrintControls
      ? `<button class="print-btn no-print" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>
  <script>
    window.addEventListener('load',()=>setTimeout(()=>window.print(),800));
  </script>`
      : ""
  }
</body>
</html>`;

  return html;
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * 🖨 พิมพ์ / บันทึก PDF ผ่าน window.print()
 * ✅ Bundle 0KB · ทำงานเร็ว · text searchable ใน PDF (ถ้าผู้ใช้เลือก Save as PDF)
 */
export function printSalaryCertificate(args) {
  const html = buildCertificateHTML(args, { includePrintControls: true });
  if (!html) return;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * 📥 ดาวน์โหลด PDF อัตโนมัติ ผ่าน pdfmake (lazy-loaded)
 * ✅ ดาวน์โหลดทันที · text searchable + select ได้ · ขนาดไฟล์เล็ก
 */
export async function downloadSalaryCertificatePDF(args) {
  if (!args?.data) throw new Error("ไม่มีข้อมูลสำหรับสร้างหนังสือรับรอง");

  // Lazy-load pdfmake + Thai fonts
  const [{ default: pdfMake }, { ensureThaiFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("../utils/pdfFonts"),
  ]);
  await ensureThaiFonts(pdfMake);

  const docDef = buildCertificateDocDef(args);
  const employeeName =
    args.profile?.name || args.employeeInfo?.name || "employee";
  const today = new Date().toISOString().slice(0, 10);
  const safe = (s) =>
    String(s || "")
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  const filename = `หนังสือรับรองเงินเดือน-${safe(employeeName)}-${today}.pdf`;

  pdfMake.createPdf(docDef).download(filename);
}

/** Default export — backward compat */
export default printSalaryCertificate;
