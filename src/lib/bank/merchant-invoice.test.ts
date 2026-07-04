import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMerchantInvoiceFee,
  type MerchantInvoiceFeeConfig,
} from "@/server/merchant-invoice-fee.service";
import {
  canManageMerchantInvoices,
  canViewMerchantInvoices,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";

describe("merchant invoice fee service", () => {
  it("returns zero fee when disabled", () => {
    const config: MerchantInvoiceFeeConfig = { enabled: false, type: "percent", value: 1 };
    const result = computeMerchantInvoiceFee(25_000, config);
    assert.equal(result.feeAmount, 0);
    assert.equal(result.netAmount, 25_000);
    assert.equal(result.totalDebited, 25_000);
  });

  it("computes percent fee with min/max bounds", () => {
    const config: MerchantInvoiceFeeConfig = {
      enabled: true,
      type: "percent",
      value: 1,
      minFee: 100,
      maxFee: 500,
    };
    assert.equal(computeMerchantInvoiceFee(10_000, config).feeAmount, 100);
    assert.equal(computeMerchantInvoiceFee(100_000, config).feeAmount, 500);
    assert.equal(computeMerchantInvoiceFee(25_000, config).feeAmount, 250);
  });
});

describe("merchant invoice permissions", () => {
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

  it("allows treasury manage roles to manage invoices", () => {
    assert.equal(canManageMerchantInvoices(baseUser("owner"), { companyId: "co-1" }), true);
    assert.equal(canManageMerchantInvoices(baseUser("finance_manager"), { companyId: "co-1" }), true);
    assert.equal(canManageMerchantInvoices(baseUser("viewer"), { companyId: "co-1" }), false);
  });

  it("allows compliance contact to view invoices", () => {
    assert.equal(canViewMerchantInvoices(baseUser("compliance_contact"), { companyId: "co-1" }), true);
    assert.equal(canViewMerchantInvoices(baseUser("viewer"), { companyId: "co-1" }), false);
  });
});

describe("merchant invoice payable statuses", () => {
  it("exports expected payable statuses", async () => {
    const { PAYABLE_INVOICE_STATUSES } = await import("@/lib/bank/merchant-invoice-types");
    assert.deepEqual(PAYABLE_INVOICE_STATUSES, ["SENT", "VIEWED", "OVERDUE"]);
  });
});
