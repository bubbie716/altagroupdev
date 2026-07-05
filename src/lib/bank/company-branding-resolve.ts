import type { CommercialPlanSettings } from "@/lib/bank/commercial-banking-types";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  type CompanyBrandingRow,
  type CustomerFacingBranding,
} from "@/lib/bank/company-branding-types";
import { canPublishInvoiceBranding } from "@/lib/bank/commercial-banking-types";

type BrandingRecord = {
  logoUrl: string | null;
  brandColor: string | null;
  accentColor: string | null;
  invoiceFooterText: string | null;
  paymentLinkFooterText: string | null;
  supportEmail: string | null;
  supportDiscord: string | null;
  websiteUrl: string | null;
  displayNameOverride: string | null;
  showPoweredByAlta: boolean;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  updatedAt: Date;
};

export function mapCompanyBrandingRow(
  companyId: string,
  record: BrandingRecord | null,
): CompanyBrandingRow | null {
  if (!record) return null;
  return {
    companyId,
    logoUrl: record.logoUrl,
    brandColor: record.brandColor ?? DEFAULT_BRAND_COLOR,
    accentColor: record.accentColor ?? DEFAULT_ACCENT_COLOR,
    invoiceFooterText: record.invoiceFooterText,
    paymentLinkFooterText: record.paymentLinkFooterText,
    supportEmail: record.supportEmail,
    supportDiscord: record.supportDiscord,
    websiteUrl: record.websiteUrl,
    displayNameOverride: record.displayNameOverride,
    showPoweredByAlta: true,
    rejectedAt: record.rejectedAt?.toISOString() ?? null,
    rejectedReason: record.rejectedReason,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function resolveCustomerFacingBranding(input: {
  companyName: string;
  plan: CommercialPlanSettings;
  branding: CompanyBrandingRow | null;
}): CustomerFacingBranding {
  const merchantDisplayName =
    input.branding?.displayNameOverride?.trim() || input.companyName;
  const canApply =
    canPublishInvoiceBranding(input.plan) &&
    input.branding != null &&
    input.branding.rejectedAt == null;

  if (!canApply) {
    return {
      merchantDisplayName: input.companyName,
      logoUrl: null,
      brandColor: DEFAULT_BRAND_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
      invoiceFooterText: null,
      paymentLinkFooterText: null,
      supportEmail: null,
      supportDiscord: null,
      websiteUrl: null,
      showPoweredByAlta: true,
      isCustomBrandingApplied: false,
    };
  }

  return {
    merchantDisplayName,
    logoUrl: input.branding.logoUrl,
    brandColor: input.branding.brandColor,
    accentColor: input.branding.accentColor,
    invoiceFooterText: input.branding.invoiceFooterText,
    paymentLinkFooterText: input.branding.paymentLinkFooterText,
    supportEmail: input.branding.supportEmail,
    supportDiscord: input.branding.supportDiscord,
    websiteUrl: input.branding.websiteUrl,
    showPoweredByAlta: true,
    isCustomBrandingApplied: true,
  };
}

export function resolvePreviewBranding(input: {
  companyName: string;
  branding: CompanyBrandingRow | null;
  draft?: Partial<CompanyBrandingRow> | null;
}): CustomerFacingBranding {
  const merged = {
    brandColor: input.draft?.brandColor ?? input.branding?.brandColor ?? DEFAULT_BRAND_COLOR,
    accentColor: input.draft?.accentColor ?? input.branding?.accentColor ?? DEFAULT_ACCENT_COLOR,
    logoUrl: input.draft?.logoUrl ?? input.branding?.logoUrl ?? null,
    invoiceFooterText:
      input.draft?.invoiceFooterText ?? input.branding?.invoiceFooterText ?? null,
    paymentLinkFooterText:
      input.draft?.paymentLinkFooterText ?? input.branding?.paymentLinkFooterText ?? null,
    supportEmail: input.draft?.supportEmail ?? input.branding?.supportEmail ?? null,
    supportDiscord: input.draft?.supportDiscord ?? input.branding?.supportDiscord ?? null,
    websiteUrl: input.draft?.websiteUrl ?? input.branding?.websiteUrl ?? null,
    displayNameOverride:
      input.draft?.displayNameOverride ?? input.branding?.displayNameOverride ?? null,
  };

  return {
    merchantDisplayName: merged.displayNameOverride?.trim() || input.companyName,
    logoUrl: merged.logoUrl,
    brandColor: merged.brandColor,
    accentColor: merged.accentColor,
    invoiceFooterText: merged.invoiceFooterText,
    paymentLinkFooterText: merged.paymentLinkFooterText,
    supportEmail: merged.supportEmail,
    supportDiscord: merged.supportDiscord,
    websiteUrl: merged.websiteUrl,
    showPoweredByAlta: true,
    isCustomBrandingApplied: true,
  };
}
