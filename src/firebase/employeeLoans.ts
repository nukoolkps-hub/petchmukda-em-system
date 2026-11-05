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
import {
  applyTopUp,
  type LoanTopUp,
  loanPrincipalAsOf,
  type TopUpInput,
} from "../utils/loanTopUp";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.EMPLOYEE_LOANS);

export type LoanStatus = "active" | "paid_off" | "cancelled";

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  principal: number; // ยอดกู้รวม (ก้อนแรก + กู้เพิ่มทุกครั้ง)
  monthlyDeduction: number; // ผ่อนเดือนละ
  startMonth: string; // "YYYY-MM" เดือนแรกที่เริ่มหัก
  note: string;
  status: LoanStatus;
  repayments?: Record<string, number>; // { "YYYY-MM": amount } — เขียนตอนยืนยันยอด
  /** กู้เพิ่มเข้าก้อนเดิม (เก่า → ใหม่) · ไม่มี = กู้ครั้งเดียว · ดู utils/loanTopUp */
  topUps?: LoanTopUp[];
  /** สลิปโอนเงิน — admin อัปโหลดตอนสร้างเงินกู้ · พนักงานเปิดดูได้ */
  slipImageUrl?: string;
  createdAt: string;
  /* LINE notification fields — worker `processLoanNotifications` พิม่ม `pending`
   * แล้วเปลี่ยนเป็น `processing` → `sent`/`error`/`skipped` · admin set ตอนสร้าง
   * เงินกู้ใหม่ (ผ่าน EmployeeLoansPanel) */
  lineNotificationStatus?:
    | "pending"
    | "processing"
    | "sent"
    | "error"
    | "skipped";
  lineNotificationType?: "created" | "topup";
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

/** กู้เพิ่มเข้าก้อนเดิมแบบ atomic — อ่าน doc ล่าสุดใน transaction (state ฝั่ง
 *  client อาจค้าง · ยืนยันยอดพร้อมกันจะเขียน repayments แทรก) แล้วต่อท้าย
 *  `topUps` + บวกยอดกู้รวม + ตั้งแจ้ง LINE ให้พนักงาน
 *
 *  ถ้าแจ้ง "สร้างเงินกู้" ยังไม่ถูกส่ง (pending/processing) → คงเป็นแจ้งสร้าง
 *  (ข้อความนั้นโชว์ยอดรวมล่าสุดอยู่แล้ว) ไม่งั้นพนักงานจะไม่เคยได้แจ้งก้อนแรก
 *  คืน doc หลังเขียน (ใช้ re-settle เดือน grace ด้วยข้อมูลเดียวกัน) */
export async function addLoanTopUpTx(
  loanId: string,
  input: Omit<TopUpInput, "createdAt">,
): Promise<EmployeeLoan | null> {
  const loanRef = doc(ref, loanId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(loanRef);
    if (!snap.exists()) return null;
    const data = { id: snap.id, ...snap.data() } as EmployeeLoan;
    const now = new Date().toISOString();
    const fields = applyTopUp(data, { ...input, createdAt: now });
    const createdStillQueued =
      data.lineNotificationType !== "topup" &&
      (data.lineNotificationStatus === "pending" ||
        data.lineNotificationStatus === "processing");
    const notify = createdStillQueued
      ? {}
      : {
          lineNotificationStatus: "pending" as const,
          lineNotificationType: "topup" as const,
          lineNotificationRequestedAt: now,
          lineNotificationLastError: null,
          lineNotificationSkippedReason: null,
        };
    tx.update(loanRef, { ...fields, ...notify });
    return { ...data, ...fields, ...notify };
  });
}

/* สร้าง loanContext ให้ calculateSalary — canonical ย้ายไป utils/payrollCompute
   (pure · single source) · re-export ที่นี่ให้ component เดิมที่ import จาก
   firebase/employeeLoans ใช้ต่อได้โดยไม่ต้องแก้ */
export { buildLoanContext } from "../utils/payrollCompute";

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
 *  เปรียบเทียบ string "YYYY-MM" lexicographic = chronological · ยอดกู้ใช้ยอด
 *  ณ เดือนนั้น (กู้เพิ่มทีหลังไม่ย้อนไปโผล่ในเดือนเก่า) */
export function loanRemainingAsOfMonth(
  loan: EmployeeLoan,
  yearMonth: string,
): number {
  const paid = Object.entries(loan.repayments || {})
    .filter(([ym]) => ym <= yearMonth)
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  return Math.max(0, loanPrincipalAsOf(loan, yearMonth) - paid);
}
