/* ─── Firebase Configuration ────────────────────────────────────
   อ่าน config จาก JSON file
   - dev: ใช้ mock Firebase project สำหรับ emulator
   - prod: ใช้ Firebase project จริง

   วิธีใช้:
   1. แก้ค่าที่ src/firebase/firebaseConfig.json
   2. รัน npm run dev                                              */

import { type FirebaseOptions, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import firebaseConfigs from "./firebaseConfig.json";

type FirebaseRuntimeConfig = {
  firebaseConfig: FirebaseOptions;
  firestoreDatabaseId: string;
};

const firebaseRuntimeConfig: FirebaseRuntimeConfig = import.meta.env.PROD
  ? firebaseConfigs.production
  : firebaseConfigs.development;

export const firebaseConfig = firebaseRuntimeConfig.firebaseConfig;
export const FIRESTORE_DATABASE_ID = firebaseRuntimeConfig.firestoreDatabaseId;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId || "";

// Validate config — warn user ถ้าลืมตั้งค่าใน JSON
const requiredFirebaseKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;
const missingKeys = requiredFirebaseKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.warn(
    "[Firebase] Missing config keys:",
    missingKeys,
    "\nตรวจสอบ src/firebase/firebaseConfig.json",
  );
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
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
  EMPLOYEES: "employees",
  LEAVES: "leaves",
  SALARIES: "salaries", // /salaries/{employeeId}/months/{yearMonth}
  ADVANCES: "advances",
  ROLES: "roles",
  PAYROLL_CONFIRMS: "payrollConfirms",
};
