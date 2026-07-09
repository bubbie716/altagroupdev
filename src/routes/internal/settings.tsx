import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchInternalDashboardMetrics } from "@/lib/internal/internal-dashboard.functions";
import { loadInternalPlatformSettings } from "@/lib/internal/internal-platform-settings-loader";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

export const Route = createFileRoute("/internal/settings")({
  loader: async () => {
    const [live, platformSettings] = await Promise.all([
      fetchInternalDashboardMetrics(),
      loadInternalPlatformSettings(),
    ]);
    return { live, ...platformSettings };
  },
  head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const { live, maintenance, creditDesk, commercialPlans } = Route.useLoaderData();

  return (
    <InternalPageShell title="Internal Settings" description="Platform maintenance, Credit Desk status, and live operations.">
      <InternalPlatformSettingsSections
        data={{ maintenance, creditDesk, commercialPlans }}
        maintenanceScopes={maintenanceScopesForInternalSettings("corporate")}
      />

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
