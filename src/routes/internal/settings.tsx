import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { MaintenanceModePanel } from "@/components/internal/maintenance-mode-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import { fetchInternalDashboardMetrics } from "@/lib/internal/internal-dashboard.functions";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";

export const Route = createFileRoute("/internal/settings")({
  loader: async () => {
    const [live, maintenance] = await Promise.all([
      fetchInternalDashboardMetrics(),
      fetchMaintenanceModeSettings(),
    ]);
    return { live, maintenance };
  },
  head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const { live, maintenance } = Route.useLoaderData();

  return (
    <InternalPageShell title="Internal Settings" description="Platform maintenance and live operations status.">
      <AdminOnly>
        <Section title="Maintenance mode">
          <MaintenanceModePanel initial={maintenance} />
        </Section>
      </AdminOnly>

      <Section title="Operations status (live)" className="mt-10">
        <Card className="grid gap-4 md:grid-cols-2 !p-5">
          <StatusRow label="Banking" detail={`${live.activeBankAccounts} active accounts · ${live.pendingDeposits} pending deposits`} />
          <StatusRow label="Scheduled transfers" detail={`${live.pendingScheduledTransfers} pending · ${live.failedScheduledTransfers} failed`} />
          <StatusRow label="Lending" detail={`${live.activeLoans} active loans · ${live.pendingLoanApplications} applications pending`} />
          <StatusRow label="Identity" detail={`${live.restrictedUsers} restricted · ${live.frozenAccounts} frozen accounts`} />
        </Card>
      </Section>
    </InternalPageShell>
  );
}

function StatusRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-border/60 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <p className="mt-2 text-[13px] text-muted-foreground">{detail}</p>
    </div>
  );
}
