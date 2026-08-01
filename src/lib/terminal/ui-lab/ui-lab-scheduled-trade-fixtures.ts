/**
 * UI Lab demonstration fixtures for Terminal scheduled trades.
 * In-memory only — never writes production Prisma rows.
 */
import type { BankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import { UI_LAB_TERMINAL_PORTFOLIO_IDS } from "@/lib/terminal/ui-lab/ui-lab-terminal-canonical-ids";
import type {
  CreateScheduledTradeInput,
  ScheduledTradeDetail,
  ScheduledTradeInstructionRow,
  ScheduledTradePreviewResult,
} from "@/lib/terminal/scheduled-trade-types";

export const UI_LAB_SCHEDULED_TRADE_IDS = {
  recurringActive: "TST-LAB-RECURRING",
  oneTimeUpcoming: "TST-LAB-ONE-TIME",
  weeklyBuy: "TST-LAB-WEEKLY-BUY",
  monthlySell: "TST-LAB-MONTHLY-SELL",
  paused: "TST-LAB-PAUSED",
  completed: "TST-LAB-COMPLETED",
  cancelled: "TST-LAB-CANCELLED",
  ended: "TST-LAB-ENDED",
  dueSoon: "TST-LAB-DUE-SOON",
  marketUnavailable: "TST-LAB-MARKET-UNAVAILABLE",
  tseUnavailable: "TST-LAB-TSE-UNAVAILABLE",
  insufficientBuyingPower: "TST-LAB-INSUFFICIENT-BP",
  insufficientHoldings: "TST-LAB-INSUFFICIENT-HOLDINGS",
  archivedPortfolio: "TST-LAB-ARCHIVED",
  restrictedAuthority: "TST-LAB-RESTRICTED",
  consentRequired: "TST-LAB-CONSENT",
  orderSubmitted: "TST-LAB-SUBMITTED",
  concurrencyDuplicate: "TST-LAB-CONCURRENCY",
} as const;

const now = Date.now();
const hour = 3_600_000;
const day = 86_400_000;

function baseRow(
  partial: Partial<ScheduledTradeInstructionRow> & Pick<ScheduledTradeInstructionRow, "id" | "status" | "scheduleType">,
): ScheduledTradeInstructionRow {
  return {
    portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
    portfolioName: "Core Portfolio",
    symbol: "ALTG",
    side: "buy",
    quantity: 10,
    florinAmount: null,
    instrumentKind: "STOCK",
    sizingMode: "QUANTITY",
    maxPriceImpactPercent: 10,
    frequency: partial.scheduleType === "recurring" ? "weekly" : null,
    startAt: new Date(now + day).toISOString(),
    nextRunAt: new Date(now + day).toISOString(),
    endAt: null,
    consecutiveFailures: 0,
    lastFailureSummary: null,
    createdAt: new Date(now - 7 * day).toISOString(),
    updatedAt: new Date(now - day).toISOString(),
    ...partial,
  };
}

const FIXTURE_INSTRUCTIONS: ScheduledTradeDetail[] = [
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.recurringActive,
      status: "active",
      scheduleType: "recurring",
      frequency: "weekly",
      symbol: "ALTG",
      side: "buy",
      quantity: 5,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.oneTimeUpcoming,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      symbol: "FLR",
      side: "sell",
      quantity: 25,
      nextRunAt: new Date(now + 2 * day).toISOString(),
      startAt: new Date(now + 2 * day).toISOString(),
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.paused,
      status: "paused",
      scheduleType: "recurring",
      consecutiveFailures: 2,
      lastFailureSummary: "Insufficient buying power for this order.",
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - 2 * hour).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "insufficient_buying_power",
    lastSubmittedOrderId: null,
    pausedAt: new Date(now - hour).toISOString(),
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [
      {
        id: "TSTO-LAB-1",
        instructionId: UI_LAB_SCHEDULED_TRADE_IDS.paused,
        scheduledRunAt: new Date(now - 3 * day).toISOString(),
        status: "failed",
        attemptCount: 1,
        terminalOrderId: null,
        failureCategory: "insufficient_buying_power",
        customerFailureSummary: "Insufficient buying power for this order.",
        startedAt: new Date(now - 3 * day).toISOString(),
        completedAt: new Date(now - 3 * day).toISOString(),
        nextRetryAt: null,
        createdAt: new Date(now - 3 * day).toISOString(),
      },
    ],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.completed,
      status: "completed",
      scheduleType: "one_time",
      frequency: null,
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "submitted",
    lastFailureCategory: null,
    lastSubmittedOrderId: "ord_uilab_sched_1",
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: new Date(now - day).toISOString(),
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.cancelled,
      status: "cancelled",
      scheduleType: "recurring",
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: new Date(now - 2 * day).toISOString(),
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.ended,
      status: "ended",
      scheduleType: "recurring",
      endAt: new Date(now - day).toISOString(),
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - 2 * day).toISOString(),
    lastAttemptStatus: "submitted",
    lastFailureCategory: null,
    lastSubmittedOrderId: "ord_uilab_sched_2",
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: new Date(now - day).toISOString(),
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.weeklyBuy,
      status: "active",
      scheduleType: "recurring",
      frequency: "weekly",
      symbol: "ALTG",
      side: "buy",
      quantity: 2,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.monthlySell,
      status: "active",
      scheduleType: "recurring",
      frequency: "monthly",
      symbol: "FLR",
      side: "sell",
      quantity: 15,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.dueSoon,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      nextRunAt: new Date(now + hour).toISOString(),
      startAt: new Date(now + hour).toISOString(),
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.marketUnavailable,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      lastFailureSummary: "Waiting for market availability.",
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - hour).toISOString(),
    lastAttemptStatus: "skipped",
    lastFailureCategory: "market_unavailable",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [
      {
        id: "TSTO-LAB-MARKET",
        instructionId: UI_LAB_SCHEDULED_TRADE_IDS.marketUnavailable,
        scheduledRunAt: new Date(now - hour).toISOString(),
        status: "skipped",
        attemptCount: 1,
        terminalOrderId: null,
        failureCategory: "market_unavailable",
        customerFailureSummary: "Waiting for market availability.",
        startedAt: new Date(now - hour).toISOString(),
        completedAt: new Date(now - hour).toISOString(),
        nextRetryAt: new Date(now + hour).toISOString(),
        createdAt: new Date(now - hour).toISOString(),
      },
    ],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.tseUnavailable,
      status: "active",
      scheduleType: "recurring",
      lastFailureSummary: "Market connection is unavailable.",
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - 30 * 60_000).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "tse_unavailable",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.insufficientBuyingPower,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      lastFailureSummary: "Insufficient buying power for this order.",
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "insufficient_buying_power",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.insufficientHoldings,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      side: "sell",
      lastFailureSummary: "Insufficient holdings for this sell order.",
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "insufficient_holdings",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.archivedPortfolio,
      status: "completed",
      scheduleType: "one_time",
      frequency: null,
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.archived,
      portfolioName: "Archived Portfolio",
      lastFailureSummary: "Portfolio is archived or unavailable.",
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "portfolio_archived",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: new Date(now - day).toISOString(),
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.restrictedAuthority,
      status: "completed",
      scheduleType: "one_time",
      frequency: null,
      lastFailureSummary: "Trading authorization is no longer valid for this portfolio.",
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "authorization_failed",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: new Date(now - day).toISOString(),
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.consentRequired,
      status: "completed",
      scheduleType: "one_time",
      frequency: null,
      lastFailureSummary: "Terminal trading consent is required.",
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - day).toISOString(),
    lastAttemptStatus: "failed",
    lastFailureCategory: "consent_required",
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: new Date(now - day).toISOString(),
    endedAt: null,
    recentOccurrences: [],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.orderSubmitted,
      status: "completed",
      scheduleType: "one_time",
      frequency: null,
      nextRunAt: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - hour).toISOString(),
    lastAttemptStatus: "submitted",
    lastFailureCategory: null,
    lastSubmittedOrderId: "ord_uilab_sched_success",
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: new Date(now - hour).toISOString(),
    endedAt: null,
    recentOccurrences: [
      {
        id: "TSTO-LAB-SUBMITTED",
        instructionId: UI_LAB_SCHEDULED_TRADE_IDS.orderSubmitted,
        scheduledRunAt: new Date(now - hour).toISOString(),
        status: "submitted",
        attemptCount: 1,
        terminalOrderId: "ord_uilab_sched_success",
        failureCategory: null,
        customerFailureSummary: null,
        startedAt: new Date(now - hour).toISOString(),
        completedAt: new Date(now - hour).toISOString(),
        nextRetryAt: null,
        createdAt: new Date(now - hour).toISOString(),
      },
    ],
  },
  {
    ...baseRow({
      id: UI_LAB_SCHEDULED_TRADE_IDS.concurrencyDuplicate,
      status: "active",
      scheduleType: "one_time",
      frequency: null,
      lastFailureSummary: null,
    }),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: new Date(now - 60_000).toISOString(),
    lastAttemptStatus: "processing",
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [
      {
        id: "TSTO-LAB-CONCURRENCY",
        instructionId: UI_LAB_SCHEDULED_TRADE_IDS.concurrencyDuplicate,
        scheduledRunAt: new Date(now - 60_000).toISOString(),
        status: "processing",
        attemptCount: 1,
        terminalOrderId: null,
        failureCategory: null,
        customerFailureSummary: null,
        startedAt: new Date(now - 60_000).toISOString(),
        completedAt: null,
        nextRetryAt: null,
        createdAt: new Date(now - 60_000).toISOString(),
      },
    ],
  },
];

const labStore = new Map<string, ScheduledTradeDetail>(
  FIXTURE_INSTRUCTIONS.map((row) => [row.id, structuredClone(row)]),
);

export function listUiLabScheduledTrades(portfolioId?: string): ScheduledTradeInstructionRow[] {
  return [...labStore.values()]
    .filter((row) => !portfolioId || row.portfolioId === portfolioId)
    .map(({ recentOccurrences: _r, ...row }) => row);
}

export function getUiLabScheduledTradeDetail(instructionId: string): ScheduledTradeDetail | null {
  const row = labStore.get(instructionId);
  return row ? structuredClone(row) : null;
}

export function previewUiLabScheduledTrade(
  input: CreateScheduledTradeInput,
): ScheduledTradePreviewResult {
  const warnings: string[] = ["UI Lab demonstration — no real schedule is created."];
  const errors: string[] = [];
  const crypto =
    input.instrumentKind === "CRYPTO" ||
    ["NPFC", "NVA", "VLT"].includes(input.symbol.trim().toUpperCase());
  const sizingMode = crypto ? ("FLORIN_AMOUNT" as const) : ("QUANTITY" as const);

  if (input.portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.archived) {
    errors.push("Archived portfolios cannot be traded.");
  }
  if (crypto) {
    if (!(Number(input.florinAmount) > 0)) errors.push("Enter a valid florin amount.");
  } else if (!(input.quantity > 0) || !Number.isInteger(input.quantity)) {
    errors.push("Share quantity must be a whole number.");
  }
  if (input.scheduleType === "recurring" && !input.frequency) {
    errors.push("Frequency is required for recurring schedules.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    portfolioId: input.portfolioId,
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    quantity: crypto ? 0 : input.quantity,
    florinAmount: crypto ? (input.florinAmount ?? null) : null,
    instrumentKind: crypto ? "CRYPTO" : "STOCK",
    sizingMode,
    maxPriceImpactPercent: input.maxPriceImpactPercent ?? 10,
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    nextRunAt: input.startAt,
    estimatedValue: crypto ? (input.florinAmount ?? 100) : 1250,
    estimatedFees: crypto ? 1 : 1.25,
  };
}

export function mockUiLabScheduledTradeCreate(
  input: CreateScheduledTradeInput,
  scenario: BankActionUiLabScenario = "success",
): ScheduledTradeDetail {
  if (scenario === "validation_error") {
    throw new Error("BAD_REQUEST:Enter a valid share quantity.");
  }
  if (scenario === "forbidden") {
    throw new Error("FORBIDDEN:Not authorized to trade this portfolio.");
  }

  const preview = previewUiLabScheduledTrade(input);
  if (!preview.ok) {
    throw new Error(`BAD_REQUEST:${preview.errors[0] ?? "Unable to create schedule."}`);
  }

  const id = `TST-LAB-${Date.now()}`;
  const detail: ScheduledTradeDetail = {
    id,
    portfolioId: input.portfolioId,
    portfolioName:
      input.portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury
        ? "ALTG Treasury"
        : "Core Portfolio",
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    quantity: preview.quantity,
    florinAmount: preview.florinAmount,
    instrumentKind: preview.instrumentKind,
    sizingMode: preview.sizingMode,
    maxPriceImpactPercent: preview.maxPriceImpactPercent,
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    startAt: input.startAt,
    nextRunAt: input.startAt,
    endAt: input.endAt ?? null,
    status: "active",
    consecutiveFailures: 0,
    lastFailureSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderType: "market",
    timeZonePolicy: "UTC",
    lastAttemptAt: null,
    lastAttemptStatus: null,
    lastFailureCategory: null,
    lastSubmittedOrderId: null,
    pausedAt: null,
    resumedAt: null,
    cancelledAt: null,
    completedAt: null,
    endedAt: null,
    recentOccurrences: [],
  };
  labStore.set(id, structuredClone(detail));
  return structuredClone(detail);
}

export function mockUiLabScheduledTradePause(instructionId: string): ScheduledTradeDetail {
  const row = labStore.get(instructionId) ?? getUiLabScheduledTradeDetail(instructionId);
  if (!row) throw new Error("NOT_FOUND");
  const updated = {
    ...row,
    status: "paused" as const,
    pausedAt: new Date().toISOString(),
    nextRunAt: null,
    updatedAt: new Date().toISOString(),
  };
  labStore.set(instructionId, updated);
  return structuredClone(updated);
}

export function mockUiLabScheduledTradeResume(instructionId: string): ScheduledTradeDetail {
  const row = labStore.get(instructionId) ?? getUiLabScheduledTradeDetail(instructionId);
  if (!row) throw new Error("NOT_FOUND");
  const nextRunAt = new Date(Date.now() + 86_400_000).toISOString();
  const updated = {
    ...row,
    status: "active" as const,
    resumedAt: new Date().toISOString(),
    nextRunAt,
    updatedAt: new Date().toISOString(),
  };
  labStore.set(instructionId, updated);
  return structuredClone(updated);
}

export function mockUiLabScheduledTradeCancel(instructionId: string): ScheduledTradeDetail {
  const row = labStore.get(instructionId) ?? getUiLabScheduledTradeDetail(instructionId);
  if (!row) throw new Error("NOT_FOUND");
  const updated = {
    ...row,
    status: "cancelled" as const,
    cancelledAt: new Date().toISOString(),
    nextRunAt: null,
    updatedAt: new Date().toISOString(),
  };
  labStore.set(instructionId, updated);
  return structuredClone(updated);
}
