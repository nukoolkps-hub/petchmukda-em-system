import { describe, expect, it } from "vitest";
import { computePoolSharesForGroup } from "./salaryUtils";

// Default pool role → items: normal(pool), special(personal), buy(pool), each threshold 80%.
const ROLE = { id: "sales", poolGroup: "sales" };
const YM = "2026-06";

interface EmpSpec {
  id: string;
  pieces?: { normal?: number; special?: number; buy?: number };
  totalLeaveDays?: number;
  poolExclusion?: unknown;
  salaryDisabled?: boolean;
}

function pool(
  employees: EmpSpec[],
  opts: { adjustment?: any; role?: any } = {},
) {
  const role = opts.role ?? ROLE;
  const salaryData: Record<string, any> = {};
  const employeeDirectory: any[] = [];
  const groupEmployeeIds: string[] = [];
  for (const e of employees) {
    groupEmployeeIds.push(e.id);
    employeeDirectory.push({ id: e.id, roleId: role.id });
    const doc: any = { roleId: role.id };
    if (e.pieces?.normal != null) doc.normalSalePieces = e.pieces.normal;
    if (e.pieces?.special != null) doc.specialSalePieces = e.pieces.special;
    if (e.pieces?.buy != null) doc.buyPieces = e.pieces.buy;
    if (e.totalLeaveDays != null) doc.totalLeaveDays = e.totalLeaveDays;
    if (e.poolExclusion !== undefined) doc.poolExclusion = e.poolExclusion;
    if (e.salaryDisabled != null) doc.salaryDisabled = e.salaryDisabled;
    salaryData[e.id] = { [YM]: doc };
  }
  return computePoolSharesForGroup({
    groupEmployeeIds,
    salaryData,
    allLeaves: [],
    yearMonth: YM,
    employeeDirectory,
    roles: [role],
    poolAdjustment: opts.adjustment ?? null,
    poolGroup: role.poolGroup,
  }) as Record<string, any>;
}

describe("computePoolSharesForGroup — guards", () => {
  it("returns {} for an empty group", () => {
    expect(
      computePoolSharesForGroup({
        groupEmployeeIds: [],
        salaryData: {},
        allLeaves: [],
        yearMonth: YM,
        employeeDirectory: [],
        roles: [ROLE],
      }),
    ).toEqual({});
  });

  it("excludes salary-disabled employees (snapshot wins) and returns {} if all disabled", () => {
    const all = pool([
      { id: "A", pieces: { normal: 100 }, salaryDisabled: true },
      { id: "B", pieces: { normal: 100 }, salaryDisabled: true },
    ]);
    expect(all).toEqual({});

    const some = pool([
      { id: "A", pieces: { normal: 100 } },
      { id: "B", pieces: { normal: 100 }, salaryDisabled: true },
    ]);
    expect(Object.keys(some)).toEqual(["A"]);
    // sole active employee takes the whole normal pool
    expect(some.A.itemShares.normal.allocatedPieces).toBeCloseTo(100, 6);
  });
});

describe("computePoolSharesForGroup — equal split, no leave", () => {
  it("splits a pool item 50/50 between two equal earners", () => {
    const r = pool([
      { id: "A", pieces: { normal: 100 } },
      { id: "B", pieces: { normal: 100 } },
    ]);
    expect(r.A.itemShares.normal.finalSharePercent).toBeCloseTo(50, 6);
    expect(r.A.itemShares.normal.allocatedPieces).toBeCloseTo(100, 6); // 50% of 200
    expect(r.B.itemShares.normal.allocatedPieces).toBeCloseTo(100, 6);
    // legacy aggregate mirror
    expect(r.A.normalSalePieces).toBeCloseTo(100, 6);
    expect(r.A.eligibleForSellPool).toBe(true);
  });
});

describe("computePoolSharesForGroup — leave deduction & redistribution", () => {
  it("redistributes a leaver's lost share to the present coworker", () => {
    const r = pool([
      { id: "A", pieces: { normal: 100 }, totalLeaveDays: 5 },
      { id: "B", pieces: { normal: 100 }, totalLeaveDays: 0 },
    ]);
    // effectiveLeave A = 5-2 = 3; factor = 50/30; deduction = 3×(50/30)×1 = 5%
    // A: 50 - 5 = 45% → 90 pieces; B: 50 + 5 = 55% → 110 pieces
    expect(r.A.itemShares.normal.finalSharePercent).toBeCloseTo(45, 6);
    expect(r.A.itemShares.normal.allocatedPieces).toBeCloseTo(90, 6);
    expect(r.B.itemShares.normal.finalSharePercent).toBeCloseTo(55, 6);
    expect(r.B.itemShares.normal.allocatedPieces).toBeCloseTo(110, 6);
    // pool is conserved
    expect(
      r.A.itemShares.normal.allocatedPieces +
        r.B.itemShares.normal.allocatedPieces,
    ).toBeCloseTo(200, 6);
  });

  it("gives the first 2 leave days for free (no deduction)", () => {
    const r = pool([
      { id: "A", pieces: { normal: 100 }, totalLeaveDays: 2 },
      { id: "B", pieces: { normal: 100 }, totalLeaveDays: 0 },
    ]);
    expect(r.A.itemShares.normal.finalSharePercent).toBeCloseTo(50, 6);
  });
});

describe("computePoolSharesForGroup — 80% threshold eligibility", () => {
  it("excludes an under-threshold earner and gives the pool to the rest", () => {
    const r = pool([
      { id: "A", pieces: { normal: 100 } },
      { id: "B", pieces: { normal: 50 } }, // 50 < 80% of 100 → out
    ]);
    expect(r.B.eligibleForSellPool).toBe(false);
    expect(r.B.itemShares.normal.eligible).toBe(false);
    expect(r.B.itemShares.normal.allocatedPieces).toBe(0);
    // A is the only eligible member → takes the whole gross pool (150)
    expect(r.A.itemShares.normal.finalSharePercent).toBeCloseTo(100, 6);
    expect(r.A.itemShares.normal.allocatedPieces).toBeCloseTo(150, 6);
  });

  it("keeps an earner exactly at the 80% boundary", () => {
    const r = pool([
      { id: "A", pieces: { normal: 100 } },
      { id: "B", pieces: { normal: 80 } }, // exactly 80% → eligible
    ]);
    expect(r.B.eligibleForSellPool).toBe(true);
  });
});

describe("computePoolSharesForGroup — personal items", () => {
  it("pays a personal item to its own earner at 100% with no leave deduction", () => {
    const r = pool([
      { id: "A", pieces: { special: 30 }, totalLeaveDays: 10 },
      { id: "B", pieces: { special: 0 } },
    ]);
    expect(r.A.itemShares.special.kind).toBe("personal");
    expect(r.A.itemShares.special.finalSharePercent).toBe(100);
    expect(r.A.itemShares.special.allocatedPieces).toBe(30);
  });

  it("honors poolExclusion='all' for a personal item (no commission)", () => {
    const r = pool([
      { id: "A", pieces: { special: 30 }, poolExclusion: "all" },
      { id: "B", pieces: { normal: 100 } },
    ]);
    expect(r.A.itemShares.special.eligible).toBe(false);
    expect(r.A.itemShares.special.allocatedPieces).toBe(0);
  });
});

describe("computePoolSharesForGroup — losesBaseSalary", () => {
  it("flags losesBaseSalary when fully excluded AND primary < 50% of top", () => {
    const r = pool([
      { id: "A", pieces: { normal: 10 }, poolExclusion: "all" }, // 10 < 50% of 100
      { id: "B", pieces: { normal: 100 } },
    ]);
    expect(r.A.losesBaseSalary).toBe(true);
    expect(r.B.losesBaseSalary).toBe(false);
  });

  it("does NOT flag it when the excluded earner still clears 50% of top", () => {
    const r = pool([
      { id: "A", pieces: { normal: 60 }, poolExclusion: "all" }, // 60 ≥ 50
      { id: "B", pieces: { normal: 100 } },
    ]);
    expect(r.A.losesBaseSalary).toBe(false);
  });
});

describe("computePoolSharesForGroup — month-level pool adjustment", () => {
  it("removes admin-excluded pieces from the pool before splitting", () => {
    const r = pool(
      [
        { id: "A", pieces: { normal: 100 } },
        { id: "B", pieces: { normal: 100 } },
      ],
      {
        adjustment: {
          items: [
            {
              poolGroup: "sales",
              side: "normal",
              pieces: 50,
              label: "ทองแท่ง MD",
            },
          ],
        },
      },
    );
    // gross 200 − 50 adjustment = 150 split 50/50 → 75 each
    expect(r.A.excludedNormalPieces).toBe(50);
    expect(r.A.itemShares.normal.allocatedPieces).toBeCloseTo(75, 6);
    expect(r.B.itemShares.normal.allocatedPieces).toBeCloseTo(75, 6);
  });

  it("ignores adjustments targeting a different pool group", () => {
    const r = pool(
      [
        { id: "A", pieces: { normal: 100 } },
        { id: "B", pieces: { normal: 100 } },
      ],
      {
        adjustment: {
          items: [
            {
              poolGroup: "other-group",
              side: "normal",
              pieces: 50,
              label: "x",
            },
          ],
        },
      },
    );
    expect(r.A.excludedNormalPieces).toBe(0);
    expect(r.A.itemShares.normal.allocatedPieces).toBeCloseTo(100, 6);
  });
});
