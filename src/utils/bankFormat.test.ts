import { describe, expect, it } from "vitest";
import { formatBankAccount } from "./bankFormat";

describe("formatBankAccount", () => {
  it("formats a 10-digit account as XXX-X-XXXXX-X (Thai standard)", () => {
    expect(formatBankAccount("1138172771")).toBe("113-8-17277-1");
    expect(formatBankAccount("2151600819")).toBe("215-1-60081-9");
  });

  it("re-groups a number that already has dashes", () => {
    expect(formatBankAccount("113-8-17277-1")).toBe("113-8-17277-1");
    expect(formatBankAccount("2151600819")).toBe("215-1-60081-9");
  });

  it("strips spaces before grouping", () => {
    expect(formatBankAccount("113 8 17277 1")).toBe("113-8-17277-1");
  });

  it("formats a 12-digit account as XXX-X-XXXXX-XXX", () => {
    expect(formatBankAccount("123456789012")).toBe("123-4-56789-012");
  });

  it("returns raw digits when length does not match a known pattern", () => {
    expect(formatBankAccount("12345")).toBe("12345");
    expect(formatBankAccount("12345678901")).toBe("12345678901"); // 11 digits
  });

  it("handles empty / nullish input", () => {
    expect(formatBankAccount("")).toBe("");
    expect(formatBankAccount(null)).toBe("");
    expect(formatBankAccount(undefined)).toBe("");
  });
});
