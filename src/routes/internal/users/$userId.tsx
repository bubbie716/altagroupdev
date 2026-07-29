import { createFileRoute } from "@tanstack/react-router";
import { CustomerWorkspaceView } from "@/components/internal/workspace";
import { fetchCustomer360 } from "@/lib/internal/ops-platform.functions";
import { fetchOpsReviewFlagsForCustomer } from "@/lib/internal/ops-v1.functions";
import {
  fetchRelationshipOperatorPanel,
  fetchRelationshipWorkspaceChrome,
} from "@/lib/internal/relationship-intelligence.functions";
import { parseCustomerWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/users/$userId")({
  validateSearch: (search: Record<string, unknown>) => parseCustomerWorkspaceSearch(search),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    section: search.section,
    filter: search.filter,
  }),
  loader: async ({ params, deps }) => {
    const includeTimeline = deps.tab === "activity";
    const loadFullRelationship =
      deps.tab === "overview" || deps.section === "relationship" || deps.tab === "more";
    const [customer360, operatorPanel, reviewFlags] = await Promise.all([
      fetchCustomer360({ data: { userId: params.userId, includeTimeline } }),
      loadFullRelationship
        ? fetchRelationshipOperatorPanel({ data: params.userId }).catch(() =>
            fetchRelationshipWorkspaceChrome({ data: params.userId }),
          )
        : fetchRelationshipWorkspaceChrome({ data: params.userId }),
      fetchOpsReviewFlagsForCustomer({ data: params.userId }),
    ]);
    return { ...customer360, operatorPanel, reviewFlags };
  },

  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.user.discordUsername ?? "Customer"}`, (match.search as { site?: string }).site) }],
  }),
  component: CustomerWorkspaceRoute,
});

function CustomerWorkspaceRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return <CustomerWorkspaceView data={data} search={search} />;
}
