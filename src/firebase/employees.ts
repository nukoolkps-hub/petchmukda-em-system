/* ─── Employees CRUD ────────────────────────────────────────── */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.EMPLOYEES);

/* ─── เรียงตาม displayOrder (ที่ admin ลากย้าย) → ชื่อ (fallback) ─── */
function sortByDisplayOrder(list) {
  return list.sort((a, b) => {
    const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
    if (ao !== null && bo !== null) return ao - bo;
    if (ao !== null) return -1;
    if (bo !== null) return 1;
    return (a.name || "").localeCompare(b.name || "", "th");
  });
}

/* ─── Read All (real-time) ───────────────────────────────────
   ใช้ onSnapshot — อัพเดต UI ทันทีเมื่อข้อมูลเปลี่ยน             */
export function subscribeEmployees(onChange, onError) {
  return onSnapshot(
    query(ref, orderBy("name")),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(sortByDisplayOrder(list));
    },
    (err) => {
      console.error("[Employees] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Read linked employee for current auth uid ─────────────── */
export function subscribeEmployeeByLineUserId(lineUserId, onChange, onError) {
  return onSnapshot(
    query(ref, where("lineUserId", "==", lineUserId), limit(1)),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    (err) => {
      console.error("[Employees] linked employee subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Batch update displayOrder — ใช้ตอน admin ลาก reorder card ─── */
export async function reorderEmployees(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      updateDoc(doc(ref, id), {
        displayOrder: index,
        updatedAt: Date.now(),
      }),
    ),
  );
}

/* ─── Read by ID ─────────────────────────────────────────────── */
export async function getEmployee(id) {
  const snap = await getDoc(doc(ref, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ─── Create / Update ─────────────────────────────────────────
   id = firebase auto ID (สำหรับใหม่) หรือ existing employee.id           */
export async function upsertEmployee(id, data) {
  const cleanId = id || doc(ref).id; // gen ใหม่ถ้าไม่มี
  await setDoc(
    doc(ref, cleanId),
    {
      ...data,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
  return cleanId;
}

/* ─── Update (partial) ──────────────────────────────────────── */
export async function updateEmployee(id, fields) {
  await updateDoc(doc(ref, id), {
    ...fields,
    updatedAt: Date.now(),
  });
}

/* ─── Delete ─────────────────────────────────────────────────── */
export async function deleteEmployee(id) {
  await deleteDoc(doc(ref, id));
}
