import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { loadInternalPlatformSettings } from "@/lib/internal/internal-platform-settings-loader";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type BankSettingsSearch = {
  site?: string;
  section?: "credit" | "commercial" | "maintenance";
};

export const Route = createFileRoute("/internal/bank/settings")({
  validateSearch: (s: Record<string, unknown>): BankSettingsSearch => {
    const section =
      s.section === "credit" || s.section === "commercial" || s.section === "maintenance"
        ? s.section
        : undefined;
    return {
      site: readDevSiteFromSearch(s) ?? "bank",
      section,
    };
  },
  loader: () => loadInternalPlatformSettings(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Bank Settings", (match.search as { site?: string }).site ?? "bank") }] }),
  component: BankInternalSettingsPage,
});

function BankInternalSettingsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <InternalPageShell
      title="Bank Settings"
      description="Credit Desk, commercial plans, and bank maintenance."
      breadcrumbs={buildBreadcrumbs([
        {
          label: "System",
          to: "/internal/jobs",
          search: withInternalSiteSearch({}, search.site ?? "bank"),
        },
        { label: "Settings" },
      ])}
    >
      <InternalPlatformSettingsSections
        data={data}
        maintenanceScopes={maintenanceScopesForInternalSettings("bank")}
        section={search.section ?? "credit"}
        sectionBasePath="/internal/bank/settings"
        siteKey={search.site ?? "bank"}
      />
    </InternalPageShell>
  );
}
