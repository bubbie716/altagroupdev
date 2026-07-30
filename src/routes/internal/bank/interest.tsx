import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { InternalManualInterestOps } from "@/components/bank/internal-manual-interest-ops";
import { InternalScheduledManualInterestPanel } from "@/components/bank/internal-scheduled-manual-interest-panel";
import { InternalAccountInterestOps } from "@/components/bank/internal-account-interest-ops";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fetchAccountInterestOps } from "@/lib/bank/account-interest.functions";
import { fetchScheduledManualInterestApplications } from "@/lib/bank/manual-interest.functions";
import type { AccountInterestOpsSummary } from "@/lib/bank/account-interest.functions";
import type { ScheduledManualInterestRow } from "@/lib/bank/manual-interest.functions";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/internal/bank/interest")({
  loader: async () => {
    const [interestOpsResult, scheduledManualInterest] = await Promise.all([
      fetchAccountInterestOps().catch(
        (): AccountInterestOpsSummary => ({
          dueAccountCount: 0,
          interestBearingActiveCount: 0,
          estimatedTotalInterestDue: 0,
          lastInterestRunAt: null,
          totalInterestCreditedThisMonth: 0,
          dueAccounts: [],
        }),
      ),
      fetchScheduledManualInterestApplications().catch((): ScheduledManualInterestRow[] => []),
    ]);
    return { interestOps: interestOpsResult, scheduledManualInterest };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Interest", (match.search as { site?: string }).site ?? "bank") }] }),
  component: InternalInterestPage,
});

function InternalInterestPage() {
  const { interestOps, scheduledManualInterest } = Route.useLoaderData() as {
    interestOps: AccountInterestOpsSummary;
    scheduledManualInterest: ScheduledManualInterestRow[];
  };
  const site = useRouterState({
    select: (s) => readDevSiteFromSearch(s.location.search as Record<string, unknown>),
  });
  const due = interestOps.dueAccounts;
  const nextDue = due
    .map((a: AccountInterestOpsSummary["dueAccounts"][number]) => a.nextInterestAccrualAt)
    .filter(Boolean)
    .sort()[0];
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <InternalPageShell
      title="Interest"
      breadcrumbs={buildBreadcrumbs([
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, site) },
        { label: "Money", to: "/internal/bank/accounts", search: withInternalSiteSearch({}, site) },
        { label: "Interest" },
      ])}
      actions={
        <button
          type="button"
          onClick={() => setActionsOpen(true)}
          className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-medium text-gold"
        >
          Interest actions
        </button>
      }
    >
      <OpsSection title="Status">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Last successful run"
            value={
              interestOps.lastInterestRunAt
                ? formatActivityDateTime(interestOps.lastInterestRunAt)
                : "No recent run"
            }
          />
          <Stat
            label="Next due"
            value={nextDue ? formatActivityDateTime(nextDue) : "—"}
          />
          <Stat label="Due accounts" value={String(interestOps.dueAccountCount)} />
          <Stat
            label="Estimated due"
            value={florin(interestOps.estimatedTotalInterestDue)}
          />
        </dl>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Credited this month: {florin(interestOps.totalInterestCreditedThisMonth)} ·{" "}
          <Link
            to="/internal/jobs"
            search={withInternalSiteSearch({}, site)}
            className="text-gold hover:underline"
          >
            System Jobs
          </Link>
        </p>
      </OpsSection>

      <OpsSection title="Accounts requiring attention" className="mt-8">
        {due.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-3 text-[13px] text-muted-foreground">
            No accounts currently need interest attention
          </p>
        ) : (
          <ul className="space-y-2">
            {due.map((account) => (
              <li
                key={account.accountId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-3 py-2"
              >
                <div>
                  <div className="font-medium text-[13px]">{account.accountNumber}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {account.holder}
                    <span className="text-muted-foreground/60"> · </span>
                    Due for accrual
                    <span className="text-muted-foreground/60"> · </span>
                    est. {florin(account.estimatedInterest)}
                  </div>
                </div>
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: account.accountId }}
                  search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, site)}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
                >
                  Review account
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-left text-[15px]">Interest actions</SheetTitle>
            <SheetDescription className="text-left text-[12px]">
              Preview accrual, authorized apply, and manual category credits.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <div>
              <h3 className="mb-2 text-[13px] font-medium">Deposit account accrual</h3>
              <InternalAccountInterestOps summary={interestOps} mode="actions" />
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-medium">Manual category credits</h3>
              <InternalManualInterestOps />
              <div className="mt-6">
                <h4 className="mb-2 text-[12px] font-medium">Scheduled manual batches</h4>
                <InternalScheduledManualInterestPanel initialRows={scheduledManualInterest} />
              </div>
            </div>
            <details className="rounded border border-border/60 px-3 py-2">
              <summary className="cursor-pointer text-[13px] font-medium">Configuration details</summary>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Interest-bearing active accounts: {interestOps.interestBearingActiveCount}. Rates are
                configured on eligible deposit products — this page does not invent new rates.
                Automated posting runs with platform servicing (deposit interest).
              </p>
            </details>
          </div>
        </SheetContent>
      </Sheet>
    </InternalPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
