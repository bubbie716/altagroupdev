import type { TseClient, TseClientContext, TseDataSourceMode } from "@/lib/terminal/types";
import { MockTseClient } from "@/lib/terminal/mock-tse-client";
import { UnavailableTseClient } from "@/lib/terminal/unavailable-tse-client";

/**
 * Resolve Terminal data-source mode.
 * - `mock`: deterministic fixtures (development default)
 * - `unavailable`: polished offline state; orders disabled (production default)
 * - `live`: reserved for future NewportTseClient (falls back to unavailable until wired)
 *
 * Control via `TERMINAL_TSE_MODE` or `VITE_TERMINAL_TSE_MODE`.
 */
export function resolveTerminalTseMode(): TseDataSourceMode {
  const raw =
    (typeof process !== "undefined" && process.env.TERMINAL_TSE_MODE) ||
    (typeof process !== "undefined" && process.env.VITE_TERMINAL_TSE_MODE) ||
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TERMINAL_TSE_MODE) ||
    "";

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "mock" || normalized === "unavailable" || normalized === "live") {
    return normalized;
  }

  const isProd =
    (typeof process !== "undefined" && process.env.NODE_ENV === "production") ||
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: { PROD?: boolean; DEV?: boolean; MODE?: string } }).env
        ?.PROD === true);

  return isProd ? "unavailable" : "mock";
}

const scopedClients = new Map<string, TseClient>();

export function createTseClient(
  context: TseClientContext = { userId: "terminal-demo-user" },
  mode = resolveTerminalTseMode(),
): TseClient {
  if (mode === "mock") return new MockTseClient(context);
  // Live Newport TSE client is not implemented yet.
  return new UnavailableTseClient();
}

/**
 * Account-scoped client. Mock mutations survive across server functions without
 * leaking watchlists, cash, or orders into another authenticated user session.
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
