/* ─── Admin Operations (calls backend) ───────────────────────
   Custom Claims (admin role) ตั้งได้เฉพาะจาก Firebase Admin SDK
   ดังนั้นต้องผ่าน backend                                       */

import { auth } from "./config";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/**
 * Promote user เป็น admin
 * @param {string} uid - Firebase UID
 */
export async function setAdminRole(uid, isAdmin = true){
  const currentUser = auth.currentUser;
  if(!currentUser){
    throw new Error("ต้อง login ก่อน");
  }

  // ส่ง ID token ของผู้เรียก → backend verify ว่าเป็น admin จริง
  const idToken = await currentUser.getIdToken();

  const res = await fetch(`${BACKEND_URL}/api/set-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ uid, isAdmin }),
  });

  if(!res.ok){
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || "ตั้งสิทธิ์ admin ไม่สำเร็จ");
  }

  return res.json();
}

/**
 * Force refresh current user's token to get latest claims
 * เรียกหลังจาก setAdminRole() เพื่อให้ frontend เห็นการเปลี่ยนแปลงทันที
 */
export async function refreshIdToken(){
  const user = auth.currentUser;
  if(!user) return;
  await user.getIdToken(true); // force refresh
}
