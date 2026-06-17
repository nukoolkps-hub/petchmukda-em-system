/* ─── Roles CRUD (ตำแหน่งงาน) ──────────────────────────────── */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.ROLES);

export function subscribeRoles(onChange, onError) {
  return onSnapshot(
    ref,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("[Roles] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function getAllRoles() {
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertRole(role) {
  await setDoc(
    doc(ref, role.id),
    {
      name: role.name,
      poolGroup: role.poolGroup,
      // ?? null กัน setDoc throw — Firestore reject undefined (ไม่ได้ตั้ง
      // ignoreUndefinedProperties) · ตำแหน่งสร้างใหม่ไม่มี icon
      icon: role.icon ?? null,
      mainDuties: role.mainDuties ?? null,
      // รายการค่าคอมต่อชิ้น (multi-item) — [] / null = ไม่มีค่าคอม
      // pool sales (poolGroup ตั้ง) ก็ null เพราะใช้ normal/special/buy
      // whitelist field {id, label} ป้องกัน transient state รั่ว (เช่น _dirty)
      pieceItems: Array.isArray(role.pieceItems)
        ? role.pieceItems
            .filter((it: any) => it?.id && typeof it.label === "string")
            .map((it: any) => ({ id: String(it.id), label: String(it.label) }))
        : null,
      // legacy pieceLabel — เขียน null เสมอเมื่อย้ายมา pieceItems แล้ว
      // (migrate-on-read ใน rolePieceItems ยังอ่าน pieceLabel ของ doc เก่าได้)
      pieceLabel: role.pieceLabel ?? null,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function deleteRole(id) {
  await deleteDoc(doc(ref, id));
}
