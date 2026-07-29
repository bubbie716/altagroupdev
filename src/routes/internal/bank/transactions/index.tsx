import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { INTERNAL_TRANSACTION_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection, OpsStatStrip } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { searchTransactionsExplorer } from "@/lib/internal/ops-platform.functions";
import type { TransactionExplorerRow } from "@/lib/internal/ops-types";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { florin } from "@/lib/bank/api";
import { plainTransactionTypeTitle } from "@/lib/internal/transaction-record-copy";
import {
  MONEY_LIST_PAGE_SIZE,
  partyAccountLabel,
  transactionDirectionWord,
  transactionNeedsDecision,
  transactionReviewCta,
} from "@/lib/internal/money-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TransactionSearch = {
  q?: string;
  type?: string;
  status?: string;
  offset?: number;
  site?: string;
};

export const Route = createFileRoute("/internal/bank/transactions/")({
  validateSearch: (s: Record<string, unknown>): TransactionSearch => {
    const site = validateDevSiteSearch(s).site;
    const offsetRaw = s.offset;
    const offset =
      typeof offsetRaw === "number"
        ? offsetRaw
        : typeof offsetRaw === "string" && /^\d+$/.test(offsetRaw)
          ? Number(offsetRaw)
          : undefined;
    return {
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      type: typeof s.type === "string" && s.type ? s.type : undefined,
      status: typeof s.status === "string" && s.status ? s.status : undefined,
      offset: offset && offset > 0 ? offset : undefined,
      site,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    searchTransactionsExplorer({
      data: {
        q: deps.q,
        type: deps.type,
        status: deps.status,
        limit: MONEY_LIST_PAGE_SIZE,
        offset: deps.offset ?? 0,
      },
    }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Transactions", (match.search as { site?: string }).site ?? "bank") }] }),
  component: TransactionsPage,
});

function txSearch(from: string, site?: string) {
  return { ...withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, site), from };
}

function amountClass(type: string) {
  const t = type.toUpperCase();
  if (t === "DEPOSIT" || t === "INTEREST_CREDIT") return "text-[var(--success)]";
  if (t === "WITHDRAWAL" || t === "LOAN_PAYMENT" || t === "FEE" || t === "INTEREST_CHARGE") {
    return "text-destructive/90";
  }
  return "";
}

function TransactionsPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const offset = search.offset ?? 0;
  const filtersOn = Boolean(search.q || search.type || search.status);
  const pendingOnPage = result.items.filter(transactionNeedsDecision).length;
  const returnFrom = buildListReturnPath("/internal/bank/transactions", {
    q: search.q,
    type: search.type,
    status: search.status,
    offset: search.offset,
    site: search.site,
  });

  function patchSearch(patch: Partial<TransactionSearch>, resetOffset = true) {
    void navigate({
      to: "/internal/bank/transactions",
      search: withInternalSiteSearch(
        {
          ...search,
          ...patch,
          ...(resetOffset ? { offset: undefined } : {}),
        },
        search.site,
      ),
      replace: true,
    });
  }

  return (
    <InternalPageShell
      title="Transactions"
      breadcrumbs={[
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
        { label: "Transactions" },
      ]}
    >
      <OpsStatStrip
        stats={[
          { label: "Shown", value: `${result.items.length} of ${result.total}` },
          { label: "Pending on page", value: pendingOnPage, tone: pendingOnPage ? "warn" : undefined },
        ]}
      />

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/bank/transactions",
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
            placeholder="Reference, account, party…"
            aria-label="Search transactions"
          />
        </OpsFilterField>
        <OpsFilterField label="Type">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.type ?? ""}
            onChange={(e) => patchSearch({ type: e.target.value || undefined })}
            aria-label="Filter by type"
          >
            <option value="">All</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="INTEREST_CREDIT">Interest credit</option>
            <option value="LOAN_PAYMENT">Loan payment</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </OpsFilterField>
        <OpsFilterField label="Status">
          <select
            className={OPS_FILTER_FIELD_CLASS}
            value={search.status ?? ""}
            onChange={(e) => patchSearch({ status: e.target.value || undefined })}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </OpsFilterField>
      </OpsFilterBar>

      <div className="mb-3 flex justify-end">
        <OpsCsvExportButton
          filename={`transactions${search.status ? `-${search.status.toLowerCase()}` : ""}.csv`}
          headers={["reference", "type", "direction", "party", "account", "amount", "status", "date"]}
          getRows={() =>
            result.items.map((r) => [
              r.referenceCode,
              r.type,
              transactionDirectionWord(r.type),
              r.holder,
              r.accountNumber,
              r.amount,
              r.status,
              r.createdAt.slice(0, 19),
            ])
          }
        />
      </div>

      <OpsSection
        title={`Transactions ${result.items.length ? `${offset + 1}–${offset + result.items.length}` : "(0)"}${result.hasMore ? "+" : ""}`}
      >
        {result.items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
            {filtersOn ? "No transactions match these filters." : "No transactions yet."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Transaction</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Party / account</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((r: TransactionExplorerRow) => {
                    const direction = transactionDirectionWord(r.type);
                    return (
                      <tr key={`desktop-${r.id}`} className="border-b border-border/40 hover:bg-surface-1/40">
                        <td className="px-2 py-2.5">
                          <Link
                            to="/internal/bank/transactions/$transactionId"
                            params={{ transactionId: r.id }}
                            search={txSearch(returnFrom, search.site)}
                            className="font-mono text-[11px] hover:text-gold"
                          >
                            {r.referenceCode}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5">
                          <div>{plainTransactionTypeTitle(r.type, r.description)}</div>
                          <div className="text-[11px] text-muted-foreground">{direction}</div>
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">{partyAccountLabel(r)}</td>
                        <td className="px-2 py-2.5">
                          <span className={cn("type-finance tabular-nums", amountClass(r.type))}>
                            {direction === "Out" ? "−" : direction === "In" ? "+" : ""}
                            {florin(r.amount)}
                          </span>
                          <span className="sr-only"> {direction === "Out" ? "outgoing" : direction === "In" ? "incoming" : ""}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <OpsStatusBadge status={r.status} />
                        </td>
                        <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {r.createdAt.slice(0, 19).replace("T", " ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {result.items.map((r) => {
                const direction = transactionDirectionWord(r.type);
                const cta = transactionReviewCta(r);
                return (
                  <li key={`mobile-${r.id}`}>
                    <Link
                      to="/internal/bank/transactions/$transactionId"
                      params={{ transactionId: r.id }}
                      search={txSearch(returnFrom, search.site)}
                      className={cn(
                        "block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        transactionNeedsDecision(r) ? "border-amber-500/40" : undefined,
                      )}
                      aria-label={`${cta} ${r.referenceCode}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">
                            {plainTransactionTypeTitle(r.type, r.description)}
                          </p>
                          <p className="mt-1 text-[12px] text-muted-foreground">{partyAccountLabel(r)}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {r.createdAt.slice(0, 10)} · {direction}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn("type-finance tabular-nums text-[12px]", amountClass(r.type))}>
                            {direction === "Out" ? "−" : direction === "In" ? "+" : ""}
                            {florin(r.amount)}
                          </p>
                          <div className="mt-1">
                            <OpsStatusBadge status={r.status} />
                          </div>
                        </div>
                      </div>
                      <span className="mt-2 inline-block text-[12px] font-medium text-gold">{cta}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="h-8 rounded border border-border px-3 text-[12px] disabled:opacity-40"
                disabled={offset <= 0}
                onClick={() => patchSearch({ offset: Math.max(0, offset - MONEY_LIST_PAGE_SIZE) }, false)}
              >
                Previous
              </button>
              <span className="text-[12px] text-muted-foreground">
                Page {Math.floor(offset / MONEY_LIST_PAGE_SIZE) + 1}
              </span>
              <button
                type="button"
                className="h-8 rounded border border-border px-3 text-[12px] disabled:opacity-40"
                disabled={!result.hasMore}
                onClick={() => patchSearch({ offset: offset + MONEY_LIST_PAGE_SIZE }, false)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}
