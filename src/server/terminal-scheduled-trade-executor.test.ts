import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapCryptoOrderErrorToFailure,
  mapPreviewErrorsToFailureCategory,
  transientRetryDelayMs,
} from "@/server/terminal-scheduled-trade-executor.service";
import { buildOccurrenceIdempotencyKey } from "@/lib/terminal/scheduled-trade-schedule";

describe("terminal-scheduled-trade-executor helpers", () => {
  it("buildOccurrenceIdempotencyKey matches required format", () => {
    const key = buildOccurrenceIdempotencyKey("clxyz123");
    assert.match(key, /^scheduled-trade-occurrence:clxyz123$/);
  });

  it("maps buying power errors to INSUFFICIENT_BUYING_POWER category", () => {
    const mapped = mapPreviewErrorsToFailureCategory(["Insufficient buying power for this order"]);
    assert.equal(mapped.category, "INSUFFICIENT_BUYING_POWER");
    assert.equal(mapped.transient, false);
  });

  it("maps crypto high impact to PRICE_IMPACT_TOO_HIGH", () => {
    const mapped = mapCryptoOrderErrorToFailure({
      code: "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED",
      customerMessage: "Confirm high impact",
    });
    assert.equal(mapped.category, "PRICE_IMPACT_TOO_HIGH");
    assert.equal(mapped.transient, false);
  });

  it("maps market closed errors to transient MARKET_UNAVAILABLE", () => {
    const mapped = mapPreviewErrorsToFailureCategory(["The market is closed"]);
    assert.equal(mapped.category, "MARKET_UNAVAILABLE");
    assert.equal(mapped.transient, true);
  });

  it("uses exponential backoff for transient retries", () => {
    assert.equal(transientRetryDelayMs(1), 15 * 60_000);
    assert.equal(transientRetryDelayMs(2), 60 * 60_000);
    assert.equal(transientRetryDelayMs(3), 6 * 60 * 60_000);
    assert.equal(transientRetryDelayMs(99), 6 * 60 * 60_000);
  });
});
