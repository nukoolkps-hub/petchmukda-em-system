/* ─── BootLoadingScreen — loading screen เดียวกันทั้งระบบ ──────────
   ใช้ตอน Firebase auth check (AuthGate) + ตอน subscribe employees (App)
   - maroon bg + gold progress bar + percentage
   - asymptotic progress (ไม่มี progress จริง — fake ที่ค่อยขึ้นใกล้ 95%)
   - ไม่มีปุ่ม reload (ตามที่ user ขอ) — boot ที่ stuck จริงจะ retry
     ผ่าน Firestore retry/auto-reconnect + auto-retry hooks เอง          */

import { useEffect, useState } from "react";
import Diamond from "./Diamond";

interface Props {
  /** ข้อความใต้ diamond — เช่น "กำลังเข้าสู่ระบบ..." / "เชื่อมต่อ Firebase..." */
  message?: string;
}

export default function BootLoadingScreen({
  message = "กำลังโหลด...",
}: Props) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => Math.min(95, p + (95 - p) * 0.06));
    }, 80);
    // หลัง 10 วินาที ถ้ายังโหลดไม่เสร็จ (component ยัง mount) → auto-reload
    // กัน user ค้างหน้านี้นานเกินไป (Firebase/Firestore handshake stuck)
    // ใช้ sessionStorage กัน loop — ถ้า reload แล้วยัง stuck รอเอง
    const RELOAD_KEY = "boot-auto-reloaded";
    const reloadTimer = setTimeout(() => {
      if (sessionStorage.getItem(RELOAD_KEY)) return; // เคย reload แล้วในรอบนี้
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }, 10000);
    return () => {
      clearInterval(id);
      clearTimeout(reloadTimer);
      // โหลดสำเร็จ (component unmount) → ล้าง flag เพื่อให้ครั้งหน้า auto-reload
      // ทำงานได้อีก
      sessionStorage.removeItem(RELOAD_KEY);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-linear-160 from-maroon-dk via-maroon to-maroon-lt font-sans">
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
    </div>
  );
}
