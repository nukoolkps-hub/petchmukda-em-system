/* ─── Helpers ที่ทำงานได้ทั้งใน LINE webview และเบราว์เซอร์ปกติ ────
   LINE in-app webview บล็อก:
   • window.open("_blank")  → ปุ่ม "พิมพ์" เดิมเปิดไม่ขึ้น
   • a[download] click      → ปุ่ม "PDF" เดิม save ไฟล์ไม่ได้
   วิธีหลีกเลี่ยง:
   • พิมพ์ → ใช้ iframe ซ่อน แล้วเรียก print() ใน iframe (LINE webview)
            หรือ window.open() ใหม่ tab → print ที่นั่น (browser ปกติ)
   • PDF  → ถ้าอยู่ใน LINE → navigate ไป blob URL (เปิดดูใน PDF viewer)
            ถ้าเบราว์เซอร์ปกติ → ใช้ a[download] save ไฟล์เหมือนเดิม      */

export function isLineWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Line\//i.test(navigator.userAgent);
}

/** เปิดแอปนี้ซ้ำในเบราว์เซอร์จริง (Chrome/Safari) ออกจาก LINE in-app
   ใช้พารามิเตอร์ openExternalBrowser=1 ที่ LINE รองรับ — PDF/พิมพ์
   ทำงานได้ปกติในเบราว์เซอร์จริง */
export function openInExternalBrowser() {
  const { origin, pathname, hash } = window.location;
  window.location.href = `${origin}${pathname}?openExternalBrowser=1${hash}`;
}

/** พิมพ์ HTML ผ่าน iframe ซ่อน + เรียก print จาก parent
    เหตุผล: iOS Safari ถ้า script ใน iframe เรียก window.print() บางครั้ง
    print top window แทน iframe → ออกมาเป็นหน้า SalaryView ทั้งหน้า ไม่ใช่
    สลิป · เรียก iframe.contentWindow.print() จาก parent แก้ได้ */
export function printHTMLInIframe(html: string) {
  document.getElementById("salary-print-iframe")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "salary-print-iframe";
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("[printHTMLInIframe] print failed:", err);
      }
    }, 500);
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // เก็บ iframe ไว้นานพอให้ print dialog ทำงานเสร็จ แล้วลบทิ้ง
  setTimeout(() => iframe.remove(), 60_000);
}

/** พิมพ์ HTML ผ่าน window.open() ใหม่ tab — เสถียรกว่า iframe บน mobile
    Safari · ใช้กับ browser ปกติ (ไม่ใช่ LINE webview)
    flow: ใหม่ tab → load HTML → auto print → user ปิด tab เอง */
export function printHTMLInNewWindow(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    // popup blocked — fallback ไปใช้ iframe (อาจมี issue บน iOS แต่ดีกว่าไม่พิมพ์)
    console.warn("[printHTMLInNewWindow] window.open blocked → fallback iframe");
    printHTMLInIframe(html);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // HTML inside มี auto-print script (window.print() onload) ทำให้ dialog
  // เด้งขึ้นใน tab ใหม่ที่ context ของ tab นั้นจริงๆ
}

/** พิมพ์ HTML — เลือก method ตาม environment อัตโนมัติ */
export function printHTML(html: string) {
  if (isLineWebview()) {
    printHTMLInIframe(html);
    return;
  }
  printHTMLInNewWindow(html);
}

/** เปิด PDF จาก URL (เช่นสลิป official ใน Storage) — รองรับ LINE webview */
export function openExternalPDF(url: string) {
  if (isLineWebview()) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener");
}

/** เปิด/ดาวน์โหลด PDF blob — รองรับทั้ง LINE webview และเบราว์เซอร์ปกติ */
export function openPDFBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  if (isLineWebview()) {
    // LINE webview บล็อก a[download] → navigate ไปดู PDF ในแท็บเดียวกัน
    // (อย่า revoke URL — page กำลังจะ navigate ไปแสดง blob นี้)
    window.location.href = url;
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
