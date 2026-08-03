/**
 * Shared post-mutation route refresh.
 * Invalidates authoritative TanStack Router loaders after a successful commit.
 * Never resubmits mutations; refresh failure must not flip success → failure.
 *
 * Prefer this over raw `router.invalidate()` for state-changing actions so
 * scoped cache clearing, root-loader preservation, and concurrent dedupe apply.
 */
import type { AnyRouter } from "@tanstack/react-router";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export type MutationRefreshStatus =
  | "idle"
  | "refreshing"
  | "updated"
  | "failed";

export type MutationRefreshScope =
  | "bank"
  | "terminal"
  | "corporate"
  | "internal"
  | "bank-terminal"
  | "lending"
  | "alta-card"
  | "all";

export type PostMutationRefreshResult = {
  ok: boolean;
  status: Exclude<MutationRefreshStatus, "idle" | "refreshing">;
  error?: unknown;
};

/** All known product route prefixes touched by mutation refresh. */
export const MUTATION_ROUTE_PREFIXES = [
  "/bank",
  "/terminal",
  "/companies",
  "/internal/bank",
  "/internal/terminal",
  "/internal/lending",
  "/internal/alta-card",
  "/internal/inbox",
  "/internal",
  "/onboarding",
] as const;

export function matchPathname(
  pathname: string | undefined,
  prefixes: readonly string[],
): boolean {
  if (!pathname) return false;
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Map a refresh scope to route pathname prefixes used for cache clearing.
 * Active non-root loaders are always revalidated via `invalidateRouteData`.
 */
export function scopePrefixes(scope: MutationRefreshScope): readonly string[] {
  switch (scope) {
    case "bank":
      return ["/bank", "/internal/bank", "/internal/inbox"];
    case "terminal":
      return ["/terminal", "/internal/terminal"];
    case "corporate":
      return [
        "/companies",
        "/bank",
        "/internal/bank",
        "/internal/inbox",
        "/internal",
      ];
    case "internal":
      return ["/internal", "/bank", "/terminal", "/companies", "/onboarding"];
    case "bank-terminal":
      return [
        "/bank",
        "/terminal",
        "/internal/bank",
        "/internal/terminal",
        "/internal/inbox",
      ];
    case "lending":
      return ["/bank/lending", "/bank", "/internal/lending", "/internal/inbox"];
    case "alta-card":
      return ["/bank/alta-card", "/bank", "/internal/alta-card", "/internal/inbox"];
    case "all":
    default:
      return MUTATION_ROUTE_PREFIXES;
  }
}

export function shouldClearCachedMatch(
  match: { pathname?: string; routeId?: string },
  prefixes: readonly string[],
): boolean {
  if (match.routeId === "__root__") return false;
  return matchPathname(match.pathname, prefixes);
}

/** In-flight dedupe keyed by router identity + scope. */
const inflight = new WeakMap<object, Map<string, Promise<PostMutationRefreshResult>>>();

function logRefreshFailure(scope: MutationRefreshScope, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[mutation-refresh] post-commit route refresh failed", {
    scope,
    message,
  });
}

/**
 * Clear cached route data for the scope, then re-run active non-root loaders.
 * Safe to call concurrently — identical scope requests share one promise.
 * Preserves URL/search/hash; never resubmits the original mutation.
 */
export async function refreshMutationRouteData(
  router: AnyRouter,
  scope: MutationRefreshScope = "all",
): Promise<PostMutationRefreshResult> {
  const key = scope;
  let byScope = inflight.get(router);
  if (!byScope) {
    byScope = new Map();
    inflight.set(router, byScope);
  }
  const existing = byScope.get(key);
  if (existing) return existing;

  const run = (async (): Promise<PostMutationRefreshResult> => {
    try {
      const prefixes = scopePrefixes(scope);
      try {
        router.clearCache({
          filter: (match) => shouldClearCachedMatch(match, prefixes),
        });
      } catch {
        // clearCache is best-effort; active invalidate still proceeds.
      }
      await invalidateRouteData(router);
      return { ok: true, status: "updated" };
    } catch (error) {
      logRefreshFailure(scope, error);
      return { ok: false, status: "failed", error };
    } finally {
      byScope?.delete(key);
    }
  })();

  byScope.set(key, run);
  return run;
}

/** True when a success path must not treat refresh failure as mutation failure. */
export function isRefreshFailureSoft(result: PostMutationRefreshResult): boolean {
  return !result.ok;
}

/**
 * Accessible + visible copy for process-state refresh status.
 * Failure copy keeps the mutation framed as completed.
 */
export function mutationRefreshCopy(
  status: MutationRefreshStatus,
): { live: string; visible: string | null } {
  switch (status) {
    case "refreshing":
      return {
        live: "Updating.",
        visible: "Updating…",
      };
    case "updated":
      return {
        live: "Updated.",
        visible: "Updated.",
      };
    case "failed":
      return {
        live: "The action completed. Updated information may take a moment to appear.",
        visible: "The action completed. Updated information may take a moment to appear.",
      };
    default:
      return { live: "", visible: null };
  }
}
