import { Check, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  FOOTER_DISCLAIMERS,
  groupEssentialLegalDocuments,
  legalDocLinkParams,
  siteEntitySectionDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import {
  getFooterEcosystemLinks,
  getFooterEntitySectionTitle,
  getFooterSupportLinks,
  LEGAL_CENTER_PATH,
  SITE_FOOTER_EMPHASIS,
} from "@/lib/site/site-links";
import { resolveCorporateSiteUrl } from "@/lib/site/entity-site-url";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { NCC } from "@/lib/ncc/ncc-tokens";

const columnTitleClass =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]";

const footerLinkClass = "text-[#374151] transition-colors hover:text-[#0c4d32]";

function NccFooterDocLink({ doc }: { doc: LegalDocumentDefinition }) {
  const link = legalDocLinkParams(doc.id);
  return (
    <Link to={link.to} params={link.params} className={footerLinkClass}>
      {doc.label}
    </Link>
  );
}

function NccFooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={columnTitleClass}>{title}</div>
      <ul className="mt-3 space-y-2 text-[13px]">{children}</ul>
    </div>
  );
}

function NccFooterCopyright() {
  return (
    <div className="space-y-2 border-t border-[#e5e7eb] pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
        © 2026 Alta Group N.V. All rights reserved.
      </p>
      <p className="max-w-3xl text-[10px] leading-relaxed text-[#6b7280]">
        {FOOTER_DISCLAIMERS.global}
      </p>
    </div>
  );
}

export function NccFooter() {
  const siteKey = "ncc" as const;
  const ecosystemLinks = getFooterEcosystemLinks(siteKey);
  const legalDocs = groupEssentialLegalDocuments();
  const supportLinks = getFooterSupportLinks(siteKey);
  const entityDocs = siteEntitySectionDocuments(siteKey);
  const entityTitle = getFooterEntitySectionTitle(siteKey);

  return (
    <footer className="mt-auto border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-[15px] font-semibold tracking-[0.08em] text-[#111827]">
              NEWPORT CLEARING
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[#6b7280]">
              {SITE_FOOTER_EMPHASIS.ncc}
            </p>
          </div>

          <NccFooterColumn title="Alta Ecosystem">
            {ecosystemLinks.map((link) => (
              <li key={link.label}>
                {link.current ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-medium text-[#0c4d32]"
                    aria-current="page"
                  >
                    <Check className="size-3.5 shrink-0" style={{ color: NCC.green }} aria-hidden />
                    {link.label}
                  </span>
                ) : link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cnExternal(footerLinkClass)}
                  >
                    {link.label}
                    <ExternalLink className="ml-1 inline size-3 opacity-70" aria-hidden />
                  </a>
                ) : (
                  <SiteInternalLink siteKey={siteKey} to={link.to} className={footerLinkClass}>
                    {link.label}
                  </SiteInternalLink>
                )}
              </li>
            ))}
          </NccFooterColumn>

          <NccFooterColumn title="Legal">
            {legalDocs.map((doc) => (
              <li key={doc.id}>
                <NccFooterDocLink doc={doc} />
              </li>
            ))}
            <li>
              <a
                href={resolveCorporateSiteUrl(LEGAL_CENTER_PATH)}
                target="_blank"
                rel="noopener noreferrer"
                className={cnExternal(footerLinkClass)}
              >
                Legal Center
                <ExternalLink className="ml-1 inline size-3 opacity-70" aria-hidden />
              </a>
            </li>
          </NccFooterColumn>

          <NccFooterColumn title="Support">
            {supportLinks.map((link) => (
              <li key={link.label}>
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cnExternal(footerLinkClass)}
                  >
                    {link.label}
                    <ExternalLink className="ml-1 inline size-3 opacity-70" aria-hidden />
                  </a>
                ) : (
                  <SiteInternalLink siteKey={siteKey} to={link.to} className={footerLinkClass}>
                    {link.label}
                  </SiteInternalLink>
                )}
              </li>
            ))}
          </NccFooterColumn>

          <NccFooterColumn title={entityTitle}>
            {entityDocs.map((doc) => (
              <li key={doc.id}>
                <NccFooterDocLink doc={doc} />
              </li>
            ))}
          </NccFooterColumn>
        </div>

        <div className="mt-8">
          <NccFooterCopyright />
        </div>
      </div>
    </footer>
  );
}

function cnExternal(className: string) {
  return `${className} inline-flex items-center`;
}
