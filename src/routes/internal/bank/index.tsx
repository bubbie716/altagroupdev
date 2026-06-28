import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { fetchInternalBankOpsSummary } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/internal/bank/")({
  loader: () => fetchInternalBankOpsSummary(),
  head: () => ({ meta: [{ title: "Bank Ops — Alta Internal" }] }),
  component: InternalBank,
});

function InternalBank() {
  const { summary } = Route.useLoaderData();

  return (
    <InternalPageShell title="Bank Operations">
      <div className="mb-4 flex flex-wrap gap-2">
        <NavPill to="/internal/bank/accounts">Accounts</NavPill>
        <NavPill to="/internal/bank/transactions">Transactions</NavPill>
        <NavPill to="/internal/bank/transfers">Transfers</NavPill>
        <NavPill to="/internal/bank/statements">Statements</NavPill>
        <NavPill to="/internal/bank/scheduled">Scheduled</NavPill>
        <NavPill to="/internal/bank/interest">Interest</NavPill>
      </div>

      <OpsSection title="Operational queues">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpsQueueCard
            label="Deposits pending"
            count={summary.pendingDeposits}
            to="/internal/queues/deposits"
            cta="Open queue"
            tone={summary.pendingDeposits > 0 ? "alert" : "neutral"}
          />
          <OpsQueueCard
            label="Withdrawals pending"
            count={summary.pendingWithdrawals}
            to="/internal/queues/withdrawals"
            cta="Open queue"
            tone={summary.pendingWithdrawals > 0 ? "alert" : "neutral"}
          />
          <OpsQueueCard
            label="Account openings"
            count={summary.pendingAccountOpenings}
            to="/internal/queues/account-openings"
            cta="Open queue"
            tone={summary.pendingAccountOpenings > 0 ? "warn" : "neutral"}
          />
        </div>
      </OpsSection>

      <OpsSection title="Platform snapshot" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total accounts" value={summary.totalAccounts.toLocaleString()} />
          <Metric label="Frozen accounts" value={String(summary.frozenAccounts)} />
          <Metric
            label="Alta Pay (MTD)"
            value={summary.altaPayCountThisMonth.toLocaleString()}
            sub={`ƒ${summary.altaPayVolumeThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <Metric label="Lending queue" value={String(summary.lendingQueue)} />
        </div>
      </OpsSection>

      <OpsSection title="Interest" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            Manual category credits, scheduled interest, and monthly deposit accrual.
          </p>
          <Link to="/internal/bank/interest" className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
            Interest ops →
          </Link>
        </div>
      </OpsSection>

      <OpsSection title="Scheduled transfers & jobs" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            Scheduled transfer execution and statement generation run via system jobs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/internal/bank/scheduled" className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
              View scheduled →
            </Link>
            <Link to="/internal/jobs" className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
              System jobs →
            </Link>
          </div>
        </div>
      </OpsSection>

      <OpsSection title="Statements" className="mt-6">
        <p className="text-[12px] text-muted-foreground">
          Monthly statement batch runs are managed on the{" "}
          <Link to="/internal/jobs" className="text-gold hover:underline">
            system jobs
          </Link>{" "}
          page.{" "}
          <Link to="/internal/bank/statements" className="text-gold hover:underline">
            Statement explorer →
          </Link>
        </p>
      </OpsSection>
    </InternalPageShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-border/80 bg-surface-1/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function NavPill({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded border border-border bg-surface-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-gold/40 hover:text-gold"
    >
      {children}
    </Link>
  );
}
