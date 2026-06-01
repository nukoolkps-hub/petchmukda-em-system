/* ─── Employee Loans (เงินกู้ผ่อนคืนหักเงินเดือน) ───────────────────
   admin สร้างเอง (ต่างจากเบิกล่วงหน้าที่พนักงานขอ) — กำหนดเงินต้น +
   ผ่อนเดือนละ X → ระบบหักอัตโนมัติทุกเดือนจนครบ (ledger: repayments[ym])
   คงเหลือ = principal − Σ repayments                                  */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.EMPLOYEE_LOANS);

export type LoanStatus = "active" | "paid_off" | "cancelled";

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  principal: number; // เงินต้น
  monthlyDeduction: number; // ผ่อนเดือนละ
  startMonth: string; // "YYYY-MM" เดือนแรกที่เริ่มหัก
  note: string;
  status: LoanStatus;
  repayments?: Record<string, number>; // { "YYYY-MM": amount } — เขียนตอนยืนยันยอด
  createdAt: string;
}

/* ─── Subscribe (admin = ทุกคน) ────────────────────────────── */
export function subscribeEmployeeLoans(onChange, onError) {
  return onSnapshot(
    query(ref, orderBy("createdAt", "desc")),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("[EmployeeLoans] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── Subscribe ของพนักงานคนเดียว ──────────────────────────── */
export function subscribeEmployeeLoansByEmployeeId(
  employeeId,
  onChange,
  onError,
) {
  return onSnapshot(
    query(ref, where("employeeId", "==", employeeId)),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("[EmployeeLoans] subscribe error:", err);
      onError?.(err);
    },
  );
}

/* ─── CRUD ─────────────────────────────────────────────────── */
export async function addEmployeeLoan(loan: Omit<EmployeeLoan, "id">) {
  const docRef = await addDoc(ref, {
    employeeId: loan.employeeId,
    employeeName: loan.employeeName || "",
    principal: Math.max(0, Number(loan.principal) || 0),
    monthlyDeduction: Math.max(0, Number(loan.monthlyDeduction) || 0),
    startMonth: loan.startMonth,
    note: (loan.note || "").slice(0, 200),
    status: "active",
    repayments: {},
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateEmployeeLoan(
  id: string,
  fields: Partial<EmployeeLoan>,
) {
  await updateDoc(doc(ref, id), fields as Record<string, unknown>);
}

export async function deleteEmployeeLoan(id: string) {
  await deleteDoc(doc(ref, id));
}

/* คงเหลือ = เงินต้น − ผลรวมที่ผ่อนแล้ว */
export function loanRemaining(loan: EmployeeLoan): number {
  const paid = Object.values(loan.repayments || {}).reduce(
    (s, v) => s + (Number(v) || 0),
    0,
  );
  return Math.max(0, (Number(loan.principal) || 0) - paid);
}
