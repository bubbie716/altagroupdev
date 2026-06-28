import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console/ops-table";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { cn } from "@/lib/utils";
import { AccountActivityLink } from "@/components/internal/internal-audit-table";
import { fetchEnhancedDashboard } from "@/lib/internal/ops-platform.functions";
import { florin } from "@/lib/bank/api";
import { Link } from "@tanstack/react-router";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { buildBreadcrumbs } from "@/components/internal/console";

export const Route = createFileRoute("/internal/")({
  loader: () => fetchEnhancedDashboard(),
  head: () => ({ meta: [{ title: "Operations Center — Alta Internal" }] }),
  component: InternalOperationsCenter,
});

function InternalOperationsCenter() {
  const { metrics: m, health, activity, negativeBalances, largeAdjustments, maintenance, queueAging } =
    Route.useLoaderData();

  const totalQueues =
    m.pendingDeposits +
    m.pendingWithdrawals +
    m.pendingAccountOpenings +
    m.pendingLoanApplications +
    m.pendingCompanyVerifications +
    m.failedScheduledTransfers +
    negativeBalances;

  return (
    <InternalPageShell
      title="Operations Center"
      breadcrumbs={buildBreadcrumbs([{ label: "Dashboard" }])}
    >

      {maintenance.enabled ? (
        <div className="mb-8 rounded-lg border border-amber-400/40 bg-amber-400/10 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">
                Maintenance mode active
              </div>
              <p className="mt-2 text-[14px] text-foreground">
                Public platform pages are offline for normal users.
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {maintenance.startedAt
                  ? `Started ${formatActivityDateTime(maintenance.startedAt)}`
                  : "Start time unavailable"}
                {maintenance.updatedByUsername ? ` · Updated by ${maintenance.updatedByUsername}` : ""}
              </p>
            </div>
            <Link
              to="/internal/settings"
              className="rounded border border-amber-300/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-400/10"
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}

      <OpsSection title={`Operational queues · ${totalQueues} items`}>
        {(queueAging.olderThan24Hours > 0 || queueAging.olderThan72Hours > 0) ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px]">
            {queueAging.olderThan24Hours > 0 ? (
              <span className="font-mono text-amber-300">
                {queueAging.olderThan24Hours} item{queueAging.olderThan24Hours === 1 ? "" : "s"} &gt; 24h
              </span>
            ) : null}
            {queueAging.olderThan72Hours > 0 ? (
              <span className="font-mono text-rose-300">
                {queueAging.olderThan72Hours} item{queueAging.olderThan72Hours === 1 ? "" : "s"} &gt; 72h
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          <OpsQueueCard label="Pending deposits" count={m.pendingDeposits} to="/internal/queues/deposits" cta="Review" />
          <OpsQueueCard label="Pending withdrawals" count={m.pendingWithdrawals} to="/internal/queues/withdrawals" cta="Review" />
          <OpsQueueCard label="Loan applications" count={m.pendingLoanApplications} to="/internal/queues/lending-applications" cta="Review" />
          <OpsQueueCard label="Company verifications" count={m.pendingCompanyVerifications} to="/internal/queues/company-verifications" cta="Review" tone={m.pendingCompanyVerifications > 0 ? "warn" : "neutral"} />
          <OpsQueueCard label="Account openings" count={m.pendingAccountOpenings} to="/internal/queues/account-openings" cta="Review" />
          <OpsQueueCard label="Failed transfers" count={m.failedScheduledTransfers} to="/internal/bank/transfers" cta="Transfers" tone={m.failedScheduledTransfers > 0 ? "alert" : "neutral"} />
          <OpsQueueCard label="Negative balances" count={negativeBalances} to="/internal/queues/exceptions" cta="Exceptions" tone={negativeBalances > 0 ? "alert" : "neutral"} />
          <OpsQueueCard label="Frozen accounts" count={m.frozenAccounts} to="/internal/bank/accounts?status=frozen" cta="Accounts" />
          <OpsQueueCard label="Restricted users" count={m.restrictedUsers} to="/internal/users?accountStatus=restricted" cta="Users" />
          <OpsQueueCard label="Large adjustments (30d)" count={largeAdjustments} to="/internal/reports" cta="Reports" tone={largeAdjustments > 0 ? "warn" : "neutral"} />
        </div>
      </OpsSection>

      <OpsSection title="Operational health" className="mt-6" action={<QuickLink to="/internal/jobs">All jobs</QuickLink>}>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {health.map((h) => (
            <div key={h.key} className="rounded border border-border bg-surface-1/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-foreground">{h.label}</span>
                <span className={cn(
                  "inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em]",
                  h.status === "operational" ? "text-emerald-400" : h.status === "degraded" ? "text-amber-300" : "text-muted-foreground"
                )}>
                  <span className={cn(
                    "size-1.5 rounded-full",
                    h.status === "operational" ? "bg-emerald-500" : h.status === "degraded" ? "bg-amber-500" : "bg-muted-foreground/50"
                  )} aria-hidden />
                  {h.status}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{h.detail}</p>
              {h.lastSuccessAt ? (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                  {h.lastSuccessAt.slice(0, 19).replace("T", " ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </OpsSection>

      <OpsSection title="Platform vitals" className="mt-6">
        <div className="grid grid-cols-2 divide-x divide-border rounded border border-border bg-surface-1/40 lg:grid-cols-4">
          {[
            { label: "Users", value: m.totalUsers.toLocaleString() },
            { label: "Active accounts", value: m.activeBankAccounts.toLocaleString() },
            { label: "Balances held", value: florin(m.totalBalancesHeld) },
            { label: "Active loans", value: m.activeLoans.toLocaleString() },
          ].map((v) => (
            <div key={v.label} className="px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{v.label}</div>
              <div className="tabular mt-1 text-[15px] font-semibold">{v.value}</div>
            </div>
          ))}
        </div>
      </OpsSection>

      <OpsSection
        title="Recent operational events"
        className="mt-6"
        action={<QuickLink to="/internal/audit">Audit log</QuickLink>}
      >
        <ActivityFeedTable items={activity} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <QuickLink to="/internal/bank/transactions">Transaction explorer</QuickLink>
          <QuickLink to="/internal/bank/alta-pay">Alta Pay ops</QuickLink>
          <QuickLink to="/internal/queues/exceptions">Exception center</QuickLink>
          <QuickLink to="/internal/reports">Reports</QuickLink>
        </div>
      </OpsSection>
    </InternalPageShell>
  );
}

function ActivityFeedTable({
  items,
}: {
  items: Awaited<ReturnType<typeof fetchEnhancedDashboard>>["activity"];
}) {
  type ActivityRow = (typeof items)[number];
  const columns: OpsTableColumn<ActivityRow>[] = [
    {
      key: "time",
      header: "Time",
      cell: (a) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {a.createdAt.slice(0, 19).replace("T", " ")}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (a) => <span className="font-mono text-[10px] uppercase">{a.category}</span>,
    },
    {
      key: "account",
      header: "Account",
      cell: (a) => <AccountActivityLink accountId={a.accountId} label={a.accountLabel} />,
    },
    {
      key: "event",
      header: "Event",
      cell: (a) => (
        <>
          {a.href ? (
            <Link to={a.href} className="hover:text-gold">
              {a.title}
            </Link>
          ) : (
            a.title
          )}
          <div className="text-[12px] text-muted-foreground">{a.detail}</div>
        </>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      cell: (a) => <span className="font-mono text-[11px]">{a.actorLabel ?? "—"}</span>,
    },
  ];

  return (
    <OpsTable
      columns={columns}
      rows={items}
      rowKey={(a) => a.id}
      emptyState="No recent activity."
    />
  );
}

function QuickLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-border-strong hover:text-foreground"
    >
      {children}
    </Link>
  );
}
