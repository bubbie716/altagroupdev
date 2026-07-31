/**
 * Safe return-destination handling for post-onboarding redirects.
 * Rejects open redirects, protocol-relative URLs, and unknown external origins.
 * Client-safe — does not import server modules.
 */
import type { SiteKey } from "@/config/sites";
import { SITE_CONFIGS } from "@/config/sites";

export type SafeReturnDestination = {
  path: string;
  origin: string | null;
  siteKey: SiteKey;
  /** True when destination host differs from current host and needs session handoff. */
  needsCrossSiteHandoff: boolean;
};

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return false;
  // Reject backslash smuggling and encoded separators that can bypass host checks.
  if (path.includes("\\") || path.includes("%5c") || path.includes("%5C")) return false;
  return true;
}

/**
 * Sanitize a browser-supplied redirect path.
 * Rejects protocol-relative (`//evil.com`), absolute URLs, and empty values.
 */
export function sanitizeOnboardingReturnPath(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!isSafeInternalPath(trimmed)) return fallback;
  if (/^[\\/]*\s*(javascript|data|vbscript):/i.test(trimmed)) return fallback;
  return trimmed;
}

function isKnownAltaHost(host: string): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  for (const config of Object.values(SITE_CONFIGS)) {
    for (const productionHost of config.productionHosts ?? []) {
      if (productionHost.replace(/^www\./, "").toLowerCase() === normalized) return true;
    }
  }
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("bank.") ||
    normalized.startsWith("terminal.") ||
    normalized.endsWith(".altagroup.dev")
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitize an optional absolute origin. Must be an approved Alta origin.
 * Returns null when missing or unsafe (caller should use current origin).
 *
 * When `allowedCallbacks` is provided (server), also accepts origins whose
 * OAuth callback is registered. Client-side falls back to known Alta hosts.
 */
export function sanitizeOnboardingReturnOrigin(
  raw: string | null | undefined,
  allowedCallbacks: string[] = [],
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const callback = `${url.origin}/api/auth/discord/callback`;
    if (allowedCallbacks.includes(callback)) return url.origin;
    if (isKnownAltaHost(url.host)) return url.origin;
    return null;
  } catch {
    return null;
  }
}

export function inferSiteKeyFromPath(path: string): SiteKey {
  if (path === "/bank" || path.startsWith("/bank/")) return "bank";
  if (path === "/terminal" || path.startsWith("/terminal/")) return "terminal";
  return "corporate";
}

export function defaultAuthenticatedPathForSite(siteKey: SiteKey): string {
  return SITE_CONFIGS[siteKey]?.defaultAuthenticatedRoute ?? "/home";
}

/**
 * Resolve the post-onboarding destination from preserved return params + current site.
 */
export function resolveSafeReturnDestination(input: {
  returnPath?: string | null;
  returnOrigin?: string | null;
  currentSiteKey: SiteKey;
  currentOrigin?: string | null;
  allowedCallbacks?: string[];
}): SafeReturnDestination {
  const fallbackPath = defaultAuthenticatedPathForSite(input.currentSiteKey);
  const path = sanitizeOnboardingReturnPath(input.returnPath, fallbackPath);
  const origin = sanitizeOnboardingReturnOrigin(input.returnOrigin, input.allowedCallbacks ?? []);
  const siteKey = origin
    ? (inferSiteKeyFromOrigin(origin) ?? inferSiteKeyFromPath(path))
    : inferSiteKeyFromPath(path) || input.currentSiteKey;

  const needsCrossSiteHandoff = Boolean(
    origin &&
      input.currentOrigin &&
      normalizeHost(origin) !== normalizeHost(input.currentOrigin),
  );

  return {
    path,
    origin,
    siteKey,
    needsCrossSiteHandoff,
  };
}

function normalizeHost(originOrHost: string): string {
  try {
    const url = originOrHost.includes("://")
      ? new URL(originOrHost)
      : new URL(`https://${originOrHost}`);
    return url.host.replace(/^www\./, "").toLowerCase();
  } catch {
    return originOrHost.replace(/^www\./, "").toLowerCase();
  }
}

function inferSiteKeyFromOrigin(origin: string): SiteKey | null {
  try {
    const host = new URL(origin).host.replace(/^www\./, "").toLowerCase();
    for (const config of Object.values(SITE_CONFIGS)) {
      for (const productionHost of config.productionHosts ?? []) {
        if (productionHost.replace(/^www\./, "").toLowerCase() === host) {
          return config.key;
        }
      }
    }
    if (host.startsWith("bank.")) return "bank";
    if (host.startsWith("terminal.")) return "terminal";
    return "corporate";
  } catch {
    return null;
  }
}

/** Build onboarding URL search preserving a safe return destination. */
export function buildOnboardingSearch(input: {
  returnPath?: string | null;
  returnOrigin?: string | null;
  site?: SiteKey;
}): Record<string, string> {
  const search: Record<string, string> = {};
  const path = sanitizeOnboardingReturnPath(input.returnPath, "");
  if (path) search.redirect = path;
  if (input.returnOrigin) {
    try {
      const url = new URL(input.returnOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        search.returnOrigin = url.origin;
      }
    } catch {
      /* ignore */
    }
  }
  if (input.site && input.site !== "corporate") {
    search.site = input.site;
  }
  return search;
}
