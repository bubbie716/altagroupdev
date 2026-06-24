import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminActivityFeed } from "@/components/internal/admin-activity-feed";
import { StatusBadge } from "@/components/internal/status-badge";
import { Card } from "@/components/page-shell";
import { LiveMetricCard } from "@/components/metrics/live-metric-card";
import { florin } from "@/lib/bank/api";
import { fetchPlatformMetrics } from "@/lib/metrics/platform-metrics.functions";
import { fetchInternalAccessMetrics } from "@/lib/internal/user-management.functions";
import { LIVE_PLATFORM_SOURCE } from "@/lib/metrics/platform-metrics";
import { getRecentAdminActivity, getSystemStatus } from "@/lib/internal/api";
import { internalPreviewNotice } from "@/lib/internal/data";

export const Route = createFileRoute("/internal/")({
  loader: async () => {
    const [platform, access] = await Promise.all([
      fetchPlatformMetrics(),
      fetchInternalAccessMetrics(),
    ]);
    return { platform, access };
  },
  head: () => ({ meta: [{ title: "Internal Overview — Alta Group" }] }),
  component: InternalOverview,
});

function InternalOverview() {
  const { platform: m, access } = Route.useLoaderData();
  const activity = getRecentAdminActivity();
  const systems = getSystemStatus();

  return (
    <InternalPageShell
      title="Operations Overview"
      description="Live platform records and labeled preview modules for Alta Group staff."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <LiveMetricCard
          label="Total Users"
          value={m.totalUsers.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Registered Companies"
          value={m.totalCompanies.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Verified Companies"
          value={m.verifiedCompanies.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Authorized Representatives"
          value={m.authorizedRepresentatives.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Pending Company Verifications"
          value={m.pendingCompanyVerifications.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Active Bank Accounts"
          value={m.activeBankAccounts.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Pending Deposits"
          value={m.pendingDepositRequests.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Pending Withdrawals"
          value={m.pendingWithdrawalRequests.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Frozen Bank Accounts"
          value={m.frozenBankAccounts.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Deposits Held"
          value={florin(m.totalBankDeposits)}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Business Operating Accounts"
          value={m.totalBusinessAccounts.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
        <LiveMetricCard
          label="Personal Accounts"
          value={m.totalPersonalAccounts.toLocaleString()}
          sourceLabel={LIVE_PLATFORM_SOURCE}
        />
      </div>

      <Section title="Access & identity" className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <LiveMetricCard label="Admins" value={access.admins.toLocaleString()} sourceLabel="UserTagAssignment" />
          <LiveMetricCard label="Operators" value={access.operators.toLocaleString()} sourceLabel="UserTagAssignment" />
          <LiveMetricCard
            label="Private Clients"
            value={access.privateClients.toLocaleString()}
            sourceLabel="UserTagAssignment"
          />
          <LiveMetricCard
            label="Developers"
            value={access.developers.toLocaleString()}
            sourceLabel="UserTagAssignment"
          />
          <LiveMetricCard label="Issuers" value={access.issuers.toLocaleString()} sourceLabel="UserTagAssignment" />
          <LiveMetricCard
            label="Restricted Users"
            value={access.restrictedUsers.toLocaleString()}
            sourceLabel="User.accountStatus"
          />
          <LiveMetricCard
            label="Frozen Users"
            value={access.frozenUsers.toLocaleString()}
            sourceLabel="User.accountStatus"
          />
        </div>
      </Section>

      <Section title="Preview modules" className="mt-10">
        <p className="mb-4 text-[13px] text-muted-foreground">{internalPreviewNotice}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <InternalStatCard label="Pending IPO Applications" value="—" sub="Preview" />
          <InternalStatCard label="Listed Companies (Exchange)" value="—" sub="Simulated market" />
          <InternalStatCard label="Open Compliance Flags" value="—" sub="Preview" />
          <InternalStatCard label="Pending API Applications" value="—" sub="Preview" />
          <InternalStatCard label="Active API Keys" value="—" sub="Preview" />
          <InternalStatCard label="Settlement Volume (24h)" value="—" sub="Planned · NCC" />
        </div>
      </Section>

      <Section title="System Status" className="mt-10">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {systems.map((s) => (
            <Card key={s.service} className="!p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{s.service}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">{s.detail}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Recent Admin Activity" className="mt-10">
        <p className="mb-4 text-[13px] text-muted-foreground">{internalPreviewNotice}</p>
        <AdminActivityFeed items={activity} />
      </Section>
    </InternalPageShell>
  );
}
