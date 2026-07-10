import { createFileRoute, Link } from "@tanstack/react-router";
import { INTERNAL_ACCOUNT_WORKSPACE_SEARCH } from "@/lib/internal/internal-route-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
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
      breadcrumbs={buildBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Accounts" },
      ])}
    >
      <form>
        <OpsFilterBar>
          <OpsFilterField label="Search">
            <input
              name="q"
              defaultValue={search.q ?? ""}
              placeholder="Account number, name, owner…"
              className={OPS_FILTER_FIELD_CLASS}
            />
          </OpsFilterField>
          <OpsFilterField label="Status">
            <select name="status" defaultValue={search.status ?? ""} className={OPS_FILTER_FIELD_CLASS}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="frozen">Frozen</option>
              <option value="closed">Closed</option>
            </select>
          </OpsFilterField>
          <div className="flex items-end gap-2 md:col-span-2">
            <button
              type="submit"
              className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
            >
              Apply
            </button>
            <Link
              to="/internal/bank/accounts"
              className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
            >
              Clear
            </Link>
          </div>
        </OpsFilterBar>
      </form>

      <OpsSection title={`Accounts (${accounts.length})`}>
        <AdminDataTable
          columns={[
            {
              key: "number",
              header: "Account",
              cell: (a: InternalBankAccountRow) => (
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: a.id }}
                  search={INTERNAL_ACCOUNT_WORKSPACE_SEARCH}
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
          emptyState="No bank accounts match the current filters."
        />
      </OpsSection>
    </InternalPageShell>
  );
}
