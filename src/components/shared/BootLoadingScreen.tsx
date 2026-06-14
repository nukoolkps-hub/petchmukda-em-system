/* ─── BootLoadingScreen — loading screen เดียวกันทั้งระบบ ──────────
   ใช้ตอน Firebase auth check (AuthGate) + ตอน subscribe employees (App)
   - maroon bg + gold progress bar + percentage
   - asymptotic progress (ไม่มี progress จริง — fake ที่ค่อยขึ้นใกล้ 95%)
   - หลัง 8s แสดงปุ่ม "ลองใหม่" ให้ user กดเอง
   - หลัง 10s auto-reload 1 ครั้งต่อ session (กัน Firebase handshake stuck)
   - reload ครั้งที่ 2 แล้วยังค้าง → แสดงคำแนะนำ + ปุ่ม "ล้าง cache + เข้าใหม่" */

import { useEffect, useState } from "react";
import Diamond from "./Diamond";

interface Props {
  /** ข้อความใต้ diamond — เช่น "กำลังเข้าสู่ระบบ..." / "เชื่อมต่อ Firebase..." */
  message?: string;
}

const RELOAD_KEY = "boot-auto-reloaded";

function hardReload() {
  // ล้าง Cache Storage + Service Worker → กัน cache เก่าค้าง
  // (ทำ best-effort · ถ้า fail ก็ reload ปกติต่อ)
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k);
      });
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
      });
    }
  } catch {
    // ignore
  }
  sessionStorage.removeItem(RELOAD_KEY);
  // bust URL cache ด้วย query param + force reload
  const url = new URL(window.location.href);
  url.searchParams.set("_t", String(Date.now()));
  window.location.replace(url.toString());
}

export default function BootLoadingScreen({ message = "กำลังโหลด..." }: Props) {
  const [progress, setProgress] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  // ถ้า reload อัตโนมัติไปแล้ว → user กลับมาเจอหน้านี้อีกครั้ง = stuck จริง
  const alreadyReloaded =
    typeof window !== "undefined" &&
    sessionStorage.getItem(RELOAD_KEY) === "1";

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => Math.min(95, p + (95 - p) * 0.06));
    }, 80);
    // นับวินาทีเพื่อตัดสินใจว่าจะโชว์ปุ่ม "ลองใหม่" ไหม (หลัง 8 วินาที)
    const tickId = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    // auto-reload หลัง 10 วินาที — 1 ครั้งต่อ session
    // เฉพาะรอบแรกเท่านั้น · รอบ 2 ปล่อยให้ user กดปุ่มเอง (กัน infinite reload)
    const reloadTimer = setTimeout(() => {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }, 10000);
    return () => {
      clearInterval(id);
      clearInterval(tickId);
      clearTimeout(reloadTimer);
      // โหลดสำเร็จ (component unmount) → ล้าง flag เพื่อให้ครั้งหน้า auto-reload
      // ทำงานได้อีก
      sessionStorage.removeItem(RELOAD_KEY);
    };
  }, []);

  // โชว์ปุ่ม "ลองใหม่" หลัง 8 วินาที (ก่อน auto-reload 2 วินาที)
  // หรือทันทีถ้า reload อัตโนมัติไปแล้ว 1 ครั้ง
  const showRetry = secondsElapsed >= 8 || alreadyReloaded;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-linear-160 from-maroon-dk via-maroon to-maroon-lt font-sans px-6">
      <div className="w-16 h-16 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)]">
        <Diamond size={32} color="#5C1212" />
      </div>
      <div className="mt-4.5 text-sm font-semibold text-gold-lt">{message}</div>
      <div className="mt-3 w-[220px] h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-gold to-gold-lt transition-[width] duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1.5 text-xs font-bold text-gold-lt/80 tabular-nums">
        {Math.round(progress)}%
      </div>

      {/* ปุ่ม recovery — โผล่หลัง 8 วินาที หรือทันทีถ้า auto-reload ไปแล้ว */}
      {showRetry && (
        <div className="mt-8 flex flex-col items-center gap-3 max-w-[280px]">
          <div className="text-xs text-gold-lt/80 text-center leading-relaxed">
            {alreadyReloaded
              ? "ดูเหมือนจะยังค้างอยู่ — ลองล้าง cache แล้วเข้าใหม่"
              : "โหลดนานกว่าปกติ — ลองรีเฟรชดูครับ"}
          </div>
          <button
            type="button"
            onClick={alreadyReloaded ? hardReload : () => window.location.reload()}
            className="px-4 py-2 rounded-[10px] bg-gold text-maroon-dk text-sm font-extrabold cursor-pointer active:scale-[0.96] transition-transform shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          >
            {alreadyReloaded ? "ล้าง cache + เข้าใหม่" : "ลองใหม่"}
          </button>
          {alreadyReloaded && (
            <div className="text-[10px] text-gold-lt/60 text-center leading-relaxed mt-1">
              ถ้ายังเข้าไม่ได้ ลองตรวจอินเทอร์เน็ต หรือเปิดในแอป LINE
            </div>
          )}
        </div>
      )}
    </div>
  );
}
