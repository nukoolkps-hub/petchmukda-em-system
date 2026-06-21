import { describe, expect, it } from "vitest";
import {
  getPayrollLock,
  isMonthLocked,
  monthOf,
  PAYROLL_EDIT_GRACE_MS,
} from "./payrollLock";

const T0 = new Date("2026-06-01T00:00:00.000Z").getTime();

describe("getPayrollLock", () => {
  it("returns un-confirmed/un-locked state when there is no doc", () => {
    expect(getPayrollLock(null, T0)).toEqual({
      confirmed: false,
      locked: false,
      lockAtMs: null,
      msLeft: 0,
      daysLeft: 0,
    });
    expect(getPayrollLock(undefined, T0).confirmed).toBe(false);
    expect(getPayrollLock({}, T0).confirmed).toBe(false);
  });

  it("derives lockAtMs from confirmedAt + 7-day grace when no firstConfirmedAt/lockAtMs", () => {
    const confirmedAt = new Date(T0).toISOString();
    const lock = getPayrollLock({ confirmedAt }, T0);
    expect(lock.confirmed).toBe(true);
    expect(lock.locked).toBe(false);
    expect(lock.lockAtMs).toBe(T0 + PAYROLL_EDIT_GRACE_MS);
    expect(lock.msLeft).toBe(PAYROLL_EDIT_GRACE_MS);
    expect(lock.daysLeft).toBe(7);
  });

  it("prefers firstConfirmedAt over confirmedAt so re-confirming does not reset the grace window", () => {
    const firstConfirmedAt = new Date(T0).toISOString();
    const confirmedAt = new Date(T0 + 3 * 86_400_000).toISOString(); // re-confirmed 3 days later
    const lock = getPayrollLock({ confirmedAt, firstConfirmedAt }, T0);
    // window still anchored to the FIRST confirmation
    expect(lock.lockAtMs).toBe(T0 + PAYROLL_EDIT_GRACE_MS);
  });

  it("uses an explicit lockAtMs when present (server-stamped) over the computed one", () => {
    const explicit = T0 + 999;
    const lock = getPayrollLock(
      { confirmedAt: new Date(T0).toISOString(), lockAtMs: explicit },
      T0,
    );
    expect(lock.lockAtMs).toBe(explicit);
  });

  it("locks once now passes lockAtMs", () => {
    const confirmedAt = new Date(T0).toISOString();
    const justAfter = T0 + PAYROLL_EDIT_GRACE_MS + 1;
    const lock = getPayrollLock({ confirmedAt }, justAfter);
    expect(lock.locked).toBe(true);
    expect(lock.msLeft).toBe(0);
    expect(lock.daysLeft).toBe(0);
  });

  it("is NOT locked exactly at the lock boundary (strict greater-than)", () => {
    const confirmedAt = new Date(T0).toISOString();
    const atBoundary = T0 + PAYROLL_EDIT_GRACE_MS;
    expect(getPayrollLock({ confirmedAt }, atBoundary).locked).toBe(false);
  });

  it("rounds daysLeft up for display (partial day still shows as a whole day)", () => {
    const confirmedAt = new Date(T0).toISOString();
    // 6 days + 1ms left → ceil → 7
    const now = T0 + PAYROLL_EDIT_GRACE_MS - (6 * 86_400_000 + 1);
    expect(getPayrollLock({ confirmedAt }, now).daysLeft).toBe(7);
  });
});

describe("isMonthLocked", () => {
  it("mirrors getPayrollLock().locked", () => {
    const confirmedAt = new Date(T0).toISOString();
    expect(isMonthLocked({ confirmedAt }, T0)).toBe(false);
    expect(isMonthLocked({ confirmedAt }, T0 + PAYROLL_EDIT_GRACE_MS + 1)).toBe(
      true,
    );
    expect(isMonthLocked(null, T0)).toBe(false);
  });
});

describe("monthOf", () => {
  it("extracts YYYY-MM from a date string", () => {
    expect(monthOf("2026-06-21")).toBe("2026-06");
    expect(monthOf("2026-06-21T13:45:00.000Z")).toBe("2026-06");
  });

  it("handles null/undefined/empty gracefully", () => {
    expect(monthOf(null)).toBe("");
    expect(monthOf(undefined)).toBe("");
    expect(monthOf("")).toBe("");
  });
});
