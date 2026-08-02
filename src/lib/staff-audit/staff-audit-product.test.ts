import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productFor } from "./audit-log-discord-bridge.ts";

describe("staff audit productFor", () => {
  it("labels TERMINAL_* actions and entity types as Alta Terminal", () => {
    assert.equal(
      productFor({ action: "TERMINAL_CRYPTO_ORDER_FILLED", entityType: "TERMINAL_CRYPTO_ORDER" }),
      "Alta Terminal",
    );
    assert.equal(
      productFor({ action: "TERMINAL_CRYPTO_RECON_CRITICAL", entityType: "TERMINAL_CRYPTO_RECON_ISSUE" }),
      "Alta Terminal",
    );
    // Terminal entity wins even for OPS_* actions
    assert.equal(
      productFor({ action: "OPS_JOB_RAN", entityType: "TERMINAL_CRYPTO_RECON_ISSUE" }),
      "Alta Terminal",
    );
    assert.equal(
      productFor({ action: "BANK_DEPOSIT_REQUEST_SUBMITTED", entityType: "BANK_TRANSACTION" }),
      "Alta Bank",
    );
  });

  it("never silently labels Terminal crypto lifecycle as Alta Bank", () => {
    for (const action of [
      "TERMINAL_CRYPTO_STATUS_HALTED",
      "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      "TERMINAL_FUNDING_TRANSFER_FAILED",
      "TERMINAL_SCHEDULED_TRADE_CREATED",
    ]) {
      assert.equal(productFor({ action, entityType: "PLATFORM" }), "Alta Terminal");
    }
  });
});
