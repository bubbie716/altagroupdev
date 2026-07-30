import { createFileRoute, notFound } from "@tanstack/react-router";
import { TerminalFundingWorkspaceView } from "@/components/internal/workspace/terminal-funding-workspace-view";
import { fetchInternalTerminalFundingTransfer } from "@/lib/terminal/terminal-funding.functions";
import { parseTransferRecordSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/transfers/funding/$transferId")({
  validateSearch: (search: Record<string, unknown>) => parseTransferRecordSearch(search),
  loader: async ({ params }) => {
    const transfer = await fetchInternalTerminalFundingTransfer({ data: params.transferId });
    if (!transfer) throw notFound();
    return { transfer };
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: internalDocumentTitle(
          loaderData?.transfer.referenceCode ?? "Terminal funding",
          (match.search as { site?: string }).site ?? "bank",
        ),
      },
    ],
  }),
  component: TerminalFundingWorkspaceRoute,
});

function TerminalFundingWorkspaceRoute() {
  const { transfer } = Route.useLoaderData();
  const search = Route.useSearch();
  return <TerminalFundingWorkspaceView transfer={transfer} search={search} />;
}
