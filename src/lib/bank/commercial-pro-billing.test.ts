import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COMMERCIAL_PLATFORM_SETTINGS,
  parseCommercialPlatformSettings,
} from "@/lib/platform/commercial-plan-settings-types";
import {
  addBillingMonths,
  isPastGracePeriod,
} from "@/server/commercial-billing.service";
import {
  commercialLimitMessage,
  isCommercialProActive,
  startOfUtcMonth,
} from "@/server/commercial-limits.service";
import {
  canAccessAdvancedMerchantAnalytics,
  canPurchaseCommercialPro,
  mapCommercialPlanSettings,
} from "@/server/commercial-plan.service";
import { DEFAULT_COMMERCIAL_FEATURES } from "@/lib/bank/commercial-banking-types";
import type { AltaUser } from "@/lib/auth/types";

const ownerUser: AltaUser = {
  id: "user-owner",
  discordId: "1",
  discordUsername: "owner",
  tags: [],
  companyMemberships: [
    {
      companyId: "co-1",
      companyName: "Test Co",
      companyTicker: "TST",
      role: "owner",
      verificationStatus: "verified",
    },
  ],
};

const financeUser: AltaUser = {
  ...ownerUser,
  id: "user-finance",
  companyMemberships: [
    {
      companyId: "co-1",
      companyName: "Test Co",
      companyTicker: "TST",
      role: "finance_manager",
      verificationStatus: "verified",
    },
  ],
};

describe("commercial platform settings defaults", () => {
  it("uses sensible defaults", () => {
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.proMonthlyFee, 10_000);
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.coreInvoiceMonthlyLimit, 10);
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.coreActivePaymentLinkLimit, 5);
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.coreTeamMemberLimit, 3);
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.proBillingGracePeriodDays, 7);
  });

  it("parses partial platform settings", () => {
    const parsed = parseCommercialPlatformSettings({ proMonthlyFee: 12_500 });
    assert.equal(parsed.proMonthlyFee, 12_500);
    assert.equal(parsed.coreInvoiceMonthlyLimit, 10);
  });
});

describe("commercial pro purchase permissions", () => {
  it("allows owner and executive to purchase Pro", () => {
    assert.equal(canPurchaseCommercialPro(ownerUser, "co-1"), true);
    const executive: AltaUser = {
      ...ownerUser,
      companyMemberships: [{ ...ownerUser.companyMemberships[0]!, role: "executive" }],
    };
    assert.equal(canPurchaseCommercialPro(executive, "co-1"), true);
  });

  it("blocks finance managers from purchasing Pro", () => {
    assert.equal(canPurchaseCommercialPro(financeUser, "co-1"), false);
  });
});

describe("commercial plan limits messaging", () => {
  it("describes Core limits with upgrade guidance", () => {
    const message = commercialLimitMessage("invoices", 10, "invoices per month");
    assert.match(message, /10 invoices per month/);
    assert.match(message, /Upgrade to Pro/);
  });

  it("treats active Pro as unlimited", () => {
    const pro = mapCommercialPlanSettings({
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "CURRENT",
      commercialMonthlyFee: 10_000,
      commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
    });
    assert.equal(isCommercialProActive(pro), true);
    assert.equal(canAccessAdvancedMerchantAnalytics(pro), true);
  });
});

describe("commercial billing cycle helpers", () => {
  it("advances billing dates by one month", () => {
    const start = new Date("2026-01-15T12:00:00.000Z");
    const next = addBillingMonths(start, 1);
    assert.equal(next.getUTCMonth(), 1);
    assert.equal(next.getUTCDate(), 15);
  });

  it("detects grace period expiry", () => {
    const pastDueAt = new Date("2026-01-01T00:00:00.000Z");
    const beforeGraceEnds = new Date("2026-01-07T23:59:59.000Z");
    const afterGraceEnds = new Date("2026-01-08T00:00:00.000Z");
    assert.equal(isPastGracePeriod(pastDueAt, 7, beforeGraceEnds), false);
    assert.equal(isPastGracePeriod(pastDueAt, 7, afterGraceEnds), true);
  });

  it("uses UTC month boundaries for invoice limits", () => {
    const monthStart = startOfUtcMonth(new Date("2026-03-18T10:00:00.000Z"));
    assert.equal(monthStart.toISOString(), "2026-03-01T00:00:00.000Z");
  });
});

describe("commercial pro feature set", () => {
  it("includes payroll and invoice branding on Pro", () => {
    assert.ok(DEFAULT_COMMERCIAL_FEATURES.PRO.includes("payroll"));
    assert.ok(DEFAULT_COMMERCIAL_FEATURES.PRO.includes("invoice_branding"));
    assert.ok(DEFAULT_COMMERCIAL_FEATURES.PRO.includes("merchant_analytics"));
  });
});

describe("commercial audit helpers", () => {
  it("exports billing audit recorders", async () => {
    const audit = await import("@/server/commercial-audit.service");
    assert.equal(typeof audit.recordCommercialProPurchasedAudit, "function");
    assert.equal(typeof audit.recordCommercialProBillingSucceededAudit, "function");
    assert.equal(typeof audit.recordCommercialProDowngradedAudit, "function");
    assert.equal(typeof audit.recordCommercialBillingAccountChangedAudit, "function");
  });

  it("exports billing notification helpers", async () => {
    const notifications = await import("@/server/banking-notification.service");
    assert.equal(typeof notifications.notifyCommercialProActivated, "function");
    assert.equal(typeof notifications.notifyCommercialProBillingFailed, "function");
    assert.equal(typeof notifications.notifyCommercialProDowngraded, "function");
  });
});

describe("commercial billing cron job", () => {
  it("exports daily billing job runner", async () => {
    const job = await import("@/server/commercial-pro-billing-job.service");
    assert.equal(typeof job.runCommercialProBillingJob, "function");
    assert.equal(job.COMMERCIAL_PRO_BILLING_JOB_KEY, "commercial-pro-billing");
  });
});
