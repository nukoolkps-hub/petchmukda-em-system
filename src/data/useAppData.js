/* ─── useAppData — Single source of truth for app data ──────
   Hook นี้ swap implementation ระหว่าง:
   - In-memory (default, demo mode)
   - Firebase (เปิดด้วย VITE_USE_FIREBASE=true)

   Interface เหมือนกันทั้งคู่ → App.jsx ไม่รู้ว่ากำลังใช้แบบไหน    */

import useInMemoryAppData from "./useInMemoryAppData";
import useFirebaseAppData from "./useFirebaseAppData";

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === "true";

export default function useAppData(){
  // Note: ห้ามเรียก hook แบบ conditional — ต้องเลือก implementation ทั้งฟังก์ชัน
  if(USE_FIREBASE){
    return useFirebaseAppData();
  }
  return useInMemoryAppData();
}

export { USE_FIREBASE };
