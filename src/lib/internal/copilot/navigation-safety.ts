/**
 * Validate and normalize Admin Copilot navigation intents.
 * Rejects external URLs and non-canonical destinations.
 */
import type { SiteKey } from "@/config/sites";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { parseInternalSearchHref } from "@/lib/internal/navigate-internal-search-href";
import { isInternalPathAllowedForUser } from "@/lib/internal/entity-internal-scope";
import type { AltaUser } from "@/lib/auth/types";
import type { AdminCopilotNavigationIntent } from "@/lib/internal/copilot/types";

const BLOCKED_SCHEMES = /^(https?:|javascript:|data:|mailto:|file:)/i;

export function isCanonicalInternalPath(to: string): boolean {
  const path = to.trim();
  if (!path.startsWith("/internal")) return false;
  if (path.includes("://")) return false;
  if (BLOCKED_SCHEMES.test(path)) return false;
  if (path.includes("\\") || path.includes("..")) return false;
  return true;
}

/**
 * Map an internal destination to the site panel that is allowed to host it.
 * Corporate cannot open lending/bank/card paths with `?site=corporate` — those
 * require the bank panel (and similarly for terminal).
 */
export function resolveSiteKeyForInternalDestination(
  pathname: string,
  requestedSite: string,
): SiteKey {
  const path = pathname.replace(/\/$/, "") || "/";
  const requested = (
    requestedSite === "bank" ||
    requestedSite === "terminal" ||
    requestedSite === "exchange" ||
    requestedSite === "corporate"
      ? requestedSite
      : "corporate"
  ) as SiteKey;

  if (
    path.startsWith("/internal/lending") ||
    path.startsWith("/internal/bank") ||
    path.startsWith("/internal/alta-card") ||
    path.startsWith("/internal/queues")
  ) {
    return "bank";
  }
  if (path.startsWith("/internal/terminal")) return "terminal";
  if (path.startsWith("/internal/exchange")) return "exchange";
  if (
    path === "/internal/settings" ||
    path.startsWith("/internal/settings/") ||
    path.startsWith("/internal/compliance")
  ) {
    return "corporate";
  }

  if (isInternalPathAllowedForUser(requested, path, null)) {
    return requested;
  }
  for (const candidate of ["bank", "corporate", "terminal"] as const) {
    if (isInternalPathAllowedForUser(candidate, path, null)) return candidate;
  }
  return requested;
}

/**
 * Build a safe navigation intent from a known-good internal href.
 * Returns null when the href is external, malformed, or not /internal.
 */
export function createSafeNavigationIntent(input: {
  href: string;
  siteKey: string;
  reason: string;
  entityType: string;
  entityId: string;
  from?: string | null;
  section?: string;
}): AdminCopilotNavigationIntent | null {
  if (BLOCKED_SCHEMES.test(input.href.trim())) return null;

  const parsed = parseInternalSearchHref(input.href, input.siteKey);
  if (!parsed) return null;
  if (!isCanonicalInternalPath(parsed.to)) return null;

  const siteKey = resolveSiteKeyForInternalDestination(parsed.to, input.siteKey);

  const search: Record<string, string> = { ...parsed.search };
  if (input.section) search.section = input.section;
  if (input.from && typeof input.from === "string" && input.from.startsWith("/internal")) {
    search.from = input.from;
  }

  const withSiteRaw = withInternalSiteSearch(search, siteKey);
  const withSite: Record<string, string> = {};
  for (const [k, v] of Object.entries(withSiteRaw)) {
    if (v == null) continue;
    withSite[k] = String(v);
  }

  return {
    kind: "navigate",
    to: parsed.to,
    search: withSite,
    reason: input.reason,
    entityType: input.entityType,
    entityId: input.entityId,
  };
}

/**
 * Validate a model- or tool-produced navigation intent before the client navigates.
 */
export function validateNavigationIntent(
  intent: AdminCopilotNavigationIntent,
  opts: { siteKey: SiteKey; user: AltaUser | null },
): { ok: true; intent: AdminCopilotNavigationIntent } | { ok: false; reason: string } {
  if (intent.kind !== "navigate") {
    return { ok: false, reason: "Not a navigation intent." };
  }
  if (!isCanonicalInternalPath(intent.to)) {
    return { ok: false, reason: "Destination must be a canonical /internal path." };
  }
  if (BLOCKED_SCHEMES.test(intent.to) || Object.values(intent.search).some((v) => typeof v === "string" && BLOCKED_SCHEMES.test(v))) {
    return { ok: false, reason: "External URLs are not allowed." };
  }

  const siteKey = resolveSiteKeyForInternalDestination(intent.to, opts.siteKey);

  try {
    if (!isInternalPathAllowedForUser(siteKey, intent.to, opts.user)) {
      return { ok: false, reason: "You do not have access to that internal destination." };
    }
  } catch {
    return { ok: false, reason: "Destination is not permitted for this site." };
  }

  const searchRaw = withInternalSiteSearch(
    { ...intent.search },
    siteKey,
  );
  const search: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchRaw)) {
    if (v == null) continue;
    search[k] = String(v);
  }

  return {
    ok: true,
    intent: {
      ...intent,
      to: intent.to.replace(/\/$/, "") || intent.to,
      search,
    },
  };
}

/** Prefer evidence section for deal-room / lending application thread links. */
export function canonicalizeDealRoomHref(href: string): string {
  const threadMatch = href.match(
    /^\/internal\/lending\/applications\/([^/?#]+)\/thread\/?$/i,
  );
  if (threadMatch) {
    return `/internal/lending/applications/${threadMatch[1]}?section=evidence`;
  }
  const appMatch = href.match(/^\/internal\/lending\/applications\/([^/?#]+)\/?$/i);
  if (appMatch && !href.includes("section=")) {
    return `/internal/lending/applications/${appMatch[1]}?section=evidence`;
  }
  return href;
}
