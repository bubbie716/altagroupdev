import { getSiteConfig } from "@/config/sites";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

/** Canonical Terminal path for every legacy Exchange host/path request. */
export const RETIRED_EXCHANGE_TERMINAL_PATH = "/terminal" as const;

function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

function appendSearchString(href: string, searchStr?: string): string {
  if (!searchStr || searchStr === "?") return href;
  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  if (!normalized) return href;
  const url = new URL(href);
  const incoming = new URLSearchParams(normalized);
  incoming.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/** True when the request host is the legacy Exchange hostname. */
export function isRetiredExchangeHost(host: string): boolean {
  const hostname = normalizeHostname(host);
  const config = getSiteConfig("exchange");
  if (config.productionHosts.includes(hostname)) return true;
  const sub = config.localSubdomain;
  if (!sub) return false;
  return hostname === `${sub}.localhost` || hostname.startsWith(`${sub}.`);
}

/** True for product paths under `/exchange` (not `/internal/exchange`). */
export function isRetiredExchangeProductPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/exchange" || path.startsWith("/exchange/");
}

/**
 * Sprint 4G.1 — send Exchange host traffic and `/exchange/*` product paths to
 * Terminal `/terminal`. Never preserves old Exchange pathnames (avoids loops with
 * cross-site ownership redirects). Query strings may be preserved.
 */
export function resolveRetiredExchangeRedirect(
  pathname: string,
  options?: { host?: string; searchStr?: string },
): string | null {
  const host = options?.host;
  if (!host) return null;

  const onExchangeHost = isRetiredExchangeHost(host);
  const onExchangePath = isRetiredExchangeProductPath(pathname);
  if (!onExchangeHost && !onExchangePath) return null;

  // Already on Terminal at the retirement destination — stop (no loop).
  if (
    !onExchangeHost &&
    normalizePathname(pathname) === RETIRED_EXCHANGE_TERMINAL_PATH &&
    normalizeHostname(host).startsWith("terminal.")
  ) {
    return null;
  }

  return appendSearchString(
    resolveEntitySiteUrl("terminal", RETIRED_EXCHANGE_TERMINAL_PATH, host),
    options?.searchStr,
  );
}

/**
 * Production Vercel destination for every exchange.altagroup.dev request.
 * Kept as a constant so tests can assert host-level behavior without string-searching only.
 */
export const EXCHANGE_HOST_VERCEL_DESTINATION = "https://terminal.altagroup.dev/terminal";
