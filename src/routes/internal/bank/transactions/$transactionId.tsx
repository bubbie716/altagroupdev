import { createFileRoute } from "@tanstack/react-router";
import { TransactionWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchTransactionDetail } from "@/lib/internal/ops-platform.functions";
import { fetchActiveOpsReviewFlags } from "@/lib/internal/ops-v1.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";

const TABS = ["overview", "related", "flags", "audit", "notes"];

export const Route = createFileRoute("/internal/bank/transactions/$transactionId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
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
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.tx.referenceCode ?? "Transaction"} — Alta Internal` }],
  }),
  component: TransactionWorkspaceRoute,
});

function TransactionWorkspaceRoute() {
  const { tx, audit, notes, reviewFlags } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  return <TransactionWorkspaceView tx={tx} audit={audit} notes={notes} activeTab={tab} reviewFlags={reviewFlags} />;
}
