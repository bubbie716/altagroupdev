/**
 * Terminal ops environment / TSE connection presentation.
 * Centralizes live · mock · unavailable · degraded labeling.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { resolveTerminalTseMode } from "@/lib/terminal/tse-client";
import type { TseDataSourceMode } from "@/lib/terminal/types";

export type TerminalOpsConnectionState = "live" | "mock" | "unavailable" | "degraded";

export type TerminalOpsEnvironmentStatus = {
  connectionState: TerminalOpsConnectionState;
  mode: TseDataSourceMode;
  label: string;
  detail: string;
  isDemonstration: boolean;
  marketDataTrustworthy: boolean;
  ordersMutable: boolean;
  adapterName: string;
  endpointHost: string | null;
  lastCheckedAt: string;
};

export function resolveTerminalOpsEnvironmentStatus(
  now = new Date(),
): TerminalOpsEnvironmentStatus {
  const mode = resolveTerminalTseMode();
  const uiLab = isUiLabMode();
  const lastCheckedAt = now.toISOString();

  if (uiLab || mode === "mock") {
    return {
      connectionState: "mock",
      mode: uiLab ? "mock" : mode,
      label: uiLab ? "UI Lab · demonstration" : "Mock market data",
      detail:
        "Demonstration data only. Not live market quotes. No real orders will be submitted.",
      isDemonstration: true,
      marketDataTrustworthy: false,
      // Mock/UI Lab never submit real (or pretend-live) order mutations.
      ordersMutable: false,
      adapterName: "MockTseClient",
      endpointHost: null,
      lastCheckedAt,
    };
  }

  if (mode === "live") {
    return {
      connectionState: "unavailable",
      mode: "live",
      label: "Live mode unavailable",
      detail:
        "Live TSE mode is configured, but the Newport TSE adapter is not implemented. Market data and order submission remain unavailable.",
      isDemonstration: false,
      marketDataTrustworthy: false,
      ordersMutable: false,
      adapterName: "UnavailableTseClient",
      endpointHost: safeEndpointHost(),
      lastCheckedAt,
    };
  }

  return {
    connectionState: "unavailable",
    mode: "unavailable",
    label: "TSE unavailable",
    detail:
      "Production Terminal uses an unavailable TSE client until a live Newport adapter is wired. Portfolio metadata may still be visible.",
    isDemonstration: false,
    marketDataTrustworthy: false,
    ordersMutable: false,
    adapterName: "UnavailableTseClient",
    endpointHost: safeEndpointHost(),
    lastCheckedAt,
  };
}

function safeEndpointHost(): string | null {
  const raw =
    (typeof process !== "undefined" && process.env.NEWPORT_TSE_URL) ||
    (typeof process !== "undefined" && process.env.VITE_NEWPORT_TSE_URL) ||
    "";
  if (!raw.trim()) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}
