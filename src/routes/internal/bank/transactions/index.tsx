import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console/ops-table";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsFilterBar } from "@/components/internal/console/ops-filter-bar";
import { searchTransactionsExplorer } from "@/lib/internal/ops-platform.functions";
import type { TransactionExplorerRow } from "@/lib/internal/ops-types";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { florin } from "@/lib/bank/api";

export type TransactionSearch = {
  q?: string;
  type?: string;
  status?: string;
};

export const Route = createFileRoute("/internal/bank/transactions/")({
  validateSearch: (s: Record<string, unknown>): TransactionSearch => ({
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    type: typeof s.type === "string" && s.type ? s.type : undefined,
    status: typeof s.status === "string" && s.status ? s.status : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchTransactionsExplorer({ data: { ...deps, limit: 50, offset: 0 } }),
  head: () => ({ meta: [{ title: "Transaction Explorer — Alta Internal" }] }),
  component: TransactionExplorerPage,
});

function TransactionExplorerPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();

  const columns: OpsTableColumn<TransactionExplorerRow>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (r) => (
        <Link
          to="/internal/bank/transactions/$transactionId"
          params={{ transactionId: r.id }}
          className="font-mono text-[11px] hover:text-gold"
        >
          {r.referenceCode}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <OpsStatusBadge status={r.type.replace(/_/g, " ")} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <OpsStatusBadge status={r.status} />,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => <span className="type-finance tabular-nums">{florin(r.amount)}</span>,
    },
    {
      key: "account",
      header: "Account",
      cell: (r) => <span className="font-mono text-[11px]">{r.accountNumber}</span>,
    },
    { key: "holder", header: "Holder", cell: (r) => r.holder },
    {
      key: "date",
      header: "Date",
      cell: (r) => (
        <span className="font-mono text-[11px]">{r.createdAt.slice(0, 19).replace("T", " ")}</span>
      ),
    },
  ];

  return (
    <InternalPageShell title="Transaction Explorer" description="Search every bank transaction in Alta.">
      <OpsFilterBar className="!block !p-0 !border-0 !bg-transparent">
        <form className="flex flex-wrap gap-2 rounded border border-border/60 bg-surface-1/40 p-3">
          <input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Reference, description…"
            className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <select
            name="type"
            defaultValue={search.type ?? ""}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="INTEREST_CREDIT">Interest credit</option>
            <option value="LOAN_PAYMENT">Loan payment</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <select
            name="status"
            defaultValue={search.status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            Search
          </button>
          <Link
            to="/internal/bank/transactions"
            className="rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
          >
            Clear
          </Link>
        </form>
      </OpsFilterBar>

      <OpsSection title={`${result.total} transaction(s)`}>
        <OpsTable
          columns={columns}
          rows={result.items}
          rowKey={(r) => r.id}
          emptyState="No transactions match these filters."
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              {result.hasMore ? (
                <span className="text-[11px] text-muted-foreground">
                  Showing first {result.items.length} of {result.total}. Refine search to narrow results.
                </span>
              ) : null}
              <OpsCsvExportButton
                filename="transactions.csv"
                headers={["reference", "type", "status", "amount", "account", "holder", "date"]}
                getRows={() =>
                  result.items.map((r) => [
                    r.referenceCode,
                    r.type,
                    r.status,
                    r.amount,
                    r.accountNumber,
                    r.holder,
                    r.createdAt.slice(0, 19),
                  ])
                }
              />
            </div>
          }
        />
      </OpsSection>
    </InternalPageShell>
  );
}
