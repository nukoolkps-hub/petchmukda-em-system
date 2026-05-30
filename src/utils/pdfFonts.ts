/* ─── Thai Font Loader for pdfmake ─────────────────────────────
   pdfmake default มีแต่ Roboto (ไม่มี Thai)
   ต้องโหลด TTF + register VFS ก่อนใช้

   Strategy:
   - First load: fetch จาก same-origin (/fonts), cache ใน localStorage
   - Subsequent loads: ใช้จาก cache (instant)
   - Cache key: font_v2_${fontName}

   หมายเหตุ: host font เองใน public/fonts แทนการดึงจาก CDN ภายนอก
   เพราะ CSP connect-src อนุญาตเฉพาะ 'self' — fetch ไป cdn.jsdelivr.net
   จะโดนบล็อก ("Refused to connect ... Content Security Policy")    */

// pdfmake รองรับเฉพาะ TTF — host ไว้ที่ public/fonts (same-origin)
const FONT_URLS_TTF: Record<string, string> = {
  "Sarabun-Regular": `${import.meta.env.BASE_URL}fonts/Sarabun-Regular.ttf`,
  "Sarabun-Bold": `${import.meta.env.BASE_URL}fonts/Sarabun-Bold.ttf`,
};

const CACHE_VERSION = "v2";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // ทยอยแปลงเป็น chunks (ป้องกัน stack overflow ถ้าไฟล์ใหญ่)
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function fetchFontBase64(name: string, url: string): Promise<string> {
  const cacheKey = `font_${CACHE_VERSION}_${name}`;

  // ลองดึงจาก localStorage ก่อน
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (_e) {
    /* localStorage อาจถูก disable */
  }

  // โหลดจาก CDN
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${name} (${response.status})`);
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  // Cache (ถ้าทำได้)
  try {
    localStorage.setItem(cacheKey, base64);
  } catch (e: unknown) {
    // localStorage เต็ม / disabled — ไม่เป็นไร ใช้ครั้งนี้ได้แต่ครั้งหน้าโหลดใหม่
    console.warn("[Font] localStorage cache failed:", (e as Error).message);
  }

  return base64;
}

let fontsLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * โหลด Thai font + register กับ pdfmake instance
 * - Idempotent: เรียกซ้ำได้ไม่ทำให้โหลดซ้ำ
 * - ส่งคืน Promise ที่ resolve เมื่อพร้อมใช้
 */
export async function ensureThaiFonts(pdfMake: any): Promise<void> {
  if (fontsLoaded) return;

  if (!loadPromise) {
    loadPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fetchFontBase64("Sarabun-Regular", FONT_URLS_TTF["Sarabun-Regular"]),
        fetchFontBase64("Sarabun-Bold", FONT_URLS_TTF["Sarabun-Bold"]),
      ]);

      pdfMake.vfs = pdfMake.vfs || {};
      pdfMake.vfs["Sarabun-Regular.ttf"] = regular;
      pdfMake.vfs["Sarabun-Bold.ttf"] = bold;

      pdfMake.fonts = {
        Sarabun: {
          normal: "Sarabun-Regular.ttf",
          bold: "Sarabun-Bold.ttf",
          italics: "Sarabun-Regular.ttf",
          bolditalics: "Sarabun-Bold.ttf",
        },
      };

      fontsLoaded = true;
    })().catch((err) => {
      // ถ้าโหลดล้มเหลว ต้องล้าง loadPromise ไม่งั้น call ครั้งถัดไป
      // จะได้ promise ที่ reject ค้างเดิม → พังตลอด session
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
}

/** เคลียร์ cache (ถ้า font version เปลี่ยน หรือ debug) */
export function clearFontCache(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("font_"))
      .forEach((k) => {
        localStorage.removeItem(k);
      });
    fontsLoaded = false;
    loadPromise = null;
  } catch (_e) {}
}
