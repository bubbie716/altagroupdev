import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

export const Route = createFileRoute("/internal/terminal/settings")({
  loader: () => fetchMaintenanceModeSettings(),
  head: () => ({ meta: [{ title: "Terminal Settings — Alta Internal" }] }),
  component: TerminalInternalSettingsPage,
});

function TerminalInternalSettingsPage() {
  const maintenance = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Terminal Settings"
      description="Maintenance controls for the Alta Terminal public site."
    >
      <InternalPlatformSettingsSections
        data={{ maintenance }}
        maintenanceScopes={maintenanceScopesForInternalSettings("terminal")}
        showCreditDesk={false}
        showCommercialPlans={false}
      />
    </InternalPageShell>
  );
}
