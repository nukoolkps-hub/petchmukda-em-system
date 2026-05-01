/* ─── Leaves CRUD ───────────────────────────────────────────── */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.LEAVES);

/* ─── Real-time subscribe ──────────────────────────────────── */
export function subscribeLeaves(onChange, onError) {
  return onSnapshot(
    query(ref, orderBy("start", "desc")),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    (err) => {
      console.error("[Leaves] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Subscribe leaves for specific employee ───────────────── */
export function subscribeLeavesByEmpId(empId, onChange, onError) {
  return onSnapshot(
    query(ref, where("empId", "==", empId), orderBy("start", "desc")),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    onError,
  );
}

/* ─── Get all (one-time) ───────────────────────────────────── */
export async function getAllLeaves() {
  const snap = await getDocs(query(ref, orderBy("start", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── Add new leave ────────────────────────────────────────── */
export async function addLeave(leave) {
  const docRef = await addDoc(ref, {
    ...leave,
    submitted: leave.submitted || new Date().toLocaleString("th-TH"),
    createdAt: Date.now(),
  });
  return docRef.id;
}

/* ─── Update leave ─────────────────────────────────────────── */
export async function updateLeave(id, fields) {
  await updateDoc(doc(ref, id), {
    ...fields,
    updatedAt: Date.now(),
  });
}

/* ─── Delete leave ─────────────────────────────────────────── */
export async function deleteLeave(id) {
  await deleteDoc(doc(ref, id));
}
