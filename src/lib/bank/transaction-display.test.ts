import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBankTransactionTypeLabel,
  getSignedBankTransactionAmount,
  isBankTransactionDebit,
  presentBankTransaction,
  presentUserBankTransaction,
} from "./transaction-display.ts";
import type { UserBankTransaction } from "./backend-types.ts";

function transaction(
  partial: Partial<UserBankTransaction> & Pick<UserBankTransaction, "type" | "amount" | "status">,
): UserBankTransaction {
  return {
    id: "tx-1",
    referenceCode: "DEP-20260703-ABC",
    bankAccountId: "acc-1",
    accountName: "Everyday Checking",
    accountNumber: "1234567890",
    typeLabel: formatBankTransactionTypeLabel(partial.type),
    statusLabel: "Approved",
    description: "Deposit",
    memo: null,
    proofImageUrl: null,
    proofFileName: null,
    proofUploadedAt: null,
    hasProof: false,
    createdAt: "2026-07-03T12:00:00.000Z",
    reviewedAt: null,
    reviewNote: null,
    ...partial,
  };
}

describe("isBankTransactionDebit", () => {
  it("classifies withdrawals, loan payments, and interest charges as debits", () => {
    assert.equal(isBankTransactionDebit("withdrawal"), true);
    assert.equal(isBankTransactionDebit("loan_payment"), true);
    assert.equal(isBankTransactionDebit("interest_charge"), true);
  });

  it("classifies deposits, interest credits, and adjustments as non-debits", () => {
    assert.equal(isBankTransactionDebit("deposit"), false);
    assert.equal(isBankTransactionDebit("interest_credit"), false);
    assert.equal(isBankTransactionDebit("adjustment"), false);
  });
});

describe("getSignedBankTransactionAmount", () => {
  it("signs deposits and interest credits positive", () => {
    assert.equal(getSignedBankTransactionAmount("deposit", 20_000), 20_000);
    assert.equal(getSignedBankTransactionAmount("interest_credit", 125.5), 125.5);
  });

  it("signs withdrawals, loan payments, and interest charges negative", () => {
    assert.equal(getSignedBankTransactionAmount("withdrawal", 20_000), -20_000);
    assert.equal(getSignedBankTransactionAmount("loan_payment", 4_500), -4_500);
    assert.equal(getSignedBankTransactionAmount("interest_charge", 87.25), -87.25);
  });

  it("normalizes stored amounts to the direction implied by the type", () => {
    assert.equal(getSignedBankTransactionAmount("deposit", -20_000), 20_000);
    assert.equal(getSignedBankTransactionAmount("withdrawal", -20_000), -20_000);
  });

  it("treats debit adjustments as negative using WDR reference prefix", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 20_000, "WDR-20260703-ABC"), -20_000);
  });

  it("treats credit adjustments as positive using DEP reference prefix", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 20_000, "DEP-20260703-ABC"), 20_000);
  });

  it("treats loan disbursement adjustments as positive", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 50_000, "LND-20260703-ABC"), 50_000);
  });

  it("ignores casing and padding on adjustment reference codes", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 500, "  wdr-20260703-abc "), -500);
  });

  it("defaults adjustments without a reference code to credits", () => {
    assert.equal(getSignedBankTransactionAmount("adjustment", 500), 500);
    assert.equal(getSignedBankTransactionAmount("adjustment", 500, null), 500);
  });

  it("keeps zero amounts at zero magnitude", () => {
    assert.equal(Math.abs(getSignedBankTransactionAmount("withdrawal", 0)), 0);
    assert.equal(Math.abs(getSignedBankTransactionAmount("deposit", 0)), 0);
  });
});

describe("presentBankTransaction — approved credits and debits", () => {
  it("presents an approved deposit as a credit", () => {
    const view = presentBankTransaction({ type: "deposit", amount: 20_000, status: "approved" });
    assert.equal(view.displayAmount, "+ƒ20,000.00");
    assert.equal(view.direction, "credit");
    assert.equal(view.tone, "credit");
    assert.equal(view.amountClassName, "ticker-up");
    assert.equal(view.signedAmount, 20_000);
    assert.equal(view.typeLabel, "Deposit");
    assert.equal(view.statusLabel, null);
    assert.equal(view.showStatus, false);
    assert.equal(view.accessibleAmount, "+ƒ20,000.00 credit");
  });

  it("presents an approved withdrawal as a debit", () => {
    const view = presentBankTransaction({ type: "withdrawal", amount: 750, status: "approved" });
    assert.equal(view.displayAmount, "−ƒ750.00");
    assert.equal(view.direction, "debit");
    assert.equal(view.tone, "debit");
    assert.equal(view.amountClassName, "ticker-down");
    assert.equal(view.signedAmount, -750);
    assert.equal(view.typeLabel, "Withdrawal");
    assert.equal(view.accessibleAmount, "−ƒ750.00 debit");
  });

  it("presents a loan payment as a debit", () => {
    const view = presentBankTransaction({ type: "loan_payment", amount: 4_500, status: "approved" });
    assert.equal(view.displayAmount, "−ƒ4,500.00");
    assert.equal(view.direction, "debit");
    assert.equal(view.amountClassName, "ticker-down");
    assert.equal(view.typeLabel, "Loan Payment");
  });

  it("presents an interest charge as a debit and an interest credit as a credit", () => {
    const charge = presentBankTransaction({
      type: "interest_charge",
      amount: 87.25,
      status: "approved",
    });
    assert.equal(charge.displayAmount, "−ƒ87.25");
    assert.equal(charge.direction, "debit");
    assert.equal(charge.amountClassName, "ticker-down");
    assert.equal(charge.typeLabel, "Interest Charge");

    const credit = presentBankTransaction({
      type: "interest_credit",
      amount: 87.25,
      status: "approved",
    });
    assert.equal(credit.displayAmount, "+ƒ87.25");
    assert.equal(credit.direction, "credit");
    assert.equal(credit.amountClassName, "ticker-up");
    assert.equal(credit.typeLabel, "Interest Payment");
  });

  it("presents a zero amount as neutral without a sign", () => {
    const view = presentBankTransaction({ type: "deposit", amount: 0, status: "approved" });
    assert.equal(view.displayAmount, "ƒ0.00");
    assert.equal(view.direction, "neutral");
    assert.equal(view.tone, "neutral");
    assert.equal(view.amountClassName, "text-muted-foreground");
    assert.equal(view.accessibleAmount, "ƒ0.00 amount");
  });

  it("prefers server-provided type labels", () => {
    const view = presentBankTransaction({
      type: "adjustment",
      amount: 100,
      status: "approved",
      typeLabel: "Courtesy Credit",
    });
    assert.equal(view.typeLabel, "Courtesy Credit");
  });
});

describe("presentBankTransaction — adjustments", () => {
  it("presents WDR adjustments as debits", () => {
    const view = presentBankTransaction({
      type: "adjustment",
      amount: 1_250,
      status: "approved",
      referenceCode: "WDR-20260703-ABC",
    });
    assert.equal(view.displayAmount, "−ƒ1,250.00");
    assert.equal(view.direction, "debit");
    assert.equal(view.amountClassName, "ticker-down");
    assert.equal(view.typeLabel, "Adjustment");
  });

  it("presents DEP adjustments as credits", () => {
    const view = presentBankTransaction({
      type: "adjustment",
      amount: 1_250,
      status: "approved",
      referenceCode: "DEP-20260703-ABC",
    });
    assert.equal(view.displayAmount, "+ƒ1,250.00");
    assert.equal(view.direction, "credit");
    assert.equal(view.amountClassName, "ticker-up");
  });

  it("keeps a denied WDR adjustment neutral instead of showing a debit", () => {
    const view = presentBankTransaction({
      type: "adjustment",
      amount: 1_250,
      status: "denied",
      referenceCode: "WDR-20260703-ABC",
    });
    assert.equal(view.displayAmount, "ƒ1,250.00");
    assert.equal(view.direction, "neutral");
    assert.equal(view.tone, "denied");
    assert.equal(view.signedAmount, 1_250);
  });
});

describe("presentBankTransaction — status handling", () => {
  it("keeps pending amounts signed but tones them down", () => {
    const view = presentBankTransaction({ type: "withdrawal", amount: 300, status: "pending" });
    assert.equal(view.displayAmount, "−ƒ300.00");
    assert.equal(view.direction, "debit");
    assert.equal(view.tone, "pending");
    assert.equal(view.amountClassName, "text-muted-foreground");
    assert.equal(view.statusLabel, "Pending");
    assert.equal(view.showStatus, true);
    assert.equal(view.accessibleAmount, "−ƒ300.00 debit, Pending");
  });

  it("presents denied transactions as neutral absolute amounts", () => {
    const view = presentBankTransaction({ type: "withdrawal", amount: 300, status: "denied" });
    assert.equal(view.displayAmount, "ƒ300.00");
    assert.doesNotMatch(view.displayAmount, /^[−+]/);
    assert.equal(view.direction, "neutral");
    assert.equal(view.tone, "denied");
    assert.equal(view.amountClassName, "text-destructive");
    assert.equal(view.signedAmount, 300);
    assert.equal(view.statusLabel, "Denied");
    assert.equal(view.showStatus, true);
    assert.equal(view.accessibleAmount, "ƒ300.00 amount, Denied");
  });

  it("presents cancelled transactions as neutral absolute amounts", () => {
    const view = presentBankTransaction({ type: "deposit", amount: 300, status: "cancelled" });
    assert.equal(view.displayAmount, "ƒ300.00");
    assert.equal(view.direction, "neutral");
    assert.equal(view.tone, "neutral");
    assert.equal(view.amountClassName, "text-muted-foreground");
    assert.equal(view.statusLabel, "Cancelled");
    assert.equal(view.showStatus, true);
  });

  it("prefers server-provided status labels", () => {
    const view = presentBankTransaction({
      type: "deposit",
      amount: 300,
      status: "pending",
      statusLabel: "Under Review",
    });
    assert.equal(view.statusLabel, "Under Review");
    assert.equal(view.accessibleAmount, "+ƒ300.00 credit, Under Review");
  });

  it("hides status for approved transactions", () => {
    const view = presentBankTransaction({
      type: "deposit",
      amount: 300,
      status: "approved",
      statusLabel: "Approved",
    });
    assert.equal(view.statusLabel, null);
    assert.equal(view.showStatus, false);
  });
});

describe("presentUserBankTransaction", () => {
  it("derives presentation from a server transaction row", () => {
    const view = presentUserBankTransaction(
      transaction({
        type: "withdrawal",
        amount: 1_000,
        status: "approved",
        typeLabel: "Withdrawal",
        referenceCode: "WDR-20260703-ABC",
      }),
    );
    assert.equal(view.displayAmount, "−ƒ1,000.00");
    assert.equal(view.amountClassName, "ticker-down");
    assert.equal(view.showStatus, false);
  });

  it("uses the row reference code to sign adjustments", () => {
    const view = presentUserBankTransaction(
      transaction({
        type: "adjustment",
        amount: 640,
        status: "approved",
        typeLabel: "Adjustment",
        referenceCode: "WDR-20260703-XYZ",
      }),
    );
    assert.equal(view.displayAmount, "−ƒ640.00");
    assert.equal(view.direction, "debit");
  });

  it("surfaces the row status label for pending rows", () => {
    const view = presentUserBankTransaction(
      transaction({
        type: "deposit",
        amount: 640,
        status: "pending",
        statusLabel: "Pending",
      }),
    );
    assert.equal(view.statusLabel, "Pending");
    assert.equal(view.showStatus, true);
    assert.equal(view.tone, "pending");
  });
});
