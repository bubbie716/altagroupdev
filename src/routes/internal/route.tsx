import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";
import { InternalShell } from "@/components/internal/console";
import { CreditDeskBanner } from "@/components/internal/credit-desk-banner";
import { fetchCreditDeskSettings } from "@/lib/platform/platform-settings.functions";
import { assertEntityInternalRouteAccess } from "@/lib/internal/entity-internal-scope";
import { siteFromRouteContext } from "@/lib/site/site-context";

function InternalNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">404</p>
      <h1 className="mt-3 text-[1.5rem] font-semibold tracking-tight text-foreground">
        This internal page could not be found.
      </h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Check the URL or return to the console home.
      </p>
      <Link
        to="/internal"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90"
      >
        Return to Internal Console
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/internal")({
  beforeLoad: async (ctx) => {
    await internalBeforeLoad(ctx);
    const site = siteFromRouteContext(ctx.context);
    assertEntityInternalRouteAccess(site.key, ctx.location.pathname, ctx.context.user);
  },
  staleTime: 60_000,
  loader: () => fetchCreditDeskSettings(),
  component: InternalLayout,
  notFoundComponent: InternalNotFound,
});

function InternalLayout() {
  const creditDesk = Route.useLoaderData();

  return (
    <InternalShell>
      {creditDesk.status === "closed" ? <CreditDeskBanner /> : null}
      <Outlet />
    </InternalShell>
  );
}
