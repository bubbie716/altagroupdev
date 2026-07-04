import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSignedBankTransactionAmount } from "./transaction-display.ts";

describe("getSignedBankTransactionAmount", () => {
  it("treats debit adjustments as negative using WDR reference prefix", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 20_000, "WDR-20260703-ABC"), -20_000);
  });

  it("treats credit adjustments as positive using DEP reference prefix", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 20_000, "DEP-20260703-ABC"), 20_000);
  });

  it("treats loan disbursement adjustments as positive", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 50_000, "LND-20260703-ABC"), 50_000);
  });
});
