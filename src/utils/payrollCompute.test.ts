import { describe, expect, it, vi } from "vitest";
import {
  buildLoanContext,
  buildPoolSharesByGroup,
  buildRateFieldsSnapshot,
  computeBreakdownSig,
  computeEmployeeMonthRow,
  computeMonthSummary,
  diffCalendarChanges,
  diffLoanFields,
  diffPoolAdjustment,
  diffSalaryCounts,
  diffSalaryFields,
  groupEmployeesByPool,
  loanSummary,
  nextMonthOf,
  roleIdForMonth,
  SALARY_AFFECTING_OBJECT_FIELDS,
  SALARY_AFFECTING_SCALAR_FIELDS,
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

describe("computeBreakdownSig", () => {
  it("is order-independent (sorted by employee id) and rounds net", () => {
    const mk = (id: string, net: number) =>
      ({ employee: { id }, salaryCalculation: { netSalary: net } }) as any;
    const a = computeBreakdownSig([mk("b", 100.4), mk("a", 200.6)]);
    const b = computeBreakdownSig([mk("a", 200.6), mk("b", 100.4)]);
    expect(a).toBe(b);
    expect(a).toBe("a:201|b:100");
  });
});

describe("computeMonthSummary", () => {
  it("sums net across active employees and returns count + sig", () => {
    const emps = [
      { id: "a", roleId: "staff", baseSalary: 30000 },
      { id: "b", roleId: "staff", baseSalary: 30000 },
    ];
    const salaryData = {
      a: { [YM]: { baseSalary: 30000 } },
      b: { [YM]: { baseSalary: 30000 } },
    };
    const s = computeMonthSummary({
      activeEmployees: emps,
      yearMonth: YM,
      salaryData,
      allLeaves: [],
      employeeDirectory: emps,
      roles: [{ id: "staff" }],
      employeeLoans: [],
      monthApprovedAdvances: [],
      poolAdjustment: null,
      storeCalendar: null,
    });
    // each: 30000 base + 2000 attendance = 32000 → total 64000, 2 คน
    expect(s.total).toBe(64000);
    expect(s.count).toBe(2);
    expect(s.breakdownSig).toBe("a:32000|b:32000");
    expect(s.rows).toHaveLength(2);
  });
});

describe("diffSalaryFields", () => {
  it("describes scalar rate changes only when changed", () => {
    const out = diffSalaryFields(
      { baseSalary: 30000, socialSecurity: 750 },
      { baseSalary: 32000, socialSecurity: 750 },
    );
    expect(out).toEqual(["เงินเดือนพื้นฐาน 30,000 → 32,000"]);
  });
  it("describes per-key map changes (poolItemRates) — id fallback when no labels", () => {
    const out = diffSalaryFields(
      { poolItemRates: { normal: 40, buy: 10 } },
      { poolItemRates: { normal: 50, buy: 10 } },
    );
    expect(out).toEqual(["ค่าคอม(normal) 40 → 50"]);
  });
  it("uses the item label when provided (instead of raw id)", () => {
    const out = diffSalaryFields(
      { poolItemRates: { p_123: 12 } },
      { poolItemRates: { p_123: 15 } },
      { poolItemRates: { p_123: "ขายเพชร" } },
    );
    expect(out).toEqual(["ค่าคอมขายเพชร 12 → 15"]);
  });
  it("roleId: โชว์ชื่อตำแหน่งจาก itemLabels (fallback id ดิบถ้าไม่มี map)", () => {
    expect(
      diffSalaryFields(
        { roleId: "r_1" },
        { roleId: "r_2" },
        { roleId: { r_1: "ช่างทอง", r_2: "พนักงานขาย" } },
      ),
    ).toEqual(["ตำแหน่ง: ช่างทอง → พนักงานขาย"]);
    // ไม่มี map → fallback id ดิบ
    expect(diffSalaryFields({ roleId: "r_1" }, { roleId: "r_2" })).toEqual([
      "ตำแหน่ง: r_1 → r_2",
    ]);
  });
  it("describes salaryDisabled toggle", () => {
    expect(diffSalaryFields({}, { salaryDisabled: true })).toEqual([
      "ปิดสิทธิ์เงินเดือน",
    ]);
    expect(
      diffSalaryFields({ salaryDisabled: true }, { salaryDisabled: false }),
    ).toEqual(["เปิดสิทธิ์เงินเดือน"]);
    expect(
      diffSalaryFields({ salaryDisabled: true }, { salaryDisabled: true }),
    ).toEqual([]);
  });
  it("describes recurringItems add/remove/change", () => {
    const before = {
      recurringItems: [
        { id: "a", type: "income", label: "ค่าเดินทาง", amount: 500 },
        { id: "b", type: "deduction", label: "ค่าชุด", amount: 200 },
      ],
    };
    const after = {
      recurringItems: [
        // a: amount changed
        { id: "a", type: "income", label: "ค่าเดินทาง", amount: 800 },
        // b removed
        // c added
        { id: "c", type: "deduction", label: "ค่าอาหาร", amount: 300 },
      ],
    };
    const out = diffSalaryFields(before, after);
    expect(out).toContain('รายรับประจำ "ค่าเดินทาง" 500 → 800 ฿');
    expect(out).toContain('ลบรายการหักประจำ "ค่าชุด"');
    expect(out).toContain('เพิ่มรายการหักประจำ "ค่าอาหาร" 300 ฿');
    expect(out).toHaveLength(3);
  });
  it("describes annualRaises per-year changes", () => {
    const out = diffSalaryFields(
      { annualRaises: { "2025": 1000 } },
      { annualRaises: { "2025": 1000, "2026": 1500 } },
    );
    expect(out).toEqual(["ปรับขึ้นเงินเดือนปี 2026: 0 → 1,500"]);
  });
  it("describes poolExclusion changes (legacy buy → ชื่อไทย)", () => {
    const out = diffSalaryFields(
      { poolExclusion: null },
      { poolExclusion: ["buy"] },
    );
    expect(out).toEqual(["การปิดสิทธิ์กองกลาง: ไม่ปิด → ปิด: รับซื้อ"]);
  });
  it("แปลง id รายการ → ชื่อไทยจาก itemLabels", () => {
    const out = diffSalaryFields(
      { poolExclusion: null },
      { poolExclusion: ["normal"] },
      { poolItemRates: { normal: "ขายทั่วไป" } },
    );
    expect(out).toEqual(["การปิดสิทธิ์กองกลาง: ไม่ปิด → ปิด: ขายทั่วไป"]);
  });
  it('poolExclusion "all" → ปิดกองกลางทั้งหมด · ล้างกลับ → ไม่ปิด', () => {
    expect(
      diffSalaryFields({ poolExclusion: null }, { poolExclusion: "all" }),
    ).toEqual(["การปิดสิทธิ์กองกลาง: ไม่ปิด → ปิดกองกลางทั้งหมด"]);
    expect(
      diffSalaryFields(
        { poolExclusion: ["normal"] },
        { poolExclusion: [] },
        { poolItemRates: { normal: "ขายทั่วไป" } },
      ),
    ).toEqual(["การปิดสิทธิ์กองกลาง: ปิด: ขายทั่วไป → ไม่ปิด"]);
  });
  it("returns empty when nothing relevant changed", () => {
    expect(diffSalaryFields({ baseSalary: 30000 }, { nickname: "x" })).toEqual(
      [],
    );
  });
  it("diffSalaryCounts describes piece/bonus count changes with item labels", () => {
    const out = diffSalaryCounts(
      { poolItemPieces: { p_1: 10 }, bonusCounts: { invite: 1 } },
      { poolItemPieces: { p_1: 12 }, bonusCounts: { invite: 1 } },
      { poolItemPieces: { p_1: "ขายทั่วไป" }, bonusCounts: { invite: "เชิญบัตร" } },
    );
    expect(out).toEqual(["ขายทั่วไป 10 → 12 ชิ้น"]);
  });
  it("diffSalaryCounts falls back to id + uses ครั้ง for bonus", () => {
    const out = diffSalaryCounts(
      { bonusCounts: { invite: 0 } },
      { bonusCounts: { invite: 3 } },
    );
    expect(out).toEqual(["invite 0 → 3 ครั้ง"]);
  });
  it("coerces numeric strings so a string-vs-number no-op is not logged", () => {
    // form may submit baseSalary as a string "30000" while stored is 30000
    expect(
      diffSalaryFields({ baseSalary: 30000 }, { baseSalary: "30000" }),
    ).toEqual([]);
  });
});

/* ─── Guard: trigger list (SALARY_AFFECTING_*) ต้องตรงกับ diffSalaryFields ─────
   ป้องกัน drift — เพิ่ม field ที่กระทบเงินเดือนแล้วลืมสอน diffSalaryFields ให้
   อธิบาย → re-settle ทำงานแต่ changeLog ขึ้นรายการว่าง (ยอดขยับ ไม่มีคำอธิบาย)
   เทสต์นี้ fail ทันทีถ้า:
   - เพิ่ม field ใน canonical list แต่ไม่ใส่ตัวอย่างใน SAMPLE_CHANGED
   - field ใด field หนึ่งเปลี่ยนแล้ว diffSalaryFields คืน array ว่าง            */
describe("diffSalaryFields covers every salary-affecting field", () => {
  // before → fields(after) ที่ทำให้ field นั้น "เปลี่ยน" 1 ตัว (ต้องได้คำอธิบาย ≥ 1)
  const SAMPLE_CHANGED: Record<string, { before: any; after: any }> = {
    baseSalary: { before: { baseSalary: 0 }, after: { baseSalary: 1 } },
    annualRaiseAmount: {
      before: { annualRaiseAmount: 0 },
      after: { annualRaiseAmount: 1 },
    },
    roleId: { before: { roleId: "r_a" }, after: { roleId: "r_b" } },
    salaryDisabled: {
      before: { salaryDisabled: false },
      after: { salaryDisabled: true },
    },
    singlePieceRate: {
      before: { singlePieceRate: 0 },
      after: { singlePieceRate: 1 },
    },
    normalSalePieceRate: {
      before: { normalSalePieceRate: 0 },
      after: { normalSalePieceRate: 1 },
    },
    specialSalePieceRate: {
      before: { specialSalePieceRate: 0 },
      after: { specialSalePieceRate: 1 },
    },
    buyPieceRate: { before: { buyPieceRate: 0 }, after: { buyPieceRate: 1 } },
    invitePieceRate: {
      before: { invitePieceRate: 0 },
      after: { invitePieceRate: 1 },
    },
    transferPieceRate: {
      before: { transferPieceRate: 0 },
      after: { transferPieceRate: 1 },
    },
    socialSecurity: {
      before: { socialSecurity: 0 },
      after: { socialSecurity: 1 },
    },
    annualRaises: {
      before: {},
      after: { annualRaises: { "2026": 1000 } },
    },
    poolExclusion: {
      before: { poolExclusion: null },
      after: { poolExclusion: "all" },
    },
    pieceRates: { before: {}, after: { pieceRates: { x: 1 } } },
    poolItemRates: { before: {}, after: { poolItemRates: { x: 1 } } },
    bonusRates: { before: {}, after: { bonusRates: { x: 1 } } },
    recurringItems: {
      before: {},
      after: {
        recurringItems: [
          { id: "r1", type: "earning", label: "ค่าเดินทาง", amount: 100 },
        ],
      },
    },
  };

  const allFields = [
    ...SALARY_AFFECTING_SCALAR_FIELDS,
    ...SALARY_AFFECTING_OBJECT_FIELDS,
  ];

  it("has a sample for every canonical field (and no stale extras)", () => {
    expect(Object.keys(SAMPLE_CHANGED).sort()).toEqual([...allFields].sort());
  });

  it.each(
    allFields,
  )("produces a non-empty changeLog description for %s", (field) => {
    const sample = SAMPLE_CHANGED[field];
    expect(sample, `missing SAMPLE_CHANGED for ${field}`).toBeDefined();
    const out = diffSalaryFields(sample.before, sample.after);
    expect(out.length, `diffSalaryFields ไม่อธิบาย "${field}"`).toBeGreaterThan(
      0,
    );
  });
});

describe("diffPoolAdjustment", () => {
  it("reports added / removed / changed-pieces items by id with labels", () => {
    const prev = {
      items: [
        { id: "i1", label: "หักค่าเสีย", pieces: 5 },
        { id: "i2", label: "หักของหาย", pieces: 2 },
      ],
    };
    const next = {
      items: [
        { id: "i1", label: "หักค่าเสีย", pieces: 8 }, // changed
        { id: "i3", label: "หักใหม่", pieces: 3 }, // added (i2 removed)
      ],
    };
    expect(diffPoolAdjustment(prev, next)).toEqual([
      'หักกองกลาง "หักค่าเสีย" 5 → 8 ชิ้น',
      'หักกองกลาง: ลบ "หักของหาย" (2 ชิ้น)',
      'หักกองกลาง: เพิ่ม "หักใหม่" 3 ชิ้น',
    ]);
  });
  it("ignores label-only edits (pieces unchanged) and handles null prev", () => {
    expect(
      diffPoolAdjustment(
        { items: [{ id: "i1", label: "เก่า", pieces: 5 }] },
        { items: [{ id: "i1", label: "ใหม่", pieces: 5 }] },
      ),
    ).toEqual([]);
    expect(
      diffPoolAdjustment(null, { items: [{ id: "i1", pieces: 4 }] }),
    ).toEqual(['หักกองกลาง: เพิ่ม "(ไม่ระบุ)" 4 ชิ้น']);
  });
});

describe("diffCalendarChanges", () => {
  it("groups open/close/paid date changes by month", () => {
    const prev = {
      extraOpenSaturdays: ["2026-06-06"],
      paidExtraSaturdays: [],
    };
    const next = {
      extraOpenSaturdays: ["2026-06-13"], // 06-06 removed, 06-13 added
      paidExtraSaturdays: ["2026-06-13"], // added
      extraClosedWeekdays: ["2026-07-01"], // added (different month)
    };
    const out = diffCalendarChanges(prev, next);
    expect(out["2026-06"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("เปิดเสาร์พิเศษ"),
        expect.stringContaining("ยกเลิกเปิดเสาร์พิเศษ"),
        expect.stringContaining("จ่ายเพิ่มเสาร์พิเศษ"),
      ]),
    );
    expect(out["2026-07"]).toEqual([expect.stringContaining("ปิดวันธรรมดาพิเศษ")]);
  });
  it("returns empty object when nothing changed", () => {
    const cal = { extraOpenSaturdays: ["2026-06-06"] };
    expect(diffCalendarChanges(cal, cal)).toEqual({});
  });
});

describe("diffLoanFields / loanSummary", () => {
  it("describes principal / monthly / startMonth / status changes", () => {
    const before = {
      principal: 10000,
      monthlyDeduction: 1000,
      startMonth: "2026-06",
      status: "active",
    };
    expect(
      diffLoanFields(before, {
        principal: 12000,
        monthlyDeduction: 1500,
        startMonth: "2026-07",
        status: "cancelled",
      }),
    ).toEqual([
      "เงินต้น 10,000 → 12,000 ฿",
      "หักต่อเดือน 1,000 → 1,500 ฿",
      "เดือนเริ่มหัก 2026-06 → 2026-07",
      "สถานะเงินกู้ กำลังผ่อน → ยกเลิก",
    ]);
  });
  it("only reports fields present in the patch", () => {
    expect(
      diffLoanFields(
        { principal: 10000, monthlyDeduction: 1000 },
        { monthlyDeduction: 1200 },
      ),
    ).toEqual(["หักต่อเดือน 1,000 → 1,200 ฿"]);
  });
  it("loanSummary formats principal + monthly deduction", () => {
    expect(loanSummary({ principal: 20000, monthlyDeduction: 2500 })).toBe(
      "เงินต้น 20,000 ฿ · หักเดือนละ 2,500 ฿",
    );
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
