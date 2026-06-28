import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { CompanyWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchCompany360 } from "@/lib/internal/ops-platform.functions";
import { fetchOpsReviewFlagsForCompany } from "@/lib/internal/ops-v1.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import {
  fetchAdminCompanyRelationshipDetail,
  fetchCompanyRelationshipRecommendations,
  fetchCompanyRelationshipTimeline,
} from "@/lib/internal/company-relationship-intelligence.functions";

const TABS = [
  "overview",
  "members",
  "accounts",
  "alta-card",
  "lending",
  "relationship",
  "alta-pay",
  "activity",
  "flags",
  "audit",
  "notes",
];

export const Route = createFileRoute("/internal/companies/$companyId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
  loader: async ({ params }) => {
    const [data, auditLogs, relationship, relationshipRecommendations, relationshipTimeline, reviewFlags] =
      await Promise.all([
        fetchCompany360({ data: params.companyId }),
        fetchAuditLogsForEntity({
          data: { entityType: "COMPANY", entityId: params.companyId },
        }),
        fetchAdminCompanyRelationshipDetail({ data: params.companyId }).catch(() => null),
        fetchCompanyRelationshipRecommendations({ data: params.companyId }).catch(() => []),
        fetchCompanyRelationshipTimeline({ data: params.companyId }).catch(() => []),
        fetchOpsReviewFlagsForCompany({ data: params.companyId }),
      ]);
    return { data, auditLogs, relationship, relationshipRecommendations, relationshipTimeline, reviewFlags };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.data.company.name ?? "Company"} — Alta Internal` }],
  }),
  component: CompanyWorkspaceRoute,
});

function CompanyWorkspaceRoute() {
  const loaderData = Route.useLoaderData();
  const { tab } = Route.useSearch();

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
      relationshipTimeline={loaderData.relationshipTimeline}
      reviewFlags={loaderData.reviewFlags}
      activeTab={tab}
    />
  );
}
