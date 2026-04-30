/* ─── Salaries CRUD (nested structure) ─────────────────────────
   Path: /salaries/{empId}/months/{ym}
   เช่น  /salaries/e1/months/2026-04                              */
import {
  collection, collectionGroup, doc, getDocs, getDoc, setDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "./config";

function monthsRef(empId){
  return collection(db, COLLECTIONS.SALARIES, empId, "months");
}

function monthRef(empId, ym){
  return doc(db, COLLECTIONS.SALARIES, empId, "months", ym);
}

/* ─── Subscribe to all salaries (all employees, all months) ────
   ใช้ collectionGroup query — ดึง /salaries/*/months/* ทั้งหมด     */
export function subscribeAllSalaries(onChange, onError){
  return onSnapshot(
    collectionGroup(db, "months"),
    (snap) => {
      // แปลงเป็น { empId: { ym: data } } ให้เข้ากับ format เดิม
      const result = {};
      snap.docs.forEach(d => {
        // path = salaries/{empId}/months/{ym}
        const parts = d.ref.path.split("/");
        const empId = parts[1];
        const ym = parts[3];
        if(!result[empId]) result[empId] = {};
        result[empId][ym] = d.data();
      });
      onChange(result);
    },
    (err) => {
      console.error("[Salaries] subscribe error:", err);
      onError?.(err);
    }
  );
}

/* ─── Get salary for specific employee/month ───────────────── */
export async function getSalary(empId, ym){
  const snap = await getDoc(monthRef(empId, ym));
  return snap.exists() ? snap.data() : null;
}

/* ─── Get all months for specific employee ─────────────────── */
export async function getEmployeeSalaries(empId){
  const snap = await getDocs(query(monthsRef(empId), orderBy("__name__", "desc")));
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data(); });
  return result;
}

/* ─── Set salary (create/replace) ──────────────────────────── */
export async function setSalary(empId, ym, data){
  await setDoc(monthRef(empId, ym), {
    ...data,
    updatedAt: Date.now(),
  });
}

/* ─── Update salary (merge fields) ─────────────────────────── */
export async function updateSalary(empId, ym, fields){
  await setDoc(monthRef(empId, ym), {
    ...fields,
    updatedAt: Date.now(),
  }, { merge: true });
}

/* ─── Delete salary ────────────────────────────────────────── */
export async function deleteSalary(empId, ym){
  await deleteDoc(monthRef(empId, ym));
}
