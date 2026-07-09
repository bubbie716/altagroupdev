import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

export const Route = createFileRoute("/internal/exchange/settings")({
  loader: () => fetchMaintenanceModeSettings(),
  head: () => ({ meta: [{ title: "Exchange Settings — Alta Internal" }] }),
  component: ExchangeInternalSettingsPage,
});

function ExchangeInternalSettingsPage() {
  const maintenance = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Exchange Settings"
      description="Maintenance controls for the Alta Exchange public site."
    >
      <InternalPlatformSettingsSections
        data={{ maintenance }}
        maintenanceScopes={maintenanceScopesForInternalSettings("exchange")}
        showCreditDesk={false}
        showCommercialPlans={false}
      />
    </InternalPageShell>
  );
}
