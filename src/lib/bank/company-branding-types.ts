export type CompanyBrandingInput = {
  brandColor?: string | null;
  accentColor?: string | null;
  invoiceFooterText?: string | null;
  paymentLinkFooterText?: string | null;
  supportEmail?: string | null;
  supportDiscord?: string | null;
  websiteUrl?: string | null;
  displayNameOverride?: string | null;
};

export type CompanyBrandingRow = {
  companyId: string;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
  invoiceFooterText: string | null;
  paymentLinkFooterText: string | null;
  supportEmail: string | null;
  supportDiscord: string | null;
  websiteUrl: string | null;
  displayNameOverride: string | null;
  showPoweredByAlta: true;
  rejectedAt: string | null;
  rejectedReason: string | null;
  updatedAt: string;
};

export type CompanyBrandingSettingsView = CompanyBrandingRow & {
  companyName: string;
  canPublish: boolean;
  canPreview: boolean;
  isPro: boolean;
  isCustomAppliedPublicly: boolean;
};

/** Customer-facing branding resolved at checkout/invoice time. */
export type CustomerFacingBranding = {
  merchantDisplayName: string;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
  invoiceFooterText: string | null;
  paymentLinkFooterText: string | null;
  supportEmail: string | null;
  supportDiscord: string | null;
  websiteUrl: string | null;
  showPoweredByAlta: true;
  isCustomBrandingApplied: boolean;
};

export const DEFAULT_BRAND_COLOR = "#0f1729";
export const DEFAULT_ACCENT_COLOR = "#c9a227";

export const COMPANY_BRANDING_LIMITS = {
  footerTextMaxLength: 500,
  displayNameMaxLength: 80,
  supportDiscordMaxLength: 64,
} as const;
