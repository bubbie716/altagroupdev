import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { loadInternalPlatformSettings } from "@/lib/internal/internal-platform-settings-loader";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

export const Route = createFileRoute("/internal/bank/settings")({
  loader: () => loadInternalPlatformSettings(),
  head: () => ({ meta: [{ title: "Bank Settings — Alta Internal" }] }),
  component: BankInternalSettingsPage,
});

function BankInternalSettingsPage() {
  const data = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Bank Settings"
      description="Credit Desk, Alta Commercial plans, and bank maintenance controls."
    >
      <InternalPlatformSettingsSections
        data={data}
        maintenanceScopes={maintenanceScopesForInternalSettings("bank")}
      />
    </InternalPageShell>
  );
}
