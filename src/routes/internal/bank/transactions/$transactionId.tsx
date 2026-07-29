import { createFileRoute } from "@tanstack/react-router";
import { TransactionWorkspaceView } from "@/components/internal/workspace";
import { fetchTransactionDetail } from "@/lib/internal/ops-platform.functions";
import { fetchActiveOpsReviewFlags } from "@/lib/internal/ops-v1.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { parseTransactionRecordSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/transactions/$transactionId")({
  validateSearch: (search: Record<string, unknown>) => parseTransactionRecordSearch(search),
  loader: async ({ params }) => {
    const [tx, audit, notes, reviewFlags] = await Promise.all([
      fetchTransactionDetail({ data: params.transactionId }),
      fetchAuditLogsForEntity({ data: { entityType: "BANK_TRANSACTION", entityId: params.transactionId } }),
      fetchInternalNotes({ data: { targetType: "BANK_TRANSACTION", targetId: params.transactionId } }),
      fetchActiveOpsReviewFlags({
        data: { targetType: "BANK_TRANSACTION", targetId: params.transactionId },
      }),
    ]);
    return { tx, audit, notes, reviewFlags };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.tx.referenceCode ?? "Transaction"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: TransactionWorkspaceRoute,
});

function TransactionWorkspaceRoute() {
  const { tx, audit, notes, reviewFlags } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <TransactionWorkspaceView
      tx={tx}
      audit={audit}
      notes={notes}
      search={search}
      reviewFlags={reviewFlags}
    />
  );
}
