import { createFileRoute } from "@tanstack/react-router";
import { CustomerWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchCustomer360 } from "@/lib/internal/ops-platform.functions";
import { fetchOpsReviewFlagsForCustomer } from "@/lib/internal/ops-v1.functions";
import { fetchRelationshipOperatorPanel } from "@/lib/internal/relationship-intelligence.functions";

const TABS = [
  "overview",
  "accounts",
  "alta-card",
  "lending",
  "relationship",
  "companies",
  "activity",
  "flags",
  "audit",
  "notes",
];

export const Route = createFileRoute("/internal/users/$userId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
    privateReview: search.privateReview === true || search.privateReview === "true",
  }),
  loader: async ({ params }) => {
    const [customer360, operatorPanel, reviewFlags] = await Promise.all([
      fetchCustomer360({ data: params.userId }),
      fetchRelationshipOperatorPanel({ data: params.userId }),
      fetchOpsReviewFlagsForCustomer({ data: params.userId }),
    ]);
    return { ...customer360, operatorPanel, reviewFlags };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.user.discordUsername ?? "Customer"} — Alta Internal` }],
  }),
  component: CustomerWorkspaceRoute,
});

function CustomerWorkspaceRoute() {
  const data = Route.useLoaderData();
  const { tab, privateReview } = Route.useSearch();
  return <CustomerWorkspaceView data={data} activeTab={tab} privateReview={privateReview} />;
}
