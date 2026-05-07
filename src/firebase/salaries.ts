/* ─── Salaries CRUD (nested structure) ─────────────────────────
   Path: /salaries/{employeeId}/months/{yearMonth}
   เช่น  /salaries/e1/months/2026-04                              */
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

function monthsRef(employeeId) {
  return collection(db, COLLECTIONS.SALARIES, employeeId, "months");
}

function monthRef(employeeId, yearMonth) {
  return doc(db, COLLECTIONS.SALARIES, employeeId, "months", yearMonth);
}

/* ─── Subscribe to all salaries (all employees, all months) ────
   ใช้ collectionGroup query — ดึง salaries/{employeeId}/months/{yearMonth} ทั้งหมด */
export function subscribeAllSalaries(onChange, onError) {
  return onSnapshot(
    collectionGroup(db, "months"),
    (snap) => {
      // แปลงเป็น { employeeId: { yearMonth: data } } ให้เข้ากับ format เดิม
      const result = {};
      snap.docs.forEach((d) => {
        // path = salaries/{employeeId}/months/{yearMonth}
        const parts = d.ref.path.split("/");
        const employeeId = parts[1];
        const yearMonth = parts[3];
        if (!result[employeeId]) result[employeeId] = {};
        result[employeeId][yearMonth] = d.data();
      });
      onChange(result);
    },
    (err) => {
      console.error("[Salaries] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Subscribe salaries for one employee ───────────────────── */
export function subscribeEmployeeSalaries(employeeId, onChange, onError) {
  return onSnapshot(
    monthsRef(employeeId),
    (snap) => {
      const result = {};
      snap.docs.forEach((d) => {
        result[d.id] = d.data();
      });
      onChange({ [employeeId]: result });
    },
    (err) => {
      console.error("[Salaries] employee subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Get salary for specific employee/month ───────────────── */
export async function getSalary(employeeId, yearMonth) {
  const snap = await getDoc(monthRef(employeeId, yearMonth));
  return snap.exists() ? snap.data() : null;
}

/* ─── Get all months for specific employee ─────────────────── */
export async function getEmployeeSalaries(employeeId) {
  const snap = await getDocs(monthsRef(employeeId));
  const result = {};
  snap.docs.forEach((d) => {
    result[d.id] = d.data();
  });
  return result;
}

/* ─── Set salary (create/replace) ──────────────────────────── */
export async function setSalary(employeeId, yearMonth, data) {
  await setDoc(monthRef(employeeId, yearMonth), {
    ...data,
    updatedAt: Date.now(),
  });
}

/* ─── Update salary (merge fields) ─────────────────────────── */
export async function updateSalary(employeeId, yearMonth, fields) {
  await setDoc(
    monthRef(employeeId, yearMonth),
    {
      ...fields,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

/* ─── Delete salary ────────────────────────────────────────── */
export async function deleteSalary(employeeId, yearMonth) {
  await deleteDoc(monthRef(employeeId, yearMonth));
}
