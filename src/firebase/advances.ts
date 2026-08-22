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
import {
  activeAdvancesOfMonth,
  advanceLimitPercent,
  advanceQuotaOfMonth,
} from "../utils/advanceUtils";
import { getEffectiveBaseSalary } from "../utils/salaryUtils";
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

/* ─── Submit new advance request ─────────────────────────────
   บังคับโควต้า "N ครั้ง/เดือน" ตรงจุดที่เขียนจริง — เช็คจาก "ข้อมูลสด" บน
   server (ไม่ใช่ snapshot ใน memory ที่อาจยังโหลดไม่เสร็จ/ค้างของเก่า
   → ปุ่มในฟอร์มเปิด แล้วยื่นเกินโควต้าหลุด · เคยเกิดจริง) · fail closed
   ถ้าอ่านไม่ได้ — ปล่อยผ่านแปลว่ายอมให้เบิกเกินสิทธิ์ ซึ่งเป็นเงินจริง       */
export async function submitAdvance(request) {
  let existing: Record<string, any>[];
  try {
    existing = await getAdvancesByEmployeeAndMonth(
      request.employeeId,
      request.month,
    );
  } catch (e) {
    console.error("[submitAdvance] ตรวจสอบคำขอเดิมไม่สำเร็จ:", e);
    throw new Error(
      "ตรวจสอบคำขอเดิมของเดือนนี้ไม่สำเร็จ — ลองใหม่อีกครั้ง (เช็คสัญญาณเน็ต)",
    );
  }
  const quota = advanceQuotaOfMonth(existing, request.month);
  if (quota.reachedLimit) {
    throw new Error(
      `เบิกได้เดือนละ ${quota.limit} ครั้ง — เดือนนี้ยื่นครบแล้ว (${quota.used}/${quota.limit})`,
    );
  }
  // ด่านที่ 2 — ยอดรวมทั้งเดือนห้ามเกินเพดาน % ตามอายุงาน · อ่าน employee doc
  // สดเช่นกัน (ฟอร์มคำนวณจาก state ที่อาจค้าง) · เพดาน 0 = คำนวณไม่ได้
  // (ยังไม่ตั้ง baseSalary / อ่านไม่เจอ) → ปล่อยผ่าน ไม่ให้บล็อกคนที่ควรเบิกได้
  const maxPerMonth = await advanceCeilingOf(request.employeeId);
  if (maxPerMonth > 0) {
    const used = activeAdvancesOfMonth(existing, request.month).reduce(
      (sum, a) => sum + (Number(a.amount) || 0),
      0,
    );
    const remaining = Math.max(0, maxPerMonth - used);
    if ((Number(request.amount) || 0) > remaining) {
      throw new Error(
        `เกินวงเงินคงเหลือของเดือนนี้ — เบิกได้อีก ${remaining.toLocaleString("th-TH")} ฿`,
      );
    }
  }
  const docRef = await addDoc(ref, {
    ...request,
    status: "pending",
    submittedAt: new Date().toISOString(),
  });
  return docRef.id;
}

/** เพดานเบิกต่อเดือนของพนักงาน (บาท) จาก employee doc สด —
 *  effective base salary (รวมขึ้นเงินเดือนสะสม) × % ตามอายุงาน ·
 *  คืน 0 เมื่ออ่านไม่ได้/ยังไม่ตั้งเงินเดือน = "ไม่รู้เพดาน" → caller ข้ามด่านนี้
 *  (ฟอร์มยังคุมอยู่ · ไม่บล็อกคนที่ควรเบิกได้เพราะ config ไม่ครบ)          */
async function advanceCeilingOf(employeeId: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId));
    const emp = snap.data();
    if (!emp) return 0;
    const base = getEffectiveBaseSalary({
      baseSalary: emp.baseSalary ?? 0,
      startWorkMonth: emp.startWorkMonth ?? null,
      annualRaiseAmount: emp.annualRaiseAmount ?? 0,
      annualRaises: emp.annualRaises ?? {},
    });
    if (!base) return 0;
    return Math.floor(base * advanceLimitPercent(emp.startWorkMonth));
  } catch (e) {
    console.warn("[submitAdvance] อ่านเพดานวงเงินไม่สำเร็จ — ข้ามด่านยอดรวม:", e);
    return 0;
  }
}

/* ─── Get advances ของพนักงานคนหนึ่งในเดือนหนึ่ง (one-time · อ่านสด) ────
   ใช้ตอน "เขียนจริง" เพื่อบังคับโควต้าครั้ง/เดือน — ห้ามอิง snapshot ใน
   memory เพราะอาจยังโหลดไม่เสร็จ/ค้างของเก่า แล้วยื่นซ้ำหลุด
   equality filter ล้วน (ไม่มี orderBy) → ไม่ต้องมี composite index          */
export async function getAdvancesByEmployeeAndMonth(
  employeeId,
  yearMonth,
): Promise<Record<string, any>[]> {
  const snap = await getDocs(
    query(
      ref,
      where("employeeId", "==", employeeId),
      where("month", "==", yearMonth),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
