import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scheduledTradeFailureCopy,
  scheduledTradeFrequencyLabel,
} from "@/lib/terminal/scheduled-trade-copy";

describe("scheduled trade copy", () => {
  it("uses customer-friendly cadence labels", () => {
    assert.equal(scheduledTradeFrequencyLabel("weekly"), "Weekly");
    assert.equal(scheduledTradeFrequencyLabel("biweekly"), "Every two weeks");
    assert.equal(scheduledTradeFrequencyLabel("monthly"), "Monthly");
    assert.equal(scheduledTradeFrequencyLabel(null), "—");
  });

  it("humanizes crypto failure categories", () => {
    assert.match(scheduledTradeFailureCopy("price_impact_too_high"), /move the market too much/i);
    assert.doesNotMatch(scheduledTradeFailureCopy("price_impact_too_high"), /10%/);
    assert.match(scheduledTradeFailureCopy("crypto_consent_required"), /consent/i);
    assert.match(scheduledTradeFailureCopy("wallet_frozen"), /frozen/i);
    assert.equal(
      scheduledTradeFailureCopy("asset_halted", "Custom halt message"),
      "Custom halt message",
    );
  });
});
