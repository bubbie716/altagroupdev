import { redirect } from "@tanstack/react-router";
import type { AltaUser } from "@/lib/auth/types";
import type { SiteConfig } from "@/config/sites";
import { canAccessInternalForSite } from "@/lib/auth/permissions";
import {
  fetchCurrentUser,
  verifyDeveloperAccess,
  verifyIssuerPortalAccess,
  verifyPrivateClientAccess,
} from "@/lib/auth/auth.functions";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { resolveSiteSignInPath, buildSignInSearch } from "@/lib/site/site-sign-in-path";
import { siteFromRouteContext } from "@/lib/site/site-context";

type GuardContext = {
  context: { user: AltaUser | null; site?: SiteConfig };
  location: { href: string; pathname: string };
};

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
  throw signInRedirect(siteFromRouteContext(context), location.pathname);
}

async function requireSignedIn({ context, location }: GuardContext) {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  if (!context.user) {
    throw signInRedirect(siteFromRouteContext(context), location.pathname);
  }
}

async function requireAccess(
  context: GuardContext,
  verify: () => Promise<boolean>,
): Promise<void> {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  await requireSignedIn(context);
  const allowed = await verify();
  if (!allowed) {
    throw redirect({ to: "/access-restricted" });
  }
}

export async function internalBeforeLoad(context: GuardContext) {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  const user = context.context.user ?? (await fetchCurrentUser());
  const site = siteFromRouteContext(context.context);
  if (!user) {
    throw signInRedirect(site, context.location.pathname);
  }
  if (!canAccessInternalForSite(user, site.key)) {
    throw redirect({ to: "/access-restricted" });
  }
}

export async function privateClientBeforeLoad(context: GuardContext) {
  await requireAccess(context, verifyPrivateClientAccess);
}

export async function developerBeforeLoad(context: GuardContext) {
  await requireAccess(context, verifyDeveloperAccess);
}

type IssuerGuardContext = GuardContext & {
  params: { ticker: string };
};

export async function issuerPortalBeforeLoad(context: IssuerGuardContext) {
  // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
  if (isUiLabMode()) return;
  await requireSignedIn(context);
  const allowed = await verifyIssuerPortalAccess({ data: { ticker: context.params.ticker } });
  if (!allowed) {
    throw redirect({ to: "/access-restricted" });
  }
}
