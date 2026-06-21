import { describe, expect, it } from "vitest";
import {
  buildRaiseHistory,
  getEffectiveBaseSalary,
  isEligibleForRaiseYear,
} from "./salaryUtils";

describe("isEligibleForRaiseYear", () => {
  it("returns false for missing/invalid start month", () => {
    expect(isEligibleForRaiseYear(null, 2026)).toBe(false);
    expect(isEligibleForRaiseYear("bad", 2026)).toBe(false);
  });

  it("requires at least 365 days between start and Jan 1 of the raise year", () => {
    // Start Jan 2021 → Jan 1 2022 is exactly 365 days later → eligible
    expect(isEligibleForRaiseYear("2021-01", 2022)).toBe(true);
    // Start Feb 2021 → Jan 1 2022 is ~334 days → not eligible
    expect(isEligibleForRaiseYear("2021-02", 2022)).toBe(false);
  });

  it("treats the raise year same as start year as not eligible", () => {
    expect(isEligibleForRaiseYear("2021-06", 2021)).toBe(false);
  });
});

describe("getEffectiveBaseSalary", () => {
  it("returns 0 for a missing source", () => {
    expect(getEffectiveBaseSalary(null, "2026-06")).toBe(0);
  });

  it("returns the plain base when there is no start month", () => {
    expect(getEffectiveBaseSalary({ baseSalary: 25000 }, "2026-06")).toBe(
      25000,
    );
  });

  it("accumulates auto raises only for eligible years up to the target", () => {
    // start Jan 2020, 1000/yr auto. Eligible raise years: 2021..2026 (6 raises).
    const source = {
      baseSalary: 30000,
      startWorkMonth: "2020-01",
      annualRaiseAmount: 1000,
    };
    expect(getEffectiveBaseSalary(source, "2026-06")).toBe(36000);
    // earlier target year accumulates fewer raises
    expect(getEffectiveBaseSalary(source, "2023-06")).toBe(33000);
  });

  it("lets a per-year override take precedence over the auto amount", () => {
    const source = {
      baseSalary: 30000,
      startWorkMonth: "2020-01",
      annualRaiseAmount: 1000,
      annualRaises: { "2023": 5000 },
    };
    // 2021,2022,2024,2025,2026 = 5×1000, plus 2023 override 5000 → +10000
    expect(getEffectiveBaseSalary(source, "2026-06")).toBe(40000);
  });

  it("never returns a negative number", () => {
    expect(
      getEffectiveBaseSalary(
        { baseSalary: -100, startWorkMonth: null },
        "2026",
      ),
    ).toBe(0);
  });
});

describe("buildRaiseHistory", () => {
  it("returns [] without a valid start month", () => {
    expect(buildRaiseHistory({}, 2026)).toEqual([]);
    expect(buildRaiseHistory({ startWorkMonth: "nope" }, 2026)).toEqual([]);
  });

  it("lists eligible years newest-first and flags overrides", () => {
    const history = buildRaiseHistory(
      {
        baseSalary: 30000,
        startWorkMonth: "2020-01",
        annualRaiseAmount: 1000,
        annualRaises: { "2023": 5000 },
      },
      2026,
    );
    expect(history.map((h) => h.year)).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021,
    ]);
    const y2023 = history.find((h) => h.year === 2023);
    expect(y2023).toEqual({ year: 2023, amount: 5000, isOverride: true });
    expect(history.find((h) => h.year === 2022)?.isOverride).toBe(false);
  });

  it("excludes years where the employee was not yet a full year in", () => {
    // start mid-2025; by 2026 not yet 365 days → no eligible raise years
    expect(
      buildRaiseHistory(
        {
          baseSalary: 30000,
          startWorkMonth: "2025-06",
          annualRaiseAmount: 1000,
        },
        2026,
      ),
    ).toEqual([]);
  });
});
