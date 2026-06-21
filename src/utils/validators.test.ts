import { describe, expect, it } from "vitest";
import {
  validateBankAccount,
  validateLineUserId,
  validateNonNegativeNumber,
  validatePositiveNumber,
  validateRequired,
} from "./validators";

const VALID_LINE_ID = `U${"0123456789abcdef".repeat(2)}`; // U + 32 hex chars

describe("validateLineUserId", () => {
  it("accepts an empty value (optional field)", () => {
    expect(validateLineUserId("")).toBeNull();
    expect(validateLineUserId(null)).toBeNull();
    expect(validateLineUserId("   ")).toBeNull();
  });

  it("accepts a well-formed LINE id (U + 32 hex)", () => {
    expect(validateLineUserId(VALID_LINE_ID)).toBeNull();
    expect(validateLineUserId(`  ${VALID_LINE_ID}  `)).toBeNull(); // trimmed
  });

  it("rejects bad formats", () => {
    expect(validateLineUserId("U123")).not.toBeNull(); // too short
    expect(validateLineUserId(`X${"0".repeat(32)}`)).not.toBeNull(); // wrong prefix
    expect(validateLineUserId(`U${"g".repeat(32)}`)).not.toBeNull(); // non-hex
  });
});

describe("validateBankAccount", () => {
  it("accepts an empty value (optional field)", () => {
    expect(validateBankAccount("")).toBeNull();
    expect(validateBankAccount(null)).toBeNull();
  });

  it("accepts digit strings with optional dashes (>= 9 digits)", () => {
    expect(validateBankAccount("123456789")).toBeNull();
    expect(validateBankAccount("123-4-56789-0")).toBeNull();
  });

  it("rejects strings that don't match the pattern", () => {
    expect(validateBankAccount("12345")).not.toBeNull(); // too short for pattern
    expect(validateBankAccount("12ab56789")).not.toBeNull(); // letters
  });

  it("rejects when fewer than 9 actual digits even if the pattern length passes", () => {
    // 9 chars matches pattern, but only 8 digits → min-digits error
    expect(validateBankAccount("1234567-8")).not.toBeNull();
  });
});

describe("validateNonNegativeNumber", () => {
  it("treats empty/null/undefined as valid (optional)", () => {
    expect(validateNonNegativeNumber("")).toBeNull();
    expect(validateNonNegativeNumber(null)).toBeNull();
    expect(validateNonNegativeNumber(undefined)).toBeNull();
  });

  it("accepts zero and positive numbers", () => {
    expect(validateNonNegativeNumber("0")).toBeNull();
    expect(validateNonNegativeNumber("123.45")).toBeNull();
  });

  it("rejects negatives and non-numbers", () => {
    expect(validateNonNegativeNumber("-1")).not.toBeNull();
    expect(validateNonNegativeNumber("abc")).not.toBeNull();
  });

  it("includes the field name in the error message", () => {
    expect(validateNonNegativeNumber("-1", "เงินเดือน")).toContain("เงินเดือน");
  });
});

describe("validatePositiveNumber", () => {
  it("treats empty as valid", () => {
    expect(validatePositiveNumber("")).toBeNull();
  });

  it("rejects zero (must be > 0)", () => {
    expect(validatePositiveNumber("0")).not.toBeNull();
  });

  it("accepts positive and rejects negative/non-number", () => {
    expect(validatePositiveNumber("0.01")).toBeNull();
    expect(validatePositiveNumber("-5")).not.toBeNull();
    expect(validatePositiveNumber("x")).not.toBeNull();
  });
});

describe("validateRequired", () => {
  it("rejects empty / whitespace-only values", () => {
    expect(validateRequired("")).not.toBeNull();
    expect(validateRequired("   ")).not.toBeNull();
    expect(validateRequired(null)).not.toBeNull();
  });

  it("accepts any non-empty string value", () => {
    expect(validateRequired("x")).toBeNull();
    expect(validateRequired("0")).toBeNull();
  });

  it("rejects the number 0 because of the falsy `!value` guard", () => {
    // documents current behavior: 0 is falsy so it is treated as missing
    expect(validateRequired(0)).not.toBeNull();
  });
});
