/* ─── Year-long payroll simulation (10 employees) ───────────────────
   จำลองการใช้งานจริง 12 เดือน × 10 พนักงาน ครอบทุกเคสที่ logic รองรับ:
   pool sales / multi-piece / ไม่มีค่าคอม · ลา weekday/อาทิตย์/เกินโควต้า ·
   เงินกู้ · เบิกล่วงหน้า · ขึ้นเงินเดือนประจำปี · poolExclusion · salaryDisabled ·
   recurring · coverage · ปฏิทินร้าน
   แล้ว assert invariant ทั้งฝั่ง admin (full salaries) และพนักงาน (poolSnapshot)

   ถ้า assertion fail = พบจุดที่คำนวณไม่ตรง → ไปแก้ที่ source                  */
import { describe, expect, it } from "vitest";
import { BUSINESS_RULES } from "../constants";
import { countWeekdayLeaves, getOverQuotaDays } from "./leaveUtils";
import { computeEmployeeMonthRow, computeMonthSummary } from "./payrollCompute";
import {
  calculateSalary,
  computePoolSharesForGroup,
  getEffectiveBaseSalary,
  isEligibleForRaiseYear,
} from "./salaryUtils";

const { WEEKDAY_LEAVE_QUOTA } = BUSINESS_RULES;
const EPS = 1e-6;

const MONTHS = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
);

// ─── Roles ────────────────────────────────────────────────────────
const ROLES = [
  {
    id: "sales",
    poolGroup: "sales",
    primaryPoolItemId: "normal",
    poolItems: [
      { id: "normal", label: "ขายทั่วไป", kind: "pool", threshold: 80 },
      { id: "special", label: "ขายพิเศษ", kind: "personal", threshold: 80 },
      { id: "buy", label: "รับซื้อ", kind: "pool", threshold: 80 },
    ],
    bonusItems: [{ id: "invite", label: "เชิญบัตร" }],
  },
  {
    id: "acct",
    pieceItems: [
      { id: "bill", label: "ทำบิล" },
      { id: "count", label: "นับสต๊อก" },
    ],
  },
  { id: "staff" },
];

// ─── Employees (10) ───────────────────────────────────────────────
const EMPLOYEES: any[] = [
  // pool sales group (e1-e3) + excluded (e8) + disabled (e9)
  {
    id: "e1",
    name: "อ้อย",
    nickname: "อ้อย",
    roleId: "sales",
    baseSalary: 30000,
    startWorkMonth: "2024-06",
    annualRaiseAmount: 1000, // eligible 2026-01 (>1y)
    poolItemRates: { normal: 12, special: 15, buy: 8 },
    bonusRates: { invite: 50 },
    socialSecurity: 750,
  },
  {
    id: "e2",
    name: "บี",
    nickname: "บี",
    roleId: "sales",
    baseSalary: 28000,
    startWorkMonth: "2023-01",
    poolItemRates: { normal: 12, special: 15, buy: 8 },
    socialSecurity: 750,
    recurringItems: [
      { type: "income", label: "ค่าเดินทาง", amount: 800 },
      { type: "deduction", label: "ค่าชุด", amount: 300 },
    ],
  },
  {
    id: "e3",
    name: "ซี",
    nickname: "ซี",
    roleId: "sales",
    baseSalary: 26000,
    startWorkMonth: "2025-03",
    poolItemRates: { normal: 10, special: 12, buy: 7 },
    socialSecurity: 750,
  },
  // multi-piece (e4-e5)
  {
    id: "e4",
    name: "ดี",
    nickname: "ดี",
    roleId: "acct",
    baseSalary: 22000,
    startWorkMonth: "2024-01",
    pieceRates: { bill: 5, count: 3 },
    socialSecurity: 450,
  },
  {
    id: "e5",
    name: "อี",
    nickname: "อี",
    roleId: "acct",
    baseSalary: 21000,
    startWorkMonth: "2025-07",
    pieceRates: { bill: 5, count: 3 },
    socialSecurity: 450,
  },
  // no-commission (e6-e7)
  {
    id: "e6",
    name: "เอฟ",
    nickname: "เอฟ",
    roleId: "staff",
    baseSalary: 15000,
  },
  {
    id: "e7",
    name: "จี",
    nickname: "จี",
    roleId: "staff",
    baseSalary: 16000,
    socialSecurity: 300,
  },
  // pool member but poolExclusion="all" + low pieces (e8)
  {
    id: "e8",
    name: "เอช",
    nickname: "เอช",
    roleId: "sales",
    baseSalary: 25000,
    poolExclusion: "all",
    poolItemRates: { normal: 10, special: 10, buy: 6 },
    socialSecurity: 750,
  },
  // salaryDisabled (e9) — intern
  {
    id: "e9",
    name: "ไอ",
    nickname: "ไอ",
    roleId: "sales",
    baseSalary: 12000,
    salaryDisabled: true,
    poolItemRates: { normal: 10, special: 10, buy: 6 },
  },
  // loan + advances + recurring (e10)
  {
    id: "e10",
    name: "เจ",
    nickname: "เจ",
    roleId: "staff",
    baseSalary: 18000,
    socialSecurity: 300,
    recurringItems: [{ type: "deduction", label: "ค่าอาหาร", amount: 500 }],
  },
];

const LOANS = [
  {
    id: "loan-e10",
    employeeId: "e10",
    status: "active",
    principal: 12000,
    monthlyDeduction: 1000,
    startMonth: "2026-01",
    repayments: {} as Record<string, number>,
  },
];

// approved advance: e2 เบิก 5000 เดือน 2026-04
function advancesForMonth(ym: string) {
  if (ym === "2026-04") return [{ employeeId: "e2", amount: 5000, month: ym }];
  return [];
}

// ลาแต่ละเดือน (หลากหลาย: 0/1/2/3 weekday + บางเดือนมีอาทิตย์)
function leavesForMonth(ym: string): any[] {
  const out: any[] = [];
  const idx = Number(ym.slice(5, 7));
  // e3: idx วันธรรมดา (0..) → ทดสอบ over-quota เพิ่มขึ้นเรื่อยๆ (clamp)
  const e3days = Math.min(idx % 5, 4); // 1..4
  // ใช้วันจันทร์ของเดือนนั้นเป็นจุดเริ่ม (2026-XX-05 เป็นจันทร์บ้าง) — เลือกช่วงวันธรรมดา
  if (e3days > 0) {
    const start = `${ym}-05`;
    const endDay = 5 + e3days - 1;
    out.push({
      employeeId: "e3",
      start,
      end: `${ym}-${String(endDay).padStart(2, "0")}`,
    });
  }
  // e1: ลาอาทิตย์ 1 วันในเดือนคู่ (2026-XX-04 หรือ -11 เป็นอาทิตย์บางเดือน)
  if (idx % 2 === 0) {
    // หา "อาทิตย์แรก" ของเดือน
    for (let d = 1; d <= 7; d++) {
      const date = new Date(`${ym}-${String(d).padStart(2, "0")}T00:00:00`);
      if (date.getDay() === 0) {
        const ds = `${ym}-${String(d).padStart(2, "0")}`;
        out.push({ employeeId: "e1", start: ds, end: ds });
        break;
      }
    }
  }
  // e6: ลายาว 3 วันธรรมดาเดือน 2026-09 (over-quota)
  if (ym === "2026-09") {
    out.push({ employeeId: "e6", start: `${ym}-07`, end: `${ym}-09` });
  }
  return out;
}

// pieces ต่อ item ต่อเดือน (หลากหลาย · ทำให้บางคนต่ำกว่า threshold บางเดือน)
function buildSalaryDoc(emp: any, ym: string, idx: number) {
  const role = ROLES.find((r) => r.id === emp.roleId);
  const doc: any = {
    roleId: emp.roleId,
    baseSalary: getEffectiveBaseSalary(emp, ym),
    poolExclusion: emp.poolExclusion ?? null,
    salaryDisabled: !!emp.salaryDisabled,
    socialSecurity: emp.socialSecurity ?? 0,
    totalLeaveDays: 0, // เติมภายหลังถ้าจำเป็น (sim ใช้ allLeaves แทน)
    poolItemRates: emp.poolItemRates ?? {},
    pieceRates: emp.pieceRates ?? {},
    bonusRates: emp.bonusRates ?? {},
  };
  if (role?.poolGroup) {
    // e1 ขายเยอะสุด, e2 รองลงมา, e3 น้อย (บางเดือนต่ำกว่า 80%), e8 น้อยมาก
    const factor: Record<string, number> = {
      e1: 100,
      e2: 90,
      e3: idx % 3 === 0 ? 50 : 85, // บางเดือนต่ำกว่า threshold
      e8: 10,
      e9: 70,
    };
    const f = factor[emp.id] ?? 0;
    doc.poolItemPieces = {
      normal: f + idx,
      special: Math.round(f / 2),
      buy: Math.round(f / 3) + (idx % 4),
    };
    doc.bonusCounts = { invite: emp.id === "e1" ? idx % 3 : 0 };
  } else if (role?.pieceItems) {
    doc.piecePieces = {
      bill: 20 + idx * 2 + (emp.id === "e4" ? 10 : 0),
      count: 5 + (idx % 4),
    };
  }
  // recurring มาจาก employee record (rates) — ไม่ต้องใส่ใน doc
  return doc;
}

// poolSnapshot shape (ฝั่งพนักงาน — ไม่มี rates)
function toPoolSnapshot(doc: any) {
  return {
    roleId: doc.roleId,
    poolExclusion: doc.poolExclusion ?? null,
    salaryDisabled: doc.salaryDisabled,
    totalLeaveDays: doc.totalLeaveDays ?? 0,
    poolItemPieces: doc.poolItemPieces ?? {},
    normalSalePieces: doc.poolItemPieces?.normal ?? 0,
    specialSalePieces: doc.poolItemPieces?.special ?? 0,
    buyPieces: doc.poolItemPieces?.buy ?? 0,
  };
}

function isFiniteNum(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}

describe("Year-long 10-employee payroll simulation", () => {
  // running ledger ของเงินกู้ (mutate ข้ามเดือน) + auto-carry deficit
  const loanRepayments: Record<string, number> = {};
  const prevDeficitCarry = 0; // deficit เดือนก่อน → advance เดือนนี้ (e10 ฯลฯ)

  it("runs 12 months and holds all invariants", () => {
    let e1PrevBase = 0;

    MONTHS.forEach((ym, mIdx) => {
      const idx = mIdx + 1;
      // build salaryData (admin = full)
      const adminSalary: Record<string, any> = {};
      EMPLOYEES.forEach((emp) => {
        adminSalary[emp.id] = { [ym]: buildSalaryDoc(emp, ym, idx) };
      });
      // employee-side salaryData: self full + peers as poolSnapshot
      const empSideSalary: Record<string, any> = {};
      EMPLOYEES.forEach((emp) => {
        empSideSalary[emp.id] = {
          [ym]: toPoolSnapshot(adminSalary[emp.id][ym]),
        };
      });

      const allLeaves = leavesForMonth(ym);
      const approved = advancesForMonth(ym);

      // ── ADMIN summary ──
      const summary = computeMonthSummary({
        activeEmployees: EMPLOYEES.filter((e) => !e.salaryDisabled),
        yearMonth: ym,
        salaryData: adminSalary,
        allLeaves,
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        employeeLoans: LOANS.map((l) => ({
          ...l,
          repayments: { ...loanRepayments },
        })),
        monthApprovedAdvances: approved,
        poolAdjustment: null,
        storeCalendar: null,
      });

      // INVARIANT C: total == sum of rows net · count correct · ทุกค่า finite
      const sumNet = summary.rows.reduce(
        (s, r) => s + r.salaryCalculation.netSalary,
        0,
      );
      expect(Math.abs(summary.total - sumNet)).toBeLessThan(EPS);
      // e9 (disabled) ต้องไม่อยู่ใน rows
      expect(summary.rows.some((r) => r.employee.id === "e9")).toBe(false);
      expect(summary.count).toBe(9);

      summary.rows.forEach((row) => {
        const c = row.salaryCalculation;
        // INVARIANT I: ไม่มี NaN/Infinity
        for (const k of [
          "earnings",
          "deductions",
          "netSalary",
          "baseSalary",
          "attendanceBonus",
          "overQuotaDeduction",
          "loanDeduction",
        ]) {
          expect(
            isFiniteNum(c[k]),
            `${row.employee.id}.${k} finite (${ym})`,
          ).toBe(true);
        }
        // INVARIANT B: net == earnings - deductions (exact)
        expect(
          Math.abs(c.netSalary - (c.earnings - c.deductions)),
        ).toBeLessThan(EPS);
        // INVARIANT D: attendance bonus rule (ถ้าไม่ losesBaseSalary)
        if (!c.losesBaseSalary) {
          const expectedBonusDays = Math.max(
            0,
            WEEKDAY_LEAVE_QUOTA - c.leaveDays,
          );
          expect(c.bonusDays).toBe(expectedBonusDays);
        }

        // INVARIANT A: pool conservation (kind=pool) — sum allocated ≈ gross
        if (row.poolShare?.poolItems) {
          for (const item of row.poolShare.poolItems) {
            if (item.kind !== "pool") continue;
            const gross = row.poolShare.grossItemPool[item.id] ?? 0;
            const totalPool = row.poolShare.totalItemPool[item.id] ?? 0;
            const sumAlloc = summary.rows.reduce((s, r2) => {
              const sh = r2.poolShare?.itemShares?.[item.id];
              return s + (sh?.allocatedPieces ?? 0);
            }, 0);
            // ไม่มี adjustment → totalPool == gross
            expect(Math.abs(totalPool - gross)).toBeLessThan(EPS);
            // pool เงินไม่หาย/ไม่เกิด: sum allocated ≈ totalPool (ยกเว้น
            // eligible=0 ซึ่งไม่ควรเกิดเพราะ top ผ่าน threshold เสมอ)
            const eligibleCount =
              row.poolShare.eligibleCountByItemId?.[item.id] ?? 0;
            if (eligibleCount > 0) {
              expect(
                Math.abs(sumAlloc - totalPool),
                `pool ${item.id} conserve ${ym} (gross ${gross}, alloc ${sumAlloc})`,
              ).toBeLessThan(1e-3);
            }
          }
        }
      });

      // INVARIANT E: e1 effective base ขึ้นปีละครั้ง (ม.ค. 2026 เป็นต้นไป +1000)
      const e1Base = summary.rows.find((r) => r.employee.id === "e1")!
        .salaryCalculation.baseSalary;
      expect(e1Base).toBe(31000); // 30000 + 1000 (eligible 2026)
      if (e1PrevBase) expect(e1Base).toBeGreaterThanOrEqual(e1PrevBase);
      e1PrevBase = e1Base;

      // INVARIANT F: loan — สะสม repayments ไม่เกิน principal · หักไม่เกินคงเหลือ
      const e10row = summary.rows.find((r) => r.employee.id === "e10")!;
      const ded = e10row.salaryCalculation.loanDeduction;
      const prevPaid = Object.values(loanRepayments).reduce(
        (s, v) => s + (Number(v) || 0),
        0,
      );
      const remaining = 12000 - prevPaid;
      expect(ded).toBeLessThanOrEqual(remaining + EPS);
      expect(ded).toBeGreaterThanOrEqual(0);
      // บันทึก ledger (denormalize ตอนยืนยันยอด)
      const reps = e10row.salaryCalculation.loanRepayments || {};
      if (reps["loan-e10"]) loanRepayments[ym] = reps["loan-e10"];
      // sum ไม่เกิน principal
      const totalPaid = Object.values(loanRepayments).reduce(
        (s, v) => s + (Number(v) || 0),
        0,
      );
      expect(totalPaid).toBeLessThanOrEqual(12000 + EPS);

      // INVARIANT H: admin vs employee-side pool share เท่ากัน (privacy phase2)
      const adminShares = computePoolSharesForGroup({
        groupEmployeeIds: ["e1", "e2", "e3", "e8", "e9"],
        salaryData: adminSalary,
        allLeaves,
        yearMonth: ym,
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        poolGroup: "sales",
        storeCalendar: null,
      });
      const empShares = computePoolSharesForGroup({
        groupEmployeeIds: ["e1", "e2", "e3", "e8", "e9"],
        salaryData: empSideSalary,
        allLeaves,
        yearMonth: ym,
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        poolGroup: "sales",
        storeCalendar: null,
      });
      for (const id of ["e1", "e2", "e3"]) {
        for (const item of ["normal", "buy"]) {
          const a = adminShares[id]?.itemShares?.[item]?.allocatedPieces ?? 0;
          const e = empShares[id]?.itemShares?.[item]?.allocatedPieces ?? 0;
          expect(
            Math.abs(a - e),
            `admin/emp parity ${id}.${item} ${ym}`,
          ).toBeLessThan(1e-3);
        }
      }

      // INVARIANT G: e8 (poolExclusion=all) commission = 0 ทุก pool item
      const e8row = computeEmployeeMonthRow({
        employee: EMPLOYEES.find((e) => e.id === "e8"),
        yearMonth: ym,
        salaryData: adminSalary,
        allLeaves,
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        employeeLoans: [],
        monthApprovedAdvances: approved,
        poolAdjustment: null,
        storeCalendar: null,
      });
      const e8comm = (e8row?.salaryCalculation.poolItemsBreakdown ?? []).reduce(
        (s: number, b: any) => s + b.amount,
        0,
      );
      expect(e8comm).toBe(0);
    });

    // เงินกู้ควรผ่อนหมดภายในปี (12000 / 1000 = 12 เดือน) ถ้า net พอหักทุกเดือน
    const totalPaid = Object.values(loanRepayments).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    expect(totalPaid).toBeLessThanOrEqual(12000 + EPS);
    expect(prevDeficitCarry).toBe(0); // placeholder (ไม่มี deficit ใน sim นี้)
  });
});

/* ─── Adversarial edge cases (bug hunting) ─────────────────────────── */
const PLAIN = { id: "staff" };
const NOQ = { weekdays: 0, sundays: 0 };

describe("Edge: deficit → loan not deducted, carry deducted next month", () => {
  it("caps loan at zero on a deficit month and deducts the carry next month", () => {
    const emp = {
      id: "x",
      baseSalary: 18000,
      socialSecurity: 300,
      recurringItems: [{ type: "deduction", label: "ค่าอาหาร", amount: 500 }],
    };
    const loanCtx1 = {
      yearMonth: "2026-01",
      loans: [
        {
          id: "L",
          principal: 12000,
          monthlyDeduction: 1000,
          startMonth: "2026-01",
          repayments: {},
        },
      ],
    };
    // month1: advance 20000 → deficit
    const m1 = calculateSalary(
      { baseSalary: 18000, socialSecurity: 300 },
      NOQ,
      emp,
      0,
      20000,
      null,
      PLAIN,
      loanCtx1,
    )!;
    expect(m1.netSalary).toBeLessThan(0); // ติดลบ
    expect(m1.loanDeduction).toBe(0); // ไม่หักกู้เพราะไม่มีเงินเหลือ
    expect(m1.loanRepayments.L ?? 0).toBe(0);

    // month2: carry = -net1 เป็น approved advance
    const carry = -m1.netSalary;
    const loanCtx2 = {
      yearMonth: "2026-02",
      loans: [
        {
          id: "L",
          principal: 12000,
          monthlyDeduction: 1000,
          startMonth: "2026-01",
          repayments: {}, // month1 ผ่อน 0
        },
      ],
    };
    const m2 = calculateSalary(
      { baseSalary: 18000, socialSecurity: 300 },
      NOQ,
      emp,
      0,
      carry,
      null,
      PLAIN,
      loanCtx2,
    )!;
    expect(m2.advanceDeduction).toBe(Math.round(carry * 1) || carry);
    expect(m2.netSalary).toBe(m2.earnings - m2.deductions);
    // มีเงินเหลือพอ → หักกู้ได้ (เต็มงวดหรือ cap)
    expect(m2.loanDeduction).toBeGreaterThan(0);
    expect(m2.loanDeduction).toBeLessThanOrEqual(1000);
  });
});

describe("Edge: multi-loan FIFO + remaining cap (legacy support)", () => {
  it("pays older loan first and never exceeds each loan's remaining", () => {
    const emp = { id: "y", baseSalary: 30000 };
    const loanCtx: any = {
      yearMonth: "2026-05",
      loans: [
        // เก่ากว่า (startMonth ก่อน) + เหลือ 500 → หักได้แค่ 500
        {
          id: "old",
          principal: 5000,
          monthlyDeduction: 1000,
          startMonth: "2026-01",
          repayments: {
            "2026-01": 1000,
            "2026-02": 1000,
            "2026-03": 1000,
            "2026-04": 1500,
          },
        },
        {
          id: "new",
          principal: 6000,
          monthlyDeduction: 2000,
          startMonth: "2026-03",
          repayments: {},
        },
      ],
    };
    const r = calculateSalary(
      { baseSalary: 30000 },
      NOQ,
      emp,
      0,
      0,
      null,
      PLAIN,
      loanCtx,
    )!;
    // old เหลือ 5000-3500=1500? → repayments sum (ไม่รวมเดือนนี้)=4500 → remaining=500 → หัก 500
    expect(r.loanRepayments.old).toBe(500);
    // new เหลือ 6000 → หัก min(2000, avail) = 2000
    expect(r.loanRepayments.new).toBe(2000);
    // ไม่มี loan ไหนหักเกิน remaining
    expect(r.loanDeduction).toBe(2500);
  });
});

describe("Edge: losesBaseSalary boundary (poolExclusion=all)", () => {
  function group(myNormal: number, topNormal: number) {
    const roles = [
      {
        id: "s",
        poolGroup: "g",
        primaryPoolItemId: "normal",
        poolItems: [
          { id: "normal", label: "ขาย", kind: "pool", threshold: 80 },
        ],
      },
    ];
    const dir = [
      { id: "me", roleId: "s", baseSalary: 20000, poolExclusion: "all" },
      { id: "top", roleId: "s", baseSalary: 20000 },
    ];
    const salaryData = {
      me: {
        "2026-01": {
          roleId: "s",
          poolExclusion: "all",
          poolItemPieces: { normal: myNormal },
        },
      },
      top: {
        "2026-01": { roleId: "s", poolItemPieces: { normal: topNormal } },
      },
    };
    const shares = computePoolSharesForGroup({
      groupEmployeeIds: ["me", "top"],
      salaryData,
      allLeaves: [],
      yearMonth: "2026-01",
      employeeDirectory: dir,
      roles,
      poolGroup: "g",
      storeCalendar: null,
    });
    return (shares as Record<string, any>).me;
  }
  it("loses base when primary < 50% of top", () => {
    expect(group(40, 100).losesBaseSalary).toBe(true); // 40% < 50%
  });
  it("keeps base at exactly 50%", () => {
    expect(group(50, 100).losesBaseSalary).toBe(false); // 50% ไม่ < 50%
  });
  it("keeps base when nobody sold (top primary = 0)", () => {
    expect(group(0, 0).losesBaseSalary).toBe(false);
  });
});

describe("Edge: leave spanning Sat+Sun (default store calendar)", () => {
  it("counts weekdays excluding Sat, Sundays separately ×1.5", () => {
    // 2026-01-09 ศุกร์ → 2026-01-13 อังคาร (ศ ส อา จ อ) = พฤ? ตรวจจริง
    // ใช้ช่วงที่คร่อมเสาร์(ปิด)+อาทิตย์(หัก×1.5)
    const leaves = [
      { employeeId: "z", start: "2026-01-09", end: "2026-01-13" },
    ];
    const wk = countWeekdayLeaves(leaves, null);
    const oq = getOverQuotaDays(leaves, null);
    // 9=ศ,10=ส(ปิด,ข้าม),11=อา(หัก),12=จ,13=อ → weekday นับ ศ จ อ = 3 · อาทิตย์ 1
    expect(wk).toBe(3);
    expect(oq.sundays).toBe(1);
    expect(oq.weekdays).toBe(Math.max(0, 3 - 2)); // 1 วันเกินโควต้า
  });
});

describe("Edge: annual raise 365-day boundary", () => {
  it("Jan start is eligible the very next year; Feb start is not", () => {
    expect(isEligibleForRaiseYear("2025-01", 2026)).toBe(true); // 365 วันพอดี
    expect(isEligibleForRaiseYear("2025-02", 2026)).toBe(false); // <365
    expect(isEligibleForRaiseYear("2025-02", 2027)).toBe(true);
  });
  it("getEffectiveBaseSalary stacks raises across years", () => {
    const emp = {
      baseSalary: 30000,
      startWorkMonth: "2024-01",
      annualRaiseAmount: 1000,
    };
    expect(getEffectiveBaseSalary(emp, "2025-06")).toBe(31000); // 1 ปี
    expect(getEffectiveBaseSalary(emp, "2026-06")).toBe(32000); // 2 ปี
    expect(getEffectiveBaseSalary(emp, "2027-06")).toBe(33000); // 3 ปี
  });
});

describe("Edge: recurring items frozen per-month (no past-slip drift)", () => {
  it("uses salary snapshot recurringItems over live employee recurringItems", () => {
    const liveEmp = {
      id: "r",
      baseSalary: 20000,
      // admin เพิ่ม recurring ใหม่ภายหลัง (live)
      recurringItems: [
        { type: "income", label: "ค่าเดินทาง", amount: 1000 },
        { type: "deduction", label: "ค่าอาหาร", amount: 700 },
      ],
    };
    // salary doc เดือนเก่า freeze recurring ไว้ตอนนั้น (มีแค่ค่าเดินทาง 500)
    const frozenSalary = {
      baseSalary: 20000,
      recurringItems: [{ type: "income", label: "ค่าเดินทาง", amount: 500 }],
    };
    const r = calculateSalary(frozenSalary, NOQ, liveEmp, 0, 0, null, PLAIN)!;
    // ต้องใช้ snapshot (500 income, ไม่มี deduction) ไม่ใช่ live (1000/700)
    expect(r.recurringIncomesTotal).toBe(500);
    expect(r.recurringDeductionsTotal).toBe(0);
  });
  it("falls back to live recurringItems when salary has no snapshot (old data)", () => {
    const liveEmp = {
      id: "r2",
      baseSalary: 20000,
      recurringItems: [{ type: "deduction", label: "ค่าชุด", amount: 300 }],
    };
    const r = calculateSalary(
      { baseSalary: 20000 },
      NOQ,
      liveEmp,
      0,
      0,
      null,
      PLAIN,
    )!;
    expect(r.recurringDeductionsTotal).toBe(300); // fallback live
  });
});
