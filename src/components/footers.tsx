import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
import { AltaLogo, AltaWordmark } from "./alta-logo";
import {
  FOOTER_DISCLAIMERS,
  groupEssentialLegalDocuments,
  legalDocLinkParams,
  paymentFooterDocuments,
  siteCompactFooterDocuments,
  siteEntitySectionDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import {
  FOOTER_CORPORATE_SECTION_LINKS,
  getFooterEcosystemLinks,
  getFooterEntitySectionTitle,
  getFooterSupportLinks,
  LEGAL_CENTER_PATH,
  SITE_FOOTER_EMPHASIS,
} from "@/lib/site/site-links";
import { resolveCorporateSiteUrl } from "@/lib/site/entity-site-url";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import type { FooterVariant } from "@/lib/platform/footer-variant";
import type { SiteKey } from "@/config/sites";
import { cn } from "@/lib/utils";

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
  if (siteKey === "corporate") {
    return (
      <Link to={LEGAL_CENTER_PATH} className={cn(footerLinkClass, className)}>
        Legal Center
      </Link>
    );
  }

  return (
    <a
      href={resolveCorporateSiteUrl(LEGAL_CENTER_PATH)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(footerLinkClass, className, "inline-flex items-center gap-1")}
    >
      Legal Center
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

function FooterEcosystemColumn({ siteKey }: { siteKey: SiteKey }) {
  const links = getFooterEcosystemLinks(siteKey);

  return (
    <FooterColumn title="Alta Ecosystem">
      {links.map((link) => (
        <li key={link.label}>
          {link.current ? (
            <span
              className="inline-flex items-center gap-1.5 font-medium text-foreground"
              aria-current="page"
            >
              <Check className="size-3.5 shrink-0 text-gold" aria-hidden />
              {link.label}
            </span>
          ) : link.external ? (
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

function FooterLegalColumn({ siteKey }: { siteKey: SiteKey }) {
  const legalDocs = groupEssentialLegalDocuments();

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

function FooterInlineLegalLinks({
  docs,
  className,
  siteKey,
  includeStatus = false,
}: {
  docs: LegalDocumentDefinition[];
  className?: string;
  siteKey: SiteKey;
  includeStatus?: boolean;
}) {
  const supportLinks = getFooterSupportLinks(siteKey);

  return (
    <nav className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {docs.map((doc) => (
        <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
      ))}
      <FooterLegalCenterLink siteKey={siteKey} className={footerInlineLinkClass} />
      {includeStatus
        ? supportLinks
            .filter((link): link is { label: string; href: string; external: true } =>
              link.label === "System Status" && "href" in link,
            )
            .map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  footerInlineLinkClass,
                  "inline-flex items-center gap-1 text-muted-foreground hover:text-gold",
                )}
              >
                {link.label}
                <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
              </a>
            ))
        : null}
    </nav>
  );
}

function FooterEcosystemInlineLinks({
  siteKey,
  className,
}: {
  siteKey: SiteKey;
  className?: string;
}) {
  const links = getFooterEcosystemLinks(siteKey);

  return (
    <nav className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {links.map((link) =>
        link.current ? (
          <span
            key={link.label}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground"
            aria-current="page"
          >
            {link.label}
          </span>
        ) : link.external ? (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={footerInlineLinkClass}
          >
            {link.label}
          </a>
        ) : (
          <SiteInternalLink
            key={link.label}
            siteKey={siteKey}
            to={link.to}
            className={footerInlineLinkClass}
          >
            {link.label}
          </SiteInternalLink>
        ),
      )}
    </nav>
  );
}

function FooterCopyrightLines({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        © 2026 Alta Group N.V. All rights reserved.
      </p>
      <p className="max-w-3xl text-[10px] leading-relaxed text-muted-foreground/80">
        {FOOTER_DISCLAIMERS.global}
      </p>
    </div>
  );
}

/** Single compact bar — legal links, ecosystem, and one copyright block. */
function CompactFooterBar({
  siteKey,
  includeStatus = false,
  className,
}: {
  siteKey: SiteKey;
  includeStatus?: boolean;
  className?: string;
}) {
  const docs = siteCompactFooterDocuments(siteKey);

  return (
    <footer className={cn("mt-auto shrink-0 border-t border-border/60 bg-surface-1/30", className)}>
      <div className="mx-auto max-w-[1400px] space-y-3 px-4 py-3 sm:px-6">
        <FooterInlineLegalLinks docs={docs} siteKey={siteKey} includeStatus={includeStatus} />
        <FooterEcosystemInlineLinks siteKey={siteKey} />
        <FooterCopyrightLines />
      </div>
    </footer>
  );
}

/** 1. Marketing — public pages with full site map columns. */
export function MarketingFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
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
        <FooterCopyrightLines className="mt-10 border-t border-border/60 pt-4" />
      </div>
    </footer>
  );
}

/** 2. Dashboard — authenticated app pages; one compact bottom bar. */
export function DashboardFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
  return <CompactFooterBar siteKey={siteKey} includeStatus />;
}

/** 3. Authentication — sign-in and access edge pages. */
export function AuthenticationFooter({ siteKey = "corporate" }: { siteKey?: SiteKey }) {
  return <CompactFooterBar siteKey={siteKey} className="relative z-10" />;
}

/** 4. Legal — individual legal document pages. */
export function LegalDocumentFooter({
  docId,
  title,
  version,
  lastUpdated,
}: {
  docId: string;
  title: string;
  version: string;
  lastUpdated: string;
}) {
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
        <FooterCopyrightLines />
      </div>
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
        {FOOTER_DISCLAIMERS.bank}
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

/** @deprecated Use MarketingFooter */
export const PublicFooter = MarketingFooter;

/** @deprecated Use MarketingFooter */
export const SiteFooterLegacy = MarketingFooter;

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

export {
  entityFooterDocuments,
  footerDocuments,
  groupFooterDocuments,
  legalDocLinkParams,
} from "@/lib/legal/legal-document-registry";
