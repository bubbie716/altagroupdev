import { getSiteConfig, type SiteConfig, type SiteKey, type SiteNavLink } from "@/config/sites";
import { buildExchangePrimaryNavLinks } from "@/lib/exchange/exchange-primary-nav";
import { buildTerminalPrimaryNavLinks } from "@/lib/terminal/terminal-primary-nav";
import { resolveCorporateSiteUrl } from "@/lib/site/entity-site-url";

function withExternalNavLink(link: SiteNavLink, href: string): SiteNavLink {
  return { ...link, to: href, external: true };
}

/** Runtime nav links — cross-entity items resolve to the correct subdomain. */
export function resolveSiteNavLinks(siteKey: SiteKey): SiteNavLink[] {
  const config = getSiteConfig(siteKey);

  if (siteKey === "exchange") {
    // Legacy host — no product nav (routes redirect to Terminal).
    return buildExchangePrimaryNavLinks();
  }

  if (siteKey === "terminal") {
    return buildTerminalPrimaryNavLinks();
  }

  if (siteKey === "ncc") {
    return config.navLinks.map((link) => {
      if (link.label === "Participation") {
        return withExternalNavLink(link, resolveCorporateSiteUrl("/legal/NCC-LEGAL-001"));
      }
      if (link.label === "Operating Rules") {
        return withExternalNavLink(link, resolveCorporateSiteUrl("/legal/NCC-LEGAL-002"));
      }
      return link;
    });
  }

  return config.navLinks;
}

export function resolveSiteContextNav(site: SiteConfig): SiteNavLink[] {
  return resolveSiteNavLinks(site.key);
}
