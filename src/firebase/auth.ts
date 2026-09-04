/* ─── Authentication ────────────────────────────────────────────
   Firebase Auth — LINE Login (ผ่าน Cloud Function) + Dev mode (emulator)
   · ระบบใช้ LINE Login ทางเดียว — Google/Email provider ถูกถอดออกแล้ว
     (ไม่มีที่เรียก · ลด bundle บน boot path)                        */

import {
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  checkReturnedState,
  saveLoginState,
  takeLoginState,
} from "../utils/loginState";
import { auth, functions } from "./config";

const lineAuthFn = httpsCallable(functions, "lineAuth");
const prepareLineLoginFn = httpsCallable(functions, "prepareLineLogin");
const devAuthFn = httpsCallable(functions, "devAuth");
const seedLineConfigFromEnvFn = httpsCallable(
  functions,
  "seedLineConfigFromEnv",
);

export type DevRole = "employee" | "admin" | "setup";

export type SeedLineConfigResult = {
  ok: boolean;
  skipped?: boolean;
  seededKeys: string[];
};

/* ─── LINE Login (full flow) ─────────────────────────────────
   ขั้นที่ 1: ขอ state จาก server → redirect → LINE Login URL
   - state ออกโดย Cloud Function prepareLineLogin · เก็บใน Firestore
     loginStates/{state} (single-use · TTL 10 นาที)
   - client เก็บ copy ใน localStorage เพื่อ defense-in-depth · ใช้
     localStorage ไม่ใช่ sessionStorage เพราะ flow มือถือเด้งข้าม tab/
     เบราว์เซอร์ได้ (เช่น พิมพ์ใบรับรองจาก LINE webview) แล้ว sessionStorage
     จะหาย → เทียบ state ไม่ผ่านทั้งที่ไม่มีใครปลอมแปลง (ดู utils/loginState.ts) */
export async function startLineLogin({ channelId, redirectUri }) {
  if (!channelId || !redirectUri) {
    throw new Error("Missing LINE channelId or redirectUri");
  }
  // 1. request state จาก server ก่อน — กัน CSRF ฝั่ง server
  const stateRes = await prepareLineLoginFn();
  const state = (stateRes.data as { state?: string })?.state;
  if (!state) {
    throw new Error("Failed to prepare LINE login state");
  }

  // 2. เก็บ copy ไว้เทียบตอนกลับมา (defense-in-depth · server ตัดสินจริง)
  saveLoginState(state);

  // 3. redirect ไป LINE authorize URL พร้อม state เดียวกัน
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "profile openid");
  window.location.href = url.toString();
}

/**
 * ขั้นที่ 2: หลัง LINE redirect กลับมา (frontend callback page)
 * ส่ง code → Cloud Function → ได้ Firebase Custom Token → sign in
 *
 * รับ code/state เป็น param (ไม่อ่านจาก URL เอง) — AuthContext ล้าง query
 * ออกจาก URL ก่อนเรียก เพื่อให้ reload ระหว่างแลก token ไม่ replay code เดิม
 *
 * @returns {Promise<User>}
 */
export async function completeLineLogin({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  if (!code) {
    throw new Error("ไม่พบ authorization code จาก LINE");
  }

  // Verify state ฝั่ง client (defense-in-depth · server validate ซ้ำใน lineAuth
  // ผ่าน Firestore transaction · single-use) · "ไม่เจอที่เก็บไว้" ไม่ใช่
  // ความผิดปกติ — บริบทหายได้จากการเด้งข้ามเบราว์เซอร์ ปล่อยให้ server ตัดสิน
  const check = checkReturnedState(state, takeLoginState());
  if (!check.ok) {
    throw new Error("State mismatch — อาจมีคนปลอมแปลง");
  }
  if (check.reason === "no-saved-state") {
    console.warn(
      "[auth] ไม่พบ state ที่เก็บไว้ (น่าจะเด้งข้ามเบราว์เซอร์/แท็บ) — ใช้การตรวจฝั่ง server อย่างเดียว",
    );
  }

  // ส่ง code + state → Cloud Function · server consume state ใน Firestore txn
  const redirectUri = window.location.origin + window.location.pathname;
  const result = await lineAuthFn({ code, redirectUri, state });
  const { customToken } = result.data as { customToken: string };

  // Sign in ด้วย custom token
  return signInWithLineToken(customToken);
}

/* ─── Original LINE custom token sign-in ─────────────────── */
export async function signInWithLineToken(customToken) {
  try {
    const result = await signInWithCustomToken(auth, customToken);
    return result.user;
  } catch (err) {
    console.error("[Auth] LINE sign-in failed:", err);
    throw new Error("LINE Login ไม่สำเร็จ — ลองใหม่อีกครั้ง");
  }
}

/* ─── Dev custom token sign-in (emulator only) ─────────────── */
export async function signInWithDevRole(role: DevRole) {
  try {
    const result = await devAuthFn({ role });
    const { customToken } = result.data as { customToken: string };
    const credential = await signInWithCustomToken(auth, customToken);
    return credential.user;
  } catch (err) {
    console.error("[Auth] Dev role sign-in failed:", err);
    throw new Error("Dev Login ไม่สำเร็จ — ตรวจสอบว่า Functions Emulator เปิดอยู่");
  }
}

/* ─── Dev env → Firestore config seed (emulator only) ────────── */
export async function seedLineConfigFromEnv() {
  const result = await seedLineConfigFromEnvFn();
  return result.data as SeedLineConfigResult;
}

/* ─── Sign Out ──────────────────────────────────────────────── */
export async function signOut() {
  await fbSignOut(auth);
}

/* ─── Listen to auth state changes ──────────────────────────── */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
