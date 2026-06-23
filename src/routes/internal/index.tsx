import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminActivityFeed } from "@/components/internal/admin-activity-feed";
import { StatusBadge } from "@/components/internal/status-badge";
import { Card } from "@/components/page-shell";
import {
  getOverviewMetrics,
  getRecentAdminActivity,
  getSystemStatus,
} from "@/lib/internal/api";

export const Route = createFileRoute("/internal/")({
  head: () => ({ meta: [{ title: "Internal Overview — Alta Group" }] }),
  component: InternalOverview,
});

function InternalOverview() {
  const m = getOverviewMetrics();
  const activity = getRecentAdminActivity();
  const systems = getSystemStatus();

  return (
    <InternalPageShell
      title="Operations Overview"
      description="Cross-division metrics and system status for Alta Group staff."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Total Users" value={m.totalUsers.toLocaleString()} />
        <InternalStatCard label="Registered Companies" value={String(m.registeredCompanies)} />
        <InternalStatCard label="Verified Institutions" value={String(m.verifiedInstitutions)} />
        <InternalStatCard label="Authorized Representatives" value={String(m.authorizedRepresentatives)} />
        <InternalStatCard label="Pending Company Reviews" value={String(m.pendingCompanyReviews)} alert />
        <InternalStatCard label="Active Bank Accounts" value={m.activeBankAccounts.toLocaleString()} />
        <InternalStatCard label="Pending IPO Applications" value={String(m.pendingIpoApplications)} alert />
        <InternalStatCard label="Pending API Applications" value={String(m.pendingApiApplications)} alert />
        <InternalStatCard label="Active API Keys" value={String(m.activeApiKeys)} />
        <InternalStatCard label="Listed Companies" value={String(m.listedCompanies)} />
        <InternalStatCard label="Open Compliance Flags" value={String(m.openComplianceFlags)} alert />
        <InternalStatCard label="Settlement Volume (24h)" value={m.settlementVolume} sub="Simulated T+0" />
      </div>

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
        <AdminActivityFeed items={activity} />
      </Section>
    </InternalPageShell>
  );
}
