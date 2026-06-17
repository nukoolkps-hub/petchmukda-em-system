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
      // ป้ายค่าคอมต่อชิ้น (PR #460) — null = ไม่มีค่าคอม · ค่า = label ของ
      // singlePieceRate · pool sales (poolGroup ตั้ง) ก็ null เพราะใช้
      // normal/special/buy
      pieceLabel: role.pieceLabel ?? null,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function deleteRole(id) {
  await deleteDoc(doc(ref, id));
}
