import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminActivityFeed } from "@/components/internal/admin-activity-feed";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { florin } from "@/lib/bank/api";
import { fetchPlatformMetrics } from "@/lib/metrics/platform-metrics.functions";
import { fetchInternalAccessMetrics } from "@/lib/internal/user-management.functions";
import { fetchInternalBankOps } from "@/lib/bank/bank.functions";
import { fetchInternalScheduledTransfers } from "@/lib/bank/scheduled-transfer-admin.functions";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import { getRecentAdminActivity, getSystemStatus } from "@/lib/internal/api";
import { internalPreviewNotice } from "@/lib/internal/data";

export const Route = createFileRoute("/internal/")({
  loader: async () => {
    const [platform, access, bankOps, scheduled] = await Promise.all([
      fetchPlatformMetrics(),
      fetchInternalAccessMetrics(),
      fetchInternalBankOps(),
      fetchInternalScheduledTransfers().catch(() => []),
    ]);
    return { platform, access, bankOps, scheduled };
  },
  head: () => ({ meta: [{ title: "Operations Dashboard — Alta Internal" }] }),
  component: InternalOverview,
});

function InternalOverview() {
  const { platform: m, access, bankOps, scheduled } = Route.useLoaderData();
  const activity = getRecentAdminActivity();
  const systems = getSystemStatus();

  const todayIso = new Date().toISOString().slice(0, 10);
  const scheduledDueToday = (scheduled as InternalScheduledTransferRow[]).filter(
    (s) => s.status === "APPROVED" && !!s.nextRunAt && s.nextRunAt.slice(0, 10) <= todayIso,
  ).length;

  const totalActionItems =
    bankOps.summary.pendingDeposits +
    bankOps.summary.pendingWithdrawals +
    bankOps.summary.pendingAccountOpenings +
    bankOps.summary.lendingQueue +
    m.pendingCompanyVerifications +
    scheduledDueToday;

  return (
    <InternalPageShell
      title="Operations Dashboard"
      description="Pending action queues, live platform vitals, and recent operator activity."
    >
      <Section
        title={`Action queues · ${totalActionItems} open`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <OpsQueueCard
            label="Pending deposits"
            count={bankOps.summary.pendingDeposits}
            to="/internal/bank"
            helper="Review and approve incoming funds"
            cta="Bank ops"
          />
          <OpsQueueCard
            label="Pending withdrawals"
            count={bankOps.summary.pendingWithdrawals}
            to="/internal/bank"
            helper="Approve or deny withdrawal requests"
            cta="Bank ops"
          />
          <OpsQueueCard
            label="Account openings"
            count={bankOps.summary.pendingAccountOpenings}
            to="/internal/bank"
            helper="New Alta Bank account requests"
            cta="Bank ops"
            tone={bankOps.summary.pendingAccountOpenings > 0 ? "warn" : "neutral"}
          />
          <OpsQueueCard
            label="Loan applications"
            count={bankOps.summary.lendingQueue}
            to="/internal/lending"
            helper="Credit facility review queue"
            cta="Lending queue"
          />
          <OpsQueueCard
            label="Company verifications"
            count={m.pendingCompanyVerifications}
            to="/internal/companies"
            helper="KYB review for registered entities"
            cta="Companies"
            tone={m.pendingCompanyVerifications > 0 ? "warn" : "neutral"}
          />
          <OpsQueueCard
            label="Scheduled transfers due"
            count={scheduledDueToday}
            to="/internal/bank/scheduled"
            helper="Approved transfers ready to execute"
            cta="Scheduled"
            tone={scheduledDueToday > 0 ? "info" : "neutral"}
          />
        </div>
      </Section>

      <Section title="Platform vitals" className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <VitalCard label="Users" value={m.totalUsers.toLocaleString()} />
          <VitalCard
            label="Companies"
            value={m.totalCompanies.toLocaleString()}
            sub={`${m.verifiedCompanies.toLocaleString()} verified`}
          />
          <VitalCard
            label="Bank accounts"
            value={m.activeBankAccounts.toLocaleString()}
            sub={`${m.frozenBankAccounts} frozen · ${m.totalBusinessAccounts} business`}
          />
          <VitalCard label="Deposits held" value={florin(m.totalBankDeposits)} sub="System-wide" />
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

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Recent operator activity">
          <p className="mb-3 text-[12px] text-muted-foreground">{internalPreviewNotice}</p>
          <AdminActivityFeed items={activity} />
        </Section>
        <Section title="System status">
          <div className="grid gap-2">
            {systems.map((s) => (
              <Card key={s.service} className="!p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                    {s.service}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1.5 text-[12px] text-muted-foreground">{s.detail}</p>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </InternalPageShell>
  );
}

function VitalCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="tabular mt-2 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

function RosterCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "alert";
}) {
  const accent =
    tone === "alert"
      ? "text-rose-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-surface-1/60 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`tabular mt-1 text-lg font-semibold ${accent}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
