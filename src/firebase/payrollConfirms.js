/* ─── Payroll Confirmations ────────────────────────────────────
   เก็บ status ว่า admin ยืนยันการจ่ายเงินเดือนเดือนใด/พนักงานคนไหน
   key: "{ym}_{empId}" เช่น "2026-04_e1"                          */
import {
  collection, doc, getDocs, setDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, COLLECTIONS } from "./config";

const ref = collection(db, COLLECTIONS.PAYROLL_CONFIRMS);

export function subscribePayrollConfirms(onChange, onError){
  return onSnapshot(
    ref,
    (snap) => {
      // แปลงเป็น { "ym_empId": true } ให้เข้ากับ format เดิม
      const result = {};
      snap.docs.forEach(d => {
        result[d.id] = d.data().confirmed === true;
      });
      onChange(result);
    },
    (err) => {
      console.error("[PayrollConfirms] subscribe error:", err);
      onError?.(err);
    }
  );
}

export async function getAllPayrollConfirms(){
  const snap = await getDocs(ref);
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data().confirmed === true; });
  return result;
}

export async function setPayrollConfirm(ym, empId, confirmed){
  const key = `${ym}_${empId}`;
  await setDoc(doc(ref, key), {
    ym, empId, confirmed,
    confirmedAt: confirmed ? new Date().toISOString() : null,
  });
}
