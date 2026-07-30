/**
 * Resolve Terminal TSE data-source mode.
 * - `unavailable`: honest offline state; orders disabled (default for all environments)
 * - `live`: reserved for future NewportTseClient (fails closed to unavailable until wired)
 * - `mock`: not a normal runtime mode — rejected unless an explicit test/UI Lab path opts in
 *
 * Control via server-only `TERMINAL_TSE_MODE`. Do not rely on `VITE_TERMINAL_TSE_MODE`
 * for server behavior (kept only as a deprecated fallback read during cleanup).
 */
import type { TseClient, TseClientContext, TseDataSourceMode } from "@/lib/terminal/types";
import { UnavailableTseClient } from "@/lib/terminal/unavailable-tse-client";

export function resolveTerminalTseMode(): TseDataSourceMode {
  const raw =
    (typeof process !== "undefined" && process.env.TERMINAL_TSE_MODE) ||
    (typeof process !== "undefined" && process.env.VITE_TERMINAL_TSE_MODE) ||
    "";

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "unavailable" || normalized === "live") {
    return normalized;
  }
  // Explicit `mock` is ignored for normal runtime — fail closed to unavailable.
  // UI Lab demonstration data is gated separately via isUiLabMode().
  return "unavailable";
}

const scopedClients = new Map<string, TseClient>();

export function createTseClient(
  _context: TseClientContext = { userId: "anonymous" },
  mode = resolveTerminalTseMode(),
): TseClient {
  // Live Newport TSE client is not implemented yet — fail closed.
  void mode;
  return new UnavailableTseClient();
}

/**
 * Account-scoped market client. Until Newport is wired this always returns
 * UnavailableTseClient regardless of TERMINAL_TSE_MODE=live.
 */
export function getTseClient(context: TseClientContext): TseClient {
  const mode = resolveTerminalTseMode();
  const key = `${mode}:${context.userId}`;
  let client = scopedClients.get(key);
  if (!client) {
    client = createTseClient(context, mode);
    scopedClients.set(key, client);
  }
  return client;
}

/** Test helper — clear all account-scoped clients between cases. */
export function resetTseClientForTests() {
  scopedClients.clear();
}

/**
 * Future connection point:
 * ```
 * class NewportTseClient implements TseClient {
 *   constructor(url: string, context: TseClientContext) {}
 * }
 * export function createTseClient(context: TseClientContext) {
 *   if (mode === "live") return new NewportTseClient(process.env.NEWPORT_TSE_URL!, context);
 *   ...
 * }
 * ```
 */
export type FutureNewportTseClient = TseClient;
