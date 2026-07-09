import { Section } from "@/components/page-shell";
import { MaintenanceModePanel } from "@/components/internal/maintenance-mode-panel";
import { CreditDeskPanel } from "@/components/internal/credit-desk-panel";
import { CommercialPlanSettingsPanel } from "@/components/internal/commercial-plan-settings-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import type { CreditDeskSettings } from "@/lib/platform/credit-desk-types";
import type { MaintenanceModeSettings, MaintenanceScope } from "@/lib/platform/maintenance-types";
import type { CommercialPlatformSettingsView } from "@/lib/platform/commercial-plan-settings-types";

export type InternalPlatformSettingsData = {
  maintenance: MaintenanceModeSettings;
  creditDesk?: CreditDeskSettings;
  commercialPlans?: CommercialPlatformSettingsView;
};

export function InternalPlatformSettingsSections({
  data,
  maintenanceScopes,
  showCreditDesk = true,
  showCommercialPlans = true,
}: {
  data: InternalPlatformSettingsData;
  maintenanceScopes: MaintenanceScope[];
  showCreditDesk?: boolean;
  showCommercialPlans?: boolean;
}) {
  return (
    <>
      {showCreditDesk && data.creditDesk ? (
        <Section title="Credit Desk">
          <CreditDeskPanel initial={data.creditDesk} />
        </Section>
      ) : null}

      <AdminOnly>
        {showCommercialPlans && data.commercialPlans ? (
          <Section title="Alta Commercial plans" className={showCreditDesk ? "mt-10" : undefined}>
            <CommercialPlanSettingsPanel initial={data.commercialPlans} />
          </Section>
        ) : null}

        {maintenanceScopes.length > 0 ? (
          <Section
            title="Maintenance mode"
            className={showCreditDesk || showCommercialPlans ? "mt-10" : undefined}
          >
            <MaintenanceModePanel initial={data.maintenance} visibleScopes={maintenanceScopes} />
          </Section>
        ) : null}
      </AdminOnly>
    </>
  );
}
