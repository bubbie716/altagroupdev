import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AccountActivityLink } from "@/components/internal/internal-audit-table";
import { fetchEnhancedDashboard } from "@/lib/internal/ops-platform.functions";
import { florin } from "@/lib/bank/api";
import { Link } from "@tanstack/react-router";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const Route = createFileRoute("/internal/")({
  loader: () => fetchEnhancedDashboard(),
  head: () => ({ meta: [{ title: "Operations Center — Alta Internal" }] }),
  component: InternalOperationsCenter,
});

function InternalOperationsCenter() {
  const { metrics: m, health, activity, negativeBalances, largeAdjustments, maintenance } =
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
      description="Queues, platform health, and live activity for Alta Bank operations."
      hideSearch
    >
      <InternalGlobalSearchInline />

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

      <Section title={`Operational queues · ${totalQueues} items`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <OpsQueueCard label="Pending deposits" count={m.pendingDeposits} to="/internal/bank/deposits" cta="Review" />
          <OpsQueueCard label="Pending withdrawals" count={m.pendingWithdrawals} to="/internal/bank/withdrawals" cta="Review" />
          <OpsQueueCard label="Loan applications" count={m.pendingLoanApplications} to="/internal/lending" cta="Lending" />
          <OpsQueueCard label="Company verifications" count={m.pendingCompanyVerifications} to="/internal/companies" cta="Companies" tone={m.pendingCompanyVerifications > 0 ? "warn" : "neutral"} />
          <OpsQueueCard label="Account openings" count={m.pendingAccountOpenings} to="/internal/bank" cta="Bank ops" />
          <OpsQueueCard label="Failed transfers" count={m.failedScheduledTransfers} to="/internal/bank/transfers" cta="Transfers" tone={m.failedScheduledTransfers > 0 ? "alert" : "neutral"} />
          <OpsQueueCard label="Negative balances" count={negativeBalances} to="/internal/exceptions" cta="Exceptions" tone={negativeBalances > 0 ? "alert" : "neutral"} />
          <OpsQueueCard label="Frozen accounts" count={m.frozenAccounts} to="/internal/bank/accounts?status=frozen" cta="Accounts" />
          <OpsQueueCard label="Restricted users" count={m.restrictedUsers} to="/internal/users?accountStatus=restricted" cta="Users" />
          <OpsQueueCard label="Large adjustments (30d)" count={largeAdjustments} to="/internal/reports" cta="Reports" tone={largeAdjustments > 0 ? "warn" : "neutral"} />
        </div>
      </Section>

      <Section title="Operational health" className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {health.map((h) => (
            <div key={h.key} className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{h.label}</span>
                <span className={`font-mono text-[10px] uppercase ${h.status === "operational" ? "text-emerald-400" : h.status === "degraded" ? "text-amber-300" : "text-muted-foreground"}`}>
                  {h.status}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">{h.detail}</p>
              {h.lastSuccessAt ? (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                  Last success {h.lastSuccessAt.slice(0, 19).replace("T", " ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Platform vitals" className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InternalStatCard label="Users" value={m.totalUsers.toLocaleString()} />
          <InternalStatCard label="Active accounts" value={m.activeBankAccounts.toLocaleString()} />
          <InternalStatCard label="Balances held" value={florin(m.totalBalancesHeld)} />
          <InternalStatCard label="Active loans" value={m.activeLoans.toLocaleString()} />
        </div>
      </Section>

      <Section title="Activity feed" className="mt-10">
        <ActivityFeedTable items={activity} />
        <div className="mt-4 flex flex-wrap gap-2">
          <QuickLink to="/internal/bank/transactions">Transaction explorer</QuickLink>
          <QuickLink to="/internal/bank/alta-pay">Alta Pay ops</QuickLink>
          <QuickLink to="/internal/exceptions">Exception center</QuickLink>
          <QuickLink to="/internal/reports">Reports</QuickLink>
        </div>
      </Section>
    </InternalPageShell>
  );
}

import { InternalGlobalSearch } from "@/components/internal/internal-global-search";

function InternalGlobalSearchInline() {
  return (
    <div className="mb-8">
      <InternalGlobalSearch />
    </div>
  );
}

function ActivityFeedTable({
  items,
}: {
  items: Awaited<ReturnType<typeof fetchEnhancedDashboard>>["activity"];
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No recent activity.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Actor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                {a.createdAt.slice(0, 19).replace("T", " ")}
              </td>
              <td className="px-4 py-3 font-mono text-[10px] uppercase">{a.category}</td>
              <td className="px-4 py-3 text-[13px]">
                <AccountActivityLink
                  accountId={a.accountId}
                  label={a.accountLabel}
                />
              </td>
              <td className="px-4 py-3">
                {a.href ? (
                  <Link to={a.href} className="hover:text-gold">
                    {a.title}
                  </Link>
                ) : (
                  a.title
                )}
                <div className="text-[12px] text-muted-foreground">{a.detail}</div>
              </td>
              <td className="px-4 py-3 font-mono text-[11px]">{a.actorLabel ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuickLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-gold/40 hover:text-gold"
    >
      {children}
    </Link>
  );
}
