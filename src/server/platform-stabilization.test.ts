import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAvailableBalancesByAccountIds } from "@/server/account-balance.service";
import { resolveSiteKeyFromSearch } from "@/lib/site/site-context";

describe("platform stabilization", () => {
  it("returns empty map for no account ids", async () => {
    const balances = await getAvailableBalancesByAccountIds([]);
    assert.equal(balances.size, 0);
  });

  it("disables production ?site= override", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(resolveSiteKeyFromSearch({ site: "bank" }), null);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("allows dev ?site= override", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(resolveSiteKeyFromSearch({ site: "bank" }), "bank");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
