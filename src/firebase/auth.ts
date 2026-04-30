/* ─── Authentication ────────────────────────────────────────────
   Firebase Auth — รองรับ:
   ✅ Google Sign-in (พร้อมใช้)
   ✅ LINE Login (ผ่าน Cloud Function)
   ✅ Email/Password (สำหรับ admin)                                */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const lineAuthFn = httpsCallable(functions, "lineAuth");

/* ─── Google Sign-in ────────────────────────────────────────── */
export async function signInWithGoogle(){
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user; // { uid, email, displayName, photoURL }
  } catch(err: unknown){
    const e = err as { code?: string };
    console.error("[Auth] Google sign-in failed:", err);
    throw new Error(e.code === "auth/popup-closed-by-user"
      ? "ยกเลิกการลงชื่อเข้าใช้"
      : "ลงชื่อเข้าใช้ไม่สำเร็จ");
  }
}

/* ─── LINE Login (full flow) ─────────────────────────────────
   ขั้นที่ 1: redirect → LINE Login URL                          */
export function startLineLogin({ channelId, redirectUri, state }){
  if(!channelId || !redirectUri){
    throw new Error("Missing LINE channelId or redirectUri");
  }
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state || crypto.randomUUID());
  url.searchParams.set("scope", "profile openid");
  // เก็บ state ใน sessionStorage เพื่อ verify ตอน callback
  sessionStorage.setItem("line_login_state", url.searchParams.get("state") ?? "");
  window.location.href = url.toString();
}

/**
 * ขั้นที่ 2: หลัง LINE redirect กลับมา (frontend callback page)
 * ส่ง code → Cloud Function → ได้ Firebase Custom Token → sign in
 *
 * @returns {Promise<User>}
 */
export async function completeLineLogin(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if(error){
    throw new Error(`LINE Login error: ${error}`);
  }
  if(!code){
    throw new Error("ไม่พบ authorization code จาก LINE");
  }

  // Verify state (ป้องกัน CSRF)
  const savedState = sessionStorage.getItem("line_login_state");
  if(state !== savedState){
    throw new Error("State mismatch — อาจมีคนปลอมแปลง");
  }
  sessionStorage.removeItem("line_login_state");

  // ส่ง code → Cloud Function
  const redirectUri = window.location.origin + window.location.pathname;
  const result = await lineAuthFn({ code, redirectUri });
  const { customToken } = result.data as { customToken: string };

  // Sign in ด้วย custom token
  return signInWithLineToken(customToken);
}

/* ─── Original LINE custom token sign-in ─────────────────── */
export async function signInWithLineToken(customToken){
  try {
    const result = await signInWithCustomToken(auth, customToken);
    return result.user;
  } catch(err){
    console.error("[Auth] LINE sign-in failed:", err);
    throw new Error("LINE Login ไม่สำเร็จ — ลองใหม่อีกครั้ง");
  }
}

/* ─── Email/Password (Admin) ────────────────────────────────── */
export async function signInWithEmail(email, password){
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch(err: unknown){
    const e = err as { code?: string };
    console.error("[Auth] Email sign-in failed:", err);
    throw new Error(e.code === "auth/wrong-password" || e.code === "auth/user-not-found"
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      : "ลงชื่อเข้าใช้ไม่สำเร็จ");
  }
}

/* ─── Sign Out ──────────────────────────────────────────────── */
export async function signOut(){
  await fbSignOut(auth);
}

/* ─── Listen to auth state changes ──────────────────────────── */
export function onAuthChange(callback){
  return onAuthStateChanged(auth, callback);
}
