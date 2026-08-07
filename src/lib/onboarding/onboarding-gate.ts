/**
 * Centralized onboarding route enforcement.
 * Authenticated users missing the currently required stage are redirected to /onboarding.
 */
import type { AltaUser } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";
import {
  meetsCurrentOnboardingRequirement,
  ONBOARDING_PATH,
  ONBOARDING_PHASE_CONFIG,
  type OnboardingPhaseConfig,
} from "@/lib/onboarding/onboarding-steps";
import { buildOnboardingSearch, sanitizeOnboardingReturnPath } from "@/lib/onboarding/safe-return";

/**
 * Paths reachable without completing onboarding.
 * Keep centralized — do not scatter allowlist checks across pages.
 */
const ONBOARDING_EXEMPT_EXACT = new Set([
  "/",
  "/login",
  "/onboarding",
  "/maintenance",
  "/access-restricted",
  "/status",
]);

const ONBOARDING_EXEMPT_PREFIXES = [
  "/onboarding",
  "/legal",
  "/support",
  "/api/auth/",
  "/api/",
  "/discord",
  // Static / public marketing that must remain reachable unsigned or mid-onboarding
  "/company",
  "/contact",
  "/docs",
  "/governance",
  "/structure",
  "/leadership",
  "/home", // marketing home — but authenticated users hitting /home will still be gated
] as const;

/**
 * Marketing/public paths that unauthenticated visitors may browse.
 * Authenticated users on these paths (except legal/support/status) are still gated
 * unless the path is explicitly mid-onboarding exempt.
 */
const AUTHENTICATED_ONBOARDING_EXEMPT_PREFIXES = [
  "/onboarding",
  "/legal",
  "/support",
  "/api/",
  "/discord",
  "/status",
  "/maintenance",
  "/access-restricted",
  "/accounting",
] as const;

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

export function isOnboardingExemptPath(pathname: string, authenticated: boolean): boolean {
  const path = normalizePathname(pathname);

  if (ONBOARDING_EXEMPT_EXACT.has(path)) {
    // `/` and `/login` and marketing homes: unauthenticated OK;
    // authenticated users on `/` (sign-in page) should not loop — allow.
    if (path === "/" || path === "/login") return true;
    if (!authenticated) return true;
  }

  if (!authenticated) {
    // Unauthenticated: do not gate marketing pages at all.
    return true;
  }

  // Authenticated: only allowlisted mid-onboarding paths.
  if (ONBOARDING_EXEMPT_EXACT.has(path) && path !== "/home") {
    // /home is corporate marketing default — authenticated users without onboarding
    // should still be redirected to complete onboarding before using the product.
    // Exception: keep /home exempt only if we treat it as public marketing.
    // Spec: "Do not interfere with unauthenticated marketing pages."
    // Authenticated users requesting product destinations must be gated.
    if (path === "/maintenance" || path === "/access-restricted" || path === "/status") {
      return true;
    }
    if (path === "/onboarding") return true;
  }

  return AUTHENTICATED_ONBOARDING_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix),
  );
}

/**
 * Whether an authenticated user must be redirected to /onboarding.
 */
export function shouldEnforceOnboarding(
  user: AltaUser | null,
  pathname: string,
  config: OnboardingPhaseConfig = ONBOARDING_PHASE_CONFIG,
): boolean {
  if (!user) return false;
  if (isOnboardingExemptPath(pathname, true)) return false;
  return !meetsCurrentOnboardingRequirement(user, config);
}

export type OnboardingRedirect = {
  to: typeof ONBOARDING_PATH;
  search: Record<string, string>;
};

/**
 * Build a safe redirect to /onboarding preserving the originally requested destination.
 */
export function buildOnboardingRedirect(input: {
  pathname: string;
  searchStr?: string;
  siteKey: SiteKey;
  returnOrigin?: string | null;
}): OnboardingRedirect {
  const safePath = sanitizeOnboardingReturnPath(input.pathname, "/");
  // Don't preserve /onboarding itself as the return path.
  const returnPath =
    safePath === ONBOARDING_PATH || safePath.startsWith(`${ONBOARDING_PATH}/`)
      ? undefined
      : safePath === "/"
        ? undefined
        : safePath;

  return {
    to: ONBOARDING_PATH,
    search: buildOnboardingSearch({
      returnPath,
      returnOrigin: input.returnOrigin,
      site: input.siteKey,
    }),
  };
}

/** Re-export for tests / shared use. */
export { ONBOARDING_EXEMPT_PREFIXES, AUTHENTICATED_ONBOARDING_EXEMPT_PREFIXES };
