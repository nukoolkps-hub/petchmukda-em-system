/* ─── Admin Operations (via Cloud Functions) ─────────────────
   Custom Claims (admin role) ตั้งได้เฉพาะจาก Firebase Admin SDK
   ดังนั้นต้องผ่าน Cloud Function                                  */

import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./config";

const setAdminFn = httpsCallable(functions, "setAdmin");

/**
 * Promote user เป็น admin
 * @param {string} uid - Firebase UID
 */
export async function setAdminRole(uid: string, isAdmin = true) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("ต้อง login ก่อน");
  }

  const result = await setAdminFn({ uid, isAdmin });
  return result.data;
}

/**
 * Force refresh current user's token to get latest claims
 * เรียกหลังจาก setAdminRole() เพื่อให้ frontend เห็นการเปลี่ยนแปลงทันที
 */
export async function refreshIdToken() {
  const user = auth.currentUser;
  if (!user) return;
  await user.getIdToken(true); // force refresh
}
