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
      icon: role.icon,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function deleteRole(id) {
  await deleteDoc(doc(ref, id));
}
