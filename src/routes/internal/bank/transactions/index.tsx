import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { searchTransactionsExplorer } from "@/lib/internal/ops-platform.functions";
import type { TransactionExplorerRow } from "@/lib/internal/ops-types";
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

  return (
    <InternalPageShell title="Transaction Explorer" description="Search every bank transaction in Alta.">
      <form className="mb-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={search.q ?? ""} placeholder="Reference, description…" className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <select name="type" defaultValue={search.type ?? ""} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="adjustment">Adjustment</option>
          <option value="interest_credit">Interest credit</option>
          <option value="loan_payment">Loan payment</option>
        </select>
        <select name="status" defaultValue={search.status ?? ""} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </select>
        <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-[12px] text-background">Search</button>
        <Link to="/internal/bank/transactions" className="rounded-md border border-border px-4 py-2 text-[12px]">Clear</Link>
      </form>

      <Section title={`${result.total} transaction(s)`}>
        <AdminDataTable
          columns={[
            { key: "ref", header: "Reference", cell: (r: TransactionExplorerRow) => (
              <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: r.id }} className="font-mono text-[11px] hover:text-gold">{r.referenceCode}</Link>
            )},
            { key: "type", header: "Type", cell: (r) => r.type },
            { key: "status", header: "Status", cell: (r) => r.status },
            { key: "amount", header: "Amount", cell: (r) => florin(r.amount) },
            { key: "account", header: "Account", cell: (r) => <span className="font-mono text-[11px]">{r.accountNumber}</span> },
            { key: "holder", header: "Holder", cell: (r) => r.holder },
            { key: "date", header: "Date", cell: (r) => <span className="font-mono text-[11px]">{r.createdAt.slice(0, 19).replace("T", " ")}</span> },
          ]}
          rows={result.items}
          rowKey={(r) => r.id}
        />
        {result.hasMore ? <p className="mt-3 text-[12px] text-muted-foreground">Showing first {result.items.length} of {result.total}. Refine search to narrow results.</p> : null}
      </Section>
    </InternalPageShell>
  );
}
