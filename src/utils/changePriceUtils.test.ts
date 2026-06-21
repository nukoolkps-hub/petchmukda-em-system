import { describe, expect, it } from "vitest";
import {
  CHANGE_PRICE_WEIGHTS,
  type ChangePriceWeight,
  ceilTo50,
  computeBuyPrice96,
  computeChangePrice,
  computeChangePriceBreakdown,
  computeSellPrice96,
  getWeightsWithLabor,
} from "./changePriceUtils";

const byId = (id: string): ChangePriceWeight => {
  const w = CHANGE_PRICE_WEIGHTS.find((x) => x.id === id);
  if (!w) throw new Error(`unknown weight ${id}`);
  return w;
};

const GOLD = 50_000; // ฿/บาท — round number for easy hand-checks

describe("ceilTo50", () => {
  it("rounds up to the nearest multiple of 50", () => {
    expect(ceilTo50(2518)).toBe(2550);
    expect(ceilTo50(2578)).toBe(2600);
    expect(ceilTo50(2501)).toBe(2550);
  });

  it("leaves exact multiples of 50 unchanged", () => {
    expect(ceilTo50(2550)).toBe(2550);
    expect(ceilTo50(50)).toBe(50);
  });

  it("returns 0 for non-positive or non-finite input", () => {
    expect(ceilTo50(0)).toBe(0);
    expect(ceilTo50(-100)).toBe(0);
    expect(ceilTo50(Number.NaN)).toBe(0);
    expect(ceilTo50(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("getWeightsWithLabor", () => {
  it("returns the default table reference when there are no overrides", () => {
    expect(getWeightsWithLabor(undefined)).toBe(CHANGE_PRICE_WEIGHTS);
    expect(getWeightsWithLabor({})).toBe(CHANGE_PRICE_WEIGHTS);
  });

  it("overrides only the laborBase of matching ids, leaving others intact", () => {
    const merged = getWeightsWithLabor({ "1-baht": 1234 });
    expect(merged.find((w) => w.id === "1-baht")?.laborBase).toBe(1234);
    expect(merged.find((w) => w.id === "0.6g")?.laborBase).toBe(
      byId("0.6g").laborBase,
    );
    // original table is not mutated
    expect(byId("1-baht").laborBase).toBe(1050);
  });
});

describe("computeSellPrice96", () => {
  it("uses the shortcut multiplier when one exists (1 บาท = gold ×1)", () => {
    const r = computeSellPrice96(byId("1-baht"), GOLD);
    expect(r.goldPart).toBe(50_000);
    expect(r.laborPart).toBe(1050);
    expect(r.total).toBe(51_050);
  });

  it("applies the ÷8 shortcut for ½ สลึง", () => {
    const r = computeSellPrice96(byId("half-saleung"), GOLD);
    expect(r.goldPart).toBe(6_250); // 50000 / 8
    expect(r.total).toBe(6_250 + byId("half-saleung").laborBase);
  });

  it("falls back to gold × 0.0656 × grams for weights with no shortcut", () => {
    const w = byId("0.6g");
    const r = computeSellPrice96(w, GOLD);
    expect(r.goldPart).toBeCloseTo(GOLD * 0.0656 * w.grams, 6); // 1968
    expect(r.total).toBeCloseTo(r.goldPart + w.laborBase, 6);
  });
});

describe("computeBuyPrice96", () => {
  it("applies the discount to the gold base then the shortcut multiplier (no labor)", () => {
    // 1 บาท, 5% discount → 50000 × 0.95 × 1
    expect(computeBuyPrice96(byId("1-baht"), GOLD, 5)).toBeCloseTo(47_500, 6);
  });

  it("uses the ÷8 shortcut for ½ สลึง with zero discount", () => {
    expect(computeBuyPrice96(byId("half-saleung"), GOLD, 0)).toBeCloseTo(
      6_250,
      6,
    );
  });

  it("falls back to grams formula for non-shortcut weights", () => {
    const w = byId("0.6g");
    expect(computeBuyPrice96(w, GOLD, 0)).toBeCloseTo(
      GOLD * 0.0656 * w.grams,
      6,
    );
  });

  it("carries no labor component (unlike the sell price)", () => {
    const buy = computeBuyPrice96(byId("1-baht"), GOLD, 0);
    const sell = computeSellPrice96(byId("1-baht"), GOLD);
    expect(sell.total - buy).toBeCloseTo(byId("1-baht").laborBase, 6);
  });
});

describe("computeChangePrice / computeChangePriceBreakdown", () => {
  it("computes gold (×3.1%) + labor (×85%) per the formula", () => {
    const w = byId("1-baht");
    const expectedGold = GOLD * 0.0656 * w.grams * 0.031;
    const expectedLabor = w.laborBase * 0.85;
    expect(computeChangePrice(w, GOLD)).toBeCloseTo(
      expectedGold + expectedLabor,
      6,
    );
  });

  it("breakdown raw matches computeChangePrice and total is rounded up to 50", () => {
    const w = byId("1-baht");
    const b = computeChangePriceBreakdown(w, GOLD);
    expect(b.raw).toBeCloseTo(computeChangePrice(w, GOLD), 6);
    expect(b.goldPart + b.laborPart).toBeCloseTo(b.raw, 6);
    expect(b.total).toBe(ceilTo50(b.raw));
    expect(b.total % 50).toBe(0);
    expect(b.total).toBeGreaterThanOrEqual(b.raw);
  });
});
