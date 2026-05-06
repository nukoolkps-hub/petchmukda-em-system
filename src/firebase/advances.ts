/* ─── Advance Requests CRUD ────────────────────────────────── */
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

const ref = collection(db, COLLECTIONS.ADVANCES);

/* ─── Real-time subscribe ──────────────────────────────────── */
export function subscribeAdvances(onChange, onError) {
  return onSnapshot(
    query(ref, orderBy("submittedAt", "desc")),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    (err) => {
      console.error("[Advances] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Subscribe pending advances (สำหรับ Admin) ────────────── */
export function subscribePendingAdvances(onChange, onError) {
  return onSnapshot(
    query(
      ref,
      where("status", "==", "pending"),
      orderBy("submittedAt", "desc"),
    ),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/* ─── Subscribe advances by status + payroll month ─────────── */
export function subscribeAdvancesByStatusAndMonth(
  status,
  ym,
  onChange,
  onError,
) {
  return onSnapshot(
    query(
      ref,
      where("status", "==", status),
      where("month", "==", ym),
      orderBy("submittedAt", "desc"),
    ),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/* ─── Subscribe approved advances for a payroll month ───────── */
export function subscribeApprovedAdvancesByMonth(ym, onChange, onError) {
  return subscribeAdvancesByStatusAndMonth("approved", ym, onChange, onError);
}

/* ─── Subscribe advances for specific employee ───────────────── */
export function subscribeAdvancesByEmployeeId(employeeId, onChange, onError) {
  return onSnapshot(
    query(
      ref,
      where("empId", "==", employeeId),
      orderBy("submittedAt", "desc"),
    ),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/* ─── Get all (one-time) ───────────────────────────────────── */
export async function getAllAdvances() {
  const snap = await getDocs(query(ref, orderBy("submittedAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── Submit new advance request ───────────────────────────── */
export async function submitAdvance(request) {
  const docRef = await addDoc(ref, {
    ...request,
    status: "pending",
    submittedAt: new Date().toISOString(),
  });
  return docRef.id;
}

/* ─── Approve advance ──────────────────────────────────────── */
export async function approveAdvance(id, slipUrl = null) {
  const fields: Record<string, unknown> = {
    status: "approved",
    approvedAt: new Date().toISOString(),
  };
  if (slipUrl) fields.slipUrl = slipUrl;
  await updateDoc(doc(ref, id), fields);
}

/* ─── Reject advance ───────────────────────────────────────── */
export async function rejectAdvance(id, reason = "") {
  await updateDoc(doc(ref, id), {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    rejectReason: reason,
  });
}

/* ─── Delete advance ───────────────────────────────────────── */
export async function deleteAdvance(id) {
  await deleteDoc(doc(ref, id));
}
