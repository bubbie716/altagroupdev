/**
 * Authoritative crypto status presentation for customer + internal surfaces.
 * Distinguishes lifecycle, trading availability, market visibility, and UI Lab demo framing
 * without changing production lifecycle semantics.
 */

export type CryptoStatusSurface = "customer" | "ops" | "system";

export type CryptoStatusPresentation = {
  /** Lifecycle status from the asset record / fixture. */
  lifecycleStatus: string;
  /** Short label shown as the primary status pill. */
  statusLabel: string;
  /** Trading / market context line. */
  tradingContextLabel: string;
  /** Whether customer markets should list the asset. */
  marketVisible: boolean;
  /** Whether buys are currently available. */
  canBuy: boolean;
  /** Whether sells/redemptions are currently available. */
  canSell: boolean;
  /** Whether operators may mutate lifecycle (always false in UI Lab). */
  administrativelyMutable: boolean;
  /** Explicit demonstration framing when in UI Lab. */
  demonstrationLabel: string | null;
  /** Operator note when mutations are blocked. */
  operationsNote: string | null;
};

function tradingCapabilities(status: string): { canBuy: boolean; canSell: boolean } {
  return {
    canBuy: status === "ACTIVE",
    canSell: status === "ACTIVE" || status === "REDEMPTION_ONLY",
  };
}

function lifecycleStatusLabel(status: string, surface: CryptoStatusSurface): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "REDEMPTION_ONLY":
      return "Redemption only";
    case "HALTED":
      return "Trading halted";
    case "CLOSED":
      return "Closed";
    case "DRAFT":
      return surface === "customer" ? "Unavailable" : "Draft";
    default:
      return surface === "customer" ? "Unavailable" : status;
  }
}

function tradingContextForStatus(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Crypto · 24/7";
    case "REDEMPTION_ONLY":
      return "Purchases disabled — redemptions only";
    case "HALTED":
      return "Trading temporarily halted";
    case "CLOSED":
      return "Asset closed — no new trades";
    case "DRAFT":
      return "Crypto · unavailable";
    default:
      return "Crypto · unavailable";
  }
}

/**
 * Build a single presentation model for NPFC/NVA/VLT (and future assets).
 * In UI Lab, prefer explicit demonstration copy over contradictory bare Active/Draft labels.
 */
export function presentCryptoAssetStatus(input: {
  status: string;
  surface: CryptoStatusSurface;
  uiLab?: boolean;
}): CryptoStatusPresentation {
  const status = String(input.status);
  const uiLab = Boolean(input.uiLab);
  const caps = tradingCapabilities(status);
  const baseLabel = lifecycleStatusLabel(status, input.surface);

  if (uiLab) {
    const isTradeableLifecycle =
      status === "ACTIVE" || status === "HALTED" || status === "REDEMPTION_ONLY";
    // Same understandable label family on customer + ops: lifecycle + Demonstration.
    const statusLabel = isTradeableLifecycle
      ? `${baseLabel} · Demonstration`
      : "Demonstration market";
    return {
      lifecycleStatus: status,
      statusLabel,
      tradingContextLabel: isTradeableLifecycle
        ? tradingContextForStatus(status)
        : "Demonstration market — not live",
      marketVisible: status !== "DRAFT" && status !== "CLOSED",
      canBuy: caps.canBuy,
      canSell: caps.canSell,
      administrativelyMutable: false,
      demonstrationLabel: "Demonstration market",
      operationsNote: "Operations disabled in UI Lab",
    };
  }

  return {
    lifecycleStatus: status,
    statusLabel: baseLabel,
    tradingContextLabel: tradingContextForStatus(status),
    marketVisible: status !== "DRAFT" && status !== "CLOSED",
    canBuy: caps.canBuy,
    canSell: caps.canSell,
    administrativelyMutable: true,
    demonstrationLabel: null,
    operationsNote: null,
  };
}

/** Aggregate System-page label for a set of asset statuses (UI Lab aware). */
export function presentCryptoSystemAggregate(input: {
  statuses: string[];
  openCritical?: number;
  uiLab?: boolean;
}): { statusLabel: string; detail: string; available: boolean } {
  const statuses = input.statuses;
  if (statuses.length === 0) {
    return {
      available: false,
      statusLabel: input.uiLab ? "Demonstration market" : "Not configured",
      detail: input.uiLab
        ? "Demonstration crypto markets — operations disabled in UI Lab."
        : "Fictional Alta Crypto schema/state is not available yet.",
    };
  }

  if ((input.openCritical ?? 0) > 0) {
    return {
      available: true,
      statusLabel: "Critical issue",
      detail: `${input.openCritical} unresolved critical reconciliation issue(s). Review Crypto markets.`,
    };
  }

  const set = new Set(statuses);
  if (input.uiLab) {
    if (set.has("ACTIVE") || set.has("HALTED") || set.has("REDEMPTION_ONLY")) {
      return {
        available: true,
        statusLabel: "Demonstration market",
        detail:
          "UI Lab demonstration markets. Operations disabled in UI Lab — not production lifecycle.",
      };
    }
    return {
      available: false,
      statusLabel: "Demonstration market",
      detail: "Demonstration assets are not activated for live operations in UI Lab.",
    };
  }

  if (set.has("ACTIVE")) {
    return {
      available: true,
      statusLabel: "Active",
      detail: "One or more fictional crypto assets are ACTIVE for trading.",
    };
  }
  if (set.has("HALTED") && !set.has("ACTIVE") && !set.has("REDEMPTION_ONLY")) {
    return {
      available: true,
      statusLabel: "Halted",
      detail: "One or more assets are halted. New trades are blocked until Corporate admin resume.",
    };
  }
  if (set.has("REDEMPTION_ONLY") && !set.has("ACTIVE")) {
    return {
      available: true,
      statusLabel: "Redemption only",
      detail: "Assets accept redemptions only — purchases disabled.",
    };
  }
  if (statuses.every((s) => s === "CLOSED")) {
    return {
      available: false,
      statusLabel: "Closed",
      detail: "All crypto assets are closed.",
    };
  }
  return {
    available: false,
    statusLabel: "Draft",
    detail:
      "Assets remain DRAFT until a Corporate admin activates them after migration and staging checks.",
  };
}
