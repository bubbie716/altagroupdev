import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { INTERNAL_ACCOUNT_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsSection, OpsStatStrip } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { fetchInternalBankAccountsFiltered } from "@/lib/bank/bank.functions";
import type { InternalBankAccountRow } from "@/lib/bank/backend-types";
import {
  accountActivityLabel,
  accountMatchesQuery,
  accountNeedsDirectoryAttention,
  sortAccountsForDirectory,
} from "@/lib/internal/money-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type InternalAccountsSearch = {
  q?: string;
  status?: string;
  accountType?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/bank/accounts/")({
  validateSearch: (search: Record<string, unknown>): InternalAccountsSearch => {
    const site = validateDevSiteSearch(search).site;
    const str = (key: string) =>
      typeof search[key] === "string" && (search[key] as string).trim()
        ? (search[key] as string).trim()
        : undefined;
    return {
      q: str("q"),
      status: str("status"),
      accountType: str("accountType"),
      attention: search.attention === "1" ? "1" : undefined,
      site,
    };
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    status: search.status?.toLowerCase(),
  }),
  loader: ({ deps }) => fetchInternalBankAccountsFiltered({ data: deps }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Accounts", (match.search as { site?: string }).site ?? "bank") }] }),
  component: InternalBankAccounts,
});

function InternalBankAccounts() {
  const accounts = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const attentionOnly = search.attention === "1";

  let filtered = accounts.filter((a) => accountMatchesQuery(a, search.q ?? ""));
  if (search.status) {
    filtered = filtered.filter((a) => a.status.toLowerCase() === search.status!.toLowerCase());
  }
  if (search.accountType) {
    filtered = filtered.filter((a) =>
      a.product.toLowerCase().includes(search.accountType!.toLowerCase()),
    );
  }
  const sorted = sortAccountsForDirectory(filtered, attentionOnly);
  const filtersOn = Boolean(search.q || search.status || search.accountType || search.attention);
  const returnFrom = buildListReturnPath("/internal/bank/accounts", {
    q: search.q,
    status: search.status,
    accountType: search.accountType,
    attention: search.attention,
    site: search.site,
  });

  function patchSearch(patch: Partial<InternalAccountsSearch>) {
    void navigate({
      to: "/internal/bank/accounts",
      search: withInternalSiteSearch({ ...search, ...patch }, search.site),
      replace: true,
    });
  }

  function recordSearch() {
    return {
      ...withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site),
      from: returnFrom,
    };
  }

  return (
    <InternalPageShell
      title="Accounts"
      breadcrumbs={buildBreadcrumbs([
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
        { label: "Accounts" },
      ])}
    >
      <OpsStatStrip
        stats={[
          { label: "Shown", value: sorted.length.toLocaleString() },
          {
            label: "Needs attention",
            value: accounts.filter(accountNeedsDirectoryAttention).length,
            tone: "warn",
          },
        ]}
      />

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/bank/accounts",
                  search: withInternalSiteSearch({}, search.site),
                  replace: true,
                })
            : undefined
        }
      >
        <OpsFilterField label="Search">
          <input
            className={OPS_FILTER_FIELD_CLASS}
            value={search.q ?? ""}
            onChange={(e) => patchSearch({ q: e.target.value || undefined })}
            placeholder="Account, reference, owner, company…"
            aria-label="Search accounts"
          />
        </OpsFilterField>
        <OpsFilterField label="Status">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.status ?? ""}
            onChange={(e) => patchSearch({ status: e.target.value || undefined })}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Frozen">Frozen</option>
            <option value="Closed">Closed</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Type">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.accountType ?? ""}
            onChange={(e) => patchSearch({ accountType: e.target.value || undefined })}
            aria-label="Filter by account type"
          >
            <option value="">All</option>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="operating">Operating</option>
            <option value="reserve">Reserve</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Needs attention">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.attention ?? ""}
            onChange={(e) => patchSearch({ attention: e.target.value === "1" ? "1" : undefined })}
            aria-label="Needs attention filter"
          >
            <option value="">Any</option>
            <option value="1">Needs attention</option>
          </select>
        </OpsFilterField>
      </OpsFilterBar>

      <OpsSection title={`Accounts · ${sorted.length}`}>
        {sorted.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
            {filtersOn
              ? "No accounts match the current filters."
              : "No bank accounts yet."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Account</th>
                    <th className="px-2 py-2 font-medium">Owner</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Balance</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
                    <tr key={`desktop-${a.id}`} className="border-b border-border/40 hover:bg-surface-1/40">
                      <td className="px-2 py-2.5">
                        <Link
                          to="/internal/bank/accounts/$accountId"
                          params={{ accountId: a.id }}
                          search={recordSearch()}
                          className="font-medium hover:text-gold"
                        >
                          {a.accountName}
                        </Link>
                        <div className="font-mono text-[11px] text-muted-foreground">{a.accountNumber}</div>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{a.holder}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{a.product}</td>
                      <td className="px-2 py-2.5 type-finance tabular-nums">{a.balance}</td>
                      <td className="px-2 py-2.5">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {accountActivityLabel(a)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {sorted.map((a) => {
                const attention = accountNeedsDirectoryAttention(a);
                return (
                  <li key={`mobile-${a.id}`}>
                    <Link
                      to="/internal/bank/accounts/$accountId"
                      params={{ accountId: a.id }}
                      search={recordSearch()}
                      className={cn(
                        "block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        attention ? "border-amber-500/40" : undefined,
                      )}
                      aria-label={`Review account ${a.accountName}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{a.accountName}</p>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                            {a.accountNumber}
                          </p>
                          <p className="mt-1 text-[12px] text-muted-foreground">{a.holder}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="type-finance tabular-nums text-[12px]">{a.balance}</p>
                          <div className="mt-1">
                            <StatusBadge status={a.status} />
                          </div>
                        </div>
                      </div>
                      <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                        Review account
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}
