import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import LeaveApp from "./App";
import LoginScreen from "./components/auth/LoginScreen";
import Diamond from "./components/shared/Diamond";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

/* ─── Auto-reload เมื่อ chunk hash เก่าค้างใน cache ──────────
   หลัง deploy ใหม่ index.html เก่าจะอ้างไฟล์ chunk ที่หายไปแล้ว
   จับ vite:preloadError แล้ว reload ครั้งเดียวเพื่อโหลด HTML ใหม่
   (sessionStorage กัน loop ถ้า reload แล้วยัง error)              */
window.addEventListener("vite:preloadError", (event) => {
  const RELOAD_KEY = "vite-preload-reloaded";
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  event.preventDefault();
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
});
window.addEventListener("load", () => {
  // ถ้าโหลดสำเร็จ ล้าง flag เพื่อให้ครั้งหน้า reload ได้อีก
  sessionStorage.removeItem("vite-preload-reloaded");
});

/* ─── Loading Screen (Firebase auth initializing) ──────────
   Firebase auth check ไม่มี progress จริง — fake asymptotic progress
   ที่ค่อยขึ้น ใกล้ 95% ช้าลง พอ auth เสร็จ component unmount เลย    */
function AuthLoadingScreen() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => Math.min(95, p + (95 - p) * 0.06));
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-linear-160 from-maroon-dk via-maroon to-maroon-lt font-sans">
      <div className="w-16 h-16 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)]">
        <Diamond size={32} color="#5C1212" />
      </div>
      <div className="mt-4.5 text-sm font-semibold text-gold-lt">
        กำลังตรวจสอบสิทธิ์...
      </div>
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

/* ─── Auth Gate — show login or app based on auth state ──── */
function AuthGate() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <LoginScreen loading={false} error={error} />;
  }

  return <LeaveApp />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
