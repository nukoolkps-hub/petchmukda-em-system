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
  runTransaction,
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
  /** สลิปโอนเงิน — admin อัปโหลดตอนสร้างเงินกู้ · พนักงานเปิดดูได้ */
  slipImageUrl?: string;
  createdAt: string;
  /* LINE notification fields — worker `processLoanNotifications` พิม่ม `pending`
   * แล้วเปลี่ยนเป็น `processing` → `sent`/`error`/`skipped` · admin set ตอนสร้าง
   * เงินกู้ใหม่ (ผ่าน EmployeeLoansPanel) */
  lineNotificationStatus?: "pending" | "processing" | "sent" | "error" | "skipped";
  lineNotificationType?: "created";
  lineNotificationRequestedAt?: string;
  lineNotificationSentAt?: string;
  lineNotificationLastError?: string | null;
  lineNotificationSkippedReason?: string | null;
  lineNotificationAttempts?: number;
  lineNotificationSlipImagePushFailed?: boolean;
  lineNotificationSlipImageError?: string | null;
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

/** บันทึก repayment ของเดือนหนึ่งแบบ atomic — ใช้ transaction กัน race
 *  case: 2 admin sessions ยืนยันยอด 2 เดือนพร้อมกัน → ถ้าทำ {...loan.repayments, [ym]: x}
 *  จาก state ภายนอกแล้วเขียนทับทั้ง map session ที่ write ทีหลังจะเด้ง entry
 *  ของอีก session ทิ้ง. transaction อ่าน-คำนวณ-เขียน atomic ภายใน Firestore */
export async function recordLoanRepaymentTx(
  loanId: string,
  yearMonth: string,
  amount: number,
): Promise<void> {
  const loanRef = doc(ref, loanId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(loanRef);
    if (!snap.exists()) return;
    const data = snap.data() as EmployeeLoan;
    const principal = Number(data.principal) || 0;
    const prevAmt = Number(data.repayments?.[yearMonth]) || 0;
    if (prevAmt === amount) return; // ไม่เปลี่ยน
    const newRepayments: Record<string, number> = {
      ...(data.repayments || {}),
      [yearMonth]: amount,
    };
    const paid = Object.values(newRepayments).reduce<number>(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    tx.update(loanRef, {
      [`repayments.${yearMonth}`]: amount,
      status: paid >= principal ? "paid_off" : "active",
    });
  });
}

/* สร้าง loanContext ให้ calculateSalary — เงินกู้ของพนักงานคนนี้ที่ยังไม่ยกเลิก */
export function buildLoanContext(
  allLoans: EmployeeLoan[] | undefined,
  employeeId: string,
  yearMonth: string,
) {
  const loans = (allLoans || [])
    .filter((l) => l.employeeId === employeeId && l.status !== "cancelled")
    .map((l) => ({
      id: l.id,
      monthlyDeduction: l.monthlyDeduction,
      principal: l.principal,
      startMonth: l.startMonth,
      repayments: l.repayments,
    }));
  return { yearMonth, loans };
}

/* คงเหลือ = เงินต้น − ผลรวมที่ผ่อนแล้ว */
export function loanRemaining(loan: EmployeeLoan): number {
  const paid = Object.values(loan.repayments || {}).reduce(
    (s, v) => s + (Number(v) || 0),
    0,
  );
  return Math.max(0, (Number(loan.principal) || 0) - paid);
}

/** คงเหลือ "ณ สิ้นเดือน yearMonth" — รวมเฉพาะ repayments[ym] ที่ ym ≤ yearMonth
 *  ใช้แสดง snapshot ฝั่งพนักงานตอนเลื่อนดูเดือนเก่า (ไม่เอาเดือนอนาคต)
 *  เปรียบเทียบ string "YYYY-MM" lexicographic = chronological */
export function loanRemainingAsOfMonth(
  loan: EmployeeLoan,
  yearMonth: string,
): number {
  const paid = Object.entries(loan.repayments || {})
    .filter(([ym]) => ym <= yearMonth)
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  return Math.max(0, (Number(loan.principal) || 0) - paid);
}
