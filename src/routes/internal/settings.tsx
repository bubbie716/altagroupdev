import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { fetchInternalDashboardMetrics } from "@/lib/internal/internal-dashboard.functions";
import { getInternalSettings } from "@/lib/internal/api";

export const Route = createFileRoute("/internal/settings")({
  loader: () => fetchInternalDashboardMetrics(),
  head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const live = Route.useLoaderData();
  const flags = getInternalSettings().featureFlags;

  return (
    <InternalPageShell title="Internal Settings" description="Platform operations status and feature flag placeholders.">
      <Section title="Operations status (live)">
        <Card className="grid gap-4 md:grid-cols-2 !p-5">
          <StatusRow label="Banking" detail={`${live.activeBankAccounts} active accounts · ${live.pendingDeposits} pending deposits`} status="Operational" />
          <StatusRow label="Scheduled transfers" detail={`${live.pendingScheduledTransfers} pending · ${live.failedScheduledTransfers} failed`} status={live.failedScheduledTransfers > 0 ? "Degraded" : "Operational"} />
          <StatusRow label="Lending" detail={`${live.activeLoans} active loans · ${live.pendingLoanApplications} applications pending`} status="Operational" />
          <StatusRow label="Identity" detail={`${live.restrictedUsers} restricted · ${live.frozenAccounts} frozen accounts`} status={live.frozenAccounts > 0 ? "Review" : "Operational"} />
        </Card>
      </Section>

      <Section title="Maintenance & feature flags" className="mt-10">
        <Card className="!p-5 text-[13px] text-muted-foreground">
          Maintenance mode and remote feature flags are not yet wired to a configuration backend. Values below are
          preview placeholders only.
        </Card>
        <Card className="mt-4 !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.key} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">{f.label}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{f.key}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.enabled ? "Active" : "Suspended"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </InternalPageShell>
  );
}

function StatusRow({ label, detail, status }: { label: string; detail: string; status: string }) {
  return (
    <div className="rounded-md border border-border/60 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <StatusBadge status={status} />
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">{detail}</p>
    </div>
  );
}
