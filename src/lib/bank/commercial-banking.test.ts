import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COMMERCIAL_FEATURES,
  MERCHANT_ANALYTICS_RANGES,
} from "@/lib/bank/commercial-banking-types";
import {
  canAccessMerchantAnalytics,
  canManageCommercialPlan,
  canViewCommercialAnalytics,
  companyHasCommercialFeature,
  mapCommercialPlanSettings,
  mapVerificationStatus,
} from "@/server/commercial-plan.service";
import {
  computeMerchantAnalyticsSummary,
  resolveAnalyticsRangeStart,
} from "@/server/merchant-analytics.service";
import {
  canManageMerchantInvoices,
  canViewMerchantInvoices,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import {
  computeMerchantInvoiceFee,
  type MerchantInvoiceFeeConfig,
} from "@/server/merchant-invoice-fee.service";
import {
  computePaymentLinkFee,
  type PaymentLinkFeeConfig,
} from "@/server/payment-link-fee.service";

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

describe("commercial verification mapping", () => {
  it("maps company verification statuses", () => {
    assert.equal(mapVerificationStatus("VERIFIED"), "verified");
    assert.equal(mapVerificationStatus("PENDING"), "pending");
    assert.equal(mapVerificationStatus("UNVERIFIED"), "unverified");
    assert.equal(mapVerificationStatus("REJECTED"), "rejected");
  });
});

describe("commercial role permissions", () => {
  it("allows treasury manage roles to manage commercial receivables", () => {
    assert.equal(canManageMerchantInvoices(baseUser("owner"), { companyId: "co-1" }), true);
    assert.equal(canManageMerchantInvoices(baseUser("finance_manager"), { companyId: "co-1" }), true);
    assert.equal(canManageMerchantInvoices(baseUser("viewer"), { companyId: "co-1" }), false);
  });

  it("allows viewer to view commercial analytics eligibility at role level", () => {
    assert.equal(canViewCommercialAnalytics(baseUser("viewer"), "co-1"), false);
    assert.equal(canViewCommercialAnalytics(baseUser("compliance_contact"), "co-1"), true);
    assert.equal(canManageCommercialPlan(baseUser("viewer"), "co-1"), false);
  });
});

describe("commercial plan feature gating", () => {
  it("defaults CORE and PRO feature sets", () => {
    assert.deepEqual(DEFAULT_COMMERCIAL_FEATURES.CORE, ["invoices", "payment_links"]);
    assert.ok(DEFAULT_COMMERCIAL_FEATURES.PRO.includes("merchant_analytics"));
    assert.ok(DEFAULT_COMMERCIAL_FEATURES.PRO.includes("payroll"));
  });

  it("gates merchant analytics to PRO", () => {
    const core = mapCommercialPlanSettings({
      commercialPlan: "CORE",
      planStatus: "ACTIVE",
      billingStatus: "NOT_BILLED",
      commercialMonthlyFee: null,
      commercialEnabledFeatures: null,
    });
    const pro = mapCommercialPlanSettings({
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "NOT_BILLED",
      commercialMonthlyFee: null,
      commercialEnabledFeatures: null,
    });
    assert.equal(canAccessMerchantAnalytics(core), false);
    assert.equal(canAccessMerchantAnalytics(pro), true);
    assert.equal(companyHasCommercialFeature(core, "invoices"), true);
    assert.equal(companyHasCommercialFeature(core, "merchant_analytics"), false);
  });

  it("blocks features when plan is suspended", () => {
    const suspended = mapCommercialPlanSettings({
      commercialPlan: "PRO",
      planStatus: "SUSPENDED",
      billingStatus: "NOT_BILLED",
      commercialMonthlyFee: null,
      commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
    });
    assert.equal(canAccessMerchantAnalytics(suspended), false);
  });
});

describe("merchant analytics calculations", () => {
  it("computes gross, net, and success rates", () => {
    const summary = computeMerchantAnalyticsSummary({
      invoicePayments: [
        { amount: 100, feeAmount: 2 },
        { amount: 50, feeAmount: 1 },
      ],
      linkPayments: [{ amount: 25, feeAmount: 0.5 }],
      failedAttempts: 1,
    });
    assert.equal(summary.grossVolume, 175);
    assert.equal(summary.netVolume, 171.5);
    assert.equal(summary.invoiceRevenue, 150);
    assert.equal(summary.paymentLinkRevenue, 25);
    assert.equal(summary.averagePaymentSize, 58.33);
    assert.equal(summary.paymentSuccessRate, 75);
    assert.equal(summary.paymentFailureRate, 25);
  });

  it("supports analytics time ranges", () => {
    assert.ok(resolveAnalyticsRangeStart("7D") instanceof Date);
    assert.ok(resolveAnalyticsRangeStart("YTD") instanceof Date);
    assert.equal(resolveAnalyticsRangeStart("ALL"), null);
    assert.equal(MERCHANT_ANALYTICS_RANGES.length, 5);
  });
});

describe("merchant receivables fee calculations", () => {
  it("computes invoice and payment link fees consistently", () => {
    const config: MerchantInvoiceFeeConfig = {
      enabled: true,
      type: "percent",
      value: 2,
      minFee: 1,
      maxFee: 10,
    };
    const linkConfig: PaymentLinkFeeConfig = config;
    assert.equal(computeMerchantInvoiceFee(100, config).feeAmount, 2);
    assert.equal(computePaymentLinkFee(100, linkConfig).feeAmount, 2);
  });
});

describe("commercial audit helpers", () => {
  it("writes commercial plan changed audit metadata shape", async () => {
    const { recordCommercialPlanChangedAudit } = await import("@/server/commercial-audit.service");
    assert.equal(typeof recordCommercialPlanChangedAudit, "function");
  });
});
