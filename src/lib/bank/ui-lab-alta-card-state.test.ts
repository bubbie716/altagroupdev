import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  applyAutopayToOverlay,
  applyCashAdvanceToOverlay,
  applyFreezeToOverlay,
  applyPaymentToOverlay,
  applyUiLabAltaCardAutopay,
  applyUiLabAltaCardCashAdvance,
  applyUiLabAltaCardFreeze,
  applyUiLabAltaCardPayment,
  getUiLabAltaCardOverlay,
  mergeOverlayOntoCard,
  mergeUiLabAltaCardRow,
  resetUiLabAltaCardStateForTests,
  resolveCompanyDisplayName,
  writeUiLabAltaCardOverlayMap,
} from "./ui-lab-alta-card-state.ts";
import type { AltaCardRow } from "./alta-card-types.ts";

function sampleCard(overrides: Partial<AltaCardRow> = {}): AltaCardRow {
  return {
    id: "card-1",
    ownerUserId: "user-1",
    ownerUsername: "carter",
    companyId: null,
    companyName: null,
    applicationId: null,
    tier: "navy",
    cardType: "personal",
    status: "active",
    creditLimit: 10_000,
    availableCredit: 7_500,
    currentBalance: 2_500,
    statementBalance: 2_500,
    minimumPaymentDue: 50,
    interestRate: 19.99,
    dueDate: null,
    currentBillingCycleStart: null,
    currentBillingCycleEnd: null,
    currentStatementId: null,
    lastStatementDate: null,
    nextStatementDate: null,
    paymentDueDate: null,
    cardLastFour: "4242",
    openedAt: null,
    closedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ui-lab-alta-card-state pure helpers", () => {
  it("freeze / unfreeze updates overlay status", () => {
    const frozen = applyFreezeToOverlay(null, true);
    assert.equal(frozen.status, "frozen");
    const active = applyFreezeToOverlay(frozen, false);
    assert.equal(active.status, "active");
  });

  it("payment updates paymentApplied and absolute balances when present", () => {
    const seeded = applyPaymentToOverlay(
      { currentBalance: 2_500, availableCredit: 7_500, creditLimit: 10_000 },
      500,
    );
    assert.equal(seeded.paymentApplied, 500);
    assert.equal(seeded.currentBalance, 2_000);
    assert.equal(seeded.availableCredit, 8_000);

    const merged = mergeOverlayOntoCard(sampleCard(), {
      paymentApplied: 500,
    });
    assert.equal(merged.currentBalance, 2_000);
    assert.equal(merged.availableCredit, 8_000);
  });

  it("cash advance updates cashAdvanceApplied and available credit", () => {
    const seeded = applyCashAdvanceToOverlay(
      { currentBalance: 2_500, availableCredit: 7_500, creditLimit: 10_000 },
      1_000,
    );
    assert.equal(seeded.cashAdvanceApplied, 1_000);
    assert.equal(seeded.currentBalance, 3_500);
    assert.equal(seeded.availableCredit, 6_500);

    const merged = mergeOverlayOntoCard(sampleCard(), { cashAdvanceApplied: 1_000 });
    assert.equal(merged.currentBalance, 3_500);
    assert.equal(merged.availableCredit, 6_500);
  });

  it("autopay updates overlay flag", () => {
    const next = applyAutopayToOverlay(null, true);
    assert.equal(next.autopayEnabled, true);
  });
});

describe("ui-lab-alta-card-state gated API", () => {
  beforeEach(() => {
    resetUiLabAltaCardStateForTests();
  });

  it("no-ops when UI Lab mode is off", () => {
    assert.equal(applyUiLabAltaCardFreeze("card-1", true), null);
    assert.equal(applyUiLabAltaCardPayment("card-1", 100), null);
    assert.equal(applyUiLabAltaCardCashAdvance("card-1", 100), null);
    assert.equal(applyUiLabAltaCardAutopay("card-1", true), null);
    assert.equal(getUiLabAltaCardOverlay("card-1"), null);

    const card = sampleCard();
    assert.equal(mergeUiLabAltaCardRow(card), card);
  });

  it("mergeOverlayOntoCard applies status without UI Lab gate", () => {
    writeUiLabAltaCardOverlayMap({ "card-1": { status: "frozen", paymentApplied: 250 } });
    const merged = mergeOverlayOntoCard(sampleCard(), {
      status: "frozen",
      paymentApplied: 250,
    });
    assert.equal(merged.status, "frozen");
    assert.equal(merged.currentBalance, 2_250);
  });

  it("resolveCompanyDisplayName prefers fallbacks then default", () => {
    assert.equal(
      resolveCompanyDisplayName("CO-ALTG", { cardCompanyName: "From Card" }),
      "From Card",
    );
    assert.equal(
      resolveCompanyDisplayName("CO-ALTG", { pendingCompanyName: "From App" }),
      "From App",
    );
    // When UI Lab is off, unknown companies fall back to "Company"
    assert.equal(resolveCompanyDisplayName("CO-UNKNOWN"), "Company");
  });
});
