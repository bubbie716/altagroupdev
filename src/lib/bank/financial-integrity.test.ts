import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAvailableBalance } from "../../server/account-balance.service.ts";
import {
  altaPayReversalMarker,
  altaPayPaymentReversalKey,
  normalizeAltaPayReference,
  parseAltaPayReversalMarker,
} from "./alta-pay-reversal.ts";
import {
  adjustmentReversalNote,
  isAdjustmentReversalNote,
  parseAdjustmentReversalNote,
} from "./adjustment-reversal.ts";
import { requireOperatorReason } from "../../server/operator-reason.service.ts";

describe("financial integrity helpers", () => {
  it("computes available balance from ledger, pending withdrawals, and holds", () => {
    assert.equal(computeAvailableBalance(1000, 150, 50), 800);
    assert.equal(computeAvailableBalance(100, 0, 0), 100);
    assert.equal(computeAvailableBalance(100, 100, 0), 0);
  });

  it("excludes the withdrawal being approved from reserved pending math", () => {
    const balance = 1000;
    const holds = 100;
    const otherPending = 200;
    const approvingAmount = 300;
    const availableForApproval = computeAvailableBalance(balance, otherPending, holds);
    assert.equal(availableForApproval, 700);
    assert.ok(approvingAmount <= availableForApproval);
  });

  it("rejects approval when other pending withdrawals consume available balance", () => {
    const balance = 500;
    const holds = 0;
    const otherPending = 450;
    const approvingAmount = 100;
    const availableForApproval = computeAvailableBalance(balance, otherPending, holds);
    assert.equal(availableForApproval, 50);
    assert.ok(approvingAmount > availableForApproval);
  });
});

describe("requireOperatorReason", () => {
  it("returns trimmed reason when present", () => {
    assert.equal(requireOperatorReason("  reviewed proof  "), "reviewed proof");
  });

  it("throws BAD_REQUEST when reason missing", () => {
    assert.throws(() => requireOperatorReason("   "), (error: Error) => {
      assert.match(error.message, /^BAD_REQUEST:/);
      return true;
    });
  });
});

describe("alta pay reversal markers", () => {
  it("builds stable reversal markers for future AltaPayPayment entity", () => {
    const base = "PAY-20260703-ABC123";
    assert.equal(altaPayReversalMarker(base), "reversesAltaPay:PAY-20260703-ABC123");
    assert.equal(altaPayPaymentReversalKey(base), "alta-pay-reversal:PAY-20260703-ABC123");
  });

  it("normalizes pay reference codes", () => {
    assert.equal(normalizeAltaPayReference("PAY-20260703-ABC123-OUT"), "PAY-20260703-ABC123");
    assert.equal(normalizeAltaPayReference("PAY-20260703-ABC123-IN"), "PAY-20260703-ABC123");
  });

  it("parses reversal marker from memo", () => {
    const memo = `Operator correction · ${altaPayReversalMarker("PAY-1")}`;
    assert.equal(parseAltaPayReversalMarker(memo), "PAY-1");
    assert.equal(parseAltaPayReversalMarker("no marker"), null);
  });
});

describe("adjustment reversal markers", () => {
  it("links reversals to original adjustment reference", () => {
    assert.equal(adjustmentReversalNote("ADJ-123"), "reversesAdjustment:ADJ-123");
    assert.equal(parseAdjustmentReversalNote("note reversesAdjustment:ADJ-123"), "ADJ-123");
    assert.equal(isAdjustmentReversalNote("reversesAdjustment:ADJ-123"), true);
    assert.equal(isAdjustmentReversalNote("manual correction"), false);
  });
});

describe("interbank safety message", () => {
  it("documents unavailable interbank fulfillment", async () => {
    const { INTERBANK_TRANSFERS_UNAVAILABLE_MESSAGE } = await import(
      "../../server/financial-integrity.service.ts"
    );
    assert.match(INTERBANK_TRANSFERS_UNAVAILABLE_MESSAGE, /not yet available/i);
  });
});

describe("company treasury permission model", () => {
  it("requires manage role for business treasury actions", async () => {
    const { canManageBusinessTreasury } = await import("../auth/permissions.ts");
    const viewer = {
      id: "u1",
      discordId: "d1",
      discordUsername: "viewer",
      tags: [],
      companyMemberships: [{ companyId: "c1", role: "viewer" as const }],
    };
    const finance = {
      ...viewer,
      companyMemberships: [{ companyId: "c1", role: "finance_manager" as const }],
    };
    assert.equal(canManageBusinessTreasury(viewer, { companyId: "c1" }), false);
    assert.equal(canManageBusinessTreasury(finance, { companyId: "c1" }), true);
  });
});
