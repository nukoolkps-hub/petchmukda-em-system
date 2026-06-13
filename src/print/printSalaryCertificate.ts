import { THAI_MONTH_NAMES } from "../constants";
import { buildCertificateDocDef } from "./pdfBuilders/salaryCertificatePDF";
import { openPDFBlob, printHTML } from "./webviewHelpers";

/* ─── Print Salary Certificate (หนังสือรับรองเงินเดือน) ─────────
   2 modes:
   • printSalaryCertificate()       → window.print() (เลือก Save as PDF)
   • downloadSalaryCertificatePDF() → pdfmake (PDF text-searchable)    */

function buildCertificateHTML(
  { profile, employeeInfo, data, startDate, purpose, refNo }: any,
  opts: { includePrintControls?: boolean } = {},
) {
  // ข้อมูล "ทางการ" ให้ใช้จาก employeeInfo (ที่ Admin ตั้งไว้) ก่อน profile (LINE)
  const employeeName = employeeInfo?.name || profile?.name || "-";
  const employeeRole = employeeInfo?.role || profile?.role || "-";
  // เงินเดือนพื้นฐาน — ดึงจากข้อมูลพนักงาน (admin ตั้งใน "ข้อมูลพนักงาน")
  const baseSalary = employeeInfo?.baseSalary || data?.baseSalary || 0;

  // mode='pdf' → ไม่ต้องมีปุ่ม + auto-print
  const includePrintControls = opts.includePrintControls !== false;

  // คำนำหน้าชื่อ — admin ตั้งใน "ข้อมูลพนักงาน" (default = นางสาว ถ้ายังไม่ตั้ง)
  const prefix = employeeInfo?.prefix || profile?.prefix || "นางสาว";

  const now = new Date();
  const printDate = now.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // เลขที่หนังสือ — caller ส่งมาเป็น "พทม. NNN/พ.ศ." (Firestore running counter)
  // fallback: ถ้าไม่มี (เช่น เน็ตล่ม) ใช้ date-time stamp กันใบไม่มีเลข
  const certRefNo =
    refNo ||
    `พทม. ${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}/${now.getFullYear() + 543}`;

  // เริ่มงาน + อายุงาน — คำนวณจาก employeeInfo.startWorkMonth ("YYYY-MM")
  const ym = employeeInfo?.startWorkMonth;
  let startWork = startDate || "มีนาคม พ.ศ. 2566";
  let yearsOfService = "";
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    const idx = m - 1;
    if (idx >= 0 && idx <= 11) {
      startWork = `${THAI_MONTH_NAMES[idx]} พ.ศ. ${y + 543}`;
      // diff in years + months
      let years = now.getFullYear() - y;
      let months = now.getMonth() - idx;
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      if (years <= 0 && months <= 0) yearsOfService = "เพิ่งเริ่มงาน";
      else if (years <= 0) yearsOfService = `${months} เดือน`;
      else if (months === 0) yearsOfService = `${years} ปี`;
      else yearsOfService = `${years} ปี ${months} เดือน`;
    }
  }

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
  const HTML_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] || c);

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=800, initial-scale=1"/>
  <title>หนังสือรับรองเงินเดือน — ${employeeName}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Sarabun',sans-serif;
      background:#ECECEC;color:#1A1A1A;padding:20px 16px;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
    .doc{
      max-width:760px;margin:0 auto;background:#fff;
      border:1px solid #333;padding:40px 56px 36px;
      display:flex;flex-direction:column;
    }
    .letterhead{text-align:center;padding-bottom:14px;
      border-bottom:3px double #7B1C1C;margin-bottom:8px;}
    /* ขนาดตัวอักษรอิงมาตรฐานหนังสือราชการ: เนื้อความ 16pt (Sarabun) */
    .company{font-size:20pt;font-weight:700;color:#7B1C1C;margin-bottom:6px;letter-spacing:0.01em;}
    .addr{font-size:12pt;color:#444;line-height:1.55;}
    .ref-no{font-size:16pt;color:#1A1A1A;font-weight:600;margin-top:18px;}
    .title{
      text-align:center;font-size:20pt;font-weight:700;color:#1A1A1A;
      letter-spacing:0.08em;margin:22px 0 4px;
    }
    .title-en{text-align:center;font-size:11pt;color:#777;letter-spacing:0.12em;
      margin-bottom:26px;text-transform:uppercase;}
    .body{font-size:16pt;line-height:1.9;color:#1A1A1A;flex:1;}
    .body p{margin-bottom:14px;text-indent:2.5em;text-align:justify;}
    .body b{font-weight:700;color:#1A1A1A;}
    .date-line{margin-top:34px;text-align:right;font-size:16pt;color:#1A1A1A;padding-right:60px;}
    .signatures{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:36px;}
    .sig-box{text-align:center;}
    .sig-line{border-top:1px solid #1A1A1A;padding-top:8px;margin-top:80px;
      font-size:16pt;color:#1A1A1A;font-weight:600;}
    .sig-name{font-size:13pt;color:#666;margin-top:3px;}
    .stamp{width:104px;height:104px;border:1.5px solid #999;border-radius:50%;
      margin:16px auto 0;display:flex;align-items:center;justify-content:center;
      color:#999;opacity:0.7;font-size:11pt;text-align:center;line-height:1.4;}
    .validity{margin-top:26px;padding-top:12px;border-top:1px solid #E0E0E0;
      font-size:11pt;color:#777;text-align:center;}
    @page{size:A4 portrait;margin:8mm;}
    @media print{
      body{background:#fff;padding:0;line-height:1.4;}
      /* doc flow ตามเนื้อหาจริง ไม่บังคับ min-height (เก่าใช้ 281mm = A4
         portrait → ถ้า user ตั้งกระดาษ A5 จะ overflow ไปหน้า 2 เปล่า) */
      .doc{border:1px solid #333 !important;
        max-width:194mm !important;margin:0 auto !important;
        page-break-inside:avoid;break-inside:avoid;}
      .no-print{display:none !important;}
      /* บีบช่องไฟให้ natural · ลายเซ็นวางตามเนื้อหา (ไม่ดันล่างแล้ว เพื่อ
         ไม่ overflow page อื่นเมื่อ user เลือกกระดาษเล็กกว่า A4) */
      .title{margin:14px 0 4px;}
      .title-en{margin-bottom:16px;}
      .body{line-height:1.7;}
      .date-line{margin-top:20px;}
      .signatures{margin-top:24px;}
      .sig-line{margin-top:58px;}
      .validity{margin-top:16px;}
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
  <div class="doc">
    <div class="letterhead">
      <div class="company">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
      <div class="addr">
        100/10 หมู่ที่ 8 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160<br/>
        โทร. 02-420-6075 · เลขประจำตัวผู้เสียภาษี 0-7355-59006-56-8
      </div>
    </div>

    <div class="ref-no">เลขที่ ${certRefNo}</div>
    <div class="title">หนังสือรับรองเงินเดือน</div>
    <div class="title-en">Certificate of Salary</div>

    <div class="body">
      <p>
        หนังสือฉบับนี้ออกให้เพื่อแสดงว่า <b>${prefix} ${employeeName}</b>
        ได้ปฏิบัติหน้าที่ในตำแหน่ง <b>${employeeRole}</b>
        ของ <b>บริษัท ห้างเพชรทองมุกดา จำกัด</b>
        โดยปฏิบัติงานตั้งแต่ <b>${startWork}</b>
        ${yearsOfService ? `รวมอายุงาน <b>${yearsOfService}</b>` : ""}
        มีอัตราเงินเดือนประจำเดือนละ <b>${formatNumber(baseSalary)} บาท</b>
        (<b>${baseInWords}</b>)
        ซึ่งอัตรานี้ยังไม่รวมค่าตอบแทนและเงินพิเศษอื่น ๆ
      </p>
      ${
        purpose
          ? `<p>หนังสือฉบับนี้ออกให้เพื่อใช้ประกอบการ <b>${escapeHTML(purpose)}</b></p>`
          : ""
      }

      <div class="date-line">ออกให้ ณ วันที่ ${printDate}</div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line">ลงชื่อพนักงาน</div>
        <div class="sig-name">(${prefix} ${employeeName})</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">ลงชื่อผู้มีอำนาจลงนาม</div>
        <div class="sig-name">บริษัท ห้างเพชรทองมุกดา จำกัด</div>
        <div class="stamp">ตราประทับบริษัท</div>
      </div>
    </div>

    <div class="validity">
      หนังสือฉบับนี้มีอายุ 30 วัน นับจากวันที่ออกเอกสาร
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
  printHTML(html);
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

  return new Promise<void>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        openPDFBlob(blob, filename);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

/** Default export — backward compat */
export default printSalaryCertificate;
