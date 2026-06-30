import { describe, expect, it } from "vitest";
import type { Duty, Employee, LeaveEntry } from "../types";
import {
  applicableDuties,
  computeAllDutiesForDay,
  computeCoverageEarningsForMonth,
  computeDutyForDay,
  computeDutyForecast,
  computeForecastPrimaries,
  employeeHasPoolExemptDuty,
  getPeriodIndex,
  getPeriodRange,
  getPeriodRangeForIndex,
  hashDutyId,
  isSunday,
  monthlyPrimariesForDay,
  pickPrimary,
  resolveDutyPool,
} from "./dutyUtils";

// ─── fixtures ──────────────────────────────────────────────────────
function duty(over: Partial<Duty> = {}): Duty {
  return {
    id: "d1",
    name: "หน้าที่",
    period: "weekly",
    roleId: "sales",
    rotationStartDate: "2026-06-01",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Duty;
}

function emp(id: string, over: Partial<Employee> = {}): Employee {
  return {
    id,
    name: id,
    roleId: "sales",
    ...over,
  } as Employee;
}

function leave(employeeId: string, start: string, end = start): LeaveEntry {
  return {
    id: `${employeeId}-${start}`,
    employeeId,
    employeeName: employeeId,
    type: "personal",
    start,
    end,
    days: 1,
  } as LeaveEntry;
}

// ─── hashDutyId ────────────────────────────────────────────────────
describe("hashDutyId", () => {
  it("is deterministic and unsigned 32-bit", () => {
    expect(hashDutyId("duty-1")).toBe(hashDutyId("duty-1"));
    const h = hashDutyId("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(Number.isInteger(h)).toBe(true);
  });

  it("matches locked reference values (client/server must agree)", () => {
    // ⚠️ if these change, functions/src/duty/dutyUtils.ts must change too
    expect(hashDutyId("duty-1")).toBe(1352159);
    expect(hashDutyId("clean")).toBe(1349386046);
    expect(hashDutyId("a")).toBe(3826002220);
  });

  it("distinguishes different ids", () => {
    expect(hashDutyId("a")).not.toBe(hashDutyId("b"));
  });
});

describe("isSunday", () => {
  it("detects Sundays via local date parsing", () => {
    expect(isSunday("2026-06-07")).toBe(true); // Sunday
    expect(isSunday("2026-06-08")).toBe(false); // Monday
  });
});

// ─── applicableDuties ──────────────────────────────────────────────
describe("applicableDuties", () => {
  const weekly = duty({ id: "w", period: "weekly" });
  const weeklyNoSun = duty({ id: "ws", period: "weekly", skipSundays: true });
  const monthly = duty({ id: "m", period: "monthly" });
  const all = [weekly, weeklyNoSun, monthly];

  it("returns nothing on a default-closed Saturday", () => {
    expect(applicableDuties(all, "2026-06-06")).toEqual([]);
  });

  it("returns all duties on a specially-opened Saturday", () => {
    expect(
      applicableDuties(all, "2026-06-06", {
        extraOpenSaturdays: ["2026-06-06"],
        extraClosedWeekdays: [],
      }),
    ).toHaveLength(3);
  });

  it("returns nothing on an admin-closed weekday", () => {
    expect(
      applicableDuties(all, "2026-06-08", {
        extraOpenSaturdays: [],
        extraClosedWeekdays: ["2026-06-08"],
      }),
    ).toEqual([]);
  });

  it("drops weekly+skipSundays duties on an open Sunday, keeps the rest", () => {
    const res = applicableDuties(all, "2026-06-07");
    expect(res.map((d) => d.id).sort()).toEqual(["m", "w"]);
  });

  it("returns nothing on an admin-closed Sunday", () => {
    expect(
      applicableDuties(all, "2026-06-07", {
        extraOpenSaturdays: [],
        extraClosedWeekdays: [],
        extraClosedSundays: ["2026-06-07"],
      }),
    ).toEqual([]);
  });

  it("returns all duties on a normal weekday", () => {
    expect(applicableDuties(all, "2026-06-08")).toHaveLength(3);
  });
});

// ─── period index & ranges ─────────────────────────────────────────
describe("getPeriodIndex", () => {
  it("counts 7-day blocks for weekly duties", () => {
    const w = duty({ period: "weekly", rotationStartDate: "2026-06-01" });
    expect(getPeriodIndex(w, "2026-06-01")).toBe(0);
    expect(getPeriodIndex(w, "2026-06-08")).toBe(1);
    expect(getPeriodIndex(w, "2026-06-21")).toBe(2);
  });

  it("counts calendar months for monthly duties (day-independent)", () => {
    const m = duty({ period: "monthly", rotationStartDate: "2026-01-15" });
    expect(getPeriodIndex(m, "2026-01-31")).toBe(0);
    expect(getPeriodIndex(m, "2026-03-01")).toBe(2);
    expect(getPeriodIndex(m, "2026-03-20")).toBe(2);
  });
});

describe("getPeriodRangeForIndex / getPeriodRange", () => {
  it("returns a 7-day window for weekly duties", () => {
    const w = duty({ period: "weekly", rotationStartDate: "2026-06-01" });
    expect(getPeriodRangeForIndex(w, 0)).toEqual({
      start: "2026-06-01",
      end: "2026-06-07",
    });
    expect(getPeriodRangeForIndex(w, 2)).toEqual({
      start: "2026-06-15",
      end: "2026-06-21",
    });
  });

  it("returns whole calendar months for monthly duties", () => {
    const m = duty({ period: "monthly", rotationStartDate: "2026-01-15" });
    expect(getPeriodRangeForIndex(m, 0)).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
    expect(getPeriodRangeForIndex(m, 1)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("clamps negative indexes to 0", () => {
    const w = duty({ period: "weekly", rotationStartDate: "2026-06-01" });
    expect(getPeriodRangeForIndex(w, -5)).toEqual(getPeriodRangeForIndex(w, 0));
  });

  it("getPeriodRange resolves the window containing a date", () => {
    const w = duty({ period: "weekly", rotationStartDate: "2026-06-01" });
    expect(getPeriodRange(w, "2026-06-17")).toEqual({
      start: "2026-06-15",
      end: "2026-06-21",
    });
  });
});

// ─── resolveDutyPool ───────────────────────────────────────────────
describe("resolveDutyPool", () => {
  it("includes only matching-role, enabled, non-excluded employees", () => {
    const employees = [
      emp("a", { displayOrder: 2 }),
      emp("b", { displayOrder: 1 }),
      emp("c", { roleId: "other" }),
      emp("d", { salaryDisabled: true }),
    ];
    const d = duty({ roleId: "sales", excludedEmpIds: ["b"] });
    // b excluded, c wrong role, d disabled → only a
    expect(resolveDutyPool(d, employees).map((e) => e.id)).toEqual(["a"]);
  });

  it("sorts by displayOrder asc, then Thai name", () => {
    const employees = [
      emp("x", { displayOrder: 3 }),
      emp("y", { displayOrder: 1 }),
      emp("z", { displayOrder: 2 }),
    ];
    expect(resolveDutyPool(duty(), employees).map((e) => e.id)).toEqual([
      "y",
      "z",
      "x",
    ]);
  });

  it("blocks poolExclusion='both' employees from MONTHLY duties only", () => {
    const employees = [emp("a"), emp("b", { poolExclusion: "both" })];
    expect(
      resolveDutyPool(duty({ period: "monthly" }), employees).map((e) => e.id),
    ).toEqual(["a"]);
    // weekly still allows them
    expect(
      resolveDutyPool(duty({ period: "weekly" }), employees).map((e) => e.id),
    ).toEqual(["a", "b"]);
  });
});

// ─── pickPrimary ───────────────────────────────────────────────────
describe("pickPrimary", () => {
  const d = duty({ id: "pp" });

  it("returns null for an empty pool", () => {
    expect(pickPrimary(d, [], 0, new Set())).toBeNull();
  });

  it("is deterministic for the same inputs", () => {
    const pool = ["a", "b", "c"];
    expect(pickPrimary(d, pool, 3, new Set())).toBe(
      pickPrimary(d, pool, 3, new Set()),
    );
  });

  it("skips collisions: a used candidate is passed over for a free one", () => {
    const pool = ["a", "b", "c"];
    const first = pickPrimary(d, pool, 0, new Set())!;
    const second = pickPrimary(d, pool, 0, new Set([first]));
    expect(second).not.toBe(first);
    expect(pool).toContain(second);
  });

  it("uses a valid cache (matching periodIndex, in pool, not used)", () => {
    const pool = ["a", "b", "c"];
    const cached = duty({
      id: "pp",
      cachedPrimary: { periodIndex: 5, empId: "b" },
    });
    expect(pickPrimary(cached, pool, 5, new Set())).toBe("b");
  });

  it("ignores a stale cache (wrong periodIndex) and falls back to the hash pick", () => {
    const pool = ["a", "b", "c"];
    const noCache = pickPrimary(d, pool, 2, new Set());
    const stale = pickPrimary(
      duty({ id: "pp", cachedPrimary: { periodIndex: 99, empId: "c" } }),
      pool,
      2,
      new Set(),
    );
    expect(stale).toBe(noCache);
  });

  it("ignores a cache whose empId left the pool", () => {
    const pool = ["a", "b", "c"];
    const noCache = pickPrimary(d, pool, 2, new Set());
    const ghost = pickPrimary(
      duty({ id: "pp", cachedPrimary: { periodIndex: 2, empId: "ghost" } }),
      pool,
      2,
      new Set(),
    );
    expect(ghost).toBe(noCache);
  });

  it("allows a repeat when every candidate is already used (duties > people)", () => {
    expect(pickPrimary(d, ["a"], 0, new Set(["a"]))).toBe("a");
  });

  it("rotationStartEmpId anchors the first period to the chosen person", () => {
    const pool = ["a", "b", "c"];
    const anchored = duty({ id: "pp", rotationStartEmpId: "c" });
    expect(pickPrimary(anchored, pool, 0, new Set())).toBe("c");
  });

  it("rotation continues in pool order from the chosen start person", () => {
    const pool = ["a", "b", "c"];
    const anchored = duty({ id: "pp", rotationStartEmpId: "b" });
    // เริ่มที่ b (idx1) แล้วหมุน: idx0=b, idx1=c, idx2=a, idx3=b
    expect(pickPrimary(anchored, pool, 0, new Set())).toBe("b");
    expect(pickPrimary(anchored, pool, 1, new Set())).toBe("c");
    expect(pickPrimary(anchored, pool, 2, new Set())).toBe("a");
    expect(pickPrimary(anchored, pool, 3, new Set())).toBe("b");
  });

  it("falls back to the hash pick when rotationStartEmpId is not in the pool", () => {
    const pool = ["a", "b", "c"];
    const noAnchor = pickPrimary(d, pool, 4, new Set());
    const ghostAnchor = pickPrimary(
      duty({ id: "pp", rotationStartEmpId: "ghost" }),
      pool,
      4,
      new Set(),
    );
    expect(ghostAnchor).toBe(noAnchor);
  });

  it("empty rotationStartEmpId behaves like no anchor (backward compatible)", () => {
    const pool = ["a", "b", "c"];
    const noAnchor = pickPrimary(d, pool, 7, new Set());
    const emptyAnchor = pickPrimary(
      duty({ id: "pp", rotationStartEmpId: "" }),
      pool,
      7,
      new Set(),
    );
    expect(emptyAnchor).toBe(noAnchor);
  });
});

// ─── computeDutyForDay ─────────────────────────────────────────────
describe("computeDutyForDay", () => {
  const employees = [
    emp("a", { displayOrder: 1 }),
    emp("b", { displayOrder: 2 }),
    emp("c", { displayOrder: 3 }),
  ];
  const d = duty({ id: "cdd", period: "weekly" });
  const MON = "2026-06-08";

  it("returns empty_pool when no one matches the role", () => {
    const r = computeDutyForDay(
      d,
      MON,
      [emp("x", { roleId: "other" })],
      [],
      new Set(),
      new Set(),
    );
    expect(r.reason).toBe("empty_pool");
    expect(r.actualEmpId).toBeNull();
  });

  it("assigns the precomputed primary when present and not on leave", () => {
    const r = computeDutyForDay(
      d,
      MON,
      employees,
      [],
      new Set(),
      new Set(),
      "a",
    );
    expect(r.reason).toBe("rotation");
    expect(r.primaryEmpId).toBe("a");
    expect(r.actualEmpId).toBe("a");
  });

  it("substitutes the next free coworker when the primary is on leave", () => {
    const r = computeDutyForDay(
      d,
      MON,
      employees,
      [leave("a", MON)],
      new Set(),
      new Set(),
      "a",
    );
    expect(r.reason).toBe("substitute_for_leave");
    expect(r.primaryEmpId).toBe("a");
    expect(r.actualEmpId).toBe("b");
  });

  it("doubles up when every free coworker is already on another duty", () => {
    // a on leave; b is busy elsewhere (primariesToday) → b chosen as double_up
    const r = computeDutyForDay(
      d,
      MON,
      [emp("a", { displayOrder: 1 }), emp("b", { displayOrder: 2 })],
      [leave("a", MON)],
      new Set(),
      new Set(["b"]),
      "a",
    );
    expect(r.reason).toBe("double_up");
    expect(r.actualEmpId).toBe("b");
  });

  it("reports all_on_leave when the whole pool is out", () => {
    const r = computeDutyForDay(
      d,
      MON,
      [emp("a", { displayOrder: 1 }), emp("b", { displayOrder: 2 })],
      [leave("a", MON), leave("b", MON)],
      new Set(),
      new Set(),
      "a",
    );
    expect(r.reason).toBe("all_on_leave");
    expect(r.actualEmpId).toBeNull();
  });
});

// ─── computeAllDutiesForDay ────────────────────────────────────────
describe("computeAllDutiesForDay", () => {
  const employees = [
    emp("a", { displayOrder: 1 }),
    emp("b", { displayOrder: 2 }),
  ];

  it("returns nothing when the store is closed", () => {
    expect(
      computeAllDutiesForDay([duty()], "2026-06-06", employees, []),
    ).toEqual([]);
  });

  it("keeps monthly assignees out of weekly duties (no same-day double assignment)", () => {
    const monthly = duty({ id: "m", period: "monthly" });
    const weekly = duty({ id: "w", period: "weekly" });
    const res = computeAllDutiesForDay(
      [monthly, weekly],
      "2026-06-08",
      employees,
      [],
    );
    const byId = Object.fromEntries(res.map((r) => [r.dutyId, r.primaryEmpId]));
    expect(byId.m).not.toBe(byId.w);
    expect([byId.m, byId.w].sort()).toEqual(["a", "b"]);
  });

  it("excludes weekly+skipSundays duties on a Sunday", () => {
    const res = computeAllDutiesForDay(
      [duty({ id: "ws", period: "weekly", skipSundays: true })],
      "2026-06-07",
      employees,
      [],
    );
    expect(res).toEqual([]);
  });
});

// ─── monthlyPrimariesForDay & pool-exempt duty ─────────────────────
describe("monthlyPrimariesForDay / employeeHasPoolExemptDuty", () => {
  const employees = [
    emp("a", { displayOrder: 1 }),
    emp("b", { displayOrder: 2 }),
  ];

  it("returns the set of monthly primaries", () => {
    const set = monthlyPrimariesForDay(
      [duty({ id: "m", period: "monthly" })],
      "2026-06-08",
      employees,
    );
    expect(set.size).toBe(1);
    expect([...set][0]).toMatch(/^[ab]$/);
  });

  it("returns empty set when there are no monthly duties", () => {
    expect(monthlyPrimariesForDay([], "2026-06-08", employees).size).toBe(0);
  });

  it("flags the primary of a pool-eligibility-granting monthly duty", () => {
    const duties = [
      duty({ id: "m", period: "monthly", grantsPoolEligibility: true }),
    ];
    const primary = [
      ...monthlyPrimariesForDay(duties, "2026-06-01", employees),
    ][0];
    const other = primary === "a" ? "b" : "a";
    expect(
      employeeHasPoolExemptDuty(primary, "2026-06", duties, employees),
    ).toBe(true);
    expect(employeeHasPoolExemptDuty(other, "2026-06", duties, employees)).toBe(
      false,
    );
  });

  it("returns false when no duty grants pool eligibility", () => {
    const duties = [duty({ id: "m", period: "monthly" })]; // no grantsPoolEligibility
    expect(employeeHasPoolExemptDuty("a", "2026-06", duties, employees)).toBe(
      false,
    );
  });

  it("ignores coverage duties for exemption", () => {
    const duties = [
      duty({
        id: "cov",
        kind: "coverage",
        period: "monthly",
        grantsPoolEligibility: true,
      }),
    ];
    expect(employeeHasPoolExemptDuty("a", "2026-06", duties, employees)).toBe(
      false,
    );
  });
});

// ─── coverage earnings ─────────────────────────────────────────────
describe("computeCoverageEarningsForMonth", () => {
  const employees = [
    emp("t1", { roleId: "sales", displayOrder: 1 }), // coverage target
    emp("c1", { roleId: "cashier", displayOrder: 1 }), // candidate
    emp("c2", { roleId: "cashier", displayOrder: 2 }), // candidate
  ];
  const coverage = duty({
    id: "cov",
    kind: "coverage",
    period: "weekly",
    coverageRoleId: "sales",
    candidateEmpIds: ["c1", "c2"],
    coveragePayPerOccurrence: 100,
  });

  it("returns zero when there are no paid coverage duties", () => {
    expect(
      computeCoverageEarningsForMonth("c1", "2026-03", [duty()], employees, []),
    ).toEqual({ total: 0, breakdown: [] });
  });

  it("pays the fairest candidate per absence × the per-occurrence rate", () => {
    // one absence day for the target → lowest-history candidate (c1) covers
    const leaves = [leave("t1", "2026-03-10")];
    const c1 = computeCoverageEarningsForMonth(
      "c1",
      "2026-03",
      [coverage],
      employees,
      leaves,
    );
    expect(c1.total).toBe(100);
    expect(c1.breakdown).toEqual([
      { dutyId: "cov", dutyName: "หน้าที่", count: 1, rate: 100, subtotal: 100 },
    ]);
    // c2 covered nothing that month
    expect(
      computeCoverageEarningsForMonth(
        "c2",
        "2026-03",
        [coverage],
        employees,
        leaves,
      ).total,
    ).toBe(0);
  });

  it("rotates coverage fairly across absences (history-based)", () => {
    // two separate absence days → c1 then c2 (history makes the second go to c2)
    const leaves = [leave("t1", "2026-03-10"), leave("t1", "2026-03-11")];
    expect(
      computeCoverageEarningsForMonth(
        "c1",
        "2026-03",
        [coverage],
        employees,
        leaves,
      ).total,
    ).toBe(100);
    expect(
      computeCoverageEarningsForMonth(
        "c2",
        "2026-03",
        [coverage],
        employees,
        leaves,
      ).total,
    ).toBe(100);
  });
});

// ─── forecast ──────────────────────────────────────────────────────
describe("computeForecastPrimaries", () => {
  it("assigns a primary per duty, with monthly locking out weekly overlap", () => {
    const monthly = duty({ id: "m", period: "monthly" });
    const weekly = duty({ id: "w", period: "weekly" });
    const pools = new Map([
      ["m", ["a", "b"]],
      ["w", ["a", "b"]],
    ]);
    const res = computeForecastPrimaries(
      [monthly, weekly],
      pools,
      "2026-06-08",
    );
    expect(res.get("m")).not.toBe(res.get("w"));
  });

  it("yields null for a duty with an empty pool", () => {
    const res = computeForecastPrimaries(
      [duty({ id: "w" })],
      new Map([["w", []]]),
      "2026-06-08",
    );
    expect(res.get("w")).toBeNull();
  });
});

describe("computeDutyForecast", () => {
  it("builds a per-period timeline from today through the end date", () => {
    const w = duty({
      id: "w",
      period: "weekly",
      rotationStartDate: "2026-06-01",
    });
    const pools = new Map([["w", ["a", "b"]]]);
    const [forecast] = computeDutyForecast(
      [w],
      pools,
      "2026-06-01",
      "2026-06-21",
    );
    expect(forecast.periods.map((p) => p.start)).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
    ]);
    expect(forecast.periods.every((p) => p.primaryEmpId !== null)).toBe(true);
  });

  it("excludes coverage duties from the forecast", () => {
    const cov = duty({ id: "cov", kind: "coverage", period: "weekly" });
    const res = computeDutyForecast(
      [cov],
      new Map([["cov", ["a"]]]),
      "2026-06-01",
      "2026-06-21",
    );
    expect(res).toEqual([]);
  });
});

describe("computeDutyForecast — coverage (คนแทนตอน primary ลา)", () => {
  // 2026-06-01 = จันทร์ · สัปดาห์แรก 06-01..06-07 (เสาร์ = 06-06)
  const w = duty({
    id: "w",
    period: "weekly",
    rotationStartDate: "2026-06-01",
  });
  const pools = new Map([["w", ["a", "b"]]]);
  // primary ของสัปดาห์แรก (a หรือ b ขึ้นกับ hash) — หาแบบ dynamic
  const primaryOfWeek1 = computeDutyForecast(
    [w],
    pools,
    "2026-06-01",
    "2026-06-07",
  )[0].periods[0].primaryEmpId as string;
  const otherEmp = primaryOfWeek1 === "a" ? "b" : "a";

  it("ไม่มี coverage ถ้าไม่ส่ง leaves (rotation ล้วน เหมือนเดิม)", () => {
    const [f] = computeDutyForecast([w], pools, "2026-06-01", "2026-06-07");
    expect(f.periods[0].coverage).toBeUndefined();
  });

  it("ใส่ coverage = คนอื่นแทน ช่วงวันที่ primary ลา (วันร้านเปิด)", () => {
    const leaves = [leave(primaryOfWeek1, "2026-06-02", "2026-06-03")];
    const [f] = computeDutyForecast(
      [w],
      pools,
      "2026-06-01",
      "2026-06-07",
      leaves,
    );
    expect(f.periods[0].coverage).toEqual([
      { start: "2026-06-02", end: "2026-06-03", substituteEmpId: otherEmp },
    ]);
  });

  it("ไม่มี coverage ถ้าคนที่ลาไม่ใช่ primary ของรอบนั้น", () => {
    const leaves = [leave(otherEmp, "2026-06-02", "2026-06-03")];
    const [f] = computeDutyForecast(
      [w],
      pools,
      "2026-06-01",
      "2026-06-07",
      leaves,
    );
    expect(f.periods[0].coverage).toBeUndefined();
  });

  it("substituteEmpId = null เมื่อทุกคนใน pool ลาวันนั้น (ไม่มีคนแทน)", () => {
    const leaves = [
      leave("a", "2026-06-02", "2026-06-02"),
      leave("b", "2026-06-02", "2026-06-02"),
    ];
    const [f] = computeDutyForecast(
      [w],
      pools,
      "2026-06-01",
      "2026-06-07",
      leaves,
    );
    expect(f.periods[0].coverage).toEqual([
      { start: "2026-06-02", end: "2026-06-02", substituteEmpId: null },
    ]);
  });

  it("ข้ามวันร้านปิด (เสาร์) — ลาเฉพาะเสาร์ → ไม่มี coverage", () => {
    const leaves = [leave(primaryOfWeek1, "2026-06-06", "2026-06-06")];
    const [f] = computeDutyForecast(
      [w],
      pools,
      "2026-06-01",
      "2026-06-07",
      leaves,
    );
    expect(f.periods[0].coverage).toBeUndefined();
  });
});
