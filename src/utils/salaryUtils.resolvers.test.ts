import { describe, expect, it } from "vitest";
import {
  LEGACY_BONUS_INVITE_ID,
  LEGACY_BONUS_TRANSFER_ID,
  LEGACY_PIECE_ITEM_ID,
  LEGACY_POOL_BUY_ID,
  LEGACY_POOL_NORMAL_ID,
  LEGACY_POOL_SPECIAL_ID,
  resolveBonusItemCount,
  resolveBonusItemRate,
  resolvePieceItemPieces,
  resolvePieceItemRate,
  resolvePoolExclusionItemIds,
  resolvePoolItemPieces,
  resolvePoolItemRate,
  roleBonusItems,
  rolePaysPieceCommission,
  rolePieceItems,
  rolePieceLabel,
  rolePoolItems,
  rolePrimaryPoolItemId,
} from "./salaryUtils";

describe("rolePieceItems", () => {
  it("returns [] for pool-sales roles and commission-less roles", () => {
    expect(rolePieceItems({ poolGroup: "sales" })).toEqual([]);
    expect(rolePieceItems({})).toEqual([]);
    expect(rolePieceItems(null)).toEqual([]);
  });

  it("returns the explicit pieceItems, trimming labels and dropping invalid ones", () => {
    const items = rolePieceItems({
      pieceItems: [
        { id: "a", label: "  งาน A  " },
        { id: "b", label: "" }, // dropped: blank label
        { id: "", label: "x" }, // dropped: blank id
      ],
    });
    expect(items).toEqual([{ id: "a", label: "งาน A" }]);
  });

  it("migrates a legacy single pieceLabel into one item with the default id", () => {
    expect(rolePieceItems({ pieceLabel: "ซ่อม" })).toEqual([
      { id: LEGACY_PIECE_ITEM_ID, label: "ซ่อม" },
    ]);
  });
});

describe("rolePaysPieceCommission", () => {
  it("is true for pool roles and piece roles, false otherwise", () => {
    expect(rolePaysPieceCommission({ poolGroup: "sales" })).toBe(true);
    expect(
      rolePaysPieceCommission({ pieceItems: [{ id: "a", label: "A" }] }),
    ).toBe(true);
    expect(rolePaysPieceCommission({})).toBe(false);
    expect(rolePaysPieceCommission(null)).toBe(false);
  });
});

describe("rolePieceLabel", () => {
  it("returns the first item's label, or empty string", () => {
    expect(rolePieceLabel({ pieceLabel: "ซ่อม" })).toBe("ซ่อม");
    expect(rolePieceLabel({})).toBe("");
  });
});

describe("resolvePieceItemRate (snapshot → legacy → live priority)", () => {
  it("prefers the salary snapshot map above everything", () => {
    expect(
      resolvePieceItemRate(
        "a",
        { pieceRates: { a: 50 } },
        { pieceRates: { a: 99 } },
      ),
    ).toBe(50);
  });

  it("falls back to the legacy singlePieceRate for the default item", () => {
    expect(
      resolvePieceItemRate(LEGACY_PIECE_ITEM_ID, { singlePieceRate: 40 }, {}),
    ).toBe(40);
  });

  it("falls back to the live rates map when the snapshot has nothing", () => {
    expect(resolvePieceItemRate("a", {}, { pieceRates: { a: 30 } })).toBe(30);
  });

  it("falls back to live singlePieceRate for the default item, else 0", () => {
    expect(
      resolvePieceItemRate(LEGACY_PIECE_ITEM_ID, {}, { singlePieceRate: 20 }),
    ).toBe(20);
    expect(resolvePieceItemRate("unknown", {}, {})).toBe(0);
  });
});

describe("resolvePieceItemPieces", () => {
  it("reads the piecePieces map, falling back to legacy singleRatePieces", () => {
    expect(resolvePieceItemPieces("a", { piecePieces: { a: 10 } })).toBe(10);
    expect(
      resolvePieceItemPieces(LEGACY_PIECE_ITEM_ID, { singleRatePieces: 7 }),
    ).toBe(7);
    expect(resolvePieceItemPieces("a", {})).toBe(0);
  });
});

describe("rolePoolItems", () => {
  it("returns [] for non-pool roles", () => {
    expect(rolePoolItems({})).toEqual([]);
    expect(rolePoolItems(null)).toEqual([]);
  });

  it("migrates null/undefined poolItems to the default 3 items", () => {
    const items = rolePoolItems({ poolGroup: "sales" });
    expect(items.map((i) => i.id)).toEqual([
      LEGACY_POOL_NORMAL_ID,
      LEGACY_POOL_SPECIAL_ID,
      LEGACY_POOL_BUY_ID,
    ]);
    expect(items.find((i) => i.id === LEGACY_POOL_SPECIAL_ID)?.kind).toBe(
      "personal",
    );
  });

  it("returns an empty array (not defaults) when poolItems is explicitly []", () => {
    expect(rolePoolItems({ poolGroup: "sales", poolItems: [] })).toEqual([]);
  });

  it("clamps thresholds to 0..100 and normalizes unknown kinds to pool", () => {
    const items = rolePoolItems({
      poolGroup: "sales",
      poolItems: [
        { id: "x", label: "X", kind: "weird", threshold: 150 },
        { id: "y", label: "Y", kind: "personal", threshold: -10 },
        { id: "z", label: "Z" }, // missing threshold → default 80
      ],
    });
    expect(items[0]).toMatchObject({ kind: "pool", threshold: 100 });
    expect(items[1]).toMatchObject({ kind: "personal", threshold: 0 });
    expect(items[2].threshold).toBe(80);
  });
});

describe("rolePrimaryPoolItemId", () => {
  it("returns the legacy normal id when role is missing", () => {
    expect(rolePrimaryPoolItemId(null)).toBe(LEGACY_POOL_NORMAL_ID);
  });

  it("honors an explicit primaryPoolItemId that still exists in the items", () => {
    const role = {
      poolGroup: "sales",
      poolItems: [
        { id: "x", label: "X", kind: "personal" },
        { id: "y", label: "Y", kind: "pool" },
      ],
      primaryPoolItemId: "x",
    };
    expect(rolePrimaryPoolItemId(role)).toBe("x");
  });

  it("falls back to the first pool-kind item when the primary id is orphaned", () => {
    const role = {
      poolGroup: "sales",
      poolItems: [
        { id: "x", label: "X", kind: "personal" },
        { id: "y", label: "Y", kind: "pool" },
      ],
      primaryPoolItemId: "deleted",
    };
    expect(rolePrimaryPoolItemId(role)).toBe("y");
  });

  it("defaults to the legacy normal id for a default pool role", () => {
    expect(rolePrimaryPoolItemId({ poolGroup: "sales" })).toBe(
      LEGACY_POOL_NORMAL_ID,
    );
  });
});

describe("resolvePoolItemPieces / resolvePoolItemRate (legacy fallbacks)", () => {
  it("reads the poolItemPieces map first, then legacy per-side fields", () => {
    expect(
      resolvePoolItemPieces(LEGACY_POOL_NORMAL_ID, {
        poolItemPieces: { [LEGACY_POOL_NORMAL_ID]: 12 },
      }),
    ).toBe(12);
    expect(
      resolvePoolItemPieces(LEGACY_POOL_NORMAL_ID, { normalSalePieces: 8 }),
    ).toBe(8);
    expect(resolvePoolItemPieces(LEGACY_POOL_BUY_ID, { buyPieces: 5 })).toBe(5);
    expect(resolvePoolItemPieces("custom", {})).toBe(0);
  });

  it("resolves rate with snapshot-map → snapshot-legacy → rates-map → rates-legacy priority", () => {
    // snapshot map wins
    expect(
      resolvePoolItemRate(
        LEGACY_POOL_NORMAL_ID,
        { poolItemRates: { [LEGACY_POOL_NORMAL_ID]: 11 } },
        { normalSalePieceRate: 99 },
      ),
    ).toBe(11);
    // snapshot legacy field
    expect(
      resolvePoolItemRate(
        LEGACY_POOL_NORMAL_ID,
        { normalSalePieceRate: 9 },
        {},
      ),
    ).toBe(9);
    // live rates map
    expect(
      resolvePoolItemRate(
        LEGACY_POOL_BUY_ID,
        {},
        { poolItemRates: { [LEGACY_POOL_BUY_ID]: 7 } },
      ),
    ).toBe(7);
    // live legacy field
    expect(
      resolvePoolItemRate(
        LEGACY_POOL_SPECIAL_ID,
        {},
        { specialSalePieceRate: 4 },
      ),
    ).toBe(4);
    expect(resolvePoolItemRate("custom", {}, {})).toBe(0);
  });
});

describe("resolvePoolExclusionItemIds", () => {
  const items = [
    { id: LEGACY_POOL_NORMAL_ID },
    { id: LEGACY_POOL_SPECIAL_ID },
    { id: LEGACY_POOL_BUY_ID },
  ];

  it("treats null / empty array as no exclusion", () => {
    expect(resolvePoolExclusionItemIds(null, items)).toEqual({
      excludedIds: new Set(),
      isAll: false,
    });
    expect(resolvePoolExclusionItemIds([], items).isAll).toBe(false);
  });

  it('treats "all" and legacy "both" as every item excluded', () => {
    const all = resolvePoolExclusionItemIds("all", items);
    expect(all.isAll).toBe(true);
    expect(all.excludedIds.size).toBe(3);
    expect(resolvePoolExclusionItemIds("both", items).isAll).toBe(true);
  });

  it("uses an explicit id array, filtering ids not in the pool", () => {
    const r = resolvePoolExclusionItemIds(
      [LEGACY_POOL_NORMAL_ID, "ghost"],
      items,
    );
    expect([...r.excludedIds]).toEqual([LEGACY_POOL_NORMAL_ID]);
    expect(r.isAll).toBe(false);
  });

  it("flags isAll when an explicit array covers every item", () => {
    const r = resolvePoolExclusionItemIds(
      [LEGACY_POOL_NORMAL_ID, LEGACY_POOL_SPECIAL_ID, LEGACY_POOL_BUY_ID],
      items,
    );
    expect(r.isAll).toBe(true);
  });

  it('maps legacy "sell" to normal+special and "buy" to buy (not isAll)', () => {
    const sell = resolvePoolExclusionItemIds("sell", items);
    expect([...sell.excludedIds].sort()).toEqual(
      [LEGACY_POOL_NORMAL_ID, LEGACY_POOL_SPECIAL_ID].sort(),
    );
    expect(sell.isAll).toBe(false);
    const buy = resolvePoolExclusionItemIds("buy", items);
    expect([...buy.excludedIds]).toEqual([LEGACY_POOL_BUY_ID]);
  });
});

describe("roleBonusItems / resolveBonusItem*", () => {
  it("returns default invite+transfer bonus items when null/undefined", () => {
    expect(roleBonusItems({}).map((b) => b.id)).toEqual([
      LEGACY_BONUS_INVITE_ID,
      LEGACY_BONUS_TRANSFER_ID,
    ]);
    expect(roleBonusItems(null)).toEqual([]);
  });

  it("returns an empty array (hides section) when bonusItems is []", () => {
    expect(roleBonusItems({ bonusItems: [] })).toEqual([]);
  });

  it("resolves bonus rate with snapshot → legacy → live priority", () => {
    expect(
      resolveBonusItemRate(
        LEGACY_BONUS_INVITE_ID,
        { bonusRates: { [LEGACY_BONUS_INVITE_ID]: 25 } },
        { invitePieceRate: 99 },
      ),
    ).toBe(25);
    expect(
      resolveBonusItemRate(LEGACY_BONUS_INVITE_ID, { invitePieceRate: 15 }, {}),
    ).toBe(15);
    expect(
      resolveBonusItemRate(
        LEGACY_BONUS_TRANSFER_ID,
        {},
        { transferPieceRate: 5 },
      ),
    ).toBe(5);
    expect(resolveBonusItemRate("custom", {}, {})).toBe(0);
  });

  it("resolves bonus count from the map, then legacy fields", () => {
    expect(
      resolveBonusItemCount(LEGACY_BONUS_INVITE_ID, {
        bonusCounts: { [LEGACY_BONUS_INVITE_ID]: 3 },
      }),
    ).toBe(3);
    expect(
      resolveBonusItemCount(LEGACY_BONUS_INVITE_ID, { invitePieces: 2 }),
    ).toBe(2);
    expect(resolveBonusItemCount("custom", {})).toBe(0);
  });
});
