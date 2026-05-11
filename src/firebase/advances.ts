/* ─── Advance Requests CRUD ────────────────────────────────── */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  yearMonth,
  onChange,
  onError,
) {
  return onSnapshot(
    query(
      ref,
      where("status", "==", status),
      where("month", "==", yearMonth),
      orderBy("submittedAt", "desc"),
    ),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

/* ─── Subscribe approved advances for a payroll month ───────── */
export function subscribeApprovedAdvancesByMonth(yearMonth, onChange, onError) {
  return subscribeAdvancesByStatusAndMonth(
    "approved",
    yearMonth,
    onChange,
    onError,
  );
}

/* ─── Subscribe advances for specific employee ───────────────── */
export function subscribeAdvancesByEmployeeId(employeeId, onChange, onError) {
  return onSnapshot(
    query(
      ref,
      where("employeeId", "==", employeeId),
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
export async function approveAdvance(id, slipImageUrl = null) {
  const advanceRef = doc(ref, id);
  const existing = await getDoc(advanceRef);
  const wasApproved = existing.data()?.status === "approved";
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    status: "approved",
    approvedAt: now,
  };
  if (slipImageUrl) fields.slipImageUrl = slipImageUrl;
  if (!wasApproved) {
    fields.lineNotificationStatus = "pending";
    fields.lineNotificationType = "approved";
    fields.lineNotificationRequestedAt = now;
    fields.lineNotificationLastError = null;
    fields.lineNotificationSkippedReason = null;
  }
  await updateDoc(advanceRef, fields);
}

/* ─── Reject advance ───────────────────────────────────────── */
export async function rejectAdvance(id, reason = "") {
  const now = new Date().toISOString();
  await updateDoc(doc(ref, id), {
    status: "rejected",
    rejectedAt: now,
    rejectionReason: reason,
    lineNotificationStatus: "pending",
    lineNotificationType: "rejected",
    lineNotificationRequestedAt: now,
    lineNotificationLastError: null,
    lineNotificationSkippedReason: null,
  });
}

/* ─── Delete advance ───────────────────────────────────────── */
export async function deleteAdvance(id) {
  await deleteDoc(doc(ref, id));
}
