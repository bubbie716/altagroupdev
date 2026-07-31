/**
 * Terminal ops environment / TSE connection presentation.
 * Centralizes live · UI Lab demonstration · unavailable · degraded labeling.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { resolveTerminalTseMode } from "@/lib/terminal/tse-client";
import type { TseDataSourceMode } from "@/lib/terminal/types";

export type TerminalOpsConnectionState = "live" | "mock" | "unavailable" | "degraded";

export type TerminalOpsCryptoMarketsStatus = "not_activated" | "draft" | "demonstration";

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
  /** Phase 3 — informational only. No activate/halt controls. */
  cryptoMarketsStatus: TerminalOpsCryptoMarketsStatus;
  cryptoMarketsLabel: string;
  cryptoMarketsDetail: string;
};

export function resolveTerminalOpsEnvironmentStatus(
  now = new Date(),
): TerminalOpsEnvironmentStatus {
  const mode = resolveTerminalTseMode();
  const uiLab = isUiLabMode();
  const lastCheckedAt = now.toISOString();

  const crypto = uiLab
    ? {
        cryptoMarketsStatus: "demonstration" as const,
        cryptoMarketsLabel: "Crypto markets · demonstration",
        cryptoMarketsDetail:
          "UI Lab demonstration crypto only. Production assets remain DRAFT / not activated. No admin activate controls in this view.",
      }
    : {
        cryptoMarketsStatus: "not_activated" as const,
        cryptoMarketsLabel: "Crypto markets · Not activated",
        cryptoMarketsDetail:
          "Alta Crypto assets remain DRAFT until Phase 4 activation. Customer production trading is unavailable. No activate, halt, or reserve controls here.",
      };

  if (uiLab) {
    return {
      connectionState: "mock",
      mode: "mock",
      label: "UI Lab · demonstration",
      detail: "Demonstration data only. Not live market quotes. No real orders will be submitted.",
      isDemonstration: true,
      marketDataTrustworthy: false,
      // Mock/UI Lab never submit real (or pretend-live) order mutations.
      ordersMutable: false,
      adapterName: "UiLabDemonstrationTseClient",
      endpointHost: null,
      lastCheckedAt,
      ...crypto,
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
      ...crypto,
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
    ...crypto,
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
