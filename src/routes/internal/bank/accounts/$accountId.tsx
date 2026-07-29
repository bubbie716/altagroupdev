import { createFileRoute } from "@tanstack/react-router";
import { AccountWorkspaceView } from "@/components/internal/workspace";
import { fetchInternalBankAccountDetail } from "@/lib/bank/bank.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { fetchAccountOpsSummary, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { parseAccountWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/accounts/$accountId")({
  validateSearch: (search: Record<string, unknown>) => parseAccountWorkspaceSearch(search),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    section: search.section,
    filter: search.filter,
  }),
  loader: async ({ params, deps }) => {
    const includeAudit = deps.tab === "more" || deps.section === "audit";
    const includeNotes = deps.tab === "more" || deps.section === "notes";
    const includeActivity = deps.tab === "activity";
    const [account, auditLogs, notes, ops, timeline] = await Promise.all([
      fetchInternalBankAccountDetail({ data: params.accountId }),
      includeAudit
        ? fetchAuditLogsForEntity({
            data: { entityType: "BANK_ACCOUNT", entityId: params.accountId },
          })
        : Promise.resolve([]),
      includeNotes
        ? fetchInternalNotes({ data: { targetType: "BANK_ACCOUNT", targetId: params.accountId } })
        : Promise.resolve([]),
      fetchAccountOpsSummary({ data: params.accountId }),
      includeActivity
        ? fetchActivityTimeline({
            data: { entityType: "BANK_ACCOUNT", entityId: params.accountId },
          })
        : Promise.resolve([]),
    ]);
    return { account, auditLogs, notes, ops, timeline };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.account.accountNumber ?? "Account"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: AccountWorkspaceRoute,
});

function AccountWorkspaceRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return <AccountWorkspaceView data={data} search={search} />;
}
