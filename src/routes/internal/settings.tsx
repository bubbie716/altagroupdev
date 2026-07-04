import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { MaintenanceModePanel } from "@/components/internal/maintenance-mode-panel";
import { CreditDeskPanel } from "@/components/internal/credit-desk-panel";
import { CommercialPlanSettingsPanel } from "@/components/internal/commercial-plan-settings-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import { fetchInternalDashboardMetrics } from "@/lib/internal/internal-dashboard.functions";
import { fetchMaintenanceModeSettings, fetchCreditDeskSettings, fetchCommercialPlanPlatformSettings } from "@/lib/platform/platform-settings.functions";

export const Route = createFileRoute("/internal/settings")({
  loader: async () => {
    const [live, maintenance, creditDesk, commercialPlans] = await Promise.all([
      fetchInternalDashboardMetrics(),
      fetchMaintenanceModeSettings(),
      fetchCreditDeskSettings(),
      fetchCommercialPlanPlatformSettings(),
    ]);
    return { live, maintenance, creditDesk, commercialPlans };
  },
  head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const { live, maintenance, creditDesk, commercialPlans } = Route.useLoaderData();

  return (
    <InternalPageShell title="Internal Settings" description="Platform maintenance, Credit Desk status, and live operations.">
      <Section title="Credit Desk">
        <CreditDeskPanel initial={creditDesk} />
      </Section>

      <AdminOnly>
        <Section title="Alta Commercial plans" className="mt-10">
          <CommercialPlanSettingsPanel initial={commercialPlans} />
        </Section>

        <Section title="Maintenance mode" className="mt-10">
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
