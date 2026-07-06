import type { SiteKey } from "@/config/sites";
import { devSiteSearchParams } from "@/lib/site/local-dev-site";

/** Every site homepage is the login page at `/`. */
export function resolveSiteSignInPath(): "/" {
  return "/";
}

/** Search params for sign-in links (preserves ?site= on plain localhost). */
export function buildSignInSearch(
  siteKey: SiteKey,
  redirectPath?: string,
): Record<string, string> | undefined {
  const params: Record<string, string> = {
    ...devSiteSearchParams(siteKey),
  };

  if (redirectPath) {
    params.redirect = redirectPath;
  }

  return Object.keys(params).length > 0 ? params : undefined;
}
