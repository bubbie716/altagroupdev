import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { fetchInternalBankAccountsFiltered } from "@/lib/bank/bank.functions";
import type { InternalBankAccountRow } from "@/lib/bank/backend-types";

export type InternalAccountsSearch = {
  q?: string;
  status?: string;
  accountType?: string;
};

export const Route = createFileRoute("/internal/bank/accounts/")({
  validateSearch: (search: Record<string, unknown>): InternalAccountsSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    status: typeof search.status === "string" && search.status ? search.status : undefined,
    accountType: typeof search.accountType === "string" && search.accountType ? search.accountType : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchInternalBankAccountsFiltered({ data: deps }),
  head: () => ({ meta: [{ title: "Bank Accounts — Alta Internal" }] }),
  component: InternalBankAccounts,
});

function InternalBankAccounts() {
  const accounts = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <InternalPageShell
      title="Bank Accounts"
      description="Search and manage Alta Bank accounts across personal and business relationships."
    >
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={search.q ?? ""}
          placeholder="Account number, name, owner…"
          className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={search.status ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="frozen">Frozen</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background">
          Search
        </button>
        <Link to="/internal/bank/accounts" className="rounded-md border border-border px-4 py-2 text-[12px]">
          Clear
        </Link>
      </form>

      <Section title={`Accounts (${accounts.length})`}>
        <AdminDataTable
          columns={[
            {
              key: "number",
              header: "Account",
              cell: (a: InternalBankAccountRow) => (
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: a.id }}
                  className="font-mono text-[12px] hover:text-gold"
                >
                  {a.accountNumber}
                </Link>
              ),
            },
            { key: "name", header: "Name", cell: (a: InternalBankAccountRow) => a.accountName },
            { key: "holder", header: "Owner", cell: (a: InternalBankAccountRow) => a.holder },
            { key: "product", header: "Type", cell: (a: InternalBankAccountRow) => a.product },
            { key: "balance", header: "Balance", cell: (a: InternalBankAccountRow) => a.balance },
            {
              key: "status",
              header: "Status",
              cell: (a: InternalBankAccountRow) => <StatusBadge status={a.status} />,
            },
            {
              key: "opened",
              header: "Opened",
              cell: (a: InternalBankAccountRow) => (
                <span className="font-mono text-[11px]">{a.createdAt.slice(0, 10)}</span>
              ),
            },
          ]}
          rows={accounts}
          rowKey={(a) => a.id}
        />
      </Section>
    </InternalPageShell>
  );
}
