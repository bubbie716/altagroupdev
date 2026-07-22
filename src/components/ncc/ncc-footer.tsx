import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  groupFooterDocuments,
  legalDocLinkParams,
  siteCompactFooterDocuments,
  siteEntitySectionDocuments,
  type LegalDocumentDefinition,
} from "@/lib/legal/legal-document-registry";
import {
  getFooterCopyrightLines,
  getFooterEntitySectionTitle,
  getFooterSupportLinks,
  LEGAL_CENTER_PATH,
  SITE_FOOTER_EMPHASIS,
} from "@/lib/site/site-links";
import { SiteInternalLink } from "@/components/site/site-internal-link";

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

export function NccCopyrightFooter() {
  const { copyright, disclaimer } = getFooterCopyrightLines("ncc");
  const legalDocs = siteCompactFooterDocuments("ncc");

  return (
    <footer className="mt-auto border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto max-w-[1400px] space-y-3 px-4 py-4 sm:px-8">
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          {legalDocs.map((doc) => (
            <NccFooterDocLink key={doc.id} doc={doc} />
          ))}
          <SiteInternalLink siteKey="ncc" to={LEGAL_CENTER_PATH} className={footerLinkClass}>
            Legal Center
          </SiteInternalLink>
        </nav>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">{copyright}</p>
        <p className="max-w-3xl text-[10px] leading-relaxed text-[#6b7280]">{disclaimer}</p>
      </div>
    </footer>
  );
}

function NccFooterCopyright() {
  const { copyright, disclaimer } = getFooterCopyrightLines("ncc");

  return (
    <div className="space-y-2 border-t border-[#e5e7eb] pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">{copyright}</p>
      <p className="max-w-3xl text-[10px] leading-relaxed text-[#6b7280]">{disclaimer}</p>
    </div>
  );
}

export function NccFooter() {
  const siteKey = "ncc" as const;
  const legalDocs = groupFooterDocuments();
  const supportLinks = getFooterSupportLinks(siteKey);
  const entityDocs = siteEntitySectionDocuments(siteKey);
  const entityTitle = getFooterEntitySectionTitle(siteKey);

  return (
    <footer className="mt-auto border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-[15px] font-semibold tracking-[0.08em] text-[#111827]">
              NEWPORT CLEARING
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[#6b7280]">
              {SITE_FOOTER_EMPHASIS.ncc}
            </p>
          </div>

          <NccFooterColumn title="Legal">
            {legalDocs.map((doc) => (
              <li key={doc.id}>
                <NccFooterDocLink doc={doc} />
              </li>
            ))}
            <li>
              <SiteInternalLink siteKey={siteKey} to={LEGAL_CENTER_PATH} className={footerLinkClass}>
                Legal Center
              </SiteInternalLink>
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
                    className={`${footerLinkClass} inline-flex items-center`}
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
