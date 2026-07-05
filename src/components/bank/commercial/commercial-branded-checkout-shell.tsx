import type { ReactNode } from "react";
import { AltaLogo } from "@/components/alta-logo";
import type { CustomerFacingBranding } from "@/lib/bank/company-branding-types";
import { DEFAULT_ACCENT_COLOR, DEFAULT_BRAND_COLOR } from "@/lib/bank/company-branding-types";
import { cn } from "@/lib/utils";

export function resolveBrandingForDisplay(
  branding: CustomerFacingBranding | undefined,
  merchantName: string,
): CustomerFacingBranding {
  if (branding) return branding;
  return {
    merchantDisplayName: merchantName,
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

export function CommercialBrandedCheckoutShell({
  branding,
  merchantName,
  secureLabel = "Secure payment · Alta Bank",
  footerText,
  children,
  className,
}: {
  branding?: CustomerFacingBranding;
  merchantName: string;
  secureLabel?: string;
  footerText?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const resolved = resolveBrandingForDisplay(branding, merchantName);
  const accent = resolved.accentColor;
  const brand = resolved.brandColor;

  return (
    <div className={cn("mx-auto max-w-2xl space-y-4", className)}>
      <header
        className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm dark:bg-surface-1"
        style={{ borderTopColor: accent, borderTopWidth: 3 }}
      >
        <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
          <MerchantBrandingLogo branding={resolved} fallbackName={merchantName} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {secureLabel}
            </p>
            <h2
              className="mt-1 truncate text-xl font-semibold tracking-tight"
              style={{ color: brand }}
            >
              {resolved.merchantDisplayName}
            </h2>
            {resolved.websiteUrl ? (
              <a
                href={resolved.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block truncate text-[12px] text-muted-foreground underline-offset-2 hover:underline"
              >
                {resolved.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
          <AltaTrustMark />
        </div>
      </header>

      {children}

      <CommercialBrandedCheckoutFooter branding={resolved} footerText={footerText} />
    </div>
  );
}

function MerchantBrandingLogo({
  branding,
  fallbackName,
}: {
  branding: CustomerFacingBranding;
  fallbackName: string;
}) {
  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={`${branding.merchantDisplayName} logo`}
        className="h-12 w-12 shrink-0 rounded-lg border border-border/60 bg-white object-contain p-1"
      />
    );
  }

  const initial = (branding.merchantDisplayName || fallbackName).trim().charAt(0).toUpperCase() || "M";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
      style={{ backgroundColor: branding.brandColor }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function AltaTrustMark() {
  return (
    <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-surface-1 px-2.5 py-1 sm:flex">
      <AltaLogo className="h-3.5 w-3.5 text-gold" />
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        Alta Bank
      </span>
    </div>
  );
}

export function CommercialBrandedCheckoutFooter({
  branding,
  footerText,
}: {
  branding: CustomerFacingBranding;
  footerText?: string | null;
}) {
  return (
    <footer className="space-y-3 rounded-2xl border border-border/60 bg-surface-1/50 px-5 py-4 text-center text-[12px] text-muted-foreground">
      {footerText ? (
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{footerText}</p>
      ) : null}
      {(branding.supportEmail || branding.supportDiscord) && (
        <p>
          {branding.supportEmail ? (
            <a href={`mailto:${branding.supportEmail}`} className="underline-offset-2 hover:underline">
              {branding.supportEmail}
            </a>
          ) : null}
          {branding.supportEmail && branding.supportDiscord ? " · " : null}
          {branding.supportDiscord ? `@${branding.supportDiscord} on Discord` : null}
        </p>
      )}
      <p className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]">
        <AltaLogo className="h-3 w-3 text-gold" />
        Powered by Alta Bank
      </p>
    </footer>
  );
}

export function CommercialBrandedReceiptShell({
  branding,
  merchantName,
  footerText,
  children,
}: {
  branding?: CustomerFacingBranding;
  merchantName: string;
  footerText?: string | null;
  children: ReactNode;
}) {
  const resolved = resolveBrandingForDisplay(branding, merchantName);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div
        className="rounded-2xl border border-border/70 px-5 py-4"
        style={{ borderLeftColor: resolved.accentColor, borderLeftWidth: 4 }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Payment receipt
        </p>
        <p className="mt-1 text-lg font-semibold" style={{ color: resolved.brandColor }}>
          {resolved.merchantDisplayName}
        </p>
      </div>
      {children}
      <CommercialBrandedCheckoutFooter branding={resolved} footerText={footerText} />
    </div>
  );
}
