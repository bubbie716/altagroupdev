import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/exchange/settings")({
  loader: () => fetchMaintenanceModeSettings(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Legacy Host Settings", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: ExchangeInternalSettingsPage,
});

function ExchangeInternalSettingsPage() {
  const maintenance = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Legacy Host Settings"
      description="Maintenance controls for the legacy host that redirects to Alta Terminal."
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
