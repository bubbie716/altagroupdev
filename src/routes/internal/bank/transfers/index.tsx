import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { OpsFilterChip } from "@/components/internal/console/ops-filter-chip";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fetchInternalScheduledTransfers } from "@/lib/bank/scheduled-transfer-admin.functions";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import { fetchInternalTerminalFundingTransfers } from "@/lib/terminal/terminal-funding.functions";
import type { TerminalFundingTransferRow } from "@/lib/terminal/terminal-funding-types";
import {
  INTERNAL_TRANSFER_RECORD_SEARCH,
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import {
  TRANSFER_LIST_FILTERS,
  TRANSFER_LIST_FILTER_LABELS,
  parseTransferListFilter,
  plainTransferStatusLabel,
  plainTransferTypeTitle,
  transferMatchesListFilter,
  transferNeedsAttention,
  transferReviewCta,
  type TransferListFilter,
} from "@/lib/internal/transfer-record-copy";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TransfersSearch = {
  status?: TransferListFilter;
  q?: string;
  site?: string;
  kind?: "scheduled" | "terminal-funding";
  fundingDirection?: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
  fundingStatus?: "PENDING" | "COMPLETED" | "FAILED";
};

export const Route = createFileRoute("/internal/bank/transfers/")({
  validateSearch: (s: Record<string, unknown>): TransfersSearch => {
    const status = parseTransferListFilter(typeof s.status === "string" ? s.status : undefined);
    const kind =
      s.kind === "terminal-funding" || s.kind === "scheduled" ? s.kind : undefined;
    const fundingDirection =
      s.fundingDirection === "BANK_TO_TERMINAL" || s.fundingDirection === "TERMINAL_TO_BANK"
        ? s.fundingDirection
        : undefined;
    const fundingStatus =
      s.fundingStatus === "PENDING" ||
      s.fundingStatus === "COMPLETED" ||
      s.fundingStatus === "FAILED"
        ? s.fundingStatus
        : undefined;
    return {
      status: status === "all" ? undefined : status,
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      site: validateDevSiteSearch(s).site,
      kind,
      fundingDirection,
      fundingStatus,
    };
  },
  loader: async () => {
    const [scheduled, funding] = await Promise.all([
      fetchInternalScheduledTransfers(),
      fetchInternalTerminalFundingTransfers({ data: { limit: 100 } }).catch(
        () => [] as TerminalFundingTransferRow[],
      ),
    ]);
    return { scheduled, funding };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Transfers", (match.search as { site?: string }).site ?? "bank") }] }),
  component: InternalTransfersPage,
});

function InternalTransfersPage() {
  const { scheduled: transfers, funding } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const filter = search.status ?? "all";
  const q = search.q?.toLowerCase() ?? "";
  const kind = search.kind ?? "scheduled";
  const filtersOn = Boolean(
    (filter && filter !== "all") ||
      search.q ||
      search.fundingDirection ||
      search.fundingStatus,
  );

  const filtered = transfers.filter((row: InternalScheduledTransferRow) => {
    if (!transferMatchesListFilter(row, filter)) return false;
    if (!q) return true;
    const hay = [
      row.label,
      row.ownerLabel,
      row.sourceAccountNumber,
      row.destinationName,
      row.destinationAccountNumber ?? "",
      row.statusLabel,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const failed = transfers.filter((r) => r.status === "failed" || r.status === "rejected");
  const pendingReview = transfers.filter((r) => r.status === "pending_review");
  const stalled = transfers.filter(
    (r) => r.consecutiveFailures > 0 && r.status !== "failed" && r.status !== "rejected",
  );

  const returnFrom = buildListReturnPath("/internal/bank/transfers", {
    kind: kind === "scheduled" ? undefined : kind,
    status: filter === "all" ? undefined : filter,
    q: search.q,
    fundingDirection: search.fundingDirection,
    fundingStatus: search.fundingStatus,
    site: search.site,
  });

  const failedFunding = funding.filter((r) => r.status === "FAILED");

  function patchSearch(patch: Partial<TransfersSearch>) {
    void navigate({
      to: "/internal/bank/transfers",
      search: withInternalSiteSearch(
        {
          kind: patch.kind ?? kind,
          status:
            patch.status === "all"
              ? undefined
              : (patch.status ?? (filter === "all" ? undefined : filter)),
          q: patch.q !== undefined ? patch.q || undefined : search.q,
          fundingDirection:
            patch.fundingDirection !== undefined
              ? patch.fundingDirection || undefined
              : search.fundingDirection,
          fundingStatus:
            patch.fundingStatus !== undefined
              ? patch.fundingStatus || undefined
              : search.fundingStatus,
        },
        search.site,
      ),
      replace: true,
    });
  }

  function recordSearch() {
    return withInternalSiteSearch({ ...INTERNAL_TRANSFER_RECORD_SEARCH, from: returnFrom }, search.site);
  }

  const fundingFiltered = funding.filter((row) => {
    if (search.fundingDirection && row.direction !== search.fundingDirection) return false;
    if (search.fundingStatus && row.status !== search.fundingStatus) return false;
    if (!q) return true;
    const hay = [
      row.referenceCode,
      row.ownerLabel,
      row.bankAccountLabel,
      row.portfolioName,
      row.status,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <InternalPageShell title="Transfers">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Intrabank scheduled transfers and Bank ↔ Terminal funding. Immediate bank-to-bank transfers appear
        as transactions; interbank wires are not available.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <OpsFilterChip
          to="/internal/bank/transfers"
          search={withInternalSiteSearch(
            { kind: undefined, status: filter === "all" ? undefined : filter, q: search.q },
            search.site,
          )}
          pressed={kind === "scheduled"}
        >
          Scheduled
        </OpsFilterChip>
        <OpsFilterChip
          to="/internal/bank/transfers"
          search={withInternalSiteSearch(
            {
              kind: "terminal-funding",
              q: search.q,
              fundingDirection: search.fundingDirection,
              fundingStatus: search.fundingStatus,
            },
            search.site,
          )}
          pressed={kind === "terminal-funding"}
        >
          Terminal funding
        </OpsFilterChip>
      </div>

      {kind === "scheduled" ? (
        <>
          {failed.length > 0 || pendingReview.length > 0 || stalled.length > 0 ? (
            <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
                Needs attention
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {failed.length > 0 ? (
                  <li>
                    {failed.length} failed transfer{failed.length === 1 ? "" : "s"}.{" "}
                    <Link
                      to="/internal/bank/transfers"
                      search={withInternalSiteSearch({ status: "failed" as const }, search.site)}
                      className="text-gold hover:underline"
                    >
                      Review failed transfers
                    </Link>
                  </li>
                ) : null}
                {pendingReview.length > 0 ? (
                  <li>
                    {pendingReview.length} transfer{pendingReview.length === 1 ? "" : "s"} pending
                    review.{" "}
                    <Link
                      to="/internal/inbox"
                      search={withInternalSiteSearch(
                        { category: "risk" as const, type: "exception" as const },
                        search.site,
                      )}
                      className="text-gold hover:underline"
                    >
                      Open Inbox
                    </Link>
                  </li>
                ) : null}
                {stalled.length > 0 ? (
                  <li>
                    {stalled.length} transfer{stalled.length === 1 ? "" : "s"} with execution failures.{" "}
                    <Link
                      to="/internal/bank/transfers"
                      search={withInternalSiteSearch({ status: "active" as const }, search.site)}
                      className="text-gold hover:underline"
                    >
                      Browse active transfers
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {TRANSFER_LIST_FILTERS.map((id) => (
              <OpsFilterChip
                key={id}
                to="/internal/bank/transfers"
                search={withInternalSiteSearch(
                  { status: id === "all" ? undefined : id, q: search.q },
                  search.site,
                )}
                pressed={filter === id}
              >
                {TRANSFER_LIST_FILTER_LABELS[id]}
              </OpsFilterChip>
            ))}
          </div>

          <OpsFilterBar
            onClear={
              filtersOn
                ? () =>
                    void navigate({
                      to: "/internal/bank/transfers",
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
                placeholder="Owner, account, label…"
                aria-label="Search transfers"
              />
            </OpsFilterField>
          </OpsFilterBar>

          {filtered.length === 0 ? (
            <p className="mt-6 text-[13px] text-muted-foreground">
              {filtersOn ? "No transfers match this filter." : "No transfers yet."}
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">From</th>
                      <th className="py-2 pr-3 font-medium">To</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Schedule / type</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Next / last</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const cta = transferReviewCta(row);
                      return (
                        <tr key={`desktop-${row.id}`} className="border-b border-border/60 align-top">
                          <td className="py-3 pr-3">
                            <div className="font-medium">{row.ownerLabel}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {row.sourceAccountNumber}
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <div>{row.destinationName}</div>
                            {row.destinationAccountNumber ? (
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {row.destinationAccountNumber}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 tabular-nums">{florin(row.amount)}</td>
                          <td className="py-3 pr-3 text-muted-foreground">
                            {plainTransferTypeTitle(row)}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge
                              status={plainTransferStatusLabel(row.status, row.statusLabel)}
                            />
                            {transferNeedsAttention(row) ? (
                              <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                                Needs action
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground">
                            {row.nextRunAt
                              ? `Next ${formatActivityDateTime(row.nextRunAt)}`
                              : row.lastRunAt
                                ? `Last ${formatActivityDateTime(row.lastRunAt)}`
                                : formatActivityDateTime(row.createdAt)}
                          </td>
                          <td className="py-3">
                            <Link
                              to="/internal/bank/transfers/$transferId"
                              params={{ transferId: row.id }}
                              search={recordSearch()}
                              className="text-[12px] font-medium text-gold hover:underline"
                            >
                              {cta}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {filtered.map((row) => {
                  const cta = transferReviewCta(row);
                  return (
                    <li key={`mobile-${row.id}`}>
                      <Link
                        to="/internal/bank/transfers/$transferId"
                        params={{ transferId: row.id }}
                        search={recordSearch()}
                        className={cn(
                          "block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                          transferNeedsAttention(row) ? "border-amber-500/40" : undefined,
                        )}
                        aria-label={`${cta} ${row.label}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium">
                              {row.ownerLabel} → {row.destinationName}
                            </div>
                            <div className="mt-0.5 text-[12px] text-muted-foreground">{row.label}</div>
                          </div>
                          <StatusBadge
                            status={plainTransferStatusLabel(row.status, row.statusLabel)}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                          <span className="tabular-nums font-medium">{florin(row.amount)}</span>
                          <span className="text-muted-foreground">{plainTransferTypeTitle(row)}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {row.nextRunAt
                              ? `Next ${formatActivityDateTime(row.nextRunAt)}`
                              : row.lastRunAt
                                ? `Last ${formatActivityDateTime(row.lastRunAt)}`
                                : null}
                          </span>
                        </div>
                        <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                          {cta}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p className="mt-8 text-[12px] text-muted-foreground">
            Batch execution runs on a schedule. Admins can trigger a manual run from{" "}
            <Link
              to="/internal/jobs"
              search={withInternalSiteSearch({}, search.site)}
              className="text-gold hover:underline"
            >
              System Jobs
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          {failedFunding.length > 0 ? (
            <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
                Needs attention
              </div>
              <p className="mt-2 text-[13px]">
                {failedFunding.length} failed Terminal funding transfer
                {failedFunding.length === 1 ? "" : "s"}.{" "}
                <Link
                  to="/internal/bank/transfers"
                  search={withInternalSiteSearch(
                    {
                      kind: "terminal-funding" as const,
                      fundingStatus: "FAILED" as const,
                    },
                    search.site,
                  )}
                  className="text-gold hover:underline"
                >
                  Review failed funding
                </Link>
              </p>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                [undefined, "All statuses"],
                ["COMPLETED", "Completed"],
                ["FAILED", "Failed"],
                ["PENDING", "Pending"],
              ] as const
            ).map(([id, label]) => (
              <OpsFilterChip
                key={label}
                to="/internal/bank/transfers"
                search={
                  withInternalSiteSearch(
                    {
                      kind: "terminal-funding",
                      fundingStatus: id,
                      fundingDirection: search.fundingDirection,
                      q: search.q,
                    },
                    search.site,
                  ) as TransfersSearch
                }
                pressed={(search.fundingStatus ?? undefined) === id}
              >
                {label}
              </OpsFilterChip>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                [undefined, "All directions"],
                ["BANK_TO_TERMINAL", "Bank → Terminal"],
                ["TERMINAL_TO_BANK", "Terminal → Bank"],
              ] as const
            ).map(([id, label]) => (
              <OpsFilterChip
                key={label}
                to="/internal/bank/transfers"
                search={
                  withInternalSiteSearch(
                    {
                      kind: "terminal-funding",
                      fundingDirection: id,
                      fundingStatus: search.fundingStatus,
                      q: search.q,
                    },
                    search.site,
                  ) as TransfersSearch
                }
                pressed={(search.fundingDirection ?? undefined) === id}
              >
                {label}
              </OpsFilterChip>
            ))}
          </div>

          <OpsFilterBar
            onClear={
              filtersOn
                ? () =>
                    void navigate({
                      to: "/internal/bank/transfers",
                      search: withInternalSiteSearch(
                        { kind: "terminal-funding" as const },
                        search.site,
                      ),
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
                placeholder="Reference, owner, portfolio…"
                aria-label="Search Terminal funding"
              />
            </OpsFilterField>
          </OpsFilterBar>

          {fundingFiltered.length === 0 ? (
            <p className="mt-6 text-[13px] text-muted-foreground">
              {filtersOn ? "No funding transfers match this filter." : "No Terminal funding transfers yet."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 pr-3 font-medium">Direction</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Bank</th>
                    <th className="py-2 pr-3 font-medium">Portfolio</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fundingFiltered.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-3 font-mono text-[12px]">{row.referenceCode}</td>
                      <td className="py-3 pr-3">
                        {row.direction === "BANK_TO_TERMINAL"
                          ? "Bank → Terminal"
                          : "Terminal → Bank"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{florin(row.amount)}</td>
                      <td className="py-3 pr-3">{row.bankAccountLabel}</td>
                      <td className="py-3 pr-3">{row.portfolioName}</td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3">
                        <Link
                          to="/internal/bank/transfers/funding/$transferId"
                          params={{ transferId: row.id }}
                          search={recordSearch()}
                          className="text-[12px] font-medium text-gold hover:underline"
                        >
                          {row.status === "FAILED" ? "Review" : "Open"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </InternalPageShell>
  );
}
