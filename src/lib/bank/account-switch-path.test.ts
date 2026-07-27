import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAccountPathSuffix } from "@/lib/bank/account-switch-path";

describe("account-switch-path payments", () => {
  it("maps legacy payments suffix to commercial payments, not overview", () => {
    assert.equal(
      extractAccountPathSuffix("/bank/account/acc-1/payments", "acc-1"),
      "/commercial/payments",
    );
    assert.notEqual(
      extractAccountPathSuffix("/bank/account/acc-1/payments", "acc-1"),
      "/commercial",
    );
  });

  it("preserves commercial payments suffix", () => {
    assert.equal(
      extractAccountPathSuffix("/bank/account/acc-1/commercial/payments", "acc-1"),
      "/commercial/payments",
    );
  });
});
