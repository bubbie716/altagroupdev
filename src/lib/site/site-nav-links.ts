import { getSiteConfig, type SiteConfig, type SiteKey, type SiteNavLink } from "@/config/sites";
import { buildExchangePrimaryNavLinks } from "@/lib/exchange/exchange-primary-nav";
import { buildTerminalPrimaryNavLinks } from "@/lib/terminal/terminal-primary-nav";

/** Runtime nav links — cross-entity items resolve to the correct subdomain. */
export function resolveSiteNavLinks(siteKey: SiteKey): SiteNavLink[] {
  if (siteKey === "exchange") {
    // Legacy host — no product nav (routes redirect to Terminal).
    return buildExchangePrimaryNavLinks();
  }

  if (siteKey === "terminal") {
    return buildTerminalPrimaryNavLinks();
  }

  return getSiteConfig(siteKey).navLinks;
}

export function resolveSiteContextNav(site: SiteConfig): SiteNavLink[] {
  return resolveSiteNavLinks(site.key);
}
