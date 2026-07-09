import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { LoginPortalShell } from "@/components/auth/auth-gate";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteContext } from "@/hooks/use-site-context";
import { canBypassMaintenanceMode } from "@/lib/auth/permissions";
import { fetchMaintenanceMode } from "@/lib/platform/platform-settings.functions";
import {
  getMaintenanceScopeForSite,
  isMaintenanceActiveForSite,
  maintenanceTitleForSite,
} from "@/lib/platform/maintenance-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const Route = createFileRoute("/maintenance")({
  beforeLoad: async ({ context }) => {
    const maintenance = await fetchMaintenanceMode();
    const siteMaintenanceActive = isMaintenanceActiveForSite(context.site.key, maintenance.scopes);
    if (!siteMaintenanceActive || canBypassMaintenanceMode(context.user)) {
      throw redirect({ to: "/" });
    }
  },
  loader: () => fetchMaintenanceMode(),
  head: ({ context }) => ({
    meta: [{ title: `${maintenanceTitleForSite(context.site.key, null)} — ${context.site.displayName}` }],
  }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const maintenance = Route.useLoaderData();
  const site = useSiteContext();
  const user = useCurrentUser();
  const isBypassUser = user ? canBypassMaintenanceMode(user) : false;
  const activeScope = getMaintenanceScopeForSite(site.key, maintenance.scopes);
  const title = maintenanceTitleForSite(site.key, activeScope);
  const startedAt = activeScope ? maintenance.scopeStartedAt[activeScope] : maintenance.startedAt;

  return (
    <LoginPortalShell brandEyebrow={`${site.displayName} · Be Back Shortly`}>
      <div className="w-full max-w-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">{site.displayName}</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{maintenance.message}</p>

        <Card className="mt-8 border-border/80 bg-card/95 !p-6 shadow-sm backdrop-blur-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
                Maintenance Active
              </span>
            </div>

            {startedAt ? (
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Started
                </span>
                <span className="font-mono text-[12px] text-foreground">
                  {formatActivityDateTime(startedAt)}
                </span>
              </div>
            ) : null}

            <p className="pt-2 text-[13px] leading-relaxed text-muted-foreground">
              Please check back shortly.
            </p>
          </div>
        </Card>

        {isBypassUser ? (
          <div className="mt-8 rounded-lg border border-gold/25 bg-gold/5 px-5 py-4">
            <p className="text-[13px] text-muted-foreground">
              Your admin account bypasses maintenance mode. The full platform remains available.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md border border-gold/30 bg-gold/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/15"
              >
                Continue to platform
              </Link>
              <Link
                to="/internal"
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Internal Operations
              </Link>
            </div>
          </div>
        ) : null}

        {user && !isBypassUser ? (
          <p className="mt-6 text-center text-[12px] text-muted-foreground">
            Signed in as {user.discordUsername}. Platform access will resume when maintenance ends.
          </p>
        ) : null}
      </div>
    </LoginPortalShell>
  );
}
