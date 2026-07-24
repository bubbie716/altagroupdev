import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AltaLogo, AltaWordmark } from "./alta-logo";
import {
  groupFooterDocuments,
  legalDocLinkParams,
  paymentFooterDocuments,
  siteCompactFooterDocuments,
  siteEntitySectionDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import {
  FOOTER_CORPORATE_SECTION_LINKS,
  getFooterCopyrightLines,
  getFooterEcosystemLinks,
  getFooterEntitySectionTitle,
  getFooterSupportLinks,
  LEGAL_CENTER_PATH,
  SITE_FOOTER_EMPHASIS,
} from "@/lib/site/site-links";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import type { FooterVariant } from "@/lib/platform/footer-variant";
import type { SiteKey } from "@/config/sites";
import { cn } from "@/lib/utils";

// Re-export for callers that import legal helpers from footers
export {
  entityFooterDocuments,
  footerDocuments,
  groupFooterDocuments,
  legalDocLinkParams,
} from "@/lib/legal/legal-document-registry";

const columnTitleClass =
  "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

const footerLinkClass = "transition-colors hover:text-gold text-foreground/90";

const footerInlineLinkClass =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-gold";

function FooterDocLink({ doc, className }: { doc: LegalDocumentDefinition; className?: string }) {
  const link = legalDocLinkParams(doc.id);
  return (
    <Link to={link.to} params={link.params} className={cn(footerLinkClass, className)}>
      {doc.label}
    </Link>
  );
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={columnTitleClass}>{title}</div>
      <ul className="mt-4 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLegalCenterLink({
  siteKey,
  className,
}: {
  siteKey: SiteKey;
  className?: string;
}) {
  return (
    <SiteInternalLink siteKey={siteKey} to={LEGAL_CENTER_PATH} className={cn(footerLinkClass, className)}>
      Legal Center
    </SiteInternalLink>
  );
}

function FooterEcosystemColumn({ siteKey }: { siteKey: SiteKey }) {
  const links = getFooterEcosystemLinks(siteKey);

  return (
    <FooterColumn title="Alta Ecosystem">
      {links.map((link) => (
        <li key={link.label}>
          {link.current ? (
            <span className="font-semibold text-foreground" aria-current="page">
              {link.label}
            </span>
          ) : link.external ? (
            <a href={link.href} className={cn(footerLinkClass, "inline-flex items-center gap-1")}>
              {link.label}
              <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
            </a>
          ) : (
            <SiteInternalLink siteKey={siteKey} to={link.to} className={footerLinkClass}>
              {link.label}
            </SiteInternalLink>
          )}
        </li>
      ))}
    </FooterColumn>
  );
}

function FooterLegalColumn({ siteKey }: { siteKey: SiteKey }) {
  const legalDocs = groupFooterDocuments();

  return (
    <FooterColumn title="Legal">
      {legalDocs.map((doc) => (
        <li key={doc.id}>
          <FooterDocLink doc={doc} />
        </li>
      ))}
      <li>
        <FooterLegalCenterLink siteKey={siteKey} />
      </li>
    </FooterColumn>
  );
}

function FooterSupportColumn({ siteKey }: { siteKey: SiteKey }) {
  const supportLinks = getFooterSupportLinks(siteKey);

  return (
    <FooterColumn title="Support">
      {supportLinks.map((link) => (
        <li key={link.label}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(footerLinkClass, "inline-flex items-center gap-1")}
            >
              {link.label}
              <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
            </a>
          ) : (
            <SiteInternalLink siteKey={siteKey} to={link.to} className={footerLinkClass}>
              {link.label}
            </SiteInternalLink>
          )}
        </li>
      ))}
    </FooterColumn>
  );
}

function FooterEntityColumn({ siteKey }: { siteKey: SiteKey }) {
  const title = getFooterEntitySectionTitle(siteKey);

  if (siteKey === "corporate") {
    return (
      <FooterColumn title={title}>
        {FOOTER_CORPORATE_SECTION_LINKS.map((link) => (
          <li key={link.label}>
            <SiteInternalLink siteKey={siteKey} to={link.to} className={footerLinkClass}>
              {link.label}
            </SiteInternalLink>
          </li>
        ))}
      </FooterColumn>
    );
  }

  const entityDocs = siteEntitySectionDocuments(siteKey);
  return (
    <FooterColumn title={title}>
      {entityDocs.map((doc) => (
        <li key={doc.id}>
          <FooterDocLink doc={doc} />
        </li>
      ))}
    </FooterColumn>
  );
}

function FooterCopyrightLines({ siteKey, className }: { siteKey: SiteKey; className?: string }) {
  const { copyright, disclaimer } = getFooterCopyrightLines(siteKey);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {copyright}
      </p>
      <p className="max-w-3xl text-[10px] leading-relaxed text-muted-foreground/80">{disclaimer}</p>
    </div>
  );
}

function StandardSiteFooter({ siteKey }: { siteKey: SiteKey }) {
  return (
    <footer className="mt-auto shrink-0 border-t border-border/60 bg-surface-1/30">
      <div className="mx-auto max-w-[1400px] px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <AltaWordmark />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{SITE_FOOTER_EMPHASIS[siteKey]}</p>
          </div>

          <FooterEcosystemColumn siteKey={siteKey} />
          <FooterLegalColumn siteKey={siteKey} />
          <FooterSupportColumn siteKey={siteKey} />
          <FooterEntityColumn siteKey={siteKey} />
        </div>
        <FooterCopyrightLines siteKey={siteKey} className="mt-10 border-t border-border/60 pt-4" />
      </div>
    </footer>
  );
}

/** Copyright-only footer for authentication pages. */
function CopyrightOnlyFooter({
  siteKey,
  className,
}: {
  siteKey: SiteKey;
  className?: string;
}) {
  const docs = siteCompactFooterDocuments(siteKey);

  return (
    <footer className={cn("mt-auto shrink-0 border-t border-border/60 bg-surface-1/30", className)}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-10 sm:px-6">
        <FooterCopyrightLines siteKey={siteKey} className="min-w-0 flex-1" />
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:max-w-xl sm:justify-end lg:max-w-2xl"
        >
          {docs.map((doc) => (
            <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
          ))}
          <FooterLegalCenterLink siteKey={siteKey} className={footerInlineLinkClass} />
        </nav>
      </div>
    </footer>
  );
}

/** 1. Marketing — public pages with full site map columns. */
export function MarketingFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
  return <StandardSiteFooter siteKey={siteKey} />;
}

/** 2. Dashboard — authenticated app pages; full column footer. */
export function DashboardFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
  return <StandardSiteFooter siteKey={siteKey} />;
}

/** 3. Authentication — sign-in and access edge pages. */
export function AuthenticationFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
  return <CopyrightOnlyFooter siteKey={siteKey} className="relative z-10" />;
}

/** 4. Legal — individual legal document pages. */
export function LegalDocumentFooter({
  siteKey = "corporate",
  docId,
  title,
  version,
  lastUpdated,
}: {
  siteKey?: SiteKey;
  docId: string;
  title: string;
  version: string;
  lastUpdated: string;
}) {
  const relatedDocs = siteCompactFooterDocuments(siteKey).filter((doc) => doc.id !== docId);

  return (
    <footer className="mt-auto shrink-0 border-t border-border/60 bg-surface-1/30">
      <div className="mx-auto max-w-[1400px] space-y-3 px-6 py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to Alta
        </Link>
        <dl className="grid gap-3 text-[12px] sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Document
            </dt>
            <dd className="mt-1 text-foreground/90">{title}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Version
            </dt>
            <dd className="mt-1 text-foreground/90">{version}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Last Updated
            </dt>
            <dd className="mt-1 text-foreground/90">{lastUpdated}</dd>
          </div>
        </dl>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {docId}
        </p>
        <div className="flex flex-col gap-4 border-t border-border/60 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <FooterCopyrightLines siteKey={siteKey} className="min-w-0 flex-1" />
          <nav
            aria-label="Related legal documents"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:max-w-xl sm:justify-end lg:max-w-2xl"
          >
            {relatedDocs.map((doc) => (
              <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
            ))}
            <FooterLegalCenterLink siteKey={siteKey} className={footerInlineLinkClass} />
          </nav>
        </div>      </div>
    </footer>
  );
}

/** Merchant checkout inline legal links — not a site chrome footer. */
export function CheckoutLegalLinks({ className }: { className?: string }) {
  const docs = paymentFooterDocuments();

  return (
    <div className={cn("space-y-2 text-center", className)}>
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {docs.map((doc) => (
          <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
        ))}
      </nav>
      <p className="mx-auto max-w-md text-[10px] leading-relaxed text-muted-foreground/80">
        {getFooterCopyrightLines("bank").disclaimer}
      </p>
      <p className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <AltaLogo className="h-3 w-3 text-gold" />
        Powered by Alta Bank
      </p>
    </div>
  );
}

export function SiteFooter({ variant, legalDoc, siteKey = "corporate" }: SiteFooterProps) {
  if (variant === "none") return null;
  if (variant === "marketing") return <MarketingFooter siteKey={siteKey} />;
  if (variant === "dashboard") return <DashboardFooter siteKey={siteKey} />;
  if (variant === "auth") return <AuthenticationFooter siteKey={siteKey} />;
  if (variant === "legal" && legalDoc) {
    return (
      <LegalDocumentFooter
        siteKey={siteKey}
        docId={legalDoc.docId}
        title={legalDoc.title}
        version={legalDoc.version}
        lastUpdated={legalDoc.lastUpdated}
      />
    );
  }
  return <MarketingFooter siteKey={siteKey} />;
}

export type SiteFooterProps = {
  variant: FooterVariant;
  siteKey?: SiteKey;
  legalDoc?: {
    docId: string;
    title: string;
    version: string;
    lastUpdated: string;
  };
};

/** @deprecated Use DashboardFooter */
export function PlatformFooter() {
  return <DashboardFooter />;
}

/** @deprecated Use AuthenticationFooter */
export function LegalMicroFooter() {
  return <AuthenticationFooter />;
}

/** @deprecated Use CheckoutLegalLinks */
export const PaymentLegalFooter = CheckoutLegalLinks;

/** @deprecated Use AuthenticationFooter */
export function LoginPortalFooter() {
  return <AuthenticationFooter />;
}
