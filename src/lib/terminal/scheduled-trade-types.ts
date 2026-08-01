export type ScheduledTradeScheduleType = "one_time" | "recurring";
export type ScheduledTradeFrequency = "weekly" | "biweekly" | "monthly";
export type ScheduledTradeStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "ended";
export type ScheduledTradeOccurrenceStatus =
  | "pending"
  | "processing"
  | "submitted"
  | "skipped"
  | "failed";

export type ScheduledTradeFailureCategory =
  | "none"
  | "insufficient_buying_power"
  | "insufficient_holdings"
  | "market_unavailable"
  | "tse_unavailable"
  | "consent_required"
  | "portfolio_archived"
  | "portfolio_restricted"
  | "symbol_unavailable"
  | "validation_failed"
  | "authorization_failed"
  | "transient_error"
  | "crypto_unavailable"
  | "asset_halted"
  | "redemption_only"
  | "price_impact_too_high"
  | "crypto_consent_required"
  | "wallet_frozen"
  | "requote_required"
  | "other";

export type ScheduledTradeInstrumentKind = "STOCK" | "CRYPTO";
export type ScheduledTradeSizingMode = "QUANTITY" | "FLORIN_AMOUNT";

export type CreateScheduledTradeInput = {
  portfolioId: string;
  symbol: string;
  side: "buy" | "sell";
  /**
   * Stock: whole-share quantity (always).
   * Crypto: omit / 0 — use florinAmount instead.
   */
  quantity: number;
  /** Crypto buy and sell — gross florins. Ignored for stock. */
  florinAmount?: number | null;
  /** Optional override; inferred from symbol when omitted. */
  instrumentKind?: ScheduledTradeInstrumentKind;
  /**
   * Crypto → FLORIN_AMOUNT; stock → QUANTITY.
   * Inferred when omitted.
   */
  sizingMode?: ScheduledTradeSizingMode;
  /** Automated crypto ceiling; default 10. Stock ignored. */
  maxPriceImpactPercent?: number;
  scheduleType: ScheduledTradeScheduleType;
  frequency?: ScheduledTradeFrequency | null;
  startAt: string;
  endAt?: string | null;
};

export type ScheduledTradePreviewInput = CreateScheduledTradeInput;

export type ScheduledTradePreviewResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  portfolioId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  florinAmount: number | null;
  instrumentKind: ScheduledTradeInstrumentKind;
  sizingMode: ScheduledTradeSizingMode;
  maxPriceImpactPercent: number;
  scheduleType: ScheduledTradeScheduleType;
  frequency: ScheduledTradeFrequency | null;
  startAt: string;
  endAt: string | null;
  nextRunAt: string | null;
  estimatedValue: number | null;
  estimatedFees: number | null;
};

export type ScheduledTradeInstructionRow = {
  id: string;
  portfolioId: string;
  portfolioName: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  florinAmount: number | null;
  instrumentKind: ScheduledTradeInstrumentKind;
  sizingMode: ScheduledTradeSizingMode;
  maxPriceImpactPercent: number;
  scheduleType: ScheduledTradeScheduleType;
  frequency: ScheduledTradeFrequency | null;
  startAt: string;
  nextRunAt: string | null;
  endAt: string | null;
  status: ScheduledTradeStatus;
  consecutiveFailures: number;
  lastFailureSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledTradeDetail = ScheduledTradeInstructionRow & {
  orderType: "market";
  timeZonePolicy: string;
  lastAttemptAt: string | null;
  lastAttemptStatus: ScheduledTradeOccurrenceStatus | null;
  lastFailureCategory: ScheduledTradeFailureCategory | null;
  lastSubmittedOrderId: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  endedAt: string | null;
  recentOccurrences: ScheduledTradeOccurrenceRow[];
};

export type ScheduledTradeOccurrenceRow = {
  id: string;
  instructionId: string;
  scheduledRunAt: string;
  status: ScheduledTradeOccurrenceStatus;
  attemptCount: number;
  terminalOrderId: string | null;
  failureCategory: ScheduledTradeFailureCategory | null;
  customerFailureSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
};
