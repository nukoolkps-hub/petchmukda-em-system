import { describe, expect, it } from "vitest";
import type { Duty, Employee, LeaveEntry } from "../types";
import {
  applicableDuties,
  computeAllDutiesForDay,
  computeCoverageCounts,
  computeCoverageEarningsForMonth,
  computeCoverageEarningsForMonthAll,
  computeCoverageForecast,
  computeDutyCounts,
  computeDutyForDay,
  computeDutyForecast,
  computeDutyHistory,
  computeForecastPrimaries,
  employeeHasPoolExemptDuty,
  getPeriodIndex,
  getPeriodRange,
  getPeriodRangeForIndex,
  hashDutyId,
  isSunday,
  monthlyPrimariesForDay,
  pickPrimary,
  pickRotationSubstitute,
  replayRotationSubHistory,
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

// ─── monthly rotation substitute — ไม่ซ้ำ (fairness history) ────────
describe("pickRotationSubstitute / replayRotationSubHistory", () => {
  const pool = ["a", "b", "c"];

  it("history เท่ากัน → เลือกคนถัดจาก primary (พฤติกรรมเดิม)", () => {
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [],
        new Set(),
        new Map(),
        new Set(),
      ),
    ).toBe("b");
  });

  it("เคยแทนน้อยสุดชนะ แม้อยู่ไกลกว่าในลำดับ", () => {
    const history = new Map([["b", 2]]);
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [],
        new Set(),
        history,
        new Set(),
      ),
    ).toBe("c");
  });

  it("ข้ามคนลา + คนติดหน้าที่อื่น (pass 1) · double-up ได้ (pass 2)", () => {
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [leave("b", "2026-07-08")],
        new Set(),
        new Map(),
        new Set(),
      ),
    ).toBe("c");
    // c ติดหน้าที่อื่น + b ลา → pass 2 ยอม double-up ที่ c
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [leave("b", "2026-07-08")],
        new Set(["c"]),
        new Map(),
        new Set(),
      ),
    ).toBe("c");
  });

  it("subExcluded — ข้ามคนที่ admin ตั้ง 'ไม่ให้เป็นคนแทน' ทั้ง 2 pass", () => {
    // b ปกติจะได้ (คนถัดจาก a) แต่ถูกตั้งไม่แทน → ได้ c
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [],
        new Set(),
        new Map(),
        new Set(["b"]),
      ),
    ).toBe("c");
    // b,c ถูกตั้งไม่แทน → ไม่มีใครแทน (แม้ทุกคนว่าง)
    expect(
      pickRotationSubstitute(
        pool,
        "a",
        "2026-07-08",
        [],
        new Set(),
        new Map(),
        new Set(["b", "c"]),
      ),
    ).toBeNull();
  });

  it("replay นับวันแทนในอดีต (เฉพาะวันร้านเปิด + primary ลาจริง)", () => {
    const m = duty({
      id: "m1",
      period: "monthly",
      rotationStartDate: "2026-07-01",
      rotationStartEmpId: "a",
    });
    // a (primary ก.ค.) ลา 2 วันทำการ → b, c ได้แทนคนละครั้ง
    const history = replayRotationSubHistory(
      m,
      pool,
      [leave("a", "2026-07-08"), leave("a", "2026-07-09")],
      null,
      "2026-07-01",
      "2026-07-15",
    );
    expect(history.get("b")).toBe(1);
    expect(history.get("c")).toBe(1);
    // เสาร์ (ร้านปิด) ไม่นับ
    const satOnly = replayRotationSubHistory(
      m,
      pool,
      [leave("a", "2026-07-11")], // เสาร์
      null,
      "2026-07-01",
      "2026-07-15",
    );
    expect(satOnly.size).toBe(0);
  });
});

describe("computeDutyForecast — monthly substitute ไม่ซ้ำ", () => {
  const m = duty({
    id: "m1",
    period: "monthly",
    rotationStartDate: "2026-07-01",
    rotationStartEmpId: "a",
  });
  const pools = new Map([["m1", ["a", "b", "c"]]]);

  it("primary ลาคนละครั้งในเดือน → คนแทนหมุน b แล้ว c (ไม่ซ้ำ b,b)", () => {
    const [f] = computeDutyForecast([m], pools, "2026-07-01", "2026-07-31", [
      leave("a", "2026-07-08"),
      leave("a", "2026-07-21"),
    ]);
    expect(f.periods[0].coverage?.map((s) => s.substituteEmpId)).toEqual([
      "b",
      "c",
    ]);
  });

  it("ลาต่อเนื่องหลายวัน → สลับคนแทนรายวัน (ยุติธรรม)", () => {
    const [f] = computeDutyForecast([m], pools, "2026-07-01", "2026-07-31", [
      leave("a", "2026-07-08", "2026-07-10"),
    ]);
    expect(f.periods[0].coverage?.map((s) => s.substituteEmpId)).toEqual([
      "b",
      "c",
      "b",
    ]);
  });

  it("seed จากประวัติเดือนก่อน — คนที่แทนบ่อยแล้วไม่โดนเลือกก่อน", () => {
    // มิ.ย.: primary a ลา 2 วัน → b,c แทน (h=1 เท่ากัน) · ก.ค.: primary b
    // (rotation หมุน) · b ลา → eligible a(h0) vs c(h1) → a ชนะ
    // (แบบเดิม neighbor-scan จะได้ c ซ้ำ)
    const m6 = duty({
      id: "m1",
      period: "monthly",
      rotationStartDate: "2026-06-01",
      rotationStartEmpId: "a",
    });
    const leaves = [
      leave("a", "2026-06-10"),
      leave("a", "2026-06-11"),
      leave("b", "2026-07-08"),
    ];
    const [f] = computeDutyForecast(
      [m6],
      pools,
      "2026-07-01",
      "2026-07-31",
      leaves,
    );
    expect(f.periods[0].primaryEmpId).toBe("b");
    expect(f.periods[0].coverage?.map((s) => s.substituteEmpId)).toEqual(["a"]);
  });

  it("weekly ยังใช้ neighbor-scan เดิม (คนเดิมแทนต่อเนื่อง)", () => {
    const w = duty({
      id: "w1",
      period: "weekly",
      rotationStartDate: "2026-07-06", // จันทร์
      rotationStartEmpId: "a",
    });
    const wPools = new Map([["w1", ["a", "b", "c"]]]);
    const [f] = computeDutyForecast([w], wPools, "2026-07-06", "2026-07-12", [
      leave("a", "2026-07-08", "2026-07-09"),
    ]);
    // b แทนทั้ง 2 วัน (segment เดียว) — ไม่สลับรายวัน
    expect(f.periods[0].coverage).toEqual([
      { start: "2026-07-08", end: "2026-07-09", substituteEmpId: "b" },
    ]);
  });

  it("substituteExcludedEmpIds (monthly) — คนถูกตั้ง 'ไม่แทน' ไม่ถูกเลือก", () => {
    // b ปกติได้ทั้ง 2 ครั้ง (ไม่ · rotate b,c) แต่ตั้ง b=ไม่แทน → c แทนทั้งคู่
    const mEx = duty({
      id: "m1",
      period: "monthly",
      rotationStartDate: "2026-07-01",
      rotationStartEmpId: "a",
      substituteExcludedEmpIds: ["b"],
    });
    const [f] = computeDutyForecast([mEx], pools, "2026-07-01", "2026-07-31", [
      leave("a", "2026-07-08"),
      leave("a", "2026-07-21"),
    ]);
    expect(f.periods[0].coverage?.map((s) => s.substituteEmpId)).toEqual([
      "c",
      "c",
    ]);
  });

  it("substituteExcludedEmpIds (weekly) — ข้ามคนถูกตั้ง 'ไม่แทน'", () => {
    const wEx = duty({
      id: "w1",
      period: "weekly",
      rotationStartDate: "2026-07-06",
      rotationStartEmpId: "a",
      substituteExcludedEmpIds: ["b"],
    });
    const wPools = new Map([["w1", ["a", "b", "c"]]]);
    const [f] = computeDutyForecast([wEx], wPools, "2026-07-06", "2026-07-12", [
      leave("a", "2026-07-08"),
    ]);
    // b ถูกข้าม → c แทน
    expect(f.periods[0].coverage?.[0]?.substituteEmpId).toBe("c");
  });
});

// ─── coverage earnings (all employees) ─────────────────────────────
describe("computeCoverageEarningsForMonthAll", () => {
  const employees = [
    emp("t1", { roleId: "sales", displayOrder: 1 }),
    emp("c1", { roleId: "cashier", displayOrder: 1 }),
    emp("c2", { roleId: "cashier", displayOrder: 2 }),
  ];
  const coverage = duty({
    id: "cov",
    kind: "coverage",
    period: "weekly",
    coverageRoleId: "sales",
    candidateEmpIds: ["c1", "c2"],
    coveragePayPerOccurrence: 100,
  });

  it("returns empty when no one covered anything", () => {
    expect(
      computeCoverageEarningsForMonthAll([coverage], employees, [], "2026-03"),
    ).toEqual({});
  });

  it("matches per-employee computeCoverageEarningsForMonth for every candidate", () => {
    const leaves = [
      leave("t1", "2026-03-10", "2026-03-13"), // 4 วัน → สลับ c1/c2
    ];
    const all = computeCoverageEarningsForMonthAll(
      [coverage],
      employees,
      leaves,
      "2026-03",
    );
    for (const id of ["c1", "c2"]) {
      const single = computeCoverageEarningsForMonth(
        id,
        "2026-03",
        [coverage],
        employees,
        leaves,
      );
      expect(all[id]?.total ?? 0).toBe(single.total);
      expect(all[id]?.breakdown ?? []).toEqual(single.breakdown);
    }
    // 4 วัน สลับ c1(10,12)/c2(11,13) → คนละ 200
    expect(all.c1.total).toBe(200);
    expect(all.c2.total).toBe(200);
  });
});

// ─── coverage forecast ─────────────────────────────────────────────
describe("computeCoverageForecast", () => {
  const employees = [
    emp("t1", { roleId: "sales", displayOrder: 1 }), // coverage target
    emp("c1", { roleId: "cashier", displayOrder: 1 }), // candidate
    emp("c2", { roleId: "cashier", displayOrder: 2 }), // candidate
  ];
  const coverage = duty({
    id: "cov",
    name: "แทนบัญชี",
    kind: "coverage",
    period: "weekly",
    coverageRoleId: "sales",
    candidateEmpIds: ["c1", "c2"],
  });

  it("empty when there are no coverage duties", () => {
    expect(
      computeCoverageForecast(
        [duty()],
        employees,
        [],
        "2026-06-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });

  it("forecasts the fairest cover for a single future absence day", () => {
    const res = computeCoverageForecast(
      [coverage],
      employees,
      [leave("t1", "2026-06-10")],
      "2026-06-01",
      "2026-12-31",
    );
    expect(res).toEqual([
      {
        dutyId: "cov",
        dutyName: "แทนบัญชี",
        start: "2026-06-10",
        end: "2026-06-10",
        targetEmpId: "t1",
        substituteEmpId: "c1",
      },
    ]);
  });

  it("groups consecutive days into one range when the cover is the same", () => {
    // pool มีคนแทนคนเดียว → คนเดิมทั้งช่วง → 1 segment
    const res = computeCoverageForecast(
      [duty({ ...coverage, candidateEmpIds: ["c1"] })],
      [emp("t1", { roleId: "sales" }), emp("c1", { roleId: "cashier" })],
      [leave("t1", "2026-06-10", "2026-06-12")],
      "2026-06-01",
      "2026-12-31",
    );
    expect(res).toEqual([
      {
        dutyId: "cov",
        dutyName: "แทนบัญชี",
        start: "2026-06-10",
        end: "2026-06-12",
        targetEmpId: "t1",
        substituteEmpId: "c1",
      },
    ]);
  });

  it("rotates cover across a multi-day absence (fairness) → split segments", () => {
    const res = computeCoverageForecast(
      [coverage],
      employees,
      [leave("t1", "2026-06-10", "2026-06-12")],
      "2026-06-01",
      "2026-12-31",
    );
    // เคยแทนน้อยสุดก่อน → c1, c2, c1 (สลับรายวันตามความยุติธรรม)
    expect(res.map((r) => r.substituteEmpId)).toEqual(["c1", "c2", "c1"]);
    expect(res.map((r) => `${r.start}/${r.end}`)).toEqual([
      "2026-06-10/2026-06-10",
      "2026-06-11/2026-06-11",
      "2026-06-12/2026-06-12",
    ]);
  });

  it("marks substituteEmpId null when no candidate is available", () => {
    const res = computeCoverageForecast(
      [duty({ ...coverage, candidateEmpIds: ["c1"] })],
      [emp("t1", { roleId: "sales" }), emp("c1", { roleId: "cashier" })],
      [leave("t1", "2026-06-10"), leave("c1", "2026-06-10")], // คนแทนคนเดียวก็ลา
      "2026-06-01",
      "2026-12-31",
    );
    expect(res).toEqual([
      {
        dutyId: "cov",
        dutyName: "แทนบัญชี",
        start: "2026-06-10",
        end: "2026-06-10",
        targetEmpId: "t1",
        substituteEmpId: null,
      },
    ]);
  });

  it("excludes absence days before today (seed only, not shown)", () => {
    const res = computeCoverageForecast(
      [coverage],
      employees,
      [leave("t1", "2026-05-30", "2026-06-02")],
      "2026-06-01",
      "2026-12-31",
    );
    // เฉพาะ 06-01, 06-02 (>= today) แสดง · 05-30/05-31 เป็นแค่ seed history
    expect(res.every((r) => r.start >= "2026-06-01")).toBe(true);
    const days = [...new Set(res.flatMap((r) => [r.start, r.end]))].sort();
    expect(days).toEqual(["2026-06-01", "2026-06-02"]);
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

describe("assignPrimaries — Latin square (หน้าที่ pool เดียวกันไม่ซ้ำเร็ว)", () => {
  it("3 weekly duties sharing a 5-person pool: each cycles all 5, no early repeat, no same-week collision", () => {
    const pool5 = ["a", "b", "c", "d", "e"];
    const ds = ["d1", "d2", "d3"].map((id) =>
      duty({ id, period: "weekly", rotationStartDate: "2026-01-05" }),
    );
    const pools = new Map(ds.map((d) => [d.id, pool5]));
    // 5 สัปดาห์ต่อเนื่อง (period index 0..4)
    const weeks = [
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
      "2026-02-02",
    ];
    const perDuty = new Map<string, (string | null)[]>(
      ds.map((d) => [d.id, []]),
    );
    for (const wk of weeks) {
      const m = computeForecastPrimaries(ds, pools, wk);
      for (const d of ds) perDuty.get(d.id)?.push(m.get(d.id) ?? null);
    }
    // แต่ละหน้าที่: 5 สัปดาห์ = 5 คนไม่ซ้ำ (วนครบก่อนซ้ำ)
    for (const d of ds) {
      expect(new Set(perDuty.get(d.id)).size).toBe(5);
    }
    // แต่ละสัปดาห์: 3 หน้าที่ = คนละคน (ไม่ชนกัน)
    for (let w = 0; w < weeks.length; w++) {
      const people = ds.map((d) => perDuty.get(d.id)?.[w]);
      expect(new Set(people).size).toBe(3);
    }
  });
});

describe("computeDutyCounts", () => {
  it("นับจำนวนครั้งต่อคน + ยุติธรรมในเดือน (หน้าที่เดี่ยว)", () => {
    const w = duty({
      id: "w",
      period: "weekly",
      rotationStartDate: "2026-08-03",
    });
    const counts = computeDutyCounts(
      [w],
      new Map([["w", ["a", "b", "c"]]]),
      "2026-08-01",
      "2026-08-31",
    ).get("w");
    if (!counts) throw new Error("no counts");
    expect(counts.size).toBe(3); // ทุกคนได้ทำ
    const vals = [...counts.values()];
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });
});

describe("computeCoverageCounts", () => {
  const employees = [
    emp("t1", { roleId: "sales", displayOrder: 1 }), // target
    emp("c1", { roleId: "cashier", displayOrder: 1 }),
    emp("c2", { roleId: "cashier", displayOrder: 2 }),
  ];
  const cov = (over: Partial<Duty> = {}) =>
    duty({
      id: "cov",
      kind: "coverage",
      period: "weekly",
      coverageRoleId: "sales",
      candidateEmpIds: ["c1", "c2"],
      ...over,
    });

  it("นับคนแทนต่อหน้าที่ · หมุนเวียนยุติธรรม (2 วันลา → คนละคน)", () => {
    const leaves = [leave("t1", "2026-03-10"), leave("t1", "2026-03-11")];
    const m = computeCoverageCounts(
      [cov()],
      employees,
      leaves,
      "2026-01-01",
      "2026-03-31",
    ).get("cov");
    if (!m) throw new Error("no counts");
    expect(m.get("c1")).toBe(1);
    expect(m.get("c2")).toBe(1);
  });

  it("นับเฉพาะที่ทำไปแล้ว — วันลาหลัง toYmd (ล่วงหน้า) ไม่ถูกนับ", () => {
    // ลา 2 วัน: 03-10 (ทำแล้ว) + 03-25 (ล่วงหน้า) · toYmd = 03-15
    const leaves = [leave("t1", "2026-03-10"), leave("t1", "2026-03-25")];
    const m = computeCoverageCounts(
      [cov()],
      employees,
      leaves,
      "2026-01-01",
      "2026-03-15",
    ).get("cov");
    if (!m) throw new Error("no counts");
    // นับแค่ 03-10 → รวม 1 ครั้ง (ไม่นับ 03-25 ที่อยู่หลัง toYmd)
    const total = [...m.values()].reduce((s, n) => s + n, 0);
    expect(total).toBe(1);
  });

  it("นับแม้หน้าที่แทนไม่มีเงินค่าแทน (ต่างจาก EarningsForMonthAll)", () => {
    const leaves = [leave("t1", "2026-03-10")];
    const noPay = cov({ coveragePayPerOccurrence: 0 });
    expect(
      computeCoverageCounts(
        [noPay],
        employees,
        leaves,
        "2026-01-01",
        "2026-03-31",
      )
        .get("cov")
        ?.get("c1"),
    ).toBe(1);
    // EarningsForMonthAll กรอง pay>0 → ว่าง
    expect(
      computeCoverageEarningsForMonthAll([noPay], employees, leaves, "2026-03"),
    ).toEqual({});
  });
});

describe("computeDutyHistory", () => {
  const SIX = ["a", "b", "c", "d", "e", "f"];

  it("returns only past periods within the from–today window", () => {
    const w = duty({
      id: "w",
      period: "weekly",
      rotationStartDate: "2026-01-05",
    });
    const [h] = computeDutyHistory(
      [w],
      new Map([["w", SIX]]),
      "2026-05-01",
      "2026-07-13",
    );
    expect(h.periods.length).toBeGreaterThan(0);
    // ทุกช่วงเป็นอดีต (เริ่มก่อนวันนี้) + ไม่หลุดก่อน from
    expect(h.periods.every((p) => p.start < "2026-07-13")).toBe(true);
    expect(h.periods.every((p) => p.end >= "2026-05-01")).toBe(true);
  });

  it("single weekly duty + 6 people → ไม่ซ้ำใน 6 รอบต่อเนื่อง (fairness)", () => {
    const w = duty({
      id: "w",
      period: "weekly",
      rotationStartDate: "2026-01-05",
    });
    const [h] = computeDutyHistory(
      [w],
      new Map([["w", SIX]]),
      "2026-01-05",
      "2026-07-13",
    );
    const byIdx = [...h.periods].sort((a, b) => a.index - b.index);
    for (let i = 0; i + 6 <= byIdx.length; i++) {
      const names = byIdx.slice(i, i + 6).map((p) => p.primaryEmpId);
      expect(new Set(names).size).toBe(6); // ครบ 6 คนไม่ซ้ำ
    }
  });

  it("excludes coverage duties", () => {
    const cov = duty({ id: "cov", kind: "coverage", period: "weekly" });
    expect(
      computeDutyHistory(
        [cov],
        new Map([["cov", ["a"]]]),
        "2026-05-01",
        "2026-07-13",
      ),
    ).toEqual([]);
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
