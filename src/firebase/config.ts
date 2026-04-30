/* ─── Firebase Configuration ────────────────────────────────────
   อ่าน config จาก environment variables (.env file)
   - dev: ใช้ค่าจาก .env.local ที่ไม่ commit ลง git
   - prod: ตั้งบน hosting environment (Vercel, Netlify, ฯลฯ)

   วิธีใช้:
   1. คัดลอก .env.example → .env.local
   2. ใส่ค่า Firebase config (จาก Firebase Console > Project Settings)
   3. รัน npm run dev                                              */

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate config — warn user ถ้าลืมตั้งค่า
const missingKeys = Object.entries(firebaseConfig).filter(([_,v])=>!v).map(([k])=>k);
if(missingKeys.length > 0){
  console.warn(
    "[Firebase] Missing config keys:", missingKeys,
    "\nสร้าง .env.local จาก .env.example แล้วใส่ค่า Firebase Config"
  );
}

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

/* ─── Emulator connections (dev only) ──────────────────────────
   เปิดอัตโนมัติตอน `npm run dev`
   ปิดได้ด้วย VITE_USE_EMULATORS=false ใน .env.local
   เปิดตอน production ได้ด้วย VITE_USE_EMULATORS=true (ไม่แนะนำ) */
const useEmulators =
  import.meta.env.VITE_USE_EMULATORS === "true" ||
  (import.meta.env.VITE_USE_EMULATORS !== "false" && import.meta.env.DEV);

if (useEmulators) {
  console.log("🔧 Firebase Emulators: connecting to local emulators…");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "localhost", 5001);
  connectStorageEmulator(storage, "localhost", 9199);
}

/* ─── Collection paths (ใช้ที่นี่ที่เดียว) ────────────────────── */
export const COLLECTIONS = {
  EMPLOYEES:        "employees",
  LEAVES:           "leaves",
  SALARIES:         "salaries",      // /salaries/{empId}/months/{ym}
  ADVANCES:         "advances",
  ROLES:            "roles",
  PAYROLL_CONFIRMS: "payrollConfirms",
};
