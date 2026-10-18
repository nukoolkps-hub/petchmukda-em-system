/* ─── BootLoadingScreen — loading screen เดียวกันทั้งระบบ ──────────
   ใช้ตอน Firebase auth check (AuthGate) + ตอน subscribe employees (App)
   - maroon bg + gold progress bar + percentage
   - asymptotic progress (ไม่มี progress จริง — fake ที่ค่อยขึ้น)
     · phase 1: 5% → ~95% เร็ว (รู้สึกมี progress)
     · phase 2: 95% → ~99% ช้าๆ (กัน "ค้างที่ 95%")
     · **คิดจากเวลาบนนาฬิกากลาง** (`utils/bootProgress.ts`) — จอ AuthGate →
       App ต่อกันได้ไม่เด้งกลับ 5% · bar วาดด้วย CSS animation (compositor)
       ไม่ใช่ setState ทุก 80ms → main thread ยุ่งตอน boot ก็ไม่กระตุก
   - หลัง 8s แสดงปุ่ม "ลองใหม่" ให้ user กดเอง
   - หลัง 10s auto-reload 1 ครั้งต่อ session (กัน Firebase handshake stuck)
   - reload ครั้งที่ 2 แล้วยังค้าง → แสดงคำแนะนำ + ปุ่ม "ล้าง cache + เข้าใหม่"
   - `autoReload={false}` (ระหว่างแลก code จาก LINE callback) → ไม่ auto-reload
     และเลื่อนปุ่ม "ลองใหม่" ออกไป — การแลก token ใช้เวลาได้หลายวินาที
     (cold start ของ Cloud Function) reload กลางทางจะทำให้ login ล้มทั้งรอบ */

import { useEffect, useRef, useState } from "react";
import {
  BOOT_ANIMATION_MS,
  bootKeyframesCss,
  bootProgressAt,
  claimBootClock,
  createBootClock,
  peekBootStart,
  releaseBootClock,
} from "../../utils/bootProgress";
import Diamond from "./Diamond";

interface Props {
  /** ข้อความใต้ diamond — เช่น "กำลังเข้าสู่ระบบ..." / "เชื่อมต่อ Firebase..." */
  message?: string;
  /** false = ปิด auto-reload 10s (ใช้ตอนกำลังแลก LINE code · default true) */
  autoReload?: boolean;
}

const RELOAD_KEY = "boot-auto-reloaded";

const BAR_ANIMATION = "boot-progress-fill";
const BAR_KEYFRAMES = bootKeyframesCss(BAR_ANIMATION);
/** นาฬิกากลาง — แชร์ทุก instance (ระดับ module) ให้จอที่ขึ้นต่อกันวิ่งต่อจากเดิม */
const bootClock = createBootClock();

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

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function BootLoadingScreen({
  message = "กำลังโหลด...",
  autoReload = true,
}: Props) {
  // เวลาที่ boot เริ่ม — จอก่อนหน้า (AuthGate) ยัง mount อยู่ตอน render นี้
  // จึงได้เวลาเริ่มของมัน → bar ต่อจากเดิม ไม่เด้งกลับ 5%
  const [startedAt] = useState(() =>
    peekBootStart(bootClock, performance.now()),
  );
  // ตรึงครั้งเดียวตอน mount — เปลี่ยน animation-delay ระหว่างทาง = bar กระโดด
  const [elapsedAtMount] = useState(() => performance.now() - startedAt);
  const [reduced] = useState(prefersReducedMotion);
  // เก็บเป็นจำนวนเต็ม — ค่าเท่าเดิม React ไม่ re-render (ช่วงคลาน 95→99
  // เลขเปลี่ยนนานๆ ครั้ง ไม่ต้อง render ทุก 200ms)
  const [percent, setPercent] = useState(() =>
    Math.round(bootProgressAt(elapsedAtMount)),
  );
  const [showRetry, setShowRetry] = useState(false);
  // ถ้า reload อัตโนมัติไปแล้ว → user กลับมาเจอหน้านี้อีกครั้ง = stuck จริง
  const alreadyReloaded =
    typeof window !== "undefined" && sessionStorage.getItem(RELOAD_KEY) === "1";
  // ref มาร์ค "เรา trigger reload เอง" — ใช้กัน cleanup ลบ flag ตอน
  // navigation race (StrictMode dev / browser timing)
  const reloadingRef = useRef(false);

  useEffect(() => {
    claimBootClock(bootClock, performance.now());
    return () => releaseBootClock(bootClock, performance.now());
  }, []);

  useEffect(() => {
    // ตัวเลข % อัปเดตจากเวลาจริง (ไม่สะสมทีละ tick) — timer ถูกเลื่อนก็ไม่
    // ทำให้เลขค้างแล้วกระโดด · bar ไม่ได้อาศัย interval นี้เลย (CSS วาดเอง)
    // ถ้า reduce motion → คงค่าไว้ (bar นิ่ง) แต่ยังโชว์เป็น hint ว่ากำลังโหลด
    if (reduced) return;
    const id = setInterval(() => {
      setPercent(Math.round(bootProgressAt(performance.now() - startedAt)));
    }, 200);
    return () => clearInterval(id);
  }, [reduced, startedAt]);

  useEffect(() => {
    // showRetry หลัง 8s — single setTimeout แทน 1s setInterval ที่ trigger
    // re-render ทุกวินาทีโดยเปล่าประโยชน์ · ระหว่าง LINE callback ให้รอนานกว่า
    // (การแลก token ช้าได้ถึง ~15s ตอน cold start · กดลองใหม่ = เริ่ม login ใหม่)
    const retryTimer = setTimeout(
      () => setShowRetry(true),
      autoReload ? 8000 : 20000,
    );
    // auto-reload หลัง 10 วินาที — 1 ครั้งต่อ session · ปิดระหว่าง LINE callback
    const reloadTimer = autoReload
      ? setTimeout(() => {
          if (sessionStorage.getItem(RELOAD_KEY)) return;
          sessionStorage.setItem(RELOAD_KEY, "1");
          // มาร์คก่อน reload — กัน cleanup ลบ flag ที่เพิ่ง set
          reloadingRef.current = true;
          window.location.reload();
        }, 10000)
      : null;
    return () => {
      clearTimeout(retryTimer);
      if (reloadTimer) clearTimeout(reloadTimer);
      // ล้าง flag เฉพาะตอน "โหลดสำเร็จ" (parent unmount เพราะ loading=false)
      // ไม่ใช่ตอนเรา trigger reload เอง (StrictMode dev จะ double-mount-unmount
      // ก่อน timer ทำงานด้วย — ถ้าลบทุก unmount จะกระทบเมื่อ flag ถูก set
      // ระหว่าง navigation race)
      if (!reloadingRef.current) {
        sessionStorage.removeItem(RELOAD_KEY);
      }
    };
  }, [autoReload]);

  return (
    // ── หน้า loading ใช้ "font ระบบ" (ไม่ใช่ Prompt) โดยตั้งใจ ──
    // Prompt เป็น web font ที่โหลดทีหลัง → ตอน boot จะเห็นตัวอักษรสลับ
    // (fallback → Prompt) ดูเพี้ยน · หน้านี้ขึ้นก่อน font โหลดเสมอ จึงบังคับ
    // ใช้ system font ที่มีอยู่แล้ว 100% → ตัวอักษรนิ่ง ไม่สลับไปมา
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-linear-160 from-maroon-dk via-maroon to-maroon-lt px-6"
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif",
      }}
    >
      <div className="w-16 h-16 rounded-full bg-linear-135 from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)]">
        <Diamond size={32} color="#5C1212" />
      </div>
      <div className="mt-4.5 text-sm font-semibold text-gold-lt">{message}</div>
      <style>{BAR_KEYFRAMES}</style>
      <div className="mt-3 w-[220px] h-2 rounded-full bg-white/10 overflow-hidden">
        {/* fill ด้วย CSS animation บน transform — browser วาดบน compositor
            thread ลื่นแม้ JS ยังทำงานหนักอยู่ · delay ติดลบ = เริ่มจากจุดที่
            จอก่อนหน้าวิ่งไปแล้ว */}
        <div
          className="h-full w-full origin-left rounded-full bg-linear-to-r from-gold to-gold-lt"
          style={{
            transform: `scaleX(${bootProgressAt(elapsedAtMount) / 100})`,
            ...(reduced
              ? null
              : {
                  animation: `${BAR_ANIMATION} ${BOOT_ANIMATION_MS}ms linear ${-Math.round(elapsedAtMount)}ms forwards`,
                  willChange: "transform",
                }),
          }}
        />
      </div>
      <div className="mt-1.5 text-xs font-bold text-gold-lt/80 tabular-nums">
        {percent}%
      </div>

      {/* ปุ่ม recovery — โผล่หลัง 8 วินาที หรือทันทีถ้า auto-reload ไปแล้ว */}
      {(showRetry || alreadyReloaded) && (
        <div className="mt-8 flex flex-col items-center gap-3 max-w-[280px]">
          <div className="text-xs text-gold-lt/80 text-center leading-relaxed">
            {alreadyReloaded
              ? "ดูเหมือนจะยังค้างอยู่ — ลองล้าง cache แล้วเข้าใหม่"
              : "โหลดนานกว่าปกติ — ลองรีเฟรชดูครับ"}
          </div>
          <button
            type="button"
            onClick={
              alreadyReloaded ? hardReload : () => window.location.reload()
            }
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
