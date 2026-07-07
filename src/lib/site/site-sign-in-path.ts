import type { SiteKey } from "@/config/sites";
import { devSiteSearchParams } from "@/lib/site/local-dev-site";

/** Sign-in path per site. NCC uses a dedicated login route; others use `/`. */
export function resolveSiteSignInPath(siteKey: SiteKey): "/" | "/login" {
  return siteKey === "ncc" ? "/login" : "/";
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
