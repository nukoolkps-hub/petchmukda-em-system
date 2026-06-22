/* ─── Simulation: mid-year role changes + multiple pool groups ──────
   จำลองเคสยากเพิ่ม:
   - เปลี่ยนตำแหน่งกลางปี (ออกจาก pool / เข้า pool ใหม่) — snapshot roleId ต่อเดือน
   - หลาย pool group พร้อมกัน (gold / silver) — ต้องแยกกอง ไม่ปนกัน
   assert: conservation ต่อกอง · isolation ข้ามกอง · commission ถูกตามตำแหน่ง
   ของเดือนนั้น · net=earnings−deductions · ไม่มี NaN                            */
import { describe, expect, it } from "vitest";
import { computeMonthSummary } from "./payrollCompute";

const MONTHS = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
);
const EPS = 1e-3;

const ROLES = [
  {
    id: "gold",
    poolGroup: "gold",
    primaryPoolItemId: "goldN",
    poolItems: [
      { id: "goldN", label: "ขายทอง", kind: "pool", threshold: 80 },
      { id: "goldB", label: "รับซื้อทอง", kind: "pool", threshold: 80 },
    ],
  },
  {
    id: "silver",
    poolGroup: "silver",
    primaryPoolItemId: "silverN",
    poolItems: [
      { id: "silverN", label: "ขายเงิน", kind: "pool", threshold: 80 },
    ],
  },
  { id: "staff" },
];

// role timeline ต่อพนักงาน (เปลี่ยนตำแหน่งกลางปี)
// m1: gold (ม.ค.-มิ.ย.) → staff (ก.ค.-ธ.ค.) = ออกจาก pool
// m2: staff (ม.ค.-มิ.ย.) → silver (ก.ค.-ธ.ค.) = เข้า pool ใหม่
function roleForMonth(empId: string, ym: string): string {
  const mo = Number(ym.slice(5, 7));
  if (empId === "m1") return mo <= 6 ? "gold" : "staff";
  if (empId === "m2") return mo <= 6 ? "staff" : "silver";
  const base: Record<string, string> = {
    g1: "gold",
    g2: "gold",
    g3: "gold",
    s1: "silver",
    s2: "silver",
  };
  return base[empId] ?? "staff";
}

const EMP_IDS = ["g1", "g2", "g3", "s1", "s2", "m1", "m2"];
const BASE: Record<string, number> = {
  g1: 30000,
  g2: 28000,
  g3: 26000,
  s1: 24000,
  s2: 23000,
  m1: 25000,
  m2: 22000,
};
const RATES = { goldN: 12, goldB: 8, silverN: 10 };

const EMPLOYEES = EMP_IDS.map((id) => ({
  id,
  name: id,
  nickname: id,
  roleId: roleForMonth(id, "2026-12"), // live = ตำแหน่งล่าสุด
  baseSalary: BASE[id],
  poolItemRates: RATES,
  socialSecurity: 750,
}));

function buildSalaryData(ym: string, idx: number) {
  const sd: Record<string, any> = {};
  EMP_IDS.forEach((id) => {
    const role = roleForMonth(id, ym);
    const doc: any = {
      roleId: role, // snapshot ตำแหน่งของเดือนนั้น
      baseSalary: BASE[id],
      poolExclusion: null,
      salaryDisabled: false,
      socialSecurity: 750,
      poolItemRates: RATES,
    };
    if (role === "gold") {
      const f = id === "g1" ? 100 : id === "g2" ? 90 : id === "g3" ? 85 : 95;
      doc.poolItemPieces = { goldN: f + idx, goldB: Math.round(f / 3) + idx };
    } else if (role === "silver") {
      const f = id === "s1" ? 80 : id === "s2" ? 75 : 88;
      doc.poolItemPieces = { silverN: f + idx };
    }
    sd[id] = { [ym]: doc };
  });
  return sd;
}

function isFiniteNum(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}

describe("Mid-year role change + multiple pool groups", () => {
  it("keeps each pool group conserved & isolated, commission follows the month's role", () => {
    MONTHS.forEach((ym, mIdx) => {
      const idx = mIdx + 1;
      const salaryData = buildSalaryData(ym, idx);
      const summary = computeMonthSummary({
        activeEmployees: EMPLOYEES,
        yearMonth: ym,
        salaryData,
        allLeaves: [],
        employeeDirectory: EMPLOYEES,
        roles: ROLES,
        employeeLoans: [],
        monthApprovedAdvances: [],
        poolAdjustment: null,
        storeCalendar: null,
      });

      // total == sum net · ไม่มี NaN
      const sumNet = summary.rows.reduce(
        (s, r) => s + r.salaryCalculation.netSalary,
        0,
      );
      expect(Math.abs(summary.total - sumNet)).toBeLessThan(1e-6);
      summary.rows.forEach((r) => {
        expect(isFiniteNum(r.salaryCalculation.netSalary)).toBe(true);
        expect(
          Math.abs(
            r.salaryCalculation.netSalary -
              (r.salaryCalculation.earnings - r.salaryCalculation.deductions),
          ),
        ).toBeLessThan(1e-6);
      });

      // ── conservation + isolation ต่อกอง ──
      const goldGross: Record<string, number> = {};
      const silverGross: Record<string, number> = {};
      const goldAlloc: Record<string, number> = {};
      const silverAlloc: Record<string, number> = {};
      summary.rows.forEach((r) => {
        const ps = r.poolShare;
        if (!ps?.poolItems) return;
        for (const item of ps.poolItems) {
          if (item.kind !== "pool") continue;
          const sh = ps.itemShares?.[item.id];
          if (item.id.startsWith("gold")) {
            goldGross[item.id] = ps.grossItemPool[item.id] ?? 0;
            goldAlloc[item.id] =
              (goldAlloc[item.id] ?? 0) + (sh?.allocatedPieces ?? 0);
          } else if (item.id.startsWith("silver")) {
            silverGross[item.id] = ps.grossItemPool[item.id] ?? 0;
            silverAlloc[item.id] =
              (silverAlloc[item.id] ?? 0) + (sh?.allocatedPieces ?? 0);
          }
        }
      });
      // gold conserved
      for (const itemId of Object.keys(goldGross)) {
        expect(
          Math.abs(goldAlloc[itemId] - goldGross[itemId]),
          `gold ${itemId} conserve ${ym}`,
        ).toBeLessThan(EPS);
      }
      // silver conserved
      for (const itemId of Object.keys(silverGross)) {
        expect(
          Math.abs(silverAlloc[itemId] - silverGross[itemId]),
          `silver ${itemId} conserve ${ym}`,
        ).toBeLessThan(EPS);
      }
      // isolation: gold ไม่มี silver item และกลับกัน (คนละ poolItems)
      summary.rows.forEach((r) => {
        const role = r.employeeRole?.id;
        if (role === "gold") {
          expect(r.poolShare.itemShares.silverN).toBeUndefined();
        }
        if (role === "silver") {
          expect(r.poolShare.itemShares.goldN).toBeUndefined();
        }
      });

      // ── commission ตามตำแหน่งของเดือน ──
      const mo = idx;
      const m1 = summary.rows.find((r) => r.employee.id === "m1")!;
      const m1comm = (m1.salaryCalculation.poolItemsBreakdown ?? []).reduce(
        (s: number, b: any) => s + b.amount,
        0,
      );
      if (mo <= 6) {
        // m1 อยู่ gold → ได้ค่าคอม (มีชิ้น + eligible)
        expect(m1.employeeRole.id).toBe("gold");
        expect(m1comm).toBeGreaterThan(0);
      } else {
        // m1 ย้ายเป็น staff → ไม่มีค่าคอม
        expect(m1.employeeRole.id).toBe("staff");
        expect(m1comm).toBe(0);
        expect(m1.poolShare ?? null).toBeNull();
      }

      const m2 = summary.rows.find((r) => r.employee.id === "m2")!;
      const m2comm = (m2.salaryCalculation.poolItemsBreakdown ?? []).reduce(
        (s: number, b: any) => s + b.amount,
        0,
      );
      if (mo <= 6) {
        expect(m2.employeeRole.id).toBe("staff");
        expect(m2comm).toBe(0);
      } else {
        expect(m2.employeeRole.id).toBe("silver");
        expect(m2comm).toBeGreaterThan(0);
      }
    });
  });

  it("gold pool grows/shrinks correctly as m1 joins(<=Jun)/leaves(>=Jul)", () => {
    // มิ.ย. (m1 ยังอยู่ gold) → gold มี 4 คน · ก.ค. (m1 ออก) → gold 3 คน
    const jun = computeMonthSummary({
      activeEmployees: EMPLOYEES,
      yearMonth: "2026-06",
      salaryData: buildSalaryData("2026-06", 6),
      allLeaves: [],
      employeeDirectory: EMPLOYEES,
      roles: ROLES,
      employeeLoans: [],
      monthApprovedAdvances: [],
      poolAdjustment: null,
      storeCalendar: null,
    });
    const jul = computeMonthSummary({
      activeEmployees: EMPLOYEES,
      yearMonth: "2026-07",
      salaryData: buildSalaryData("2026-07", 7),
      allLeaves: [],
      employeeDirectory: EMPLOYEES,
      roles: ROLES,
      employeeLoans: [],
      monthApprovedAdvances: [],
      poolAdjustment: null,
      storeCalendar: null,
    });
    const junGoldCount = jun.rows.find((r) => r.employee.id === "g1")!.poolShare
      .eligibleCountByItemId.goldN;
    const julGoldCount = jul.rows.find((r) => r.employee.id === "g1")!.poolShare
      .eligibleCountByItemId.goldN;
    // มิ.ย. รวม m1 = 4 eligible · ก.ค. ไม่มี m1 = 3 eligible
    expect(junGoldCount).toBe(4);
    expect(julGoldCount).toBe(3);
  });
});

describe("Config edge: two roles sharing one poolGroup with DIFFERENT items", () => {
  it("documents behavior — group resolves poolItems from one role only", () => {
    // admin ตั้งผิด: 2 role ใช้ poolGroup เดียวกันแต่ poolItems ต่างกัน
    const roles = [
      {
        id: "rA",
        poolGroup: "mix",
        primaryPoolItemId: "a",
        poolItems: [{ id: "a", label: "A", kind: "pool", threshold: 80 }],
      },
      {
        id: "rB",
        poolGroup: "mix",
        primaryPoolItemId: "b",
        poolItems: [{ id: "b", label: "B", kind: "pool", threshold: 80 }],
      },
    ];
    const dir = [
      {
        id: "u1",
        roleId: "rA",
        baseSalary: 20000,
        poolItemRates: { a: 10, b: 5 },
      },
      {
        id: "u2",
        roleId: "rB",
        baseSalary: 20000,
        poolItemRates: { a: 10, b: 5 },
      },
    ];
    const sd = {
      u1: {
        "2026-01": {
          roleId: "rA",
          poolItemPieces: { a: 100 },
          poolItemRates: { a: 10, b: 5 },
        },
      },
      u2: {
        "2026-01": {
          roleId: "rB",
          poolItemPieces: { b: 100 },
          poolItemRates: { a: 10, b: 5 },
        },
      },
    };
    const summary = computeMonthSummary({
      activeEmployees: dir,
      yearMonth: "2026-01",
      salaryData: sd,
      allLeaves: [],
      employeeDirectory: dir,
      roles,
      employeeLoans: [],
      monthApprovedAdvances: [],
      poolAdjustment: null,
      storeCalendar: null,
    });
    // ทั้งกลุ่มใช้ poolItems ของ role แรกที่เจอ (rA → item "a") · u2's "b" pieces
    // ไม่ถูกนับ (config ผิด) — ยืนยันว่าไม่ crash + ไม่มี NaN (พฤติกรรมที่เป็นอยู่)
    summary.rows.forEach((r) => {
      expect(Number.isFinite(r.salaryCalculation.netSalary)).toBe(true);
    });
    // net ทั้งคู่ยังคำนวณได้ (ไม่ throw)
    expect(summary.rows).toHaveLength(2);
  });
});

import { calculateSalary } from "./salaryUtils";
/* ─── On-screen numbers: slip rows must sum to net (HTML/PDF/modal) ── */
import { applyHiddenFilter, buildSlipRowsCatalog } from "./slipRows";

describe("Slip display: earn − ded == net (incl custom pool item, recurring, custom)", () => {
  const poolRoleCustom = {
    id: "jewel",
    poolGroup: "jewel",
    primaryPoolItemId: "normal",
    poolItems: [
      { id: "normal", label: "ขายทั่วไป", kind: "pool", threshold: 80 },
      { id: "diamond", label: "ขายเพชร", kind: "personal", threshold: 80 }, // custom
      { id: "buy", label: "รับซื้อ", kind: "pool", threshold: 80 },
    ],
    bonusItems: [{ id: "invite", label: "เชิญบัตร" }],
  };

  function rowFor(opts: {
    role: any;
    salary: any;
    rates: any;
    poolShare?: any;
    advance?: number;
    loanCtx?: any;
  }) {
    const calc = calculateSalary(
      opts.salary,
      { weekdays: 1, sundays: 1 }, // มี over-quota + อาทิตย์
      opts.rates,
      3,
      opts.advance ?? 0,
      opts.poolShare ?? null,
      opts.role,
      opts.loanCtx ?? null,
    )!;
    const cat = buildSlipRowsCatalog({
      data: opts.salary,
      salaryCalculation: calc,
      employeeRole: opts.role,
    });
    return { calc, cat };
  }

  it("pool role with a custom item: slip rows reconcile to net", () => {
    // poolShare แบบ pool item (normal/buy) + personal (diamond)
    const poolShare = {
      poolItems: poolRoleCustom.poolItems,
      itemShares: {
        normal: { allocatedPieces: 50, eligible: true, kind: "pool" },
        diamond: { allocatedPieces: 20, eligible: true, kind: "personal" },
        buy: { allocatedPieces: 30, eligible: true, kind: "pool" },
      },
      losesBaseSalary: false,
    };
    const rates = {
      poolItemRates: { normal: 12, diamond: 25, buy: 8 },
      bonusRates: { invite: 50 },
      socialSecurity: 750,
    };
    const salary = {
      baseSalary: 30000,
      poolItemRates: rates.poolItemRates,
      bonusRates: rates.bonusRates,
      bonusCounts: { invite: 2 },
      socialSecurity: 750,
      customEarnings: [{ label: "โบนัสพิเศษ", amount: 1500 }],
      customDeductions: [{ label: "ของเสีย", amount: 200 }],
      recurringItems: [
        { type: "income", label: "ค่าเดินทาง", amount: 800 },
        { type: "deduction", label: "ค่าชุด", amount: 300 },
      ],
      coveragePay: 600,
    };
    const { calc, cat } = rowFor({
      role: poolRoleCustom,
      salary,
      rates,
      poolShare,
    });
    const earn = cat.earnRows.reduce((s, r) => s + r.value, 0);
    const ded = cat.dedRows.reduce((s, r) => s + r.value, 0);
    expect(earn).toBe(calc.earnings);
    expect(ded).toBe(calc.deductions);
    expect(earn - ded).toBe(calc.netSalary);
    // custom item "ขายเพชร" ต้องโผล่ในสลิป
    expect(cat.earnRows.some((r) => r.id === "pool:diamond")).toBe(true);
  });

  it("multi-piece role: slip rows reconcile to net", () => {
    const role = {
      id: "acct",
      pieceItems: [
        { id: "bill", label: "ทำบิล" },
        { id: "count", label: "นับสต๊อก" },
      ],
    };
    const rates = { pieceRates: { bill: 5, count: 3 }, socialSecurity: 450 };
    const salary = {
      baseSalary: 22000,
      pieceRates: rates.pieceRates,
      piecePieces: { bill: 40, count: 12 },
      socialSecurity: 450,
    };
    const { calc, cat } = rowFor({ role, salary, rates });
    const earn = cat.earnRows.reduce((s, r) => s + r.value, 0);
    const ded = cat.dedRows.reduce((s, r) => s + r.value, 0);
    expect(earn - ded).toBe(calc.netSalary);
  });

  it("no-commission role + loan + advance: slip rows reconcile to net", () => {
    const role = { id: "staff" };
    const rates = { socialSecurity: 300 };
    const salary = { baseSalary: 18000, socialSecurity: 300 };
    const loanCtx = {
      yearMonth: "2026-03",
      loans: [
        {
          id: "L",
          principal: 5000,
          monthlyDeduction: 1000,
          startMonth: "2026-01",
          repayments: {},
        },
      ],
    };
    const { calc, cat } = rowFor({
      role,
      salary,
      rates,
      advance: 2000,
      loanCtx,
    });
    const earn = cat.earnRows.reduce((s, r) => s + r.value, 0);
    const ded = cat.dedRows.reduce((s, r) => s + r.value, 0);
    expect(earn - ded).toBe(calc.netSalary);
    expect(cat.dedRows.some((r) => r.id === "loan")).toBe(true);
    expect(cat.dedRows.some((r) => r.id === "advance")).toBe(true);
  });

  it("partial slip (hidden rows → 'อื่นๆ') conserves the displayed total", () => {
    const role = { id: "staff" };
    const rates = { socialSecurity: 300 };
    const salary = {
      baseSalary: 18000,
      socialSecurity: 300,
      customEarnings: [{ label: "โบนัส", amount: 1000 }],
      recurringItems: [{ type: "income", label: "ค่าเดินทาง", amount: 500 }],
    };
    const { cat } = rowFor({ role, salary, rates });
    const fullEarn = cat.earnRows.reduce((s, r) => s + r.value, 0);
    // ซ่อนบางแถว → ต้องมี "รายรับอื่นๆ" รวมยอดที่ซ่อน → total เท่าเดิม
    const hidden = new Set(["attendance", "recurring-earn:0"]);
    const visible = applyHiddenFilter(cat.earnRows, hidden, "รายรับอื่นๆ");
    const visSum = visible.reduce((s, r) => s + r.value, 0);
    expect(visSum).toBe(fullEarn);
    expect(visible.some((r) => r.id === "__other__")).toBe(true);
  });
});
