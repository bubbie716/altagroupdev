import { Link } from "@tanstack/react-router";
import { MaintenanceModePanel } from "@/components/internal/maintenance-mode-panel";
import { CreditDeskPanel } from "@/components/internal/credit-desk-panel";
import { CommercialPlanSettingsPanel } from "@/components/internal/commercial-plan-settings-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import type { CreditDeskSettings } from "@/lib/platform/credit-desk-types";
import type { MaintenanceModeSettings, MaintenanceScope } from "@/lib/platform/maintenance-types";
import type { CommercialPlatformSettingsView } from "@/lib/platform/commercial-plan-settings-types";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import type { SiteKey } from "@/config/sites";
import { cn } from "@/lib/utils";

export type InternalPlatformSettingsData = {
  maintenance: MaintenanceModeSettings;
  creditDesk?: CreditDeskSettings;
  commercialPlans?: CommercialPlatformSettingsView;
};

export type SettingsSectionId = "credit" | "commercial" | "maintenance";

const SECTION_TABS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "credit", label: "Credit and products" },
  { id: "commercial", label: "Commercial" },
  { id: "maintenance", label: "Maintenance" },
];

export function InternalPlatformSettingsSections({
  data,
  maintenanceScopes,
  showCreditDesk = true,
  showCommercialPlans = true,
  section = "credit",
  sectionBasePath = "/internal/settings",
  siteKey = "corporate",
}: {
  data: InternalPlatformSettingsData;
  maintenanceScopes: MaintenanceScope[];
  showCreditDesk?: boolean;
  showCommercialPlans?: boolean;
  section?: SettingsSectionId;
  sectionBasePath?: "/internal/settings" | "/internal/bank/settings" | "/internal/terminal/settings";
  siteKey?: SiteKey;
}) {
  const tabs = SECTION_TABS.filter((tab) => {
    if (tab.id === "credit") return showCreditDesk;
    if (tab.id === "commercial") return showCommercialPlans;
    return true;
  });
  const activeSection =
    tabs.some((t) => t.id === section) ? section : (tabs[0]?.id ?? "maintenance");

  return (
    <>
      {tabs.length > 1 ? (
        <nav
          aria-label="Settings sections"
          className="mb-6 flex flex-wrap gap-2 border-b border-border/60 pb-3"
        >
          {tabs.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <Link
                key={tab.id}
                to={sectionBasePath}
                search={withInternalSiteSearch({ section: tab.id }, siteKey)}
                className={cn(
                  "rounded px-3 py-1.5 text-[13px]",
                  active
                    ? "bg-gold/15 font-medium text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {activeSection === "credit" && showCreditDesk && data.creditDesk ? (
        <section aria-label="Credit and products">
          <CreditDeskPanel initial={data.creditDesk} />
        </section>
      ) : null}

      {activeSection === "commercial" ? (
        <AdminOnly
          siteKey={siteKey}
          fallback={
            <p className="text-[13px] text-muted-foreground">
              Commercial plan settings require admin access.
            </p>
          }
        >
          {showCommercialPlans && data.commercialPlans ? (
            <section aria-label="Commercial">
              <CommercialPlanSettingsPanel initial={data.commercialPlans} />
            </section>
          ) : (
            <p className="text-[13px] text-muted-foreground">Commercial plans unavailable.</p>
          )}
        </AdminOnly>
      ) : null}

      {activeSection === "maintenance" ? (
        <AdminOnly
          siteKey={siteKey}
          fallback={
            <p className="text-[13px] text-muted-foreground">
              Maintenance controls require admin access. Operators can view status on Home and Jobs.
            </p>
          }
        >
          {maintenanceScopes.length > 0 ? (
            <section aria-label="Maintenance">
              <MaintenanceModePanel initial={data.maintenance} visibleScopes={maintenanceScopes} />
            </section>
          ) : (
            <p className="text-[13px] text-muted-foreground">No maintenance scopes for this site.</p>
          )}
        </AdminOnly>
      ) : null}
    </>
  );
}
