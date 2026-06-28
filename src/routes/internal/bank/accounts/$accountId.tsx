import { createFileRoute } from "@tanstack/react-router";
import { AccountWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchInternalBankAccountDetail } from "@/lib/bank/bank.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { fetchAccountOpsSummary, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";

const TABS = ["overview", "transactions", "statements", "holds", "activity", "audit", "notes"];

export const Route = createFileRoute("/internal/bank/accounts/$accountId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
  }),
  loader: async ({ params }) => {
    const [account, auditLogs, notes, ops, timeline] = await Promise.all([
      fetchInternalBankAccountDetail({ data: params.accountId }),
      fetchAuditLogsForEntity({ data: { entityType: "BANK_ACCOUNT", entityId: params.accountId } }),
      fetchInternalNotes({ data: { targetType: "BANK_ACCOUNT", targetId: params.accountId } }),
      fetchAccountOpsSummary({ data: params.accountId }),
      fetchActivityTimeline({ data: { entityType: "BANK_ACCOUNT", entityId: params.accountId } }),
    ]);
    return { account, auditLogs, notes, ops, timeline };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.account.accountNumber ?? "Account"} — Alta Internal` }],
  }),
  component: AccountWorkspaceRoute,
});

function AccountWorkspaceRoute() {
  const data = Route.useLoaderData();
  const { tab } = Route.useSearch();
  return <AccountWorkspaceView data={data} activeTab={tab} />;
}
