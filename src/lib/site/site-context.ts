import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  getDefaultSiteConfig,
  getSiteConfig,
  isSiteKey,
  SITE_CONFIGS,
  SITE_KEYS,
  type SiteConfig,
  type SiteKey,
} from "@/config/sites";
import { siteKeyForEntityPath, isPlainLocalDevHost } from "@/lib/site/local-dev-site";

const SUBDOMAIN_TO_SITE: Record<string, SiteKey> = {
  bank: "bank",
  exchange: "exchange",
  terminal: "terminal",
  ncc: "ncc",
};

function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

function buildProductionHostToSiteMap(): Map<string, SiteKey> {
  const map = new Map<string, SiteKey>();
  for (const key of SITE_KEYS) {
    for (const host of SITE_CONFIGS[key].productionHosts) {
      map.set(normalizeHostname(host), key);
    }
  }
  return map;
}

const PRODUCTION_HOST_TO_SITE = buildProductionHostToSiteMap();

function resolveSiteKeyFromProductionHost(hostname: string): SiteKey | null {
  return PRODUCTION_HOST_TO_SITE.get(hostname) ?? null;
}

/** Resolve site key from request Host header (no query override). */
export function resolveSiteKeyFromHost(host: string): SiteKey {
  const hostname = normalizeHostname(host);

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "corporate";
  }

  // bank.localhost, exchange.localhost, etc.
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(/\.localhost$/, "");
    return SUBDOMAIN_TO_SITE[sub] ?? "corporate";
  }

  const productionSite = resolveSiteKeyFromProductionHost(hostname);
  if (productionSite) return productionSite;

  if (hostname.endsWith(".altagroup.dev")) {
    const sub = hostname.slice(0, -".altagroup.dev".length);
    if (sub && !sub.includes(".")) {
      return SUBDOMAIN_TO_SITE[sub] ?? "corporate";
    }
  }

  return "corporate";
}

export function resolveSiteKeyFromSearch(
  search: Record<string, unknown>,
  options?: { allowDevOverride?: boolean },
): SiteKey | null {
  if (options?.allowDevOverride === false) return null;
  if (process.env.NODE_ENV === "production") return null;

  const raw = search.site;
  if (typeof raw !== "string" || !isSiteKey(raw)) return null;
  return raw;
}

export function resolveSiteKey(input: {
  host: string;
  search?: Record<string, unknown>;
  pathname?: string;
  allowDevOverride?: boolean;
}): SiteKey {
  const override = input.search
    ? resolveSiteKeyFromSearch(input.search, { allowDevOverride: input.allowDevOverride })
    : null;
  if (override) return override;

  const hostSiteKey = resolveSiteKeyFromHost(input.host);
  if (hostSiteKey !== "corporate") return hostSiteKey;

  if (
    process.env.NODE_ENV !== "production" &&
    isPlainLocalDevHost(input.host) &&
    input.pathname
  ) {
    const pathSiteKey = siteKeyForEntityPath(input.pathname);
    if (pathSiteKey) return pathSiteKey;
  }

  return hostSiteKey;
}

export function resolveSiteConfig(input: {
  host: string;
  search?: Record<string, unknown>;
  pathname?: string;
  allowDevOverride?: boolean;
}): SiteConfig {
  return getSiteConfig(resolveSiteKey(input));
}

export const readRequestHost = createIsomorphicFn()
  .server(() => getRequestHeader("host") ?? "localhost")
  .client(() => window.location.host);

export function resolveSiteContextFromRequest(
  search?: Record<string, unknown>,
  pathname?: string,
): SiteConfig {
  return resolveSiteConfig({
    host: readRequestHost(),
    search,
    pathname,
    allowDevOverride: true,
  });
}

export function fallbackSiteContext(): SiteConfig {
  return getDefaultSiteConfig();
}

/** Safe site lookup for route head/beforeLoad/loader when context may be incomplete. */
export function siteFromRouteContext(
  context: { site?: SiteConfig } | null | undefined,
): SiteConfig {
  return context?.site ?? fallbackSiteContext();
}
