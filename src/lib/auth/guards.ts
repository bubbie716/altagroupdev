import { redirect } from "@tanstack/react-router";
import type { AltaUser } from "@/lib/auth/types";
import type { SiteConfig } from "@/config/sites";
import { canAccessInternalForSite } from "@/lib/auth/permissions";
import { fetchCurrentUser } from "@/lib/auth/auth.functions";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { resolveSiteSignInPath, buildSignInSearch } from "@/lib/site/site-sign-in-path";
import { resolveSiteContextFromRequest, siteFromRouteContext } from "@/lib/site/site-context";
import { readDevSiteFromLocation } from "@/lib/site/preserve-dev-site-search";

type GuardContext = {
  context: { user: AltaUser | null; site?: SiteConfig };
  location: { href: string; pathname: string; search?: Record<string, unknown>; searchStr?: string };
};

function siteForLocation(context: GuardContext): SiteConfig {
  // TanStack keeps the root context stable for query-only transitions. Use
  // the current search first so local multi-site routes remain scoped.
  const requestedSite = readDevSiteFromLocation(context.location);
  return resolveSiteContextFromRequest(
    requestedSite ? { site: requestedSite } : context.location.searchStr ?? context.location.search,
    context.location.pathname,
  ) ??
    siteFromRouteContext(context.context);
}

function signInRedirect(site: SiteConfig, pathname: string) {
  return redirect({
    to: resolveSiteSignInPath(site.key),
    search: buildSignInSearch(site.key, pathname),
  });
}

export function authBeforeLoad({ context, location }: GuardContext) {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  if (context.user) return;
  throw signInRedirect(siteForLocation({ context, location }), location.pathname);
}

/** Alta Accounting — Discord session + corporate_admin only. */
export async function accountingBeforeLoad(context: GuardContext) {
  if (isUiLabMode()) return;
  const user = context.context.user ?? (await fetchCurrentUser());
  const site = siteForLocation({ context: context.context, location: context.location });
  if (!user) {
    throw signInRedirect(site, context.location.pathname);
  }
  const { isCorporateAdmin } = await import("@/lib/auth/permissions");
  if (!isCorporateAdmin(user)) {
    throw redirect({ to: "/access-restricted" });
  }
}

export async function internalBeforeLoad(context: GuardContext) {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  const user = context.context.user ?? (await fetchCurrentUser());
  const site = siteForLocation({ context: context.context, location: context.location });
  if (!user) {
    throw signInRedirect(site, context.location.pathname);
  }
  if (!canAccessInternalForSite(user, site.key)) {
    throw redirect({ to: "/access-restricted" });
  }
}
