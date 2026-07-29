import { createFileRoute } from "@tanstack/react-router";
import { ScheduledTransferWorkspaceView } from "@/components/internal/workspace";
import { fetchInternalScheduledTransferDetail } from "@/lib/bank/scheduled-transfer-admin.functions";
import type { InternalScheduledTransferDetail } from "@/lib/bank/ui-lab-money-ops-fixtures";
import { parseTransferRecordSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/transfers/$transferId")({
  validateSearch: (search: Record<string, unknown>) => parseTransferRecordSearch(search),
  loader: async ({ params }): Promise<{ transfer: InternalScheduledTransferDetail }> => {
    const transfer = await fetchInternalScheduledTransferDetail({ data: params.transferId });
    return { transfer };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.transfer.label ?? "Transfer"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: ScheduledTransferWorkspaceRoute,
});

function ScheduledTransferWorkspaceRoute() {
  const { transfer } = Route.useLoaderData();
  const search = Route.useSearch();
  return <ScheduledTransferWorkspaceView transfer={transfer} search={search} />;
}
