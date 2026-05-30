/* ─── Helpers ที่ทำงานได้ทั้งใน LINE webview และเบราว์เซอร์ปกติ ────
   LINE in-app webview บล็อก:
   • window.open("_blank")  → ปุ่ม "พิมพ์" เดิมเปิดไม่ขึ้น
   • a[download] click      → ปุ่ม "PDF" เดิม save ไฟล์ไม่ได้
   วิธีหลีกเลี่ยง:
   • พิมพ์ → ใช้ iframe ซ่อน แล้วเรียก print() ใน iframe
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

/** พิมพ์ HTML ผ่าน iframe ซ่อน */
export function printHTMLInIframe(html: string) {
  document.getElementById("salary-print-iframe")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "salary-print-iframe";
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // HTML มี script auto-เรียก window.print() อยู่แล้วเมื่อโหลดเสร็จ
  // เก็บ iframe ไว้นานพอให้ print dialog ทำงานเสร็จ แล้วลบทิ้ง
  setTimeout(() => iframe.remove(), 60_000);
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
