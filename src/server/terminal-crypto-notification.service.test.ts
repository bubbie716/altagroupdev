import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCryptoOrderNotification } from "./terminal-crypto-notification.service.ts";

describe("classifyCryptoOrderNotification", () => {
  it("skips transient UX codes", () => {
    assert.equal(classifyCryptoOrderNotification("QUOTE_EXPIRED"), "skip");
    assert.equal(classifyCryptoOrderNotification("REQUOTE_REQUIRED"), "skip");
    assert.equal(classifyCryptoOrderNotification("IDEMPOTENCY_CONFLICT"), "skip");
  });

  it("maps INTERNAL_FAILURE to failed", () => {
    assert.equal(classifyCryptoOrderNotification("INTERNAL_FAILURE"), "failed");
  });

  it("maps business rejects to rejected", () => {
    assert.equal(classifyCryptoOrderNotification("INSUFFICIENT_CASH"), "rejected");
    assert.equal(classifyCryptoOrderNotification("ASSET_HALTED"), "rejected");
    assert.equal(classifyCryptoOrderNotification("PRICE_IMPACT_LIMIT_EXCEEDED"), "rejected");
  });
});
