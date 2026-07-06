import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AltaLogo, AltaWordmark } from "./alta-logo";
import {
  entityFooterDocuments,
  essentialGroupDocuments,
  FOOTER_DISCLAIMERS,
  getLegalDocument,
  groupFooterDocuments,
  legalDocLinkParams,
  LEGAL_CENTER_PATH,
  paymentFooterDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import { ALTA_SYSTEM_STATUS_URL, FOOTER_COMPANY_LINKS, FOOTER_SUPPORT_LINKS } from "@/lib/site/site-links";
import type { FooterVariant } from "@/lib/platform/footer-variant";
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

function FooterInlineLegalLinks({
  docs,
  className,
  includeStatus = false,
}: {
  docs: LegalDocumentDefinition[];
  className?: string;
  includeStatus?: boolean;
}) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {docs.map((doc) => (
        <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
      ))}
      {includeStatus ? (
        <a
          href={ALTA_SYSTEM_STATUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            footerInlineLinkClass,
            "inline-flex items-center gap-1 text-muted-foreground hover:text-gold",
          )}
        >
          Status
          <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
        </a>
      ) : null}
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

/** Single compact bar — links, copyright, and disclaimer in one block (no stacked sections). */
function CompactFooterBar({
  docs,
  includeStatus = false,
  className,
}: {
  docs: LegalDocumentDefinition[];
  includeStatus?: boolean;
  className?: string;
}) {
  return (
    <footer className={cn("mt-auto shrink-0 border-t border-border/60 bg-surface-1/30", className)}>
      <div className="mx-auto max-w-[1400px] space-y-2 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <FooterInlineLegalLinks docs={docs} includeStatus={includeStatus} />
          <span className="hidden h-3 w-px bg-border/80 sm:block" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            © 2026 Alta Group N.V.
          </p>
        </div>
        <p className="max-w-3xl text-[10px] leading-relaxed text-muted-foreground/80">
          {FOOTER_DISCLAIMERS.global}
        </p>
      </div>
    </footer>
  );
}

/** 1. Marketing — public pages with full site map columns. */
export function MarketingFooter() {
  const legalDocs = groupFooterDocuments();
  const bankDocs = entityFooterDocuments("bank");
  const marketsDocs = entityFooterDocuments("markets");
  const nccDocs = entityFooterDocuments("ncc");

  return (
    <footer className="mt-auto shrink-0 border-t border-border/60 bg-surface-1/30">
      <div className="mx-auto max-w-[1400px] px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-1">
            <AltaWordmark />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Live Like the 1%</p>
          </div>

          <FooterColumn title="Company">
            {FOOTER_COMPANY_LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className={footerLinkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Legal">
            {legalDocs.map((doc) => (
              <li key={doc.id}>
                <FooterDocLink doc={doc} />
              </li>
            ))}
            <li>
              <Link to={LEGAL_CENTER_PATH} className={footerLinkClass}>
                Legal Center
              </Link>
            </li>
          </FooterColumn>

          <FooterColumn title="Bank">
            {bankDocs.map((doc) => (
              <li key={doc.id}>
                <FooterDocLink doc={doc} />
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Markets">
            {marketsDocs.map((doc) => (
              <li key={doc.id}>
                <FooterDocLink doc={doc} />
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="NCC">
            {nccDocs.map((doc) => (
              <li key={doc.id}>
                <FooterDocLink doc={doc} />
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Support">
            {FOOTER_SUPPORT_LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className={footerLinkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>
        </div>
        <FooterCopyrightLines className="mt-10 border-t border-border/60 pt-4" />
      </div>
    </footer>
  );
}

/** 2. Dashboard — authenticated app pages; one compact bottom bar. */
export function DashboardFooter() {
  return <CompactFooterBar docs={essentialGroupDocuments()} includeStatus />;
}

/** 3. Authentication — sign-in and access edge pages. */
export function AuthenticationFooter() {
  return <CompactFooterBar docs={essentialGroupDocuments()} className="relative z-10" />;
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
      <FooterInlineLegalLinks docs={docs} className="justify-center" />
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

export function SiteFooter({ variant, legalDoc }: SiteFooterProps) {
  if (variant === "none") return null;
  if (variant === "marketing") return <MarketingFooter />;
  if (variant === "dashboard") return <DashboardFooter />;
  if (variant === "auth") return <AuthenticationFooter />;
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
  return <MarketingFooter />;
}

export type SiteFooterProps = {
  variant: FooterVariant;
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
