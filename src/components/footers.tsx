import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AltaLogo, AltaWordmark } from "./alta-logo";
import type { LegalFooterContext, PlatformFooterContext } from "@/lib/platform/footer-variant";
import {
  entityFooterDocuments,
  essentialGroupDocuments,
  FOOTER_DISCLAIMERS,
  groupFooterDocuments,
  legalDocLinkParams,
  LEGAL_CENTER_PATH,
  paymentFooterDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import { FOOTER_COMPANY_LINKS, FOOTER_SUPPORT_LINKS } from "@/lib/site/site-links";
import { cn } from "@/lib/utils";

const columnTitleClass =
  "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

const footerLinkClass =
  "transition-colors hover:text-gold text-foreground/90";

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

function FooterLegalLinkRow({
  docs,
  includeLegalCenter = false,
  className,
}: {
  docs: LegalDocumentDefinition[];
  includeLegalCenter?: boolean;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {docs.map((doc) => (
        <FooterDocLink key={doc.id} doc={doc} className={footerInlineLinkClass} />
      ))}
      {includeLegalCenter ? (
        <Link to={LEGAL_CENTER_PATH} className={footerInlineLinkClass}>
          Legal Center
        </Link>
      ) : null}
    </nav>
  );
}

function FooterCopyrightBar({ className }: { className?: string }) {
  return (
    <div className={cn("border-t border-border/60 bg-surface-1/30", className)}>
      <div className="mx-auto max-w-[1400px] space-y-2 px-6 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          © 2026 Alta Group N.V. All rights reserved.
        </p>
        <p className="max-w-3xl text-[10px] leading-relaxed text-muted-foreground/80">
          {FOOTER_DISCLAIMERS.global}
        </p>
      </div>
    </div>
  );
}

export function PublicFooter() {
  const legalDocs = groupFooterDocuments();
  const bankDocs = entityFooterDocuments("bank");
  const marketsDocs = entityFooterDocuments("markets");
  const nccDocs = entityFooterDocuments("ncc");

  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto max-w-[1400px] px-6 py-16">
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
      </div>
      <FooterCopyrightBar />
    </footer>
  );
}

/** @deprecated Use PublicFooter */
export const SiteFooter = PublicFooter;

const platformDisclaimer: Record<PlatformFooterContext, string> = {
  bank: FOOTER_DISCLAIMERS.bank,
  exchange: FOOTER_DISCLAIMERS.markets,
  general: FOOTER_DISCLAIMERS.global,
};

function platformDocuments(context: PlatformFooterContext): LegalDocumentDefinition[] {
  const group = essentialGroupDocuments();
  if (context === "bank") {
    return [...group, ...entityFooterDocuments("bank")];
  }
  if (context === "exchange") {
    return [...group, ...entityFooterDocuments("markets")];
  }
  return groupFooterDocuments();
}

export function PlatformFooter({ context = "general" }: { context?: PlatformFooterContext }) {
  const docs = platformDocuments(context);

  return (
    <footer className="mt-12 border-t border-border/60">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
        <FooterLegalLinkRow docs={docs} includeLegalCenter />
        <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          {platformDisclaimer[context]}
        </p>
      </div>
      <FooterCopyrightBar />
    </footer>
  );
}

const legalCopy: Record<
  LegalFooterContext,
  { primary: string; secondary: string }
> = {
  login: {
    primary: "© 2026 Alta Group N.V. · Member Access",
    secondary: "Sign in with Discord · Individual accounts and authorized company representatives",
  },
  maintenance: {
    primary: "© 2026 Alta Group N.V. · Platform Maintenance",
    secondary: "Scheduled work in progress. Access will resume when maintenance ends.",
  },
  "access-restricted": {
    primary: "© 2026 Alta Group N.V. · Member Access",
    secondary: "Sign in with Discord · Individual accounts and authorized company representatives",
  },
};

export function LegalMicroFooter({ context = "login" }: { context?: LegalFooterContext }) {
  const copy = legalCopy[context];
  const docs = essentialGroupDocuments();

  return (
    <footer className="relative z-10 border-t border-border/60">
      <div className="space-y-3 px-6 py-5 sm:px-10">
        <FooterLegalLinkRow docs={docs} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {copy.primary}
          </span>
          <span className="text-[11px] text-muted-foreground">{copy.secondary}</span>
        </div>
      </div>
      <FooterCopyrightBar />
    </footer>
  );
}

export function PaymentLegalFooter({ className }: { className?: string }) {
  const docs = paymentFooterDocuments();

  return (
    <div className={cn("space-y-3 text-center", className)}>
      <FooterLegalLinkRow docs={docs} className="justify-center" />
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

/** @deprecated Use LegalMicroFooter */
export function LoginPortalFooter() {
  return <LegalMicroFooter context="login" />;
}

export {
  entityFooterDocuments,
  footerDocuments,
  groupFooterDocuments,
  legalDocLinkParams,
} from "@/lib/legal/legal-document-registry";
