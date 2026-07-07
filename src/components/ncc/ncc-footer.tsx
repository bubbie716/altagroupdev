import { SiteInternalLink } from "@/components/site/site-internal-link";
import { NCC_LEGAL_DOCS } from "@/lib/ncc/ncc-tokens";
import { ALTA_SYSTEM_STATUS_URL } from "@/lib/site/site-links";

export function NccFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#e5e7eb] bg-white">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 sm:px-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Company
          </div>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li>
              <SiteInternalLink siteKey="ncc" to="/" className="text-[#374151] hover:text-[#0c4d32]">
                Newport Clearing Corporation
              </SiteInternalLink>
            </li>
            <li>
              <SiteInternalLink
                siteKey="ncc"
                to="/institutions"
                className="text-[#374151] hover:text-[#0c4d32]"
              >
                Institutions
              </SiteInternalLink>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Legal
          </div>
          <ul className="mt-3 space-y-2 text-[13px]">
            {NCC_LEGAL_DOCS.map((doc) => (
              <li key={doc.id}>
                <SiteInternalLink
                  siteKey="ncc"
                  to={doc.path}
                  className="text-[#374151] hover:text-[#0c4d32]"
                >
                  {doc.label}
                </SiteInternalLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Operations
          </div>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li>
              <SiteInternalLink
                siteKey="ncc"
                to="/support"
                className="text-[#374151] hover:text-[#0c4d32]"
              >
                Support
              </SiteInternalLink>
            </li>
            <li>
              <a
                href={ALTA_SYSTEM_STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#374151] hover:text-[#0c4d32]"
              >
                Status
              </a>
            </li>
            <li>
              <SiteInternalLink
                siteKey="ncc"
                to="/network"
                className="text-[#374151] hover:text-[#0c4d32]"
              >
                Network
              </SiteInternalLink>
            </li>
          </ul>
        </div>

        <div className="text-[12px] leading-relaxed text-[#6b7280]">
          <p>Clearing and settlement infrastructure for approved institutions.</p>
          <p className="mt-4">© {year} Newport Clearing Corporation</p>
        </div>
      </div>
    </footer>
  );
}
