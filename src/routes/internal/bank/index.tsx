"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection, OpsEmptyState, buildBreadcrumbs } from "@/components/internal/console";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { fetchInternalBankOpsSummary } from "@/lib/bank/bank.functions";
import { useSiteContext } from "@/hooks/use-site-context";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import {
  homeAttentionTotal,
  rankHomeAttention,
  type HomeAttentionItem,
} from "@/lib/internal/home-attention";
import { florin } from "@/lib/bank/api";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/")({
  loader: () => fetchInternalBankOpsSummary(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Home", (match.search as { site?: string }).site ?? "bank") }] }),
  component: InternalBank,
});

function InternalBank() {
  const summary = Route.useLoaderData();
  const site = useSiteContext();

  const attention = rankHomeAttention([
    {
      id: "deposits",
      label: "Pending deposits",
      count: summary.pendingDeposits,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "money" as const, type: "deposit" as const },
        site.key,
      ),
      urgency: 90,
      tone: "alert",
    },
    {
      id: "withdrawals",
      label: "Pending withdrawals",
      count: summary.pendingWithdrawals,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "money" as const, type: "withdrawal" as const },
        site.key,
      ),
      urgency: 95,
      tone: "alert",
    },
    {
      id: "openings",
      label: "Account openings",
      count: summary.pendingAccountOpenings,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "account_opening" as const }, site.key),
      urgency: 65,
      tone: "warn",
    },
    {
      id: "lending",
      label: "Lending applications",
      count: summary.lendingQueue,
      to: "/internal/inbox",
      search: withInternalSiteSearch({ category: "lending" as const }, site.key),
      urgency: 70,
      tone: "warn",
    },
    {
      id: "transfers-review",
      label: "Transfers requiring review",
      count: summary.transfersInReview,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "risk" as const, type: "exception" as const },
        site.key,
      ),
      urgency: 80,
      tone: "alert",
    },
    {
      id: "failed-transfers",
      label: "Failed transfers",
      count: summary.failedTransfers,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "risk" as const, type: "exception" as const },
        site.key,
      ),
      urgency: 88,
      tone: "alert",
    },
    {
      id: "card-apps",
      label: "Alta Card applications",
      count: summary.pendingCardApplications,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "cards" as const, type: "alta_card_application" as const },
        site.key,
      ),
      urgency: 55,
      tone: "warn",
    },
    {
      id: "card-reviews",
      label: "Alta Card reviews",
      count: summary.pendingCardReviews,
      to: "/internal/inbox",
      search: withInternalSiteSearch(
        { category: "cards" as const, type: "alta_card_review" as const },
        site.key,
      ),
      urgency: 58,
      tone: "warn",
    },
  ] satisfies HomeAttentionItem[]);

  const attentionTotal = homeAttentionTotal(attention);
  const showFrozen = summary.frozenAccounts > 0;

  return (
    <InternalPageShell title="Home" breadcrumbs={buildBreadcrumbs([{ label: "Home" }])}>
      <OpsSection title="Work requiring attention">
        {attention.length === 0 ? (
          <OpsEmptyState
            title="No open Bank work"
            description="Pending deposits, withdrawals, openings, and lending cases will appear here."
          />
        ) : (
          <>
            <p className="mb-2 text-[12px] text-muted-foreground">
              {attentionTotal} item{attentionTotal === 1 ? "" : "s"} need attention
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {attention.map((item) => (
                <OpsQueueCard
                  key={item.id}
                  label={item.label}
                  count={item.count}
                  to={item.to}
                  search={item.search}
                  tone={item.tone}
                  cta="Open"
                />
              ))}
            </div>
          </>
        )}
      </OpsSection>

      <OpsSection title="Banking snapshot" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Active accounts" value={summary.totalAccounts.toLocaleString()} />
          {showFrozen ? (
            <Metric label="Frozen accounts" value={String(summary.frozenAccounts)} />
          ) : null}
          <Metric
            label="Alta Pay (this month)"
            value={summary.altaPayCountThisMonth.toLocaleString()}
            sub={florin(summary.altaPayVolumeThisMonth)}
          />
        </div>
      </OpsSection>

      <OpsSection title="System status" className="mt-6">
        <p className="text-[13px] text-muted-foreground">
          Routine Bank jobs are healthy unless Jobs or Statements show a failure.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
          <Link
            to="/internal/jobs"
            search={withInternalSiteSearch({}, site.key)}
            className="text-gold hover:underline"
          >
            Jobs
          </Link>
          <Link
            to="/internal/bank/scheduled"
            search={withInternalSiteSearch({}, site.key)}
            className="text-gold hover:underline"
          >
            Scheduled transfers
          </Link>
          <Link
            to="/internal/bank/statements"
            search={withInternalSiteSearch({}, site.key)}
            className="text-gold hover:underline"
          >
            Statements
          </Link>
        </div>
      </OpsSection>
    </InternalPageShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-border/70 bg-surface-1/40 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
