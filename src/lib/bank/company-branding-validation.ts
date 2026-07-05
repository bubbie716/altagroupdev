import {
  COMPANY_BRANDING_LIMITS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  type CompanyBrandingInput,
} from "@/lib/bank/company-branding-types";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const IMPERSONATION_NEEDLES = [
  "alta bank",
  "alta group",
  "alta ncc",
  "newport clearing",
  "newport central clearing",
  "official alta",
  "verified by alta",
  "alta official",
  "ncc official",
  "government",
  "fdic",
  "sec.gov",
] as const;

const TRACKING_NEEDLES = [
  "<script",
  "<img",
  "<iframe",
  "javascript:",
  "onerror=",
  "onload=",
  "pixel.gif",
  "doubleclick",
  "googletagmanager",
  "facebook.com/tr",
  "analytics",
] as const;

export class CompanyBrandingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyBrandingValidationError";
  }
}

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_PATTERN.test(withHash)) {
    throw new CompanyBrandingValidationError("Brand colors must be valid 6-digit hex values.");
  }
  return withHash.toLowerCase();
}

export function sanitizeBrandingText(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!trimmed) return null;
  assertSafeBrandingText(trimmed);
  const withoutTags = trimmed.replace(/<[^>]*>/g, "").trim();
  if (!withoutTags) return null;
  if (withoutTags.length > maxLength) {
    throw new CompanyBrandingValidationError(`Text must be ${maxLength} characters or fewer.`);
  }
  assertSafeBrandingText(withoutTags);
  return withoutTags;
}

export function assertSafeBrandingText(text: string): void {
  const lower = text.toLowerCase();
  for (const needle of IMPERSONATION_NEEDLES) {
    if (lower.includes(needle)) {
      throw new CompanyBrandingValidationError(
        "Branding text cannot impersonate Alta Bank, NCC, or official system entities.",
      );
    }
  }
  for (const needle of TRACKING_NEEDLES) {
    if (lower.includes(needle)) {
      throw new CompanyBrandingValidationError("Branding text cannot include tracking or script content.");
    }
  }
}

function normalizeOptionalUrl(value: string | null | undefined, label: string): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new CompanyBrandingValidationError(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new CompanyBrandingValidationError(`${label} must use http or https.`);
  }
  return parsed.toString();
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 120) {
    throw new CompanyBrandingValidationError("Support email must be a valid email address.");
  }
  return trimmed.toLowerCase();
}

function normalizeDiscord(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return null;
  if (trimmed.length > COMPANY_BRANDING_LIMITS.supportDiscordMaxLength) {
    throw new CompanyBrandingValidationError("Support Discord must be 64 characters or fewer.");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new CompanyBrandingValidationError("Support Discord must be a valid Discord username.");
  }
  return trimmed;
}

export function validateCompanyBrandingInput(input: CompanyBrandingInput): {
  brandColor: string;
  accentColor: string;
  invoiceFooterText: string | null;
  paymentLinkFooterText: string | null;
  supportEmail: string | null;
  supportDiscord: string | null;
  websiteUrl: string | null;
  displayNameOverride: string | null;
} {
  return {
    brandColor: normalizeHexColor(input.brandColor, DEFAULT_BRAND_COLOR),
    accentColor: normalizeHexColor(input.accentColor, DEFAULT_ACCENT_COLOR),
    invoiceFooterText: sanitizeBrandingText(
      input.invoiceFooterText,
      COMPANY_BRANDING_LIMITS.footerTextMaxLength,
    ),
    paymentLinkFooterText: sanitizeBrandingText(
      input.paymentLinkFooterText,
      COMPANY_BRANDING_LIMITS.footerTextMaxLength,
    ),
    supportEmail: normalizeEmail(input.supportEmail),
    supportDiscord: normalizeDiscord(input.supportDiscord),
    websiteUrl: normalizeOptionalUrl(input.websiteUrl, "Website URL"),
    displayNameOverride: sanitizeBrandingText(
      input.displayNameOverride,
      COMPANY_BRANDING_LIMITS.displayNameMaxLength,
    ),
  };
}

export function buildBrandingPreviewInput(
  input: CompanyBrandingInput,
): ReturnType<typeof validateCompanyBrandingInput> {
  return validateCompanyBrandingInput(input);
}
