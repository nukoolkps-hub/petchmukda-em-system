/* ─── Firestore transport (WebChannel vs long-polling) ─────────────
   ปกติ Firestore ในเบราว์เซอร์คุยผ่าน WebChannel (bidi long-poll ที่พึ่ง
   keep-alive) · **เบราว์เซอร์ในแอป LINE (LIFF WebView) บล็อก keep-alive
   ตัวนี้บ่อย** → connection ดู open แต่ข้อมูลไม่ไหลกลับมา · `onSnapshot`
   จึงไม่เรียก callback และไม่ยิง error เลย = แอปค้างหน้า "เชื่อมต่อ
   Firebase..." ตลอดกาล (ไม่ใช่ปัญหาสิทธิ์/ข้อมูล — ดู docs → troubleshooting)

   `experimentalAutoDetectLongPolling` ให้ SDK เดาเอง แต่ **เดาไม่ถูกทุกเคส**
   ในแอป LINE (เจอจริงบน production) · ที่นี่จึงบังคับ long-polling ไปเลย
   เมื่อรู้ว่าอยู่ใน LINE หรือเคยค้างมาก่อน — ช้ากว่านิดหน่อยแต่ไม่ค้าง       */

/** key ใน localStorage ที่จำว่าเครื่องนี้เคยเชื่อมต่อค้าง */
export const FIRESTORE_STALL_KEY = "firestore-stalled";

/** UA ของเบราว์เซอร์ในแอป LINE มี "Line/<version>" เสมอ
 *  (เทียบแบบมี "/" + เลขเวอร์ชัน กันชนคำว่า line ที่โผล่ใน UA อื่น) */
export function isLineWebView(userAgent: string): boolean {
  return /\bLine\/\d/i.test(userAgent);
}

/** ควรบังคับ long-polling ไหม — ใน LINE หรือเครื่องที่เคยค้างมาก่อน */
export function shouldForceLongPolling({
  userAgent,
  stalledBefore,
}: {
  userAgent: string;
  stalledBefore: boolean;
}): boolean {
  return stalledBefore || isLineWebView(userAgent);
}

/* localStorage อาจโยน (private mode / ปิด cookie) — ห้ามให้ล้มทั้งแอป */
export function hasFirestoreStalled(): boolean {
  try {
    return localStorage.getItem(FIRESTORE_STALL_KEY) === "1";
  } catch {
    return false;
  }
}

/** จำไว้ว่าเชื่อมต่อค้าง — โหลดครั้งหน้าจะข้าม auto-detect ไป long-polling เลย
 *  (ไม่ล้าง flag ทีหลัง: long-polling ใช้ได้เสมอ ปล่อยให้ค้างไว้ปลอดภัยกว่า) */
export function markFirestoreStalled(): void {
  try {
    localStorage.setItem(FIRESTORE_STALL_KEY, "1");
  } catch {
    // ไม่มีที่เก็บก็ไม่เป็นไร — รอบหน้าแค่ไม่ได้ประโยชน์จากการจำ
  }
}
