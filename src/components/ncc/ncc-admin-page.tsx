import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccMaintenanceModePanel } from "@/components/ncc/ncc-maintenance-mode-panel";
import { NccCard, NccPageContainer } from "@/components/ncc/ncc-ui";
import type { NccMaintenanceModeSettings } from "@/lib/ncc/ncc-maintenance-types";

export function NccAdminPage({
  maintenanceSettings,
}: {
  maintenanceSettings: NccMaintenanceModeSettings;
}) {

  return (
    <NccLayout>
      <NccPageContainer>
        <div className="border-b border-[#e5e7eb] pb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            Administration
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
            NCC Admin Panel
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Network operations settings for authorized NCC operators. Maintenance mode is managed
            here independently from Alta Group platform maintenance.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <NccMaintenanceModePanel initial={maintenanceSettings} />

          <NccCard>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
              Coming soon
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[#4b5563]">
              Additional controls for institution onboarding, routing configuration, settlement
              policy, and network operations will appear here.
            </p>
          </NccCard>
        </div>
      </NccPageContainer>
    </NccLayout>
  );
}
