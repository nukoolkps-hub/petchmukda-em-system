/* ─── useAppData — Single source of truth for app data ──────
   Hook นี้ swap implementation ระหว่าง:
   - In-memory (default, demo mode)
   - Firebase (เปิดด้วย VITE_USE_FIREBASE=true)

   Interface เหมือนกันทั้งคู่ → App.jsx ไม่รู้ว่ากำลังใช้แบบไหน    */

import useFirebaseAppData from "./useFirebaseAppData";
import useInMemoryAppData from "./useInMemoryAppData";

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === "true";

// Pick implementation at module scope (build-time constant) to satisfy Rules of Hooks
const useAppDataImpl = USE_FIREBASE ? useFirebaseAppData : useInMemoryAppData;

export default function useAppData() {
  return useAppDataImpl();
}

export { USE_FIREBASE };
