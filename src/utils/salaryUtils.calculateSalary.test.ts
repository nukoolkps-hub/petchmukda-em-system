import { describe, expect, it } from "vitest";
import {
  calculateSalary,
  computeExtraOpenSaturdayWorkedDates,
} from "./salaryUtils";

// A commission-less role: base salary + attendance bonus only.
const PLAIN_ROLE = { id: "staff" };
const NO_OVER_QUOTA = { weekdays: 0, sundays: 0 };

// calculateSalary(salary, overQuotaInfo, rates, totalLeaveDays,
//   approvedAdvanceTotal, poolShare, roleConfig, loanContext?, ...)
function calc(
  over = NO_OVER_QUOTA,
  opts: Partial<{
    salary: any;
    rates: any;
    totalLeaveDays: number;
    advance: number;
    poolShare: any;
    role: any;
    loanContext: any;
    pieceExclusions: any;
    extraSat: any;
  }> = {},
) {
  return calculateSalary(
    opts.salary ?? { baseSalary: 30000 },
    over,
    opts.rates ?? {},
    opts.totalLeaveDays ?? 0,
    opts.advance ?? 0,
    opts.poolShare ?? null,
    opts.role ?? PLAIN_ROLE,
    opts.loanContext ?? null,
    opts.pieceExclusions ?? null,
    opts.extraSat ?? null,
  );
}

describe("calculateSalary — basics", () => {
  it("returns null when there is no salary doc", () => {
    expect(
      calculateSalary(null, NO_OVER_QUOTA, {}, 0, 0, null, PLAIN_ROLE),
    ).toBeNull();
  });

  it("pays base salary + attendance bonus for a clean month", () => {
    const r = calc();
    // base 30000, dailyRate 1000, 0 leave → bonus 2×1000 = 2000
    expect(r?.baseSalary).toBe(30000);
    expect(r?.dailySalaryRate).toBe(1000);
    expect(r?.attendanceBonus).toBe(2000);
    expect(r?.earnings).toBe(32000);
    expect(r?.deductions).toBe(0);
    expect(r?.netSalary).toBe(32000);
  });
});

describe("calculateSalary — attendance bonus tiers", () => {
  it("gives 2×dailyRate at 0 leave days", () => {
    expect(calc(NO_OVER_QUOTA, { totalLeaveDays: 0 })?.attendanceBonus).toBe(
      2000,
    );
  });
  it("gives 1×dailyRate at 1 leave day", () => {
    expect(calc(NO_OVER_QUOTA, { totalLeaveDays: 1 })?.attendanceBonus).toBe(
      1000,
    );
  });
  it("gives 0 at 2+ leave days", () => {
    expect(calc(NO_OVER_QUOTA, { totalLeaveDays: 2 })?.attendanceBonus).toBe(0);
    expect(calc(NO_OVER_QUOTA, { totalLeaveDays: 5 })?.attendanceBonus).toBe(0);
  });
});

describe("calculateSalary — over-quota deduction", () => {
  it("charges weekdays ×dailyRate and Sundays ×1.5×dailyRate", () => {
    const r = calc({ weekdays: 3, sundays: 1 }, { totalLeaveDays: 5 });
    // 3×1000 + 1×1000×1.5 = 4500
    expect(r?.overQuotaDeduction).toBe(4500);
    expect(r?.attendanceBonus).toBe(0); // 5 leave days
    expect(r?.netSalary).toBe(30000 - 4500); // earnings 30000, no bonus
  });
});

describe("calculateSalary — losesBaseSalary", () => {
  it("zeroes base salary AND attendance bonus when the pool flags it", () => {
    const r = calc(NO_OVER_QUOTA, {
      poolShare: { losesBaseSalary: true },
    });
    expect(r?.baseSalary).toBe(0);
    expect(r?.attendanceBonus).toBe(0);
    expect(r?.losesBaseSalary).toBe(true);
    expect(r?.earnings).toBe(0);
    expect(r?.netSalary).toBe(0);
  });
});

describe("calculateSalary — deductions", () => {
  it("subtracts advance, social security, custom deductions; adds custom earnings", () => {
    const r = calc(NO_OVER_QUOTA, {
      salary: {
        baseSalary: 30000,
        socialSecurity: 750,
        customEarnings: [{ amount: 500 }],
        customDeductions: [{ amount: 200 }],
      },
      advance: 5000,
    });
    expect(r?.earnings).toBe(30000 + 2000 + 500); // base + bonus + custom earning
    expect(r?.deductions).toBe(5000 + 750 + 200); // advance + ss + custom deduction
    expect(r?.netSalary).toBe(32500 - 5950);
    expect(r?.socialSecurity).toBe(750);
    expect(r?.advanceDeduction).toBe(5000);
  });

  it("includes recurring incomes and deductions from the employee rates", () => {
    const r = calc(NO_OVER_QUOTA, {
      rates: {
        recurringItems: [
          { type: "income", label: "ค่าเดินทาง", amount: 1000 },
          { type: "deduction", label: "ค่าชุด", amount: 300 },
        ],
      },
    });
    expect(r?.recurringIncomesTotal).toBe(1000);
    expect(r?.recurringDeductionsTotal).toBe(300);
    expect(r?.earnings).toBe(30000 + 2000 + 1000);
    expect(r?.netSalary).toBe(33000 - 300);
  });
});

describe("calculateSalary — loan repayment (FIFO, capped at available cash)", () => {
  const loan = (over: any) =>
    calc(over, {
      loanContext: {
        yearMonth: "2026-06",
        loans: [
          {
            id: "l1",
            monthlyDeduction: 3000,
            principal: 10000,
            startMonth: "2026-01",
            repayments: {},
          },
        ],
      },
    });

  it("deducts the monthly amount when cash is available", () => {
    const r = loan(NO_OVER_QUOTA);
    expect(r?.loanDeduction).toBe(3000);
    expect(r?.loanBreakdown).toEqual([{ id: "l1", amount: 3000 }]);
    expect(r?.netSalary).toBe(32000 - 3000);
  });

  it("caps the loan deduction at the cash left after other deductions", () => {
    const r = calc(NO_OVER_QUOTA, {
      advance: 31000, // earnings 32000, so only 1000 left before loan
      loanContext: {
        yearMonth: "2026-06",
        loans: [
          {
            id: "l1",
            monthlyDeduction: 3000,
            principal: 10000,
            startMonth: "2026-01",
            repayments: {},
          },
        ],
      },
    });
    expect(r?.loanDeduction).toBe(1000);
    expect(r?.netSalary).toBe(0);
  });

  it("skips a loan whose start month is after the payroll month", () => {
    const r = calc(NO_OVER_QUOTA, {
      loanContext: {
        yearMonth: "2026-06",
        loans: [
          {
            id: "l1",
            monthlyDeduction: 3000,
            principal: 10000,
            startMonth: "2026-07",
            repayments: {},
          },
        ],
      },
    });
    expect(r?.loanDeduction).toBe(0);
  });

  it("caps the deduction at the remaining balance (idempotent re-confirm)", () => {
    const r = calc(NO_OVER_QUOTA, {
      loanContext: {
        yearMonth: "2026-06",
        loans: [
          {
            id: "l1",
            monthlyDeduction: 3000,
            principal: 10000,
            startMonth: "2026-01",
            // 9000 already repaid in other months → only 1000 remains
            repayments: { "2026-03": 9000 },
          },
        ],
      },
    });
    expect(r?.loanDeduction).toBe(1000);
  });
});

describe("calculateSalary — base salary snapshot vs live fallback", () => {
  it("uses the live effective base when the snapshot has no baseSalary", () => {
    const r = calc(NO_OVER_QUOTA, {
      salary: {}, // no baseSalary snapshot
      rates: { baseSalary: 25000 }, // live (no startWorkMonth → plain)
    });
    expect(r?.baseSalary).toBe(25000);
  });

  it("respects an explicit baseSalary of 0 in the snapshot (no live fallback)", () => {
    const r = calc(NO_OVER_QUOTA, {
      salary: { baseSalary: 0 },
      rates: { baseSalary: 25000 },
    });
    expect(r?.baseSalary).toBe(0);
    expect(r?.dailySalaryRate).toBe(0);
    expect(r?.attendanceBonus).toBe(0); // bonus scales with dailyRate
  });
});

describe("calculateSalary — extra paid-Saturday bonus", () => {
  it("adds dailyRate per worked paid-Saturday", () => {
    const r = calc(NO_OVER_QUOTA, {
      extraSat: { workedDates: ["2026-06-06", "2026-06-13"] },
    });
    expect(r?.extraOpenSaturdayDays).toBe(2);
    expect(r?.extraOpenSaturdayBonus).toBe(2000); // 2 × dailyRate(1000)
    expect(r?.earnings).toBe(30000 + 2000 + 2000);
  });
});

describe("calculateSalary — single-piece (multi-item) commission", () => {
  const role = { id: "tech", pieceItems: [{ id: "a", label: "งาน A" }] };

  it("sums piece commission from the snapshot rate × pieces", () => {
    const r = calc(NO_OVER_QUOTA, {
      role,
      salary: {
        baseSalary: 30000,
        piecePieces: { a: 10 },
        pieceRates: { a: 50 },
      },
    });
    expect(r?.usesSinglePieceRate).toBe(true);
    expect(r?.singleRateCommission).toBe(500); // 10 × 50
    expect(r?.earnings).toBe(30000 + 2000 + 500);
  });

  it("subtracts piece exclusions from the gross before applying the rate", () => {
    const r = calc(NO_OVER_QUOTA, {
      role,
      salary: {
        baseSalary: 30000,
        piecePieces: { a: 10 },
        pieceRates: { a: 50 },
      },
      pieceExclusions: [{ pieceItemId: "a", pieces: 4, label: "คืนงาน" }],
    });
    expect(r?.singleRatePieces).toBe(6); // 10 - 4
    expect(r?.singleRateCommission).toBe(300); // 6 × 50
  });
});

describe("computeExtraOpenSaturdayWorkedDates", () => {
  it("keeps paid Saturdays in the month where the employee was not on leave", () => {
    const r = computeExtraOpenSaturdayWorkedDates(
      "2026-06",
      { paidExtraSaturdays: ["2026-06-06", "2026-06-13", "2026-07-04"] },
      [{ start: "2026-06-13", end: "2026-06-13" }],
    );
    expect(r).toEqual(["2026-06-06"]); // 06-13 on leave, 07-04 wrong month
  });

  it("returns [] when there are no paid Saturdays configured", () => {
    expect(computeExtraOpenSaturdayWorkedDates("2026-06", {}, [])).toEqual([]);
  });
});
