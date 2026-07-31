import type {
  ScheduledTradeFailureCategory,
  ScheduledTradeFrequency,
} from "@/lib/terminal/scheduled-trade-types";

const SCHEDULED_TRADE_FREQUENCY_LABELS: Record<ScheduledTradeFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
};

export function scheduledTradeFrequencyLabel(
  frequency: ScheduledTradeFrequency | null,
): string {
  return frequency ? SCHEDULED_TRADE_FREQUENCY_LABELS[frequency] : "—";
}

const CRYPTO_FAILURE_COPY: Partial<Record<ScheduledTradeFailureCategory, string>> = {
  crypto_unavailable: "Crypto trading is currently unavailable for this asset.",
  asset_halted: "Trading is halted for this crypto asset.",
  redemption_only: "Purchases are disabled — this asset is redemption-only.",
  price_impact_too_high:
    "This attempt was skipped because the estimated price impact exceeded the 10% limit.",
  crypto_consent_required: "Terminal and crypto trading consent is required.",
  wallet_frozen: "This portfolio’s crypto wallet is frozen.",
  requote_required: "Market conditions changed — this attempt could not be completed.",
  insufficient_buying_power: "Insufficient cash for this crypto purchase.",
  insufficient_holdings: "Insufficient crypto holdings for this sell.",
};

/** Customer-safe failure summary; prefer stored summary, else category copy. */
export function scheduledTradeFailureCopy(
  category: ScheduledTradeFailureCategory | null | undefined,
  storedSummary?: string | null,
): string {
  if (storedSummary?.trim()) return storedSummary.trim();
  if (!category || category === "none") return "This scheduled trade could not be completed.";
  return CRYPTO_FAILURE_COPY[category] ?? "This scheduled trade could not be completed.";
}
