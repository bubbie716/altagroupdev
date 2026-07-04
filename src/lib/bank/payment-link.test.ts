import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePaymentLinkFee,
  type PaymentLinkFeeConfig,
} from "@/server/payment-link-fee.service";
import {
  canManagePaymentLinks,
  canViewPaymentLinks,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";

describe("payment link fee service", () => {
  it("returns zero fee when disabled", () => {
    const config: PaymentLinkFeeConfig = { enabled: false, type: "percent", value: 1 };
    const result = computePaymentLinkFee(10_000, config);
    assert.equal(result.feeAmount, 0);
    assert.equal(result.totalDebited, 10_000);
  });

  it("computes percent fee with bounds", () => {
    const config: PaymentLinkFeeConfig = {
      enabled: true,
      type: "percent",
      value: 2,
      minFee: 50,
      maxFee: 200,
    };
    assert.equal(computePaymentLinkFee(1_000, config).feeAmount, 50);
    assert.equal(computePaymentLinkFee(20_000, config).feeAmount, 200);
    assert.equal(computePaymentLinkFee(5_000, config).feeAmount, 100);
  });
});

describe("payment link permissions", () => {
  const baseUser = (role: AltaUser["companyMemberships"][number]["role"]): AltaUser => ({
    id: "user-1",
    discordId: "1",
    discordUsername: "merchant",
    tags: [],
    companyMemberships: [
      {
        companyId: "co-1",
        companyName: "District Construction LLC",
        companyTicker: "DCL",
        role,
        verificationStatus: "verified",
      },
    ],
  });

  it("allows treasury manage roles to manage payment links", () => {
    assert.equal(canManagePaymentLinks(baseUser("owner"), { companyId: "co-1" }), true);
    assert.equal(canManagePaymentLinks(baseUser("executive"), { companyId: "co-1" }), true);
    assert.equal(canManagePaymentLinks(baseUser("finance_manager"), { companyId: "co-1" }), true);
    assert.equal(canManagePaymentLinks(baseUser("viewer"), { companyId: "co-1" }), false);
  });

  it("allows compliance contact to view payment links", () => {
    assert.equal(canViewPaymentLinks(baseUser("compliance_contact"), { companyId: "co-1" }), true);
    assert.equal(canViewPaymentLinks(baseUser("viewer"), { companyId: "co-1" }), false);
  });
});
