import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

export const Route = createFileRoute("/internal/exchange/settings")({
  loader: () => fetchMaintenanceModeSettings(),
  head: () => ({ meta: [{ title: "Retired Exchange Host Settings — Alta Internal" }] }),
  component: ExchangeInternalSettingsPage,
});

function ExchangeInternalSettingsPage() {
  const maintenance = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Retired Exchange Host"
      description="Maintenance controls for the discontinued exchange.altagroup.dev host. Product traffic redirects to Alta Terminal."
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
