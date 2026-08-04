import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { internalBeforeLoad } from "@/lib/auth/guards";
import { InternalShell } from "@/components/internal/console";
import { CreditDeskBanner } from "@/components/internal/credit-desk-banner";
import { fetchCreditDeskSettings } from "@/lib/platform/platform-settings.functions";
import { assertEntityInternalRouteAccess } from "@/lib/internal/entity-internal-scope";
import {
  normalizeInternalSearch,
  serializeInternalSearch,
} from "@/lib/internal/normalize-internal-search";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import { readDevSiteFromLocation } from "@/lib/site/preserve-dev-site-search";

function internalRedirectHref(pathname: string, search: Record<string, unknown>): string {
  const query = serializeInternalSearch(normalizeInternalSearch(search));
  return query ? `${pathname}?${query}` : pathname;
}

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
  // Keep the localhost multi-site override on the shared parent route. TanStack
  // otherwise normalizes unknown parent search keys away before child guards run.
  validateSearch: (search: Record<string, unknown>): { site?: string } => ({
    site: typeof search.site === "string" ? search.site : undefined,
  }),
  beforeLoad: async (ctx) => {
    await internalBeforeLoad(ctx);
    // The root `/internal` child can be reached with a query-only site override.
    // Use the raw href here as a final guard because the parent route may not
    // have a validated search object yet during SSR.
    const rawSite = /(?:\?|&)site=([^&]+)/.exec(ctx.location.href)?.[1];
    const rawPath = ctx.location.pathname.replace(/\/$/, "") || "/";
    if (rawPath === "/internal" && rawSite === "bank") {
      throw redirect({
        href: internalRedirectHref("/internal/bank", { site: "bank" }),
        replace: true,
      });
    }
    const legacyRedirects: Record<string, { pathname: string; search: Record<string, unknown> }> = {
      "/internal/exceptions": {
        pathname: "/internal/inbox",
        search: { site: "bank", category: "risk", type: "exception" },
      },
      "/internal/deposits": {
        pathname: "/internal/inbox",
        search: { site: "bank", category: "money", type: "deposit" },
      },
      "/internal/withdrawals": {
        pathname: "/internal/inbox",
        search: { site: "bank", category: "money", type: "withdrawal" },
      },
      "/internal/scheduled": {
        pathname: "/internal/bank/transfers",
        search: { site: "bank", status: "scheduled" },
      },
    };
    const legacyRedirect = legacyRedirects[rawPath];
    if (legacyRedirect) {
      throw redirect({
        href: internalRedirectHref(legacyRedirect.pathname, legacyRedirect.search),
        replace: true,
      });
    }
    // Query overrides are not guaranteed to remount the root route context.
    // Resolve from the current location before applying site-scoped guards.
    const requestedSite = readDevSiteFromLocation(ctx.location);
    const site = resolveSiteContextFromRequest(
      requestedSite
        ? { site: requestedSite }
        : typeof ctx.location.searchStr === "string"
          ? ctx.location.searchStr
          : (ctx.location as { search?: Record<string, unknown> }).search,
      ctx.location.pathname,
    );
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
