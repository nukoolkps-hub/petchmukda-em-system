import { describe, expect, it, vi } from "vitest";
import {
  buildLoanContext,
  buildPoolSharesByGroup,
  buildRateFieldsSnapshot,
  computeEmployeeMonthRow,
  groupEmployeesByPool,
  nextMonthOf,
  roleIdForMonth,
  settleEmployeeMonth,
} from "./payrollCompute";

const YM = "2026-03";

describe("roleIdForMonth", () => {
  it("prefers the salary-doc snapshot roleId over the live employee role", () => {
    const emp = { id: "e1", roleId: "live-role" };
    const salaryData = { e1: { [YM]: { roleId: "snap-role" } } };
    expect(roleIdForMonth(emp, YM, salaryData)).toBe("snap-role");
  });
  it("falls back to the live roleId when no snapshot", () => {
    expect(roleIdForMonth({ id: "e1", roleId: "live" }, YM, {})).toBe("live");
  });
});

describe("nextMonthOf", () => {
  it("advances within a year", () => {
    expect(nextMonthOf("2026-03")).toBe("2026-04");
  });
  it("rolls over December → January next year", () => {
    expect(nextMonthOf("2026-12")).toBe("2027-01");
  });
});

describe("buildLoanContext", () => {
  it("keeps only non-cancelled loans of the employee and maps fields", () => {
    const loans = [
      {
        id: "l1",
        employeeId: "e1",
        status: "active",
        monthlyDeduction: 100,
        principal: 1000,
        startMonth: "2026-01",
        repayments: { "2026-01": 100 },
      },
      { id: "l2", employeeId: "e1", status: "cancelled", monthlyDeduction: 50 },
      { id: "l3", employeeId: "e2", status: "active", monthlyDeduction: 50 },
    ];
    const ctx = buildLoanContext(loans, "e1", YM);
    expect(ctx.yearMonth).toBe(YM);
    expect(ctx.loans).toHaveLength(1);
    expect(ctx.loans[0]).toMatchObject({ id: "l1", monthlyDeduction: 100 });
  });
  it("handles undefined loan list", () => {
    expect(buildLoanContext(undefined, "e1", YM).loans).toEqual([]);
  });
});

describe("buildRateFieldsSnapshot", () => {
  it("captures rate fields with safe defaults", () => {
    const snap = buildRateFieldsSnapshot(
      { baseSalary: 30000, poolItemRates: { normal: 5 } },
      YM,
    );
    expect(snap.baseSalary).toBe(30000);
    expect(snap.poolItemRates).toEqual({ normal: 5 });
    expect(snap.normalSalePieceRate).toBe(0);
    expect(snap.pieceRates).toEqual({});
  });
});

describe("groupEmployeesByPool", () => {
  it("groups active employees by their month role's poolGroup", () => {
    const emps = [
      { id: "a", roleId: "sales" },
      { id: "b", roleId: "sales" },
      { id: "c", roleId: "staff" },
    ];
    const roles = [
      { id: "sales", poolGroup: "sales-pool" },
      { id: "staff" }, // no poolGroup
    ];
    const grouped = groupEmployeesByPool(emps, YM, {}, roles);
    expect(grouped).toEqual({ "sales-pool": ["a", "b"] });
  });
});

describe("computeEmployeeMonthRow", () => {
  const baseArgs = {
    yearMonth: YM,
    allLeaves: [],
    roles: [{ id: "staff" }],
    employeeLoans: [],
    monthApprovedAdvances: [],
    poolAdjustment: null,
    storeCalendar: null,
  };

  it("returns null when the employee has no salary doc for the month", () => {
    const row = computeEmployeeMonthRow({
      ...baseArgs,
      employee: { id: "e1", roleId: "staff" },
      salaryData: {},
      employeeDirectory: [{ id: "e1", roleId: "staff" }],
    });
    expect(row).toBeNull();
  });

  it("computes a commission-less row's earnings from base salary", () => {
    const employee = { id: "e1", roleId: "staff", baseSalary: 30000 };
    const row = computeEmployeeMonthRow({
      ...baseArgs,
      employee,
      salaryData: { e1: { [YM]: { baseSalary: 30000 } } },
      employeeDirectory: [employee],
    });
    expect(row).not.toBeNull();
    // base 30000 + attendance bonus (2 × dailyRate, 0 leaves) = 30000 + 2000
    expect(row?.salaryCalculation.baseSalary).toBe(30000);
    expect(row?.salaryCalculation.netSalary).toBe(32000);
    expect(row?.advanceTotal).toBe(0);
  });

  it("filters approved advances to the employee and deducts them", () => {
    const employee = { id: "e1", roleId: "staff", baseSalary: 30000 };
    const row = computeEmployeeMonthRow({
      ...baseArgs,
      employee,
      salaryData: { e1: { [YM]: { baseSalary: 30000 } } },
      employeeDirectory: [employee],
      monthApprovedAdvances: [
        { employeeId: "e1", amount: 5000 },
        { employeeId: "e2", amount: 9999 }, // other employee — ignored
      ],
    });
    expect(row?.advanceTotal).toBe(5000);
    expect(row?.salaryCalculation.advanceDeduction).toBe(5000);
    // 30000 + 2000 attendance − 5000 advance
    expect(row?.salaryCalculation.netSalary).toBe(27000);
  });

  it("derives pool exclusion from salaryData (resettle patches salaryData to control the pool result)", () => {
    const role = {
      id: "sales",
      poolGroup: "p",
      poolItems: [
        { id: "normal", label: "ขาย", kind: "personal", threshold: 80 },
      ],
    };
    const employee = {
      id: "e1",
      roleId: "sales",
      baseSalary: 30000,
      poolItemRates: { normal: 10 },
    };
    // snapshot excludes the 'normal' item → its commission must be 0 ·
    // proves patching salaryData (the resettle fix) controls eligibility, not
    // just the employee's own rate
    const salaryData = {
      e1: {
        [YM]: {
          baseSalary: 30000,
          poolItemRates: { normal: 10 },
          poolItemPieces: { normal: 100 },
          poolExclusion: ["normal"],
        },
      },
    };
    const row = computeEmployeeMonthRow({
      ...baseArgs,
      roles: [role],
      employee,
      salaryData,
      employeeDirectory: [employee],
    });
    const normalRow = row?.salaryCalculation.poolItemsBreakdown.find(
      (b: any) => b.id === "normal",
    );
    expect(normalRow.amount).toBe(0);
  });

  it("honours dataOverride (fresh rate) over the in-memory salaryData snapshot", () => {
    const role = {
      id: "sales",
      poolGroup: "p",
      poolItems: [
        { id: "normal", label: "ขาย", kind: "personal", threshold: 80 },
      ],
    };
    const employee = {
      id: "e1",
      roleId: "sales",
      baseSalary: 30000,
      poolItemRates: { normal: 10 }, // new rate
    };
    // stale snapshot has the OLD rate (5) — dataOverride must win
    const staleDoc = {
      baseSalary: 30000,
      poolItemRates: { normal: 5 },
      poolItemPieces: { normal: 100 },
    };
    const row = computeEmployeeMonthRow({
      ...baseArgs,
      roles: [role],
      employee,
      salaryData: { e1: { [YM]: staleDoc } },
      employeeDirectory: [employee],
      dataOverride: {
        ...staleDoc,
        ...buildRateFieldsSnapshot(employee, YM),
      },
    });
    // personal item: 100 pieces × new rate 10 = 1000 (not 500 from stale rate)
    const normalRow = row?.salaryCalculation.poolItemsBreakdown.find(
      (b: any) => b.id === "normal",
    );
    expect(normalRow.rate).toBe(10);
    expect(normalRow.amount).toBe(1000);
  });
});

describe("settleEmployeeMonth", () => {
  function makeRow(net: number, loanRepayments: Record<string, number> = {}) {
    return {
      employee: { id: "e1", name: "A", nickname: "เอ" },
      employeeRole: null,
      data: {},
      poolShare: null,
      advanceTotal: 0,
      monthApprovedAdvances: [],
      salaryCalculation: { netSalary: net, loanRepayments },
    };
  }

  it("clears the deficit flag and removes auto-carry when net >= 0", async () => {
    const saveNetDenorm = vi.fn().mockResolvedValue(undefined);
    const syncAutoCarry = vi.fn().mockResolvedValue(undefined);
    const recordLoanRepayment = vi.fn().mockResolvedValue(undefined);
    await settleEmployeeMonth(makeRow(5000), YM, [], {
      saveNetDenorm,
      syncAutoCarry,
      recordLoanRepayment,
    });
    expect(saveNetDenorm).toHaveBeenCalledWith("e1", YM, 5000, true);
    expect(syncAutoCarry).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMonth: YM,
        nextMonth: "2026-04",
        employeeId: "e1",
        employeeName: "เอ",
        deficitAmount: 0,
      }),
    );
  });

  it("does not clear the flag and carries the deficit when net < 0", async () => {
    const saveNetDenorm = vi.fn().mockResolvedValue(undefined);
    const syncAutoCarry = vi.fn().mockResolvedValue(undefined);
    await settleEmployeeMonth(makeRow(-1200), YM, [], {
      saveNetDenorm,
      syncAutoCarry,
      recordLoanRepayment: vi.fn().mockResolvedValue(undefined),
    });
    expect(saveNetDenorm).toHaveBeenCalledWith("e1", YM, -1200, false);
    expect(syncAutoCarry).toHaveBeenCalledWith(
      expect.objectContaining({ deficitAmount: 1200 }),
    );
  });

  it("writes loan ledger only when the amount changed", async () => {
    const recordLoanRepayment = vi.fn().mockResolvedValue(undefined);
    const loans = [
      {
        id: "l1",
        employeeId: "e1",
        status: "active",
        repayments: { [YM]: 100 },
      },
      {
        id: "l2",
        employeeId: "e1",
        status: "active",
        repayments: { [YM]: 200 },
      },
    ];
    // l1 changes 100 → 150, l2 stays 200 (skip)
    await settleEmployeeMonth(makeRow(5000, { l1: 150, l2: 200 }), YM, loans, {
      saveNetDenorm: vi.fn().mockResolvedValue(undefined),
      syncAutoCarry: vi.fn().mockResolvedValue(undefined),
      recordLoanRepayment,
    });
    expect(recordLoanRepayment).toHaveBeenCalledTimes(1);
    expect(recordLoanRepayment).toHaveBeenCalledWith("l1", YM, 150);
  });
});

describe("buildPoolSharesByGroup", () => {
  it("returns shares keyed by pool group for active members", () => {
    const role = {
      id: "sales",
      poolGroup: "p",
      poolItems: [{ id: "normal", label: "ขาย", kind: "pool", threshold: 80 }],
      primaryPoolItemId: "normal",
    };
    const emps = [
      { id: "a", roleId: "sales" },
      { id: "b", roleId: "sales" },
    ];
    const salaryData = {
      a: { [YM]: { poolItemPieces: { normal: 100 } } },
      b: { [YM]: { poolItemPieces: { normal: 100 } } },
    };
    const shares = buildPoolSharesByGroup({
      activeEmployees: emps,
      yearMonth: YM,
      salaryData,
      allLeaves: [],
      employeeDirectory: emps,
      roles: [role],
      poolAdjustment: null,
      storeCalendar: null,
    });
    expect(shares.p).toBeDefined();
    expect(shares.p.a).toBeDefined();
    expect(shares.p.b).toBeDefined();
  });
});
