import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { resolveFundingIdempotencyKey } from "@/lib/bank/ncc-terminal-funding-idempotency";
import { customerFundingErrorMessage, customerFundingStatusLabel } from "@/server/ncc/ncc-funding.service";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

describe("ncc sprint 3c bank website route", () => {
  it("activates /bank/transfers/interbank with live Terminal funding (not disabled wire submit)", () => {
    const routeSource = readFileSync(
      join(repoRoot, "src/routes/bank/transfers/interbank.tsx"),
      "utf8",
    );
    assert.match(routeSource, /BankTerminalFundingForm/);
    assert.match(routeSource, /fetchTerminalFundingSources/);
    assert.match(routeSource, /Available now/);
    assert.match(routeSource, /TerminalFundingHistory/);
    assert.doesNotMatch(routeSource, /Submit wire \(unavailable\)/);
    assert.doesNotMatch(routeSource, /Submit wire \(preview only\)/);
    // External wires remain a separate coming-soon preview; live path is Terminal funding.
    assert.match(routeSource, /Coming soon/);
  });

  it("keeps double-submit protected by reusing one idempotency key", () => {
    const first = resolveFundingIdempotencyKey(null);
    const second = resolveFundingIdempotencyKey(first);
    const third = resolveFundingIdempotencyKey(first);
    assert.equal(second, first);
    assert.equal(third, first);
    assert.notEqual(resolveFundingIdempotencyKey(null), first);
  });

  it("surfaces customer-friendly funding errors", () => {
    assert.match(customerFundingErrorMessage("INSUFFICIENT_FUNDS"), /insufficient/i);
    assert.match(customerFundingErrorMessage("COMPANY_SOURCE_NOT_SUPPORTED"), /Business Bank/i);
    assert.match(customerFundingErrorMessage("IDEMPOTENCY_CONFLICT"), /conflicts/i);
    assert.match(customerFundingErrorMessage("SOURCE_ACCOUNT_RESTRICTED"), /restricted/i);
    assert.match(customerFundingErrorMessage("NCC_ROUTING_NOT_CONFIGURED"), /unavailable/i);
  });

  it("does not label NCC ledger post alone as Completed", () => {
    assert.equal(customerFundingStatusLabel("NCC_POSTED"), "Sent to NCC");
    assert.equal(customerFundingStatusLabel("SOURCE_COMMITTED", "MANUAL_REVIEW"), "Needs review");
    assert.equal(customerFundingStatusLabel("SOURCE_COMMITTED", "RETRY_PENDING"), "Delayed—still processing");
    assert.notEqual(customerFundingStatusLabel("NCC_POSTED"), "Completed");
  });
});
