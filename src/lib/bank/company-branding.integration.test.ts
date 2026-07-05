/**
 * Integration test for company checkout branding.
 * Requires DATABASE_URL pointing at a local/dev database.
 *
 *   npx tsx --test src/lib/bank/company-branding.integration.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "@/server/db";
import {
  getCompanyBrandingSettings,
  resolveBrandingForMerchantCompany,
  updateCompanyBrandingSettings,
} from "@/server/company-branding.service";
import { canPublishInvoiceBranding } from "@/lib/bank/commercial-banking-types";
import { mapCommercialPlanSettings } from "@/server/commercial-plan.service";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function findMerchantCompany() {
  const company = await prisma.company.findFirst({
    where: {
      verificationStatus: "VERIFIED",
      bankAccounts: { some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" } },
      memberships: { some: { role: "OWNER" } },
    },
    include: {
      memberships: { where: { role: "OWNER" }, take: 1 },
    },
  });
  if (!company?.memberships[0]) return null;
  return {
    companyId: company.id,
    merchantUserId: company.memberships[0].userId,
    plan: mapCommercialPlanSettings(company),
  };
}

async function findProMerchantCompany() {
  const company = await prisma.company.findFirst({
    where: {
      verificationStatus: "VERIFIED",
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      bankAccounts: { some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" } },
      memberships: { some: { role: "OWNER" } },
    },
    include: {
      memberships: { where: { role: "OWNER" }, take: 1 },
    },
  });
  if (!company?.memberships[0]) return null;
  const plan = mapCommercialPlanSettings(company);
  if (!canPublishInvoiceBranding(plan)) return null;
  return {
    companyId: company.id,
    merchantUserId: company.memberships[0].userId,
    plan,
  };
}

describe("company branding integration", { skip: !hasDatabaseUrl() }, () => {
  it("loads branding settings for merchant owners", async () => {
    const actors = await findMerchantCompany();
    assert.ok(actors, "Need verified company with owner");

    const settings = await getCompanyBrandingSettings(actors.merchantUserId, actors.companyId);
    assert.ok(settings.companyName);
    assert.equal(settings.companyId, actors.companyId);
    assert.equal(settings.canPublish, canPublishInvoiceBranding(actors.plan));
    assert.equal(settings.canPreview, true);
  });

  it("blocks branding updates for Core companies", async () => {
    const actors = await findMerchantCompany();
    assert.ok(actors, "Need verified company with owner");
    if (canPublishInvoiceBranding(actors.plan)) {
      return;
    }

    await assert.rejects(
      () =>
        updateCompanyBrandingSettings(actors.merchantUserId, actors.companyId, {
          brandColor: "#112233",
          accentColor: "#aabbcc",
          invoiceFooterText: "Integration test footer",
          paymentLinkFooterText: null,
          supportEmail: null,
          supportDiscord: null,
          websiteUrl: null,
          displayNameOverride: null,
        }),
      /BAD_REQUEST:.*Pro/i,
    );
  });

  it("persists branding for Pro companies and applies it on public checkout", async () => {
    const actors = await findProMerchantCompany();
    if (!actors) return;

    const existing = await prisma.companyBranding.findUnique({
      where: { companyId: actors.companyId },
    });

    try {
      const updated = await updateCompanyBrandingSettings(actors.merchantUserId, actors.companyId, {
        brandColor: "#223344",
        accentColor: "#556677",
        invoiceFooterText: "Branding integration test footer",
        paymentLinkFooterText: "Branding integration test link footer",
        supportEmail: "branding-test@example.com",
        supportDiscord: null,
        websiteUrl: "https://example.com",
        displayNameOverride: "Branding Test Merchant",
      });

      assert.equal(updated.canPublish, true);
      assert.equal(updated.brandColor, "#223344");
      assert.equal(updated.displayNameOverride, "Branding Test Merchant");

      const publicBranding = await resolveBrandingForMerchantCompany(actors.companyId);
      assert.equal(publicBranding.isCustomBrandingApplied, true);
      assert.equal(publicBranding.merchantDisplayName, "Branding Test Merchant");
      assert.equal(publicBranding.invoiceFooterText, "Branding integration test footer");
    } finally {
      if (existing) {
        await prisma.companyBranding.update({
          where: { companyId: actors.companyId },
          data: {
            brandColor: existing.brandColor,
            accentColor: existing.accentColor,
            invoiceFooterText: existing.invoiceFooterText,
            paymentLinkFooterText: existing.paymentLinkFooterText,
            supportEmail: existing.supportEmail,
            supportDiscord: existing.supportDiscord,
            websiteUrl: existing.websiteUrl,
            displayNameOverride: existing.displayNameOverride,
            rejectedAt: existing.rejectedAt,
            rejectedReason: existing.rejectedReason,
          },
        });
      } else {
        await prisma.companyBranding.deleteMany({ where: { companyId: actors.companyId } });
      }
    }
  });
});
