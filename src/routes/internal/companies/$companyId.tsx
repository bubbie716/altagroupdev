import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { CompanyWorkspaceView } from "@/components/internal/workspace";
import { fetchCompany360 } from "@/lib/internal/ops-platform.functions";
import { fetchOpsReviewFlagsForCompany } from "@/lib/internal/ops-v1.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import {
  fetchAdminCompanyRelationshipDetail,
  fetchCompanyRelationshipRecommendations,
} from "@/lib/internal/company-relationship-intelligence.functions";
import { parseCompanyWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/companies/$companyId")({
  validateSearch: (search: Record<string, unknown>) => parseCompanyWorkspaceSearch(search),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    section: search.section,
    filter: search.filter,
  }),
  loader: async ({ params, deps }) => {
    const tab = deps.tab;
    const includeTimeline = tab === "activity";
    const includeAudit = tab === "more" || deps.section === "audit";
    const includeRelationshipExtras =
      tab === "overview" || deps.section === "relationship" || deps.section === "relationship-detail";

    const [data, reviewFlags, relationship, auditLogs, relationshipRecommendations] =
      await Promise.all([
        fetchCompany360({ data: { companyId: params.companyId, includeTimeline } }),
        fetchOpsReviewFlagsForCompany({ data: params.companyId }),
        fetchAdminCompanyRelationshipDetail({
          data: {
            companyId: params.companyId,
            liveCalculate: includeRelationshipExtras,
          },
        }).catch(() => null),
        includeAudit
          ? fetchAuditLogsForEntity({
              data: { entityType: "COMPANY", entityId: params.companyId },
            })
          : Promise.resolve([]),
        includeRelationshipExtras
          ? fetchCompanyRelationshipRecommendations({ data: params.companyId }).catch(() => [])
          : Promise.resolve([]),
      ]);
    return { data, auditLogs, relationship, relationshipRecommendations, reviewFlags };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.data.company.name ?? "Company"}`, (match.search as { site?: string }).site) }],
  }),
  component: CompanyWorkspaceRoute,
});

function CompanyWorkspaceRoute() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();

  if (!loaderData?.data) {
    return (
      <InternalPageShell title="Company not found">
        <p className="text-[12px] text-muted-foreground">No registered entity matches this ID.</p>
        <Link to="/internal/companies" className="mt-3 inline-block font-mono text-[11px] text-gold hover:underline">
          ← Companies
        </Link>
      </InternalPageShell>
    );
  }

  return (
    <CompanyWorkspaceView
      data={loaderData.data}
      auditLogs={loaderData.auditLogs}
      relationship={loaderData.relationship}
      relationshipRecommendations={loaderData.relationshipRecommendations}
      reviewFlags={loaderData.reviewFlags}
      search={search}
    />
  );
}
