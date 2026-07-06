import { getSiteConfig, type SiteKey } from "@/config/sites";
import {
  devSiteSearchParams,
  isPlainLocalDevHost,
  siteKeyForEntityPath,
} from "@/lib/site/local-dev-site";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveEntitySiteHostname(siteKey: SiteKey): string {
  const config = getSiteConfig(siteKey);
  if (siteKey === "corporate") {
    return config.productionHosts.find((host) => !host.startsWith("www.")) ?? "altagroup.dev";
  }
  return config.productionHosts[0];
}

function resolveLocalDevUrl(
  siteKey: SiteKey,
  path: string,
  portSuffix: string,
  hostname: string,
): string {
  const config = getSiteConfig(siteKey);

  if (isPlainLocalDevHost(hostname)) {
    const base = `http://localhost${portSuffix}`;
    const normalizedPath = normalizePath(path);
    if (siteKey === "corporate") {
      return `${base}${normalizedPath}`;
    }
    if (normalizedPath === "/") {
      return `${base}/?site=${siteKey}`;
    }
    if (siteKeyForEntityPath(normalizedPath) === siteKey) {
      return `${base}${normalizedPath}`;
    }
    const url = new URL(`${base}${normalizedPath}`);
    url.searchParams.set("site", siteKey);
    return url.toString();
  }

  if (siteKey === "corporate") {
    return `http://localhost${portSuffix}${path}`;
  }
  const sub = config.localSubdomain;
  return sub ? `http://${sub}.localhost${portSuffix}${path}` : `http://localhost${portSuffix}${path}`;
}

function resolveRequestHost(requestHost?: string): string | undefined {
  if (requestHost) return requestHost;
  if (typeof window === "undefined") return undefined;

  const { host, hostname, port } = window.location;
  if (host) return host;
  if (!hostname) return undefined;
  return port ? `${hostname}:${port}` : hostname;
}

/** Absolute URL for an Alta entity site (subdomain in prod, localhost/?site= in plain local dev). */
export function resolveEntitySiteUrl(
  siteKey: SiteKey,
  path = "/",
  requestHost?: string,
): string {
  const normalizedPath = normalizePath(path);
  const host = resolveEntitySiteHostname(siteKey);
  const resolvedHost = resolveRequestHost(requestHost);

  if (resolvedHost) {
    const portSuffix = resolvedHost.includes(":")
      ? `:${resolvedHost.split(":").slice(1).join(":")}`
      : "";
    const hostname = resolvedHost.split(":")[0].toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
      return resolveLocalDevUrl(siteKey, normalizedPath, portSuffix, hostname);
    }

    const secure =
      typeof window !== "undefined" ? window.location.protocol === "https:" : process.env.NODE_ENV === "production";
    return `${secure ? "https" : "http"}://${host}${normalizedPath}`;
  }

  const secure = process.env.NODE_ENV === "production";
  if (!secure && siteKey !== "corporate") {
    if (process.env.NODE_ENV !== "production") {
      return resolveLocalDevUrl(siteKey, normalizedPath, "", "localhost");
    }
    const sub = getSiteConfig(siteKey).localSubdomain;
    if (sub) {
      return `http://${sub}.localhost${normalizedPath}`;
    }
  }

  return `${secure ? "https" : "http"}://${host}${normalizedPath}`;
}

export function resolveCorporateSiteUrl(path = "/"): string {
  return resolveEntitySiteUrl("corporate", path);
}

/** Hostname label for external subsidiary links (e.g. bank.altagroup.dev). */
export function resolveEntitySiteLabel(siteKey: SiteKey): string {
  return resolveEntitySiteHostname(siteKey);
}

export { devSiteSearchParams };
