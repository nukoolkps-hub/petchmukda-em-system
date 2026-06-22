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

/* ─── Get approved advances for a payroll month (one-time) ──────
   ใช้ใน data layer (auto-settle เดือน grace) ที่ admin subscription เป็น
   pending-only — จึงต้องอ่าน approved แบบ on-demand เพื่อหักเบิกให้ถูก       */
export async function getApprovedAdvancesByMonth(yearMonth) {
  const snap = await getDocs(
    query(
      ref,
      where("status", "==", "approved"),
      where("month", "==", yearMonth),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── Get auto-carry advance(s) ของพนักงาน 1 คนที่ยกมาจากเดือน X (one-time) ─
   auto-carry เป็น status="approved" จึงไม่อยู่ใน admin pending subscription ·
   ใช้หา doc เดิมเพื่อ update/delete แทนการ find จาก state (กันสร้างซ้ำ)        */
export async function getAutoCarryAdvances(employeeId, autoCarryFromMonth) {
  const snap = await getDocs(
    query(
      ref,
      where("employeeId", "==", employeeId),
      where("autoCarryFromMonth", "==", autoCarryFromMonth),
      where("status", "==", "approved"),
    ),
  );
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

/* ─── Create auto-carry advance (เงินสุทธิติดลบ → ยกไปเดือนถัดไป) ───
   ต่างจาก submitAdvance: status="approved" ตั้งแต่แรก · ไม่ต้องผ่าน admin
   approve · ใส่ `autoCarryFromMonth` marker เพื่อ filter ใน UI         */
export async function createAutoCarryAdvance(request) {
  const now = new Date().toISOString();
  const docRef = await addDoc(ref, {
    ...request,
    status: "approved",
    submittedAt: now,
    approvedAt: now,
  });
  return docRef.id;
}

/* ─── Update auto-carry advance amount (ถ้า admin re-confirm + net เปลี่ยน) ─ */
export async function updateAutoCarryAdvanceAmount(id, amount) {
  await updateDoc(doc(ref, id), { amount });
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
