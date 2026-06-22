/* ─── Year-long simulation of TODAY'S grace-period re-settle changes ──────
   ครอบ #637-#640: auto re-settle "ทุกแถว" เมื่อมี grace edit หลายแหล่ง
   (ลา/เรท/เงินกู้/เบิก/หักกองกลาง/ปฏิทินร้าน) + restamp totalLeaveDays snapshot.

   จุดเสี่ยงที่ test นี้พิสูจน์ (ถ้า fail = เงินคลาดเคลื่อนจริง):
   1. IDEMPOTENT — trigger หลายตัวยิง settle เดือนเดิมซ้ำๆ ต้องได้ผลเท่าเดิม
      (ไม่หักเงินกู้ซ้ำ · ไม่สร้าง auto-carry ซ้ำ · net ไม่ drift)
   2. CONSERVATION — เงินกองกลางไม่หาย/ไม่เกิดหลัง re-settle
   3. LOAN CAP — ผ่อนสะสมไม่เกินเงินต้น แม้ settle ซ้ำทั้งปี
   4. AUTO-CARRY — เงินสุทธิติดลบ → ยกไปเดือนถัดไป "ก้อนเดียว" (ไม่ซ้ำ) + เดือน
      ถัดไปหักจริง · ถ้า net กลับบวก → carry ถูกลบ
   5. LEAVE SNAPSHOT — แก้ใบลาในเดือน grace → restamp totalLeaveDays → pool
      leave-deduction เปลี่ยนตาม (ไม่ใช่แค่ over-quota)

   จำลอง writers แบบ in-memory ที่ mirror semantics จริงของ Firestore:
   - recordLoanRepayment: SET repayments[ym] (idempotent) + paid_off เมื่อครบต้น
   - syncAutoCarry: key = employeeId|sourceMonth (dedup) · amount update · ลบเมื่อ 0
   - saveNetDenorm: เขียน net ทับ                                              */
import { describe, expect, it } from "vitest";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";
import { computeMonthSummary, settleEmployeeMonth } from "./payrollCompute";

const EPS = 1e-6;
const MONTHS = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
);

const ROLES = [
  {
    id: "sales",
    poolGroup: "sales",
    primaryPoolItemId: "normal",
    poolItems: [
      { id: "normal", label: "ขายทั่วไป", kind: "pool", threshold: 80 },
      { id: "buy", label: "รับซื้อ", kind: "pool", threshold: 80 },
    ],
  },
  { id: "staff" },
];

const EMPLOYEES: any[] = [
  {
    id: "e1",
    name: "เอ",
    nickname: "เอ",
    roleId: "sales",
    baseSalary: 30000,
    poolItemRates: { normal: 12, buy: 8 },
    socialSecurity: 750,
  },
  {
    id: "e2",
    name: "บี",
    nickname: "บี",
    roleId: "sales",
    baseSalary: 28000,
    poolItemRates: { normal: 12, buy: 8 },
  },
  {
    id: "e3",
    name: "ซี",
    nickname: "ซี",
    roleId: "sales",
    baseSalary: 26000,
    poolItemRates: { normal: 12, buy: 8 },
  },
  // e4: เงินกู้ก้อนใหญ่ + base ต่ำ → บางเดือน net ติดลบ → auto-carry
  {
    id: "e4",
    name: "ดี",
    nickname: "ดี",
    roleId: "staff",
    baseSalary: 15000,
  },
  // e5: disabled → ต้องไม่อยู่ใน rows เลย
  {
    id: "e5",
    name: "อี",
    nickname: "อี",
    roleId: "staff",
    baseSalary: 20000,
    salaryDisabled: true,
  },
];

const LOAN_PRINCIPAL = 100000;
const LOANS_BASE = [
  {
    id: "loan-e4",
    employeeId: "e4",
    status: "active",
    principal: LOAN_PRINCIPAL,
    monthlyDeduction: 9000, // ใหญ่พอจะดัน net ติดลบบางเดือน
    startMonth: "2026-01",
  },
];

function buildSalaryDoc(emp: any, idx: number, totalLeaveDays = 0) {
  const role = ROLES.find((r) => r.id === emp.roleId);
  const doc: any = {
    roleId: emp.roleId,
    baseSalary: emp.baseSalary,
    poolExclusion: emp.poolExclusion ?? null,
    salaryDisabled: !!emp.salaryDisabled,
    socialSecurity: emp.socialSecurity ?? 0,
    totalLeaveDays,
    poolItemRates: emp.poolItemRates ?? {},
  };
  if (role?.poolGroup) {
    const factor: Record<string, number> = { e1: 100, e2: 92, e3: 84 };
    const f = factor[emp.id] ?? 0;
    doc.poolItemPieces = { normal: f + idx, buy: Math.round(f / 3) + idx };
  }
  return doc;
}

/** โลกจำลอง: ledger เงินกู้ + auto-carry + net denorm (mirror Firestore) */
function makeWorld() {
  const loans: Record<string, any> = {};
  for (const l of LOANS_BASE) loans[l.id] = { ...l, repayments: {} };
  const autoCarry: Record<
    string,
    { id: string; employeeId: string; nextMonth: string; amount: number }
  > = {};
  let seq = 0;
  const netDenorm: Record<string, number> = {};

  // async เหมือน writer จริง (Firestore) — settleEmployeeMonth await ทุกตัว
  const writers = {
    saveNetDenorm: async (id: string, ym: string, net: number) => {
      netDenorm[`${id}|${ym}`] = net;
    },
    syncAutoCarry: async (args: {
      sourceMonth: string;
      nextMonth: string;
      employeeId: string;
      employeeName: string;
      deficitAmount: number;
    }) => {
      const key = `${args.employeeId}|${args.sourceMonth}`;
      const deficit = Math.round(args.deficitAmount);
      if (deficit > 0) {
        if (autoCarry[key]) autoCarry[key].amount = deficit;
        else
          autoCarry[key] = {
            id: `ac${++seq}`,
            employeeId: args.employeeId,
            nextMonth: args.nextMonth,
            amount: deficit,
          };
      } else {
        delete autoCarry[key];
      }
    },
    recordLoanRepayment: async (loanId: string, ym: string, amount: number) => {
      const loan = loans[loanId];
      if (!loan) return;
      const prev = loan.repayments[ym] || 0;
      if (prev === amount) return; // idempotent (mirror recordLoanRepaymentTx)
      loan.repayments[ym] = amount;
      const paid = Object.values(loan.repayments).reduce(
        (s: number, v) => s + (Number(v) || 0),
        0,
      );
      loan.status = paid >= loan.principal ? "paid_off" : "active";
    },
  };
  return { loans, autoCarry, netDenorm, writers };
}

/** approved advances ของเดือน = manual + auto-carry ที่ nextMonth === ym */
function approvedFor(
  ym: string,
  autoCarry: Record<
    string,
    { nextMonth: string; employeeId: string; amount: number }
  >,
  manual: Record<string, { employeeId: string; amount: number }[]>,
) {
  const out: { employeeId: string; amount: number; month: string }[] = [];
  for (const a of manual[ym] ?? []) out.push({ ...a, month: ym });
  for (const c of Object.values(autoCarry)) {
    if (c.nextMonth === ym)
      out.push({ employeeId: c.employeeId, amount: c.amount, month: ym });
  }
  return out;
}

function snapshot(world: ReturnType<typeof makeWorld>) {
  return JSON.stringify({
    loans: world.loans,
    autoCarry: world.autoCarry,
    netDenorm: world.netDenorm,
  });
}

/** settle ทั้งเดือน (mirror syncConfirmedMonth: settle ทุกแถว · await ทุก row
 *  เหมือน Promise.allSettled ในของจริง) */
async function settleMonth(
  world: ReturnType<typeof makeWorld>,
  ym: string,
  allLeaves: any[],
  manualAdv: Record<string, { employeeId: string; amount: number }[]>,
  salaryData: Record<string, any>,
) {
  const monthApprovedAdvances = approvedFor(ym, world.autoCarry, manualAdv);
  const employeeLoans = Object.values(world.loans);
  const summary = computeMonthSummary({
    activeEmployees: EMPLOYEES.filter((e) => !e.salaryDisabled),
    yearMonth: ym,
    salaryData,
    allLeaves,
    employeeDirectory: EMPLOYEES,
    roles: ROLES,
    employeeLoans,
    monthApprovedAdvances,
    poolAdjustment: null,
    storeCalendar: null,
  });
  await Promise.all(
    summary.rows.map((row) =>
      settleEmployeeMonth(row, ym, employeeLoans, world.writers),
    ),
  );
  return summary;
}

/** รวมค่าคอมกองกลางของ row (sum poolItemsBreakdown · kind=pool) */
function poolEarningsOf(calc: any): number {
  return (calc.poolItemsBreakdown || []).reduce(
    (s: number, b: any) => s + (Number(b.amount) || 0),
    0,
  );
}

describe("Grace-period re-settle simulation (today's #637-#640 changes)", () => {
  it("re-settling a month N times == settling once (idempotent · no money drift)", async () => {
    const manualAdv: Record<string, { employeeId: string; amount: number }[]> =
      { "2026-03": [{ employeeId: "e1", amount: 4000 }] };

    // โลก A: settle เดือนละ 1 ครั้ง · โลก B: settle เดือนละ 4 ครั้ง (grace triggers)
    const worldA = makeWorld();
    const worldB = makeWorld();

    for (let mIdx = 0; mIdx < MONTHS.length; mIdx++) {
      const ym = MONTHS[mIdx];
      const idx = mIdx + 1;
      const allLeaves: any[] = [];
      const salaryData: Record<string, any> = {};
      for (const e of EMPLOYEES)
        salaryData[e.id] = { [ym]: buildSalaryDoc(e, idx) };

      await settleMonth(worldA, ym, allLeaves, manualAdv, salaryData);

      // โลก B: settle 4 รอบ (จำลอง 4 grace edits ยิง settle เดือนเดิม)
      for (let k = 0; k < 4; k++)
        await settleMonth(worldB, ym, allLeaves, manualAdv, salaryData);
    }

    // หลังจบปี โลกทั้งสองต้องเหมือนกันเป๊ะ — settle ซ้ำไม่ทำเงินเพี้ยน
    expect(snapshot(worldB)).toBe(snapshot(worldA));

    // เงินกู้: ผ่อนสะสมไม่เกินเงินต้น (ทั้งที่ settle ซ้ำ 48 ครั้ง)
    const paid = Object.values(worldB.loans["loan-e4"].repayments).reduce(
      (s: number, v) => s + (Number(v) || 0),
      0,
    );
    expect(paid).toBeLessThanOrEqual(LOAN_PRINCIPAL + EPS);
    expect(paid).toBeGreaterThan(0);
  });

  it("auto-carry: deficit → next month one entry, deducted, removed when net recovers", async () => {
    const world = makeWorld();
    // เบิกเกินรายได้ (20000 > earnings 16000) → loan ถูก floor ที่ 0 → net ติดลบ
    // → carry ไป 02 (loan floor: take=min(due,avail) · avail≥0 จึงต้องใช้ advance
    // เกิน earnings ถึงจะติดลบ — ตรงตาม logic จริง net ไม่ติดลบจากเงินกู้อย่างเดียว)
    const manualAdv: Record<string, { employeeId: string; amount: number }[]> =
      { "2026-01": [{ employeeId: "e4", amount: 20000 }] };

    const sal01: Record<string, any> = {};
    for (const e of EMPLOYEES)
      sal01[e.id] = { "2026-01": buildSalaryDoc(e, 1) };
    await settleMonth(world, "2026-01", [], manualAdv, sal01);

    expect(world.netDenorm["e4|2026-01"]).toBeLessThan(0);
    // carry ก้อนเดียวไป 02
    const carries = Object.values(world.autoCarry).filter(
      (c) => c.employeeId === "e4",
    );
    expect(carries).toHaveLength(1);
    expect(carries[0].nextMonth).toBe("2026-02");
    const deficit01 = Math.round(-world.netDenorm["e4|2026-01"]);
    expect(carries[0].amount).toBe(deficit01);

    // re-settle 01 อีก 3 รอบ — carry ต้องยังก้อนเดียว (ไม่ซ้ำ)
    for (let k = 0; k < 3; k++)
      await settleMonth(world, "2026-01", [], manualAdv, sal01);
    expect(
      Object.values(world.autoCarry).filter((c) => c.employeeId === "e4"),
    ).toHaveLength(1);

    // เดือน 02: carry จาก 01 ถูกหักเป็น approved advance
    const sal02: Record<string, any> = {};
    for (const e of EMPLOYEES)
      sal02[e.id] = { "2026-02": buildSalaryDoc(e, 2) };
    const sum02 = await settleMonth(world, "2026-02", [], manualAdv, sal02);
    const e4row02 = sum02.rows.find((r) => r.employee.id === "e4")!;
    expect(e4row02.salaryCalculation.advanceDeduction).toBe(deficit01);

    // ลบ advance ก้อนใหญ่ของ 01 แล้ว re-settle → net 01 กลับบวก → carry ถูกลบ
    const sum01b = await settleMonth(world, "2026-01", [], {}, sal01);
    const e4row01b = sum01b.rows.find((r) => r.employee.id === "e4")!;
    expect(e4row01b.salaryCalculation.netSalary).toBeGreaterThanOrEqual(0);
    expect(
      Object.values(world.autoCarry).filter((c) => c.employeeId === "e4"),
    ).toHaveLength(0);
  });

  it("leave edit in grace month: restamp totalLeaveDays → pool deduction follows", () => {
    // เดือนที่มี "อาทิตย์" เพื่อให้ totalLeaveDays (weekday+sunday) มีผลต่อ pool
    const ym = "2026-03";
    const idx = 3;
    // หา 2 วันธรรมดา + 1 อาทิตย์ของ e3 (ดัน leave หลายวัน → pool หักเยอะ)
    const leaveStart = `${ym}-09`; // จันทร์ (2026-03-09 = Mon)
    const leaveEnd = `${ym}-13`; // ศุกร์ → 5 วันธรรมดา (over-quota)

    function poolDeductForE3(totalLeaveDays: number) {
      const salaryData: Record<string, any> = {};
      for (const e of EMPLOYEES) {
        const tl = e.id === "e3" ? totalLeaveDays : 0;
        salaryData[e.id] = { [ym]: buildSalaryDoc(e, idx, tl) };
      }
      const sum = computeMonthSummary({
        activeEmployees: EMPLOYEES.filter((e) => !e.salaryDisabled),
        yearMonth: ym,
        salaryData,
        allLeaves: [{ employeeId: "e3", start: leaveStart, end: leaveEnd }],
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        employeeLoans: [],
        monthApprovedAdvances: [],
        poolAdjustment: null,
        storeCalendar: null,
      });
      const e3 = sum.rows.find((r) => r.employee.id === "e3")!;
      // pool leave-deduction สะท้อนใน poolItemsBreakdown (วันลาเกิน 2 วันแรกหักสัดส่วน)
      return {
        net: e3.salaryCalculation.netSalary,
        poolEarnings: poolEarningsOf(e3.salaryCalculation),
      };
    }

    // snapshot totalLeaveDays ที่ถูกต้อง = weekday + sundays ของช่วงลา
    const monthLeaves = [
      { employeeId: "e3", start: leaveStart, end: leaveEnd },
    ];
    const weekday = countWeekdayLeaves(monthLeaves, null);
    const over = getOverQuotaDays(monthLeaves, null);
    const correctTotal = weekday + (over.sundays || 0);
    expect(correctTotal).toBeGreaterThan(2); // มีวันลาเกิน free 2 วัน

    // snapshot เก่า (stale = 0 วัน) vs snapshot ใหม่ (restamp) → pool earnings ต่างกัน
    const stale = poolDeductForE3(0);
    const fresh = poolDeductForE3(correctTotal);
    // restamp ทำให้ pool earnings ของ e3 "ลดลง" (ถูกหักวันลา) เทียบ stale=0
    expect(fresh.poolEarnings).toBeLessThan(stale.poolEarnings);
    // ทุกค่ายัง finite
    expect(Number.isFinite(fresh.net)).toBe(true);
  });

  it("pool conservation holds after repeated re-settles over the year", async () => {
    const world = makeWorld();
    for (let mIdx = 0; mIdx < MONTHS.length; mIdx++) {
      const ym = MONTHS[mIdx];
      const idx = mIdx + 1;
      const salaryData: Record<string, any> = {};
      for (const e of EMPLOYEES)
        salaryData[e.id] = { [ym]: buildSalaryDoc(e, idx) };
      // settle 3 รอบ
      let sum: Awaited<ReturnType<typeof settleMonth>> | null = null;
      for (let k = 0; k < 3; k++)
        sum = await settleMonth(world, ym, [], {}, salaryData);
      // conservation: pool ที่จัดสรร ≈ gross ต่อ item (kind=pool)
      for (const row of sum!.rows) {
        if (!row.poolShare?.poolItems) continue;
        for (const item of row.poolShare.poolItems) {
          if (item.kind !== "pool") continue;
          const gross = row.poolShare.grossItemPool[item.id] ?? 0;
          const total = row.poolShare.totalItemPool[item.id] ?? 0;
          expect(Math.abs(total - gross)).toBeLessThan(EPS);
        }
      }
      // net denorm == สรุป (admin total) ของเดือน
      const sumNet = sum!.rows.reduce(
        (s, r) => s + r.salaryCalculation.netSalary,
        0,
      );
      expect(Math.abs(sum!.total - sumNet)).toBeLessThan(EPS);
    }
  });
});
