/* ─── เพิ่มเงินกู้ (top-up) ให้ก้อนเดิม — logic ล้วน ─────────────────────
   พนักงาน 1 คน = เงินกู้ 1 ก้อน (การ์ดเดียว) · กู้เพิ่ม = ต่อท้าย `topUps[]`
   ใน doc เดิม แทนการสร้างก้อนใหม่ · `principal` ใน doc = **ยอดกู้รวมปัจจุบัน**
   (ทุกที่ที่อ่าน `principal` อยู่แล้ว — คงเหลือ/สถานะ/แจ้ง LINE — ได้ยอดรวมเลย)

   **พังเงียบถ้าใช้ยอดรวมกับเดือนก่อนหน้า:** เดือนที่ยืนยันยอดไปแล้วแต่ยังอยู่
   ใน grace ถูก re-settle ได้ · ถ้าก้อนเดิมเหลือ 500 (หักไป 500) แล้วกู้เพิ่ม
   10,000 ในเดือนถัดไป การ re-settle เดือนเก่าด้วยยอดรวมจะหักเต็มเดือนละ
   2,000 ย้อนหลัง → ยอดเดือนที่จ่ายไปแล้วเปลี่ยน · จึงต้องคิด "ยอดกู้ ณ เดือน M"
   = principal − ยอดที่เพิ่มซึ่งเริ่มหักหลังเดือน M (เช่นเดียวกับยอดผ่อน/เดือน)

   doc เก่าที่ไม่มี `topUps` = ยอดเดิมทุกเดือน (migrate-on-read)            */

export interface LoanTopUp {
  id: string;
  /** ยอดที่กู้เพิ่ม (บาท) */
  amount: number;
  /** "YYYY-MM" เดือนแรกที่ยอดเพิ่มนี้ (และยอดผ่อนใหม่) มีผลกับการหัก */
  effectiveMonth: string;
  /** ISO — วันเวลาที่กดเพิ่ม (โชว์ในประวัติ) */
  createdAt: string;
  note?: string;
  slipImageUrl?: string;
  /** ยอดผ่อน/เดือน ก่อน → หลัง เพิ่มเงินกู้ครั้งนี้ */
  prevMonthlyDeduction: number;
  monthlyDeduction: number;
}

interface LoanLike {
  principal?: number;
  monthlyDeduction?: number;
  startMonth?: string;
  createdAt?: string;
  note?: string;
  slipImageUrl?: string;
  status?: string;
  repayments?: Record<string, number>;
  topUps?: LoanTopUp[] | null;
}

const num = (v: unknown) => Number(v) || 0;

function topUpsOf(loan: LoanLike): LoanTopUp[] {
  return Array.isArray(loan.topUps) ? loan.topUps : [];
}

/** ยอดกู้ก้อนแรก (ก่อนกู้เพิ่มครั้งใดๆ) */
export function loanBasePrincipal(loan: LoanLike): number {
  const added = topUpsOf(loan).reduce((s, t) => s + num(t.amount), 0);
  return Math.max(0, num(loan.principal) - added);
}

/** ยอดกู้รวม ณ เดือน `yearMonth` — ไม่นับยอดที่เพิ่มซึ่งเริ่มหักหลังเดือนนี้ */
export function loanPrincipalAsOf(loan: LoanLike, yearMonth: string): number {
  const later = topUpsOf(loan)
    .filter((t) => (t.effectiveMonth || "") > yearMonth)
    .reduce((s, t) => s + num(t.amount), 0);
  return Math.max(0, num(loan.principal) - later);
}

/** ยอดผ่อน/เดือน ณ เดือน `yearMonth` — ย้อนยอดที่เปลี่ยนตอนกู้เพิ่มซึ่งยัง
 *  ไม่มีผลในเดือนนี้ (ไล่จากครั้งล่าสุดย้อนกลับ) */
export function loanMonthlyAsOf(loan: LoanLike, yearMonth: string): number {
  let monthly = num(loan.monthlyDeduction);
  const sorted = [...topUpsOf(loan)].sort(compareTopUps).reverse();
  for (const t of sorted) {
    if ((t.effectiveMonth || "") > yearMonth)
      monthly = num(t.prevMonthlyDeduction);
  }
  return monthly;
}

function compareTopUps(a: LoanTopUp, b: LoanTopUp): number {
  const m = (a.effectiveMonth || "").localeCompare(b.effectiveMonth || "");
  if (m !== 0) return m;
  return (a.createdAt || "").localeCompare(b.createdAt || "");
}

/** ผ่อนไปแล้วทั้งหมด */
export function loanPaidTotal(loan: LoanLike): number {
  return Object.values(loan.repayments || {}).reduce<number>(
    (s, v) => s + num(v),
    0,
  );
}

/** ยังผ่อนอยู่จริงไหม (มียอดค้าง · ไม่ได้ยกเลิก/ผ่อนครบ) — ใช้แยกการ์ด
 *  "กำลังผ่อน" กับกล่อง "ผ่อนครบแล้ว" + ตัดสินว่ากู้เพิ่ม/สร้างใหม่ได้ไหม
 *
 *  กู้เพิ่มได้เฉพาะก้อนที่ยังผ่อนอยู่ · ผ่อนครบแล้วกู้ใหม่ = สร้างเงินกู้ใหม่
 *  (การ์ดเก่าไปอยู่กล่องผ่อนครบ ประวัติไม่ปนกับก้อนใหม่) */
export function isLoanOpen(loan: LoanLike): boolean {
  if (loan.status === "cancelled" || loan.status === "paid_off") return false;
  return num(loan.principal) - loanPaidTotal(loan) > 0;
}

export interface TopUpInput {
  id: string;
  amount: number;
  effectiveMonth: string;
  monthlyDeduction: number;
  createdAt: string;
  note?: string;
  slipImageUrl?: string;
}

/** ตรวจก่อนบันทึก · คืนข้อความผิดพลาด (ว่าง = ผ่าน) */
export function validateTopUp(
  loan: LoanLike,
  input: { amount: number; monthlyDeduction: number; effectiveMonth: string },
): string {
  if (loan.status === "cancelled") return "เงินกู้นี้ถูกยกเลิกแล้ว";
  if (!isLoanOpen(loan)) return 'เงินกู้นี้ผ่อนครบแล้ว — กู้ใหม่ให้กด "สร้างเงินกู้"';
  if (!/^\d{4}-\d{2}$/.test(input.effectiveMonth || ""))
    return "กรุณาเลือกเดือนที่เริ่มหัก";
  // ห้ามเริ่มก่อนครั้งที่กู้เพิ่มล่าสุด — ยอดผ่อนย้อนหลังจะต่อกันไม่ถูก
  // (ยอดผ่อนเดิมของครั้งนี้ = ยอดใหม่ของครั้งก่อน ซึ่งยังไม่มีผลในเดือนนั้น)
  const latest = topUpsOf(loan).reduce(
    (m, t) => ((t.effectiveMonth || "") > m ? t.effectiveMonth : m),
    "",
  );
  if (latest && input.effectiveMonth < latest)
    return "เดือนที่เริ่มหักต้องไม่ก่อนครั้งที่กู้เพิ่มล่าสุด";
  if (!(input.amount > 0)) return "กรุณาระบุยอดที่กู้เพิ่ม";
  if (!(input.monthlyDeduction > 0)) return "กรุณาระบุยอดผ่อนต่อเดือน";
  const remainingAfter =
    Math.max(0, num(loan.principal) - loanPaidTotal(loan)) + input.amount;
  if (input.monthlyDeduction > remainingAfter)
    return "ยอดผ่อนต่อเดือนมากกว่ายอดคงเหลือ";
  return "";
}

/** field ที่ต้องเขียนลง doc เมื่อกู้เพิ่ม — ใช้ทั้งใน transaction และตอน
 *  re-settle เดือน grace (ให้ทั้ง 2 ที่ได้ doc หน้าตาเดียวกัน)
 *
 *  - ยอดกู้รวมเพิ่มขึ้น · ยอดผ่อนเป็นค่าใหม่ · ผ่อนครบแล้ว → กลับมา "กำลังผ่อน"
 *  - ไม่แตะ `repayments` (ยอดที่หักไปแล้วต้องคงเดิม)                      */
export function applyTopUp(
  loan: LoanLike,
  input: TopUpInput,
): {
  principal: number;
  monthlyDeduction: number;
  status: "active";
  topUps: LoanTopUp[];
} {
  const entry: LoanTopUp = {
    id: input.id,
    amount: input.amount,
    effectiveMonth: input.effectiveMonth,
    createdAt: input.createdAt,
    prevMonthlyDeduction: num(loan.monthlyDeduction),
    monthlyDeduction: input.monthlyDeduction,
    ...(input.note ? { note: input.note } : {}),
    ...(input.slipImageUrl ? { slipImageUrl: input.slipImageUrl } : {}),
  };
  return {
    principal: num(loan.principal) + input.amount,
    monthlyDeduction: input.monthlyDeduction,
    status: "active",
    topUps: [...topUpsOf(loan), entry],
  };
}

/** รายการกู้เพิ่มครั้งล่าสุด (ตามเวลาที่กด) · ไม่มี → null */
export function latestTopUp(loan: LoanLike): LoanTopUp | null {
  let latest: LoanTopUp | null = null;
  for (const t of topUpsOf(loan)) {
    if (!latest || (t.createdAt || "") >= (latest.createdAt || "")) latest = t;
  }
  return latest;
}

/** ลบการกู้เพิ่มครั้งล่าสุดได้ไหม · คืนเหตุผลที่ลบไม่ได้ (ว่าง = ลบได้)
 *
 *  ลบได้เฉพาะครั้งล่าสุด (ยอดผ่อนเดิมของครั้งถัดไปผูกกับครั้งนี้ ลบกลางสาย
 *  จะต่อกันผิด) และ**ต้องยังไม่เคยหักเงินเดือนตั้งแต่เดือนที่ยอดนี้เริ่มมีผล**
 *  — เดือนพวกนั้นคิดด้วยยอดใหม่ไปแล้ว ถ้าปิดรอบแล้วแก้ย้อนไม่ได้ ลบทิ้ง =
 *  ledger ไม่ตรงกับยอดกู้ (เช่น หักเกินยอดกู้เดิม) แบบกู้คืนไม่ได้        */
export function topUpUndoBlocker(loan: LoanLike): string {
  if (loan.status === "cancelled") return "เงินกู้นี้ถูกยกเลิกแล้ว";
  const latest = latestTopUp(loan);
  if (!latest) return "ไม่มีรายการกู้เพิ่ม";
  const deductedSince = Object.entries(loan.repayments || {}).some(
    ([ym, v]) => ym >= (latest.effectiveMonth || "") && num(v) > 0,
  );
  if (deductedSince) return "หักเงินเดือนด้วยยอดใหม่ไปแล้ว — ลบไม่ได้";
  return "";
}

/** field ที่ต้องเขียนเมื่อลบการกู้เพิ่มครั้งล่าสุด — คืนยอดกู้/ยอดผ่อนเป็นค่า
 *  ก่อนกู้เพิ่ม · สถานะคิดใหม่จากยอดที่ผ่อนแล้ว (ก้อนที่ผ่อนครบก่อนกู้เพิ่ม
 *  กลับเป็น "ผ่อนครบแล้ว") · ไม่แตะ `repayments` · ผู้เรียกต้องเช็ค
 *  `topUpUndoBlocker` ก่อน */
export function undoLatestTopUp(loan: LoanLike): {
  principal: number;
  monthlyDeduction: number;
  status: "active" | "paid_off";
  topUps: LoanTopUp[];
} | null {
  const latest = latestTopUp(loan);
  if (!latest) return null;
  const principal = Math.max(0, num(loan.principal) - num(latest.amount));
  return {
    principal,
    monthlyDeduction: num(latest.prevMonthlyDeduction),
    status: loanPaidTotal(loan) >= principal ? "paid_off" : "active",
    topUps: topUpsOf(loan).filter((t) => t !== latest),
  };
}

export interface LoanHistoryEntry {
  /** paidoff = ผ่อนครบ (ณ เดือน `effectiveMonth` · `amount` = ยอดกู้รวมที่ครบ) */
  kind: "initial" | "topup" | "paidoff";
  /** id ของรายการกู้เพิ่ม (ครั้งแรกไม่มี) */
  topUpId?: string;
  /** ISO วันเวลาที่กู้ */
  at: string;
  amount: number;
  /** เดือนแรกที่ยอดนี้เริ่มหัก */
  effectiveMonth: string;
  /** ยอดผ่อน/เดือน หลังรายการนี้ · ครั้งแรก = ยอดผ่อนตั้งต้น */
  monthlyDeduction: number;
  /** ยอดผ่อนเดิม (เฉพาะกู้เพิ่มที่เปลี่ยนยอดผ่อน) */
  prevMonthlyDeduction?: number;
  /** ยอดกู้รวมหลังรายการนี้ */
  totalAfter: number;
  note?: string;
  slipImageUrl?: string;
}

/** ประวัติการกู้ (เก่า → ใหม่) — กู้ครั้งแรก + กู้เพิ่มแต่ละครั้ง */
export function loanHistory(loan: LoanLike): LoanHistoryEntry[] {
  const topUps = [...topUpsOf(loan)].sort((a, b) =>
    (a.createdAt || "").localeCompare(b.createdAt || ""),
  );
  const base = loanBasePrincipal(loan);
  const firstMonthly = topUps.length
    ? num(topUps[0].prevMonthlyDeduction)
    : num(loan.monthlyDeduction);
  const out: LoanHistoryEntry[] = [
    {
      kind: "initial",
      at: loan.createdAt || "",
      amount: base,
      effectiveMonth: loan.startMonth || "",
      monthlyDeduction: firstMonthly,
      totalAfter: base,
      ...(loan.note ? { note: loan.note } : {}),
      ...(loan.slipImageUrl ? { slipImageUrl: loan.slipImageUrl } : {}),
    },
  ];
  let total = base;
  for (const t of topUps) {
    total += num(t.amount);
    const changed = num(t.prevMonthlyDeduction) !== num(t.monthlyDeduction);
    out.push({
      kind: "topup",
      topUpId: t.id,
      at: t.createdAt || "",
      amount: num(t.amount),
      effectiveMonth: t.effectiveMonth || "",
      monthlyDeduction: num(t.monthlyDeduction),
      ...(changed ? { prevMonthlyDeduction: num(t.prevMonthlyDeduction) } : {}),
      totalAfter: total,
      ...(t.note ? { note: t.note } : {}),
      ...(t.slipImageUrl ? { slipImageUrl: t.slipImageUrl } : {}),
    });
  }
  // แทรก "ผ่อนครบ" หลังรายการสุดท้ายที่เริ่มหักไม่เกินเดือนที่ครบ (กู้เพิ่ม
  // ที่เริ่มหักทีหลังจึงตามหลังบรรทัดผ่อนครบ ถูกลำดับเหตุการณ์)
  for (const p of loanPaidOffMonths(loan)) {
    let pos = 0;
    out.forEach((e, i) => {
      if ((e.effectiveMonth || "") <= p.yearMonth) pos = i + 1;
    });
    out.splice(pos, 0, {
      kind: "paidoff",
      at: "",
      amount: p.total,
      effectiveMonth: p.yearMonth,
      monthlyDeduction: 0,
      totalAfter: p.total,
    });
  }
  return out;
}

/** เดือนที่ผ่อนครบ (เก่า → ใหม่) — ไล่ยอดที่หักสะสมทีละเดือนเทียบยอดกู้
 *  "ณ เดือนนั้น" · ครบแล้วมีกู้เพิ่ม (ข้อมูลก่อนกฎใหม่) แล้วครบอีก = 2 ครั้ง */
export function loanPaidOffMonths(
  loan: LoanLike,
): { yearMonth: string; total: number }[] {
  const out: { yearMonth: string; total: number }[] = [];
  let paid = 0;
  let wasDone = false;
  for (const r of loanRepaymentHistory(loan)) {
    paid += r.amount;
    const owed = loanPrincipalAsOf(loan, r.yearMonth);
    const done = owed > 0 && paid >= owed;
    if (done && !wasDone) out.push({ yearMonth: r.yearMonth, total: owed });
    wasDone = done;
  }
  return out;
}

/** ยอดผ่อนเปลี่ยนเท่าไรตอนกู้เพิ่ม — ประวัติ/แจ้ง LINE ต้องบอก "เพิ่มเท่าไร
 *  → รวมเท่าไร" ให้ชัด (โชว์แค่ "500 → 700" แล้วคนอ่านต้องลบเลขเอง) ·
 *  ข้อมูลก่อนเปลี่ยนช่องเป็น "ผ่อนเพิ่ม" อาจมียอดลดลงได้ จึงรองรับ "ลด" ด้วย */
export function topUpMonthlyChange(
  prev: number,
  next: number,
): { kind: "up" | "down" | "same"; delta: number; total: number } {
  const delta = num(next) - num(prev);
  return {
    kind: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    delta: Math.abs(delta),
    total: num(next),
  };
}

/** ยอดที่หักแต่ละเดือน (เก่า → ใหม่ · ข้ามเดือนที่หัก 0) */
export function loanRepaymentHistory(
  loan: LoanLike,
): { yearMonth: string; amount: number }[] {
  return Object.entries(loan.repayments || {})
    .map(([yearMonth, v]) => ({ yearMonth, amount: num(v) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}
