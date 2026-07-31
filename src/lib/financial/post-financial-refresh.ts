/**
 * Shared post-financial-mutation refresh.
 * Invalidates authoritative TanStack Router loaders after a successful commit.
 * Never resubmits mutations; refresh failure must not flip success → failure.
 */
import type { AnyRouter } from "@tanstack/react-router";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export type FinancialRefreshStatus =
  | "idle"
  | "refreshing"
  | "updated"
  | "failed";

export type FinancialRefreshScope =
  | "bank"
  | "terminal"
  | "bank-terminal"
  | "lending"
  | "alta-card"
  | "all";

export type PostFinancialRefreshResult = {
  ok: boolean;
  status: Exclude<FinancialRefreshStatus, "idle" | "refreshing">;
  error?: unknown;
};

const FINANCIAL_ROUTE_PREFIXES = [
  "/bank",
  "/terminal",
  "/internal/bank",
  "/internal/terminal",
  "/internal/lending",
  "/internal/alta-card",
  "/internal/inbox",
] as const;

function matchPathname(pathname: string | undefined, prefixes: readonly string[]): boolean {
  if (!pathname) return false;
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function scopePrefixes(scope: FinancialRefreshScope): readonly string[] {
  switch (scope) {
    case "bank":
      return ["/bank", "/internal/bank", "/internal/inbox"];
    case "terminal":
      return ["/terminal", "/internal/terminal"];
    case "bank-terminal":
      return ["/bank", "/terminal", "/internal/bank", "/internal/terminal", "/internal/inbox"];
    case "lending":
      return ["/bank/lending", "/bank", "/internal/lending", "/internal/inbox"];
    case "alta-card":
      return ["/bank/alta-card", "/bank", "/internal/alta-card", "/internal/inbox"];
    case "all":
    default:
      return FINANCIAL_ROUTE_PREFIXES;
  }
}

function shouldClearCachedMatch(
  match: { pathname?: string; routeId?: string },
  prefixes: readonly string[],
): boolean {
  if (match.routeId === "__root__") return false;
  return matchPathname(match.pathname, prefixes);
}

/** In-flight dedupe keyed by router identity + scope. */
const inflight = new WeakMap<object, Map<string, Promise<PostFinancialRefreshResult>>>();

function logRefreshFailure(scope: FinancialRefreshScope, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[financial-refresh] post-commit route refresh failed", {
    scope,
    message,
  });
}

/**
 * Clear cached financial route data, then re-run active non-root loaders.
 * Safe to call concurrently — identical scope requests share one promise.
 */
export async function refreshFinancialRouteData(
  router: AnyRouter,
  scope: FinancialRefreshScope = "all",
): Promise<PostFinancialRefreshResult> {
  const key = scope;
  let byScope = inflight.get(router);
  if (!byScope) {
    byScope = new Map();
    inflight.set(router, byScope);
  }
  const existing = byScope.get(key);
  if (existing) return existing;

  const run = (async (): Promise<PostFinancialRefreshResult> => {
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

/** True when a success path must not treat refresh failure as transaction failure. */
export function isRefreshFailureSoft(result: PostFinancialRefreshResult): boolean {
  return !result.ok;
}

export function financialRefreshCopy(
  status: FinancialRefreshStatus,
): { live: string; visible: string | null } {
  switch (status) {
    case "refreshing":
      return {
        live: "Updating balances.",
        visible: "Updating balances…",
      };
    case "updated":
      return {
        live: "Balances updated.",
        visible: "Balances updated.",
      };
    case "failed":
      return {
        live: "Transfer completed. Updated balances may take a moment to appear.",
        visible: "Transfer completed. Updated balances may take a moment to appear.",
      };
    default:
      return { live: "", visible: null };
  }
}
