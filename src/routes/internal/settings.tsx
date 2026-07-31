import { createFileRoute, redirect } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";

export type SettingsSearch = {
  site?: string;
  section?: "credit" | "commercial" | "maintenance";
};

export const Route = createFileRoute("/internal/settings")({
  validateSearch: (s: Record<string, unknown>): SettingsSearch => {
    const section =
      s.section === "credit" || s.section === "commercial" || s.section === "maintenance"
        ? s.section
        : undefined;
    return {
      site: readDevSiteFromSearch(s),
      section,
    };
  },
  beforeLoad: ({ search }) => {
    if (search.site === "bank") {
      throw redirect({
        to: "/internal/bank/settings",
        search: normalizeInternalSearch(
          withInternalSiteSearch({ section: search.section }, "bank"),
        ),
      });
    }
  },
  loader: async () => ({ maintenance: await fetchMaintenanceModeSettings() }),
  head: ({ match }) => ({
    meta: [{ title: internalDocumentTitle("Settings", (match.search as SettingsSearch).site) }],
  }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <InternalPageShell
      title="Corporate Settings"
      description="Alta Group corporate-site maintenance configuration."
      breadcrumbs={buildBreadcrumbs([
        { label: "System", to: "/internal/jobs", search: withInternalSiteSearch({}, search.site) },
        { label: "Settings" },
      ])}
    >
      <InternalPlatformSettingsSections
        data={data}
        maintenanceScopes={maintenanceScopesForInternalSettings("corporate")}
        showCreditDesk={false}
        showCommercialPlans={false}
        section="maintenance"
        sectionBasePath="/internal/settings"
        siteKey="corporate"
      />
    </InternalPageShell>
  );
}
