import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COMMERCIAL_PLATFORM_SETTINGS,
  parseCommercialPlatformSettings,
} from "@/lib/platform/commercial-plan-settings-types";
import {
  addBillingMonths,
  canDowngradeCommercialPro,
  isPastGracePeriod,
} from "@/server/commercial-billing.service";
import {
  canCreateCommercialInvoice,
  canCreateCommercialPaymentLink,
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
    assert.equal(DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.corePaymentLinkMonthlyLimit, 5);
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

  it("allows owners and executives to downgrade Pro", () => {
    assert.equal(canDowngradeCommercialPro(ownerUser, "co-1"), true);
    const executive: AltaUser = {
      ...ownerUser,
      companyMemberships: [{ ...ownerUser.companyMemberships[0]!, role: "executive" }],
    };
    assert.equal(canDowngradeCommercialPro(executive, "co-1"), true);
  });

  it("blocks finance managers from downgrading Pro", () => {
    assert.equal(canDowngradeCommercialPro(financeUser, "co-1"), false);
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

  it("extends active admin grants from current expiry", async () => {
    const { resolveAdminGrantExpiresAt } = await import("@/server/commercial-billing.service");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const currentExpiresAt = new Date("2026-06-01T00:00:00.000Z");
    const extended = resolveAdminGrantExpiresAt({
      now,
      months: 3,
      currentExpiresAt,
      isActiveAdminGrant: true,
    });
    assert.equal(extended.toISOString(), "2026-09-01T00:00:00.000Z");
  });

  it("starts admin grant duration from now when not extending", async () => {
    const { resolveAdminGrantExpiresAt } = await import("@/server/commercial-billing.service");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = resolveAdminGrantExpiresAt({
      now,
      months: 2,
      currentExpiresAt: null,
      isActiveAdminGrant: false,
    });
    assert.equal(expiresAt.toISOString(), "2026-03-01T00:00:00.000Z");
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

  it("describes monthly payment link limits", () => {
    const message = commercialLimitMessage("payment links", 5, "payment links created per month");
    assert.match(message, /5 payment links created per month/);
  });

  it("allows Pro companies to create unlimited receivables", () => {
    const proUsage = {
      isPro: true,
      paymentLinksThisMonth: 100,
      invoicesThisMonth: 100,
      teamMembers: 10,
      limits: {
        coreInvoiceMonthlyLimit: 10,
        corePaymentLinkMonthlyLimit: 5,
        coreTeamMemberLimit: 3,
      },
    };
    assert.equal(canCreateCommercialPaymentLink(proUsage), true);
    assert.equal(canCreateCommercialInvoice(proUsage), true);
  });

  it("blocks Core companies at monthly receivable limits", () => {
    const coreAtLimit = {
      isPro: false,
      paymentLinksThisMonth: 5,
      invoicesThisMonth: 10,
      teamMembers: 2,
      limits: {
        coreInvoiceMonthlyLimit: 10,
        corePaymentLinkMonthlyLimit: 5,
        coreTeamMemberLimit: 3,
      },
    };
    assert.equal(canCreateCommercialPaymentLink(coreAtLimit), false);
    assert.equal(canCreateCommercialInvoice(coreAtLimit), false);

    const coreBelowLimit = {
      ...coreAtLimit,
      paymentLinksThisMonth: 4,
      invoicesThisMonth: 9,
    };
    assert.equal(canCreateCommercialPaymentLink(coreBelowLimit), true);
    assert.equal(canCreateCommercialInvoice(coreBelowLimit), true);
  });
});

describe("commercial notification batching", () => {
  it("rejects object payloads passed as user ids", async () => {
    const { createUserNotifications } = await import("@/server/notification.service");
    await assert.rejects(
      () =>
        createUserNotifications(
          [
            {
              userId: "user-1",
              type: "COMMERCIAL_PRO_ACTIVATED",
              title: "Test",
              body: "Test",
            } as unknown as string,
          ],
          {
            type: "COMMERCIAL_PRO_ACTIVATED",
            title: "Test",
            body: "Test",
          },
        ),
      /expected string user ids/,
    );
  });
});

describe("commercial downgrade cleanup", () => {
  it("selects newest rows beyond the Core limit", async () => {
    const { selectExcessRowIds } = await import("@/server/commercial-downgrade-cleanup.service");
    const rows = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
      { id: "f" },
    ];
    assert.deepEqual(selectExcessRowIds(rows, 5), ["f"]);
    assert.deepEqual(selectExcessRowIds(rows, 10), []);
  });

  it("exports downgrade cleanup runner", async () => {
    const cleanup = await import("@/server/commercial-downgrade-cleanup.service");
    assert.equal(typeof cleanup.applyCommercialCoreDowngradeCleanup, "function");
    assert.equal(typeof cleanup.previewCommercialCoreDowngradeCleanup, "function");
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
    assert.equal(typeof audit.recordCommercialProAdminGrantedAudit, "function");
  });

  it("exports billing notification helpers", async () => {
    const notifications = await import("@/server/banking-notification.service");
    assert.equal(typeof notifications.notifyCommercialProActivated, "function");
    assert.equal(typeof notifications.notifyCommercialProBillingFailed, "function");
    assert.equal(typeof notifications.notifyCommercialProDowngraded, "function");
    assert.equal(typeof notifications.notifyCommercialProAdminGranted, "function");
  });
});

describe("commercial billing cron job", () => {
  it("exports daily billing job runner", async () => {
    const job = await import("@/server/commercial-pro-billing-job.service");
    assert.equal(typeof job.runCommercialProBillingJob, "function");
    assert.equal(job.COMMERCIAL_PRO_BILLING_JOB_KEY, "commercial-pro-billing");
  });
});
