import { getSiteConfig, type SiteKey } from "@/config/sites";
import {
  isPlainLocalDevHost,
  siteKeyForEntityPath,
} from "@/lib/site/local-dev-site";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveEntitySiteHostname(siteKey: SiteKey): string {
  const config = getSiteConfig(siteKey);
  return (
    config.productionHosts.find((host) => !host.startsWith("www.")) ??
    config.productionHosts[0] ??
    "altagroup.dev"
  );
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

/**
 * Stable same-app relative URLs when request origin is unknown.
 * Prefer passing an explicit request host so SSR and the browser match.
 */
export function resolveRelativeEntitySiteUrl(siteKey: SiteKey, path = "/"): string {
  const normalizedPath = normalizePath(path);
  if (siteKey === "corporate") {
    return normalizedPath;
  }
  if (normalizedPath === "/") {
    return `/?site=${siteKey}`;
  }
  if (siteKeyForEntityPath(normalizedPath) === siteKey) {
    return normalizedPath;
  }
  const params = new URLSearchParams({ site: siteKey });
  return `${normalizedPath}?${params.toString()}`;
}

function portSuffixFromHost(host: string): string {
  return host.includes(":") ? `:${host.split(":").slice(1).join(":")}` : "";
}

function hostnameFromHost(host: string): string {
  return host.split(":")[0].toLowerCase();
}

function isLocalDevHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

/** Absolute URL for an Alta entity site (subdomain in prod, localhost/?site= in plain local dev). */
export function resolveEntitySiteUrl(
  siteKey: SiteKey,
  path = "/",
  requestHost?: string,
): string {
  const normalizedPath = normalizePath(path);
  const productionHost = resolveEntitySiteHostname(siteKey);

  if (!requestHost) {
    // No origin context — keep markup stable with relative same-app URLs.
    // Callers that need absolute production URLs must pass the request host.
    if (process.env.NODE_ENV === "production") {
      return `https://${productionHost}${normalizedPath}`;
    }
    return resolveRelativeEntitySiteUrl(siteKey, normalizedPath);
  }

  const portSuffix = portSuffixFromHost(requestHost);
  const hostname = hostnameFromHost(requestHost);

  if (isLocalDevHostname(hostname)) {
    return resolveLocalDevUrl(siteKey, normalizedPath, portSuffix, hostname);
  }

  const secure = process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${productionHost}${normalizedPath}`;
}

export function resolveCorporateSiteUrl(path = "/", requestHost?: string): string {
  return resolveEntitySiteUrl("corporate", path, requestHost);
}

/** Hostname label for external subsidiary links (e.g. bank.altagroup.dev). */
export function resolveEntitySiteLabel(siteKey: SiteKey): string {
  return resolveEntitySiteHostname(siteKey);
}

export { devSiteSearchParams } from "@/lib/site/local-dev-site";
