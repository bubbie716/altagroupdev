import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsSection, OpsStatStrip } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { fetchInternalCompaniesFromDb } from "@/lib/company/company.functions";
import type { InternalCompanyRow } from "@/lib/company/types";
import {
  companyMatchesQuery,
  companyNeedsDirectoryAttention,
  companyTypeSectorLabel,
  sortCompaniesForDirectory,
} from "@/lib/internal/directory-desk";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type InternalCompaniesSearch = {
  q?: string;
  verification?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/companies/")({
  validateSearch: (search: Record<string, unknown>): InternalCompaniesSearch => {
    const site = validateDevSiteSearch(search).site;
    const str = (key: string) =>
      typeof search[key] === "string" && (search[key] as string).trim()
        ? (search[key] as string).trim()
        : undefined;
    const verification = str("verification");
    return {
      q: str("q"),
      verification:
        verification === "verified" ||
        verification === "pending" ||
        verification === "rejected" ||
        verification === "unverified"
          ? verification
          : undefined,
      attention: search.attention === "1" ? "1" : undefined,
      site,
    };
  },
  loader: async () => {
    try {
      return await fetchInternalCompaniesFromDb();
    } catch {
      const { getCompanyAccounts } = await import("@/lib/internal/api");
      return getCompanyAccounts().map((c) => ({
        id: c.id,
        name: c.name,
        ticker: c.ticker,
        type: c.type,
        sector: c.sector,
        status: c.status,
        verificationStatus: c.verificationStatus,
        representativeCount: c.representativeCount,
        primaryContact: c.primaryContact,
        lastUpdated: c.lastUpdated,
      })) satisfies InternalCompanyRow[];
    }
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Companies", (match.search as { site?: string }).site) }] }),
  component: InternalCompanies,
});

function InternalCompanies() {
  const companies = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const attentionOnly = search.attention === "1";

  let filtered = companies.filter((c) => companyMatchesQuery(c, search.q ?? ""));
  if (search.verification) {
    filtered = filtered.filter(
      (c) => c.verificationStatus.toLowerCase() === search.verification!.toLowerCase(),
    );
  }
  const sorted = sortCompaniesForDirectory(filtered, attentionOnly);
  const filtersOn = Boolean(search.q || search.verification || search.attention);
  const returnFrom = buildListReturnPath("/internal/companies", {
    q: search.q,
    verification: search.verification,
    attention: search.attention,
    site: search.site,
  });

  function patchSearch(patch: Partial<InternalCompaniesSearch>) {
    void navigate({
      to: "/internal/companies",
      search: withInternalSiteSearch({ ...search, ...patch }, search.site),
      replace: true,
    });
  }

  function recordSearch() {
    return {
      ...withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site),
      from: returnFrom,
    };
  }

  return (
    <InternalPageShell
      title="Companies"
      breadcrumbs={buildBreadcrumbs([
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
        { label: "Companies" },
      ])}
    >
      <OpsStatStrip
        stats={[
          { label: "Shown", value: sorted.length.toLocaleString() },
          {
            label: "Needs attention",
            value: companies.filter(companyNeedsDirectoryAttention).length,
            tone: "warn",
          },
          {
            label: "Verified",
            value: companies.filter((c) => c.verificationStatus === "verified").length,
            tone: "ok",
          },
        ]}
      />

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/companies",
                  search: withInternalSiteSearch({}, search.site),
                  replace: true,
                })
            : undefined
        }
      >
        <OpsFilterField label="Search">
          <input
            className={OPS_FILTER_FIELD_CLASS}
            value={search.q ?? ""}
            onChange={(e) => patchSearch({ q: e.target.value || undefined })}
            placeholder="Company, ticker, contact…"
            aria-label="Search companies"
          />
        </OpsFilterField>
        <OpsFilterField label="Verification">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.verification ?? ""}
            onChange={(e) => patchSearch({ verification: e.target.value || undefined })}
            aria-label="Filter by verification"
          >
            <option value="">All</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Needs attention">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.attention ?? ""}
            onChange={(e) => patchSearch({ attention: e.target.value === "1" ? "1" : undefined })}
            aria-label="Needs attention filter"
          >
            <option value="">Any</option>
            <option value="1">Needs attention</option>
          </select>
        </OpsFilterField>
      </OpsFilterBar>

      <OpsSection title={`Companies · ${sorted.length}`}>
        {sorted.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
            {attentionOnly
              ? "No companies currently need attention."
              : "No companies match the current filters."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Company</th>
                    <th className="px-2 py-2 font-medium">Type / sector</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Verification</th>
                    <th className="px-2 py-2 font-medium">Primary contact</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={`desktop-${c.id}`} className="border-b border-border/40 hover:bg-surface-1/40">
                      <td className="px-2 py-2.5">
                        <Link
                          to="/internal/companies/$companyId"
                          params={{ companyId: c.id }}
                          search={recordSearch()}
                          className="font-medium hover:text-gold"
                        >
                          {c.name}
                        </Link>
                        {c.ticker ? (
                          <div className="font-mono text-[11px] text-muted-foreground">{c.ticker}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{companyTypeSectorLabel(c)}</td>
                      <td className="px-2 py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusBadge status={c.verificationStatus} />
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[12px]">{c.primaryContact || "—"}</td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {c.lastUpdated.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {sorted.map((c) => {
                const attention = companyNeedsDirectoryAttention(c);
                return (
                  <li key={`mobile-${c.id}`}>
                    <Link
                      to="/internal/companies/$companyId"
                      params={{ companyId: c.id }}
                      search={recordSearch()}
                      className={cn(
                        "block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      )}
                      aria-label={`Review company ${c.name}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[13px]">{c.name}</div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {companyTypeSectorLabel(c)}
                          </div>
                        </div>
                        <StatusBadge status={c.verificationStatus} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                        <span>{c.primaryContact || "No primary contact"}</span>
                        <span>{attention ? "Needs attention" : c.status}</span>
                      </div>
                      <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                        Review company
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}
