import { createFileRoute } from "@tanstack/react-router";
import { TerminalOrderWorkspaceView } from "@/components/internal/workspace/terminal-order-workspace-view";
import { parseTerminalOrderRecordSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { fetchTerminalOrderDetail } from "@/lib/terminal/terminal-ops.functions";
import type { TerminalOpsOrderRow } from "@/lib/terminal/terminal-ops-types";

export const Route = createFileRoute("/internal/terminal/orders/$orderId")({
  validateSearch: (search: Record<string, unknown>) => parseTerminalOrderRecordSearch(search),
  loader: async ({ params }): Promise<{ order: TerminalOpsOrderRow }> => {
    const order = await fetchTerminalOrderDetail({ data: params.orderId });
    return { order };
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: internalDocumentTitle(
          loaderData?.order.symbol ?? "Order",
          (match.search as { site?: string }).site ?? "terminal",
        ),
      },
    ],
  }),
  component: TerminalOrderWorkspaceRoute,
});

function TerminalOrderWorkspaceRoute() {
  const { order } = Route.useLoaderData();
  const search = Route.useSearch();
  return <TerminalOrderWorkspaceView order={order} search={search} />;
}
