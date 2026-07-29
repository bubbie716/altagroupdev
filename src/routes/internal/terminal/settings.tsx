import { createFileRoute } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalPlatformSettingsSections } from "@/components/internal/internal-platform-settings-sections";
import { fetchMaintenanceModeSettings } from "@/lib/platform/platform-settings.functions";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TerminalSettingsSearch = { site?: string; section?: string };

export const Route = createFileRoute("/internal/terminal/settings")({
  validateSearch: (s: Record<string, unknown>): TerminalSettingsSearch => ({
    site: validateDevSiteSearch(s).site,
    section: typeof s.section === "string" && s.section.trim() ? s.section.trim() : undefined,
  }),
  loader: () => fetchMaintenanceModeSettings(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Terminal Settings", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: TerminalInternalSettingsPage,
});

function TerminalInternalSettingsPage() {
  const maintenance = Route.useLoaderData();
  const search = Route.useSearch();
  const showLegacyHost = search.section === "legacy-host" || search.section === "exchange";
  const terminalScopes = maintenanceScopesForInternalSettings("terminal");
  const scopes = showLegacyHost
    ? [...terminalScopes, ...maintenanceScopesForInternalSettings("exchange")]
    : terminalScopes;

  return (
    <InternalPageShell
      title="Terminal Settings"
      description="Maintenance controls for the Alta Terminal public site."
    >
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Terminal maintenance status and public message. System readiness lives on System.
      </p>
      <InternalPlatformSettingsSections
        data={{ maintenance }}
        maintenanceScopes={scopes}
        showCreditDesk={false}
        showCommercialPlans={false}
        section="maintenance"
        sectionBasePath="/internal/terminal/settings"
        siteKey={search.site}
      />
      {showLegacyHost ? (
        <details className="mt-4 rounded-md border border-border/60 px-4 py-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Legacy host maintenance
          </summary>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Compatibility controls for the retired Exchange host. Use the Legacy Host Maintenance
            scope above when operators need to put the redirect host into maintenance.
          </p>
        </details>
      ) : null}
    </InternalPageShell>
  );
}
