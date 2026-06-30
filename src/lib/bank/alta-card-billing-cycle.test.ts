import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  endOfUtcDay,
  isAltaCardStatementCloseDue,
  resolveAltaCardStatementSchedulerWindow,
} from "./alta-card-billing-cycle";

describe("resolveAltaCardStatementSchedulerWindow", () => {
  it("skips early on the last calendar day before the period closes", () => {
    const june30MorningUtc = new Date("2026-06-30T04:00:00.000Z");
    const window = resolveAltaCardStatementSchedulerWindow(june30MorningUtc);
    assert.equal(window.shouldRun, false);
    if (!window.shouldRun) {
      assert.match(window.skipReason, /still open until end of day/i);
    }
  });

  it("runs on the 1st as catch-up after the prior month close", () => {
    const july1MorningUtc = new Date("2026-07-01T04:00:00.000Z");
    const window = resolveAltaCardStatementSchedulerWindow(july1MorningUtc);
    assert.equal(window.shouldRun, true);
    if (window.shouldRun) {
      assert.equal(window.mode, "month_start_catch_up");
    }
  });

  it("treats a stored close date as due on the same UTC calendar day", () => {
    const closeDate = endOfUtcDay(new Date("2026-06-30T00:00:00.000Z"));
    const runDate = new Date("2026-06-30T04:00:00.000Z");
    assert.equal(isAltaCardStatementCloseDue(closeDate, runDate), true);
  });
});
