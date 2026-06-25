import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { florin } from "@/lib/bank/api";
import { fetchInternalDashboardMetrics } from "@/lib/internal/internal-dashboard.functions";
import { fetchRecentAuditLogs } from "@/lib/internal/audit.functions";
import { fetchInternalAccessMetrics } from "@/lib/internal/user-management.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/")({
  loader: async () => {
    const [metrics, access, audit] = await Promise.all([
      fetchInternalDashboardMetrics(),
      fetchInternalAccessMetrics(),
      fetchRecentAuditLogs({ data: 20 }),
    ]);
    return { metrics, access, audit };
  },
  head: () => ({ meta: [{ title: "Operations Dashboard — Alta Internal" }] }),
  component: InternalOverview,
});

function InternalOverview() {
  const { metrics: m, access, audit } = Route.useLoaderData();

  const totalActionItems =
    m.pendingDeposits +
    m.pendingWithdrawals +
    m.pendingAccountOpenings +
    m.pendingLoanApplications +
    m.pendingCompanyVerifications +
    m.failedScheduledTransfers;

  return (
    <InternalPageShell
      title="Operations Dashboard"
      description="Live operational queues, platform vitals, and recent admin activity."
    >
      <Section title={`Action queues · ${totalActionItems} open`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <OpsQueueCard label="Pending deposits" count={m.pendingDeposits} to="/internal/bank/deposits" helper="Review incoming funds" cta="Deposits" />
          <OpsQueueCard label="Pending withdrawals" count={m.pendingWithdrawals} to="/internal/bank/withdrawals" helper="Approve or deny payouts" cta="Withdrawals" />
          <OpsQueueCard label="Account openings" count={m.pendingAccountOpenings} to="/internal/bank" helper="New account requests" cta="Bank ops" tone={m.pendingAccountOpenings > 0 ? "warn" : "neutral"} />
          <OpsQueueCard label="Loan applications" count={m.pendingLoanApplications} to="/internal/lending" helper="Credit facility queue" cta="Lending" />
          <OpsQueueCard label="Company verifications" count={m.pendingCompanyVerifications} to="/internal/companies" helper="KYB review" cta="Companies" tone={m.pendingCompanyVerifications > 0 ? "warn" : "neutral"} />
          <OpsQueueCard label="Failed transfers" count={m.failedScheduledTransfers} to="/internal/bank/transfers" helper="Scheduled transfer failures" cta="Transfers" tone={m.failedScheduledTransfers > 0 ? "alert" : "neutral"} />
          <OpsQueueCard label="Frozen accounts" count={m.frozenAccounts} to="/internal/bank/accounts" helper="Accounts in frozen status" cta="Accounts" />
          <OpsQueueCard label="Restricted users" count={m.restrictedUsers} to="/internal/users" helper="Users with restricted access" cta="Users" />
        </div>
      </Section>

      <Section title="Quick actions" className="mt-10">
        <div className="flex flex-wrap gap-2">
          <ActionLink to="/internal/users">Manage users</ActionLink>
          <ActionLink to="/internal/bank/accounts">Manage accounts</ActionLink>
          <ActionLink to="/internal/bank/interest">Manual interest</ActionLink>
          <ActionLink to="/internal/bank/statements">Statements</ActionLink>
          <ActionLink to="/internal/lending">Lending queue</ActionLink>
          <ActionLink to="/internal/audit">Audit log</ActionLink>
          <ActionLink to="/internal/compliance">Compliance</ActionLink>
          <ActionLink to="/internal/settings">Settings</ActionLink>
        </div>
      </Section>

      <Section title="Platform vitals" className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <VitalCard label="Users" value={m.totalUsers.toLocaleString()} />
          <VitalCard label="Companies" value={m.totalCompanies.toLocaleString()} sub={`${m.verifiedCompanies} verified`} />
          <VitalCard label="Bank accounts" value={m.totalBankAccounts.toLocaleString()} sub={`${m.activeBankAccounts} active`} />
          <VitalCard label="Balances held" value={florin(m.totalBalancesHeld)} sub="Active accounts" />
          <VitalCard label="Active loans" value={m.activeLoans.toLocaleString()} />
          <VitalCard label="Pending scheduled" value={m.pendingScheduledTransfers.toLocaleString()} />
          <VitalCard label="Frozen accounts" value={m.frozenAccounts.toLocaleString()} />
          <VitalCard label="Restricted users" value={m.restrictedUsers.toLocaleString()} />
        </div>
      </Section>

      <Section title="Access roster" className="mt-10">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
          <RosterCell label="Admins" value={access.admins} />
          <RosterCell label="Operators" value={access.operators} />
          <RosterCell label="Private clients" value={access.privateClients} />
          <RosterCell label="Developers" value={access.developers} />
          <RosterCell label="Issuers" value={access.issuers} />
          <RosterCell label="Restricted" value={access.restrictedUsers} tone="warn" />
          <RosterCell label="Frozen" value={access.frozenUsers} tone="alert" />
        </div>
      </Section>

      <Section title="Recent admin activity" className="mt-10">
        <InternalAuditTable rows={audit} />
      </Section>
    </InternalPageShell>
  );
}

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground hover:border-gold/40 hover:text-gold"
    >
      {children}
    </Link>
  );
}

function VitalCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="tabular mt-2 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

function RosterCell({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warn" | "alert" }) {
  const accent = tone === "alert" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-surface-1/60 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`tabular mt-1 text-lg font-semibold ${accent}`}>{value.toLocaleString()}</div>
    </div>
  );
}
