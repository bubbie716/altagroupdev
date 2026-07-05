import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
} from "@/lib/bank/company-branding-types";
import {
  resolveCustomerFacingBranding,
  resolvePreviewBranding,
} from "@/lib/bank/company-branding-resolve";
import {
  CompanyBrandingValidationError,
  normalizeHexColor,
  sanitizeBrandingText,
  validateCompanyBrandingInput,
} from "@/lib/bank/company-branding-validation";
import { canPublishInvoiceBranding } from "@/lib/bank/commercial-banking-types";
import type { CommercialPlanSettings } from "@/lib/bank/commercial-banking-types";
import { DEFAULT_COMMERCIAL_FEATURES } from "@/lib/bank/commercial-banking-types";

const proPlan: CommercialPlanSettings = {
  commercialPlan: "PRO",
  planStatus: "ACTIVE",
  billingStatus: "CURRENT",
  monthlyFee: 10_000,
  enabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
};

const corePlan: CommercialPlanSettings = {
  commercialPlan: "CORE",
  planStatus: "ACTIVE",
  billingStatus: "NOT_BILLED",
  monthlyFee: null,
  enabledFeatures: DEFAULT_COMMERCIAL_FEATURES.CORE,
};

const savedBranding = {
  companyId: "co-1",
  logoUrl: "https://cdn.example/logo.png",
  brandColor: "#112233",
  accentColor: "#aabbcc",
  invoiceFooterText: "Thank you for your business.",
  paymentLinkFooterText: "Questions? Email support@merchant.test",
  supportEmail: "support@merchant.test",
  supportDiscord: "merchantdesk",
  websiteUrl: "https://merchant.test",
  displayNameOverride: "Merchant Co",
  showPoweredByAlta: true as const,
  rejectedAt: null,
  rejectedReason: null,
  updatedAt: new Date().toISOString(),
};

describe("company branding validation", () => {
  it("accepts valid hex colors and sanitized footer text", () => {
    const validated = validateCompanyBrandingInput({
      brandColor: "112233",
      accentColor: "#aabbcc",
      invoiceFooterText: "Thank you for your business.",
      websiteUrl: "merchant.test",
      supportEmail: "help@merchant.test",
    });
    assert.equal(validated.brandColor, "#112233");
    assert.equal(validated.accentColor, "#aabbcc");
    assert.equal(validated.websiteUrl, "https://merchant.test/");
  });

  it("rejects invalid hex colors", () => {
    assert.throws(
      () => validateCompanyBrandingInput({ brandColor: "not-a-color" }),
      CompanyBrandingValidationError,
    );
  });

  it("rejects impersonation wording in footer text", () => {
    assert.throws(
      () => sanitizeBrandingText("Official Alta Bank payment portal", 500),
      CompanyBrandingValidationError,
    );
  });

  it("rejects tracking/script patterns", () => {
    assert.throws(
      () => sanitizeBrandingText('<script src="evil"></script>', 500),
      CompanyBrandingValidationError,
    );
  });

  it("normalizes hex with hash", () => {
    assert.equal(normalizeHexColor("0f1729", DEFAULT_BRAND_COLOR), "#0f1729");
  });
});

describe("company branding Pro gating", () => {
  it("allows Pro companies to publish branding", () => {
    assert.equal(canPublishInvoiceBranding(proPlan), true);
  });

  it("blocks Core companies from publishing branding", () => {
    assert.equal(canPublishInvoiceBranding(corePlan), false);
  });

  it("blocks suspended Pro companies from publishing branding", () => {
    assert.equal(
      canPublishInvoiceBranding({
        ...proPlan,
        planStatus: "SUSPENDED",
      }),
      false,
    );
  });

  it("blocks Pro companies without invoice_branding feature", () => {
    assert.equal(
      canPublishInvoiceBranding({
        ...proPlan,
        enabledFeatures: proPlan.enabledFeatures.filter((f) => f !== "invoice_branding"),
      }),
      false,
    );
  });

  it("applies custom branding publicly for active Pro companies", () => {
    const resolved = resolveCustomerFacingBranding({
      companyName: "District Construction LLC",
      plan: proPlan,
      branding: savedBranding,
    });
    assert.equal(resolved.isCustomBrandingApplied, true);
    assert.equal(resolved.merchantDisplayName, "Merchant Co");
    assert.equal(resolved.logoUrl, savedBranding.logoUrl);
    assert.equal(resolved.showPoweredByAlta, true);
  });

  it("uses Alta defaults for Core companies even when branding is saved", () => {
    const resolved = resolveCustomerFacingBranding({
      companyName: "District Construction LLC",
      plan: corePlan,
      branding: savedBranding,
    });
    assert.equal(resolved.isCustomBrandingApplied, false);
    assert.equal(resolved.merchantDisplayName, "District Construction LLC");
    assert.equal(resolved.logoUrl, null);
    assert.equal(resolved.brandColor, DEFAULT_BRAND_COLOR);
    assert.equal(resolved.accentColor, DEFAULT_ACCENT_COLOR);
  });

  it("uses Alta defaults when branding was rejected", () => {
    const resolved = resolveCustomerFacingBranding({
      companyName: "District Construction LLC",
      plan: proPlan,
      branding: {
        ...savedBranding,
        rejectedAt: new Date().toISOString(),
        rejectedReason: "Impersonation attempt",
      },
    });
    assert.equal(resolved.isCustomBrandingApplied, false);
  });

  it("supports preview branding for unsaved drafts", () => {
    const preview = resolvePreviewBranding({
      companyName: "District Construction LLC",
      branding: null,
      draft: {
        brandColor: "#123456",
        accentColor: "#654321",
        logoUrl: null,
        invoiceFooterText: "Preview footer",
        paymentLinkFooterText: null,
        supportEmail: null,
        supportDiscord: null,
        websiteUrl: null,
        displayNameOverride: "Preview Merchant",
      },
    });
    assert.equal(preview.merchantDisplayName, "Preview Merchant");
    assert.equal(preview.brandColor, "#123456");
    assert.equal(preview.isCustomBrandingApplied, true);
  });
});
