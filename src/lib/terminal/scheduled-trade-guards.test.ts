import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildOccurrenceIdempotencyKey } from "@/lib/terminal/scheduled-trade-schedule";
import {
  mapPreviewErrorsToFailureCategory,
  transientRetryDelayMs,
} from "@/server/terminal-scheduled-trade-executor.service";

function read(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

describe("terminal scheduled trade integration guards", () => {
  it("uses stable occurrence-scoped idempotency keys", () => {
    assert.equal(
      buildOccurrenceIdempotencyKey("occ_123"),
      "scheduled-trade-occurrence:occ_123",
    );
  });

  it("maps buying power and holdings failures to customer-safe categories", () => {
    assert.equal(
      mapPreviewErrorsToFailureCategory(["Insufficient buying power for this order"]).category,
      "INSUFFICIENT_BUYING_POWER",
    );
    assert.equal(
      mapPreviewErrorsToFailureCategory(["You do not hold enough shares to sell"]).category,
      "INSUFFICIENT_HOLDINGS",
    );
  });

  it("uses bounded transient backoff without rapid loops", () => {
    assert.equal(transientRetryDelayMs(1), 15 * 60_000);
    assert.equal(transientRetryDelayMs(2), 60 * 60_000);
    assert.equal(transientRetryDelayMs(3), 6 * 60 * 60_000);
    assert.equal(transientRetryDelayMs(99), 6 * 60 * 60_000);
  });

  it("registers cron job and forbids UI Lab real occurrence execution", () => {
    const job = read("server/terminal-scheduled-trades-job.service.ts");
    const executor = read("server/terminal-scheduled-trade-executor.service.ts");
    const catalog = read("lib/internal/ops-jobs-catalog.ts");
    assert.match(job, /terminal_scheduled_trades/);
    assert.match(job, /\/opt\/alta-cron\/run\.sh terminal-scheduled-trades/);
    assert.match(catalog, /terminal_scheduled_trades/);
    assert.match(executor, /isUiLabMode\(\)/);
    assert.match(executor, /dueCount: 0/);
  });

  it("gates mutations with consent, rate limit, and UI Lab mutation assert", () => {
    const fns = read("lib/terminal/scheduled-trade.functions.ts");
    assert.match(fns, /assertProductConsentForAction\(/);
    assert.match(fns, /terminal\.place_order/);
    assert.match(fns, /terminal\.crypto_trade/);
    assert.match(fns, /assertNotUiLabMutation\("Scheduled trade creation"\)/);
    assert.match(fns, /assertUserRateLimit/);
    assert.match(fns, /assertUiLabProductConsentForAction/);
  });

  it("crypto schedules use florin sizing and never route to TSE in the executor", () => {
    const executor = read("server/terminal-scheduled-trade-executor.service.ts");
    const service = read("server/terminal-scheduled-trade.service.ts");
    const sheet = read("components/terminal/schedule-trade-sheet.tsx");
    assert.match(executor, /processCryptoOccurrence/);
    assert.match(executor, /submitTerminalCryptoOrder/);
    assert.match(executor, /acceptHighPriceImpact: false/);
    assert.match(executor, /PRICE_IMPACT_TOO_HIGH/);
    assert.match(service, /executionVenue: instrumentKind === "CRYPTO" \? "ALTA_CRYPTO"/);
    assert.match(service, /FLORIN_AMOUNT/);
    assert.match(sheet, /Florin amount/);
    assert.match(sheet, /move the market too\s+much at execution time/);
    // Server policy remains stricter; customer copy must not advertise the exact threshold.
    assert.doesNotMatch(sheet, /price impact is 10%/);
  });

  it("customer Orders nav stays Orders|Scheduled without a new primary nav item", () => {
    const nav = read("lib/terminal/terminal-primary-nav.ts");
    const orders = read("routes/terminal/orders.tsx");
    assert.match(nav, /label: "Orders"/);
    assert.doesNotMatch(nav, /Scheduled/);
    assert.match(orders, /TABS = \["orders", "scheduled"\]/);
  });

  it("schedule sheet documents non-reservation and UTC policy", () => {
    const sheet = read("components/terminal/schedule-trade-sheet.tsx");
    assert.match(sheet, /not reserved or guaranteed/);
    assert.match(sheet, /checked[\s\S]*again at each attempt/i);
    assert.match(sheet, /TERMINAL_SCHEDULED_TRADE_UTC_HELP/);
    assert.match(sheet, /SheetContent/);
    assert.match(sheet, /min-h-11/);
  });

  it("UI Lab fixtures are isolated and labeled demonstration", () => {
    const fixtures = read("lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures.ts");
    assert.match(fixtures, /demonstration/i);
    assert.match(fixtures, /never writes production/i);
    assert.match(fixtures, /UI_LAB_SCHEDULED_TRADE_IDS/);
    assert.match(fixtures, /tseUnavailable/);
    assert.match(fixtures, /concurrencyDuplicate/);
  });
});
