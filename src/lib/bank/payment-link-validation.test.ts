import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validatePaymentLinkAmountRules,
  validatePaymentLinkExpiration,
  validatePaymentLinkMinMax,
} from "@/lib/bank/payment-link-validation";

describe("validatePaymentLinkMinMax", () => {
  it("allows empty bounds", () => {
    assert.equal(validatePaymentLinkMinMax(null, null), null);
    assert.equal(validatePaymentLinkMinMax(undefined, undefined), null);
  });

  it("rejects non-positive bounds", () => {
    assert.match(validatePaymentLinkMinMax(0, null) ?? "", /Minimum/);
    assert.match(validatePaymentLinkMinMax(null, -1) ?? "", /Maximum/);
  });

  it("rejects min greater than max", () => {
    assert.equal(
      validatePaymentLinkMinMax(100, 50),
      "Minimum amount cannot exceed maximum amount.",
    );
  });

  it("allows equal and ordered bounds", () => {
    assert.equal(validatePaymentLinkMinMax(50, 50), null);
    assert.equal(validatePaymentLinkMinMax(10, 100), null);
    assert.equal(validatePaymentLinkMinMax(25, null), null);
    assert.equal(validatePaymentLinkMinMax(null, 75), null);
  });
});

describe("validatePaymentLinkExpiration", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");

  it("allows empty expiration", () => {
    assert.equal(validatePaymentLinkExpiration(null, now), null);
    assert.equal(validatePaymentLinkExpiration("", now), null);
  });

  it("rejects invalid dates", () => {
    assert.equal(validatePaymentLinkExpiration("not-a-date", now), "Enter a valid expiration date.");
  });

  it("rejects already-expired timestamps", () => {
    assert.equal(
      validatePaymentLinkExpiration("2026-07-26T14:59:00.000Z", now),
      "Expiration must be in the future.",
    );
  });

  it("allows future expirations", () => {
    assert.equal(validatePaymentLinkExpiration("2026-07-26T16:00:00.000Z", now), null);
  });
});

describe("validatePaymentLinkAmountRules", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");

  it("requires fixed amount > 0", () => {
    assert.match(
      validatePaymentLinkAmountRules(
        {
          amountType: "FIXED",
          amount: "",
          minAmount: "",
          maxAmount: "",
          expiresAt: "",
        },
        now,
      ) ?? "",
      /fixed amount/i,
    );
  });

  it("validates open amount min/max together", () => {
    assert.equal(
      validatePaymentLinkAmountRules(
        {
          amountType: "OPEN",
          amount: "",
          minAmount: "200",
          maxAmount: "50",
          expiresAt: "",
        },
        now,
      ),
      "Minimum amount cannot exceed maximum amount.",
    );
  });
});
