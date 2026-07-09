import { Section } from "@/components/page-shell";
import { MaintenanceModePanel } from "@/components/internal/maintenance-mode-panel";
import { CreditDeskPanel } from "@/components/internal/credit-desk-panel";
import { CommercialPlanSettingsPanel } from "@/components/internal/commercial-plan-settings-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import type { CreditDeskSettings } from "@/lib/platform/credit-desk-types";
import type { MaintenanceModeSettings } from "@/lib/platform/maintenance-types";
import type { CommercialPlatformSettingsView } from "@/lib/platform/commercial-plan-settings-types";

export type InternalPlatformSettingsData = {
  maintenance: MaintenanceModeSettings;
  creditDesk: CreditDeskSettings;
  commercialPlans: CommercialPlatformSettingsView;
};

export function InternalPlatformSettingsSections({ data }: { data: InternalPlatformSettingsData }) {
  return (
    <>
      <Section title="Credit Desk">
        <CreditDeskPanel initial={data.creditDesk} />
      </Section>

      <AdminOnly>
        <Section title="Alta Commercial plans" className="mt-10">
          <CommercialPlanSettingsPanel initial={data.commercialPlans} />
        </Section>

        <Section title="Maintenance mode" className="mt-10">
          <MaintenanceModePanel initial={data.maintenance} />
        </Section>
      </AdminOnly>
    </>
  );
}
