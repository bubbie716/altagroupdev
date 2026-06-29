import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assetAllocationFromSnapshot,
  computeAssetAllocation,
  normalizeAllocationPercents,
} from "./asset-allocation.ts";

describe("asset allocation", () => {
  it("shows 100% cash when only bank balances exist", () => {
    const items = assetAllocationFromSnapshot({ florinBalance: 50_000, portfolioValue: 0 });
    assert.deepEqual(
      items.map((item) => item.percent),
      [100, 0, 0, 0],
    );
  });

  it("normalizes integer percents to total 100", () => {
    const percents = normalizeAllocationPercents([820_000, 120_000, 40_000, 20_000]);
    assert.equal(percents.reduce((sum, value) => sum + value, 0), 100);
    assert.deepEqual(percents, [82, 12, 4, 2]);
  });

  it("returns all zeros when net worth is zero", () => {
    const items = computeAssetAllocation({
      cash: 0,
      equities: 0,
      privateCredit: 0,
      alternativeAssets: 0,
    });
    assert.deepEqual(
      items.map((item) => item.percent),
      [0, 0, 0, 0],
    );
  });
});
