/**
 * Cron executor for due Terminal scheduled trades.
 * Mirrors bank scheduled-transfer claim/idempotency — never holds DB TX during TSE calls.
 */
import type {
  TerminalScheduledTradeFailureCategory,
  TerminalScheduledTradeInstruction,
  TerminalScheduledTradeOccurrence,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  buildOccurrenceIdempotencyKey,
  computeNextRunAt,
  isPastEndDate,
} from "@/lib/terminal/scheduled-trade-schedule";
import { canAttemptScheduledTrade } from "@/lib/terminal/scheduled-trade-market-session";
import { validateOrderPreview } from "@/lib/terminal/order-validation";
import { UnavailableTseClient } from "@/lib/terminal/unavailable-tse-client";
import { prisma } from "@/server/db";

const BATCH_LIMIT = 50;
const FAILURE_THRESHOLD = 3;
const MAX_TRANSIENT_RETRIES = 3;
const STALE_PENDING_MS = 120_000;

const TRANSIENT_BACKOFF_MS = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;

export interface ExecuteDueScheduledTradesOptions {
  now?: Date;
}

export interface ExecuteDueScheduledTradesResult {
  dueCount: number;
  submittedCount: number;
  failedCount: number;
  skippedCount: number;
  deferredCount: number;
}

export type FailureResolution = {
  category: TerminalScheduledTradeFailureCategory;
  customerSummary: string;
  technicalDetails?: string;
  transient: boolean;
};

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export function mapPreviewErrorsToFailureCategory(errors: string[]): FailureResolution {
  const joined = errors.join(" ").toLowerCase();
  if (/insufficient buying power/.test(joined)) {
    return {
      category: "INSUFFICIENT_BUYING_POWER",
      customerSummary: "Insufficient buying power for this order.",
      transient: false,
    };
  }
  if (/do not hold enough shares|insufficient holdings/.test(joined)) {
    return {
      category: "INSUFFICIENT_HOLDINGS",
      customerSummary: "Insufficient holdings for this sell order.",
      transient: false,
    };
  }
  if (/market is closed|market unavailable/.test(joined)) {
    return {
      category: "MARKET_UNAVAILABLE",
      customerSummary: "Market was unavailable when this trade was attempted.",
      transient: true,
    };
  }
  if (/unknown symbol|unavailable for this security|halted/.test(joined)) {
    return {
      category: "SYMBOL_UNAVAILABLE",
      customerSummary: "This symbol could not be traded.",
      transient: false,
    };
  }
  return {
    category: "VALIDATION_FAILED",
    customerSummary: "This scheduled trade could not be validated.",
    technicalDetails: errors.join("; "),
    transient: false,
  };
}

function isCryptoInstruction(instruction: TerminalScheduledTradeInstruction): boolean {
  return (
    instruction.instrumentKind === "CRYPTO" || instruction.executionVenue === "ALTA_CRYPTO"
  );
}

export function transientRetryDelayMs(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount - 1, 0), TRANSIENT_BACKOFF_MS.length - 1);
  return TRANSIENT_BACKOFF_MS[index]!;
}

async function findDueInstructions(now: Date): Promise<TerminalScheduledTradeInstruction[]> {
  return prisma.terminalScheduledTradeInstruction.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: BATCH_LIMIT,
  });
}

async function findRetryOccurrences(now: Date): Promise<
  (TerminalScheduledTradeOccurrence & { instruction: TerminalScheduledTradeInstruction })[]
> {
  return prisma.terminalScheduledTradeOccurrence.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: { lte: now },
      attemptCount: { lt: MAX_TRANSIENT_RETRIES },
      instruction: { status: "ACTIVE" },
    },
    include: { instruction: true },
    orderBy: { nextRetryAt: "asc" },
    take: BATCH_LIMIT,
  });
}

async function claimOccurrence(
  instruction: TerminalScheduledTradeInstruction,
  scheduledRunAt: Date,
  now: Date,
): Promise<{ occurrenceId: string } | "skipped"> {
  try {
    const created = await prisma.terminalScheduledTradeOccurrence.create({
      data: {
        instructionId: instruction.id,
        scheduledRunAt,
        idempotencyKey: `pending:${instruction.id}:${scheduledRunAt.toISOString()}`,
        status: "PENDING",
      },
    });
    const idempotencyKey = buildOccurrenceIdempotencyKey(created.id);
    await prisma.terminalScheduledTradeOccurrence.update({
      where: { id: created.id },
      data: { idempotencyKey },
    });
    return { occurrenceId: created.id };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await prisma.terminalScheduledTradeOccurrence.findUnique({
      where: {
        instructionId_scheduledRunAt: {
          instructionId: instruction.id,
          scheduledRunAt,
        },
      },
    });
    if (!existing) return "skipped";
    if (existing.status === "SUBMITTED" || existing.terminalOrderId) return "skipped";

    if (existing.status === "PENDING") {
      const ageMs = now.getTime() - existing.createdAt.getTime();
      if (ageMs < STALE_PENDING_MS) return "skipped";
      return { occurrenceId: existing.id };
    }

    if (existing.status === "FAILED" && existing.nextRetryAt && existing.nextRetryAt <= now) {
      await prisma.terminalScheduledTradeOccurrence.update({
        where: { id: existing.id },
        data: { status: "PENDING", startedAt: null, completedAt: null },
      });
      return { occurrenceId: existing.id };
    }

    return "skipped";
  }
}

async function loadCreatorUser(userId: string) {
  const { loadAltaUserOrThrow } = await import("@/server/bank-account-access.service");
  return loadAltaUserOrThrow(userId);
}

async function revalidateInstruction(
  instruction: TerminalScheduledTradeInstruction,
  creatorUserId: string,
): Promise<FailureResolution | null> {
  if (instruction.status !== "ACTIVE") {
    return {
      category: "VALIDATION_FAILED",
      customerSummary: "This schedule is no longer active.",
      transient: false,
    };
  }

  const portfolio = await prisma.terminalPortfolio.findUnique({
    where: { id: instruction.portfolioId },
  });
  if (!portfolio || portfolio.status !== "ACTIVE") {
    return {
      category: "PORTFOLIO_ARCHIVED",
      customerSummary: "Portfolio is archived or unavailable.",
      transient: false,
    };
  }

  try {
    const user = await loadCreatorUser(creatorUserId);
    const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
      "@/lib/terminal/terminal-portfolio.service"
    );
    const summary = await getTerminalPortfolioForUser(user, instruction.portfolioId);
    assertCanTradePortfolio(user, summary);
  } catch (error) {
    return {
      category: "AUTHORIZATION_FAILED",
      customerSummary: "Trading authorization is no longer valid for this portfolio.",
      technicalDetails: error instanceof Error ? error.message : String(error),
      transient: false,
    };
  }

  const isCrypto =
    instruction.instrumentKind === "CRYPTO" || instruction.executionVenue === "ALTA_CRYPTO";
  const consentAction = isCrypto ? "terminal.crypto_trade" : "terminal.place_order";

  try {
    const user = await loadCreatorUser(creatorUserId);
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, consentAction);
  } catch {
    return {
      category: isCrypto ? "CRYPTO_CONSENT_REQUIRED" : "CONSENT_REQUIRED",
      customerSummary: isCrypto
        ? "Terminal crypto trading consent is required."
        : "Terminal trading consent is required.",
      transient: false,
    };
  }

  return null;
}

export function mapCryptoOrderErrorToFailure(error: {
  code: string;
  customerMessage: string;
}): FailureResolution {
  switch (error.code) {
    case "INSUFFICIENT_CASH":
      return {
        category: "INSUFFICIENT_BUYING_POWER",
        customerSummary: "Insufficient cash for this crypto purchase.",
        transient: false,
      };
    case "INSUFFICIENT_HOLDINGS":
      return {
        category: "INSUFFICIENT_HOLDINGS",
        customerSummary: "Insufficient crypto holdings for this sell.",
        transient: false,
      };
    case "ASSET_HALTED":
      return {
        category: "ASSET_HALTED",
        customerSummary: "This crypto asset is halted.",
        transient: false,
      };
    case "REDEMPTION_ONLY":
      return {
        category: "REDEMPTION_ONLY",
        customerSummary: "Purchases are disabled — redemptions only.",
        transient: false,
      };
    case "ASSET_DRAFT":
    case "CRYPTO_UNAVAILABLE":
    case "ASSET_CLOSED":
      return {
        category: "CRYPTO_UNAVAILABLE",
        customerSummary: error.customerMessage,
        transient: false,
      };
    case "WALLET_FROZEN":
      return {
        category: "WALLET_FROZEN",
        customerSummary: "This crypto wallet is frozen.",
        transient: false,
      };
    case "QUOTE_EXPIRED":
    case "REQUOTE_REQUIRED":
      return {
        category: "REQUOTE_REQUIRED",
        customerSummary: "The crypto quote changed and needs a fresh attempt.",
        transient: true,
      };
    case "CONSENT_REQUIRED":
      return {
        category: "CRYPTO_CONSENT_REQUIRED",
        customerSummary: "Terminal crypto trading consent is required.",
        transient: false,
      };
    case "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED":
      return {
        category: "PRICE_IMPACT_TOO_HIGH",
        customerSummary:
          "Price impact was too high for automated execution. Review this trade manually.",
        transient: false,
      };
    default:
      return {
        category: "VALIDATION_FAILED",
        customerSummary: error.customerMessage || "This scheduled crypto trade could not run.",
        technicalDetails: error.code,
        transient: false,
      };
  }
}

async function processCryptoOccurrence(
  instruction: TerminalScheduledTradeInstruction,
  occurrenceId: string,
  scheduledRunAt: Date,
  now: Date,
): Promise<"submitted" | "failed" | "skipped" | "deferred"> {
  const revalidation = await revalidateInstruction(instruction, instruction.createdByUserId);
  if (revalidation) {
    await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, revalidation);
    return "failed";
  }

  const user = await loadCreatorUser(instruction.createdByUserId);
  const { previewTerminalCryptoOrder } = await import(
    "@/lib/terminal/crypto/terminal-crypto-preview.service"
  );
  const { submitTerminalCryptoOrder } = await import(
    "@/lib/terminal/crypto/terminal-crypto-execution.service"
  );
  const { CryptoOrderError } = await import("@/lib/terminal/crypto/crypto-order-types");

  const side = instruction.side === "BUY" ? ("BUY" as const) : ("SELL" as const);
  const sizingMode = instruction.sizingMode;
  const grossFlorins =
    sizingMode === "FLORIN_AMOUNT" && instruction.florinAmount != null
      ? instruction.florinAmount.toString()
      : undefined;
  const quantity =
    sizingMode === "QUANTITY" ? instruction.quantity.toString() : undefined;

  let preview;
  try {
    preview = await previewTerminalCryptoOrder(user, {
      portfolioId: instruction.portfolioId,
      symbol: instruction.symbol,
      side,
      grossFlorins,
      quantity,
    });
  } catch (error) {
    if (error instanceof CryptoOrderError) {
      const failure = mapCryptoOrderErrorToFailure(error);
      if (failure.transient) {
        await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
      } else {
        await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
      }
      return "failed";
    }
    await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, {
      category: "TRANSIENT_ERROR",
      customerSummary: "A temporary error occurred while quoting the crypto order.",
      technicalDetails: error instanceof Error ? error.message : String(error),
      transient: true,
    });
    return "failed";
  }

  const impactAbs = Math.abs(Number.parseFloat(preview.priceImpactPercent));
  const maxImpact = decimalToNumber(instruction.maxPriceImpactPercent) || 10;
  if (Number.isFinite(impactAbs) && impactAbs >= maxImpact) {
    await prisma.$transaction(async (tx) => {
      await tx.terminalScheduledTradeOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: "SKIPPED",
          failureCategory: "PRICE_IMPACT_TOO_HIGH",
          customerFailureSummary:
            "Skipped because estimated price impact was at or above the automated safety limit. Review this trade manually.",
          completedAt: now,
          nextRetryAt: null,
        },
      });

      const nextRun =
        instruction.scheduleType === "RECURRING" && instruction.frequency
          ? computeNextRunAt(scheduledRunAt, instruction.frequency)
          : null;
      let instructionStatus = instruction.status;
      let instructionNextRunAt: Date | null = nextRun;
      let completedAt: Date | null = null;
      let endedAt: Date | null = null;

      if (instruction.scheduleType === "ONE_TIME") {
        instructionStatus = "COMPLETED";
        instructionNextRunAt = null;
        completedAt = now;
      } else if (nextRun && isPastEndDate(instruction.endAt, nextRun)) {
        instructionStatus = "ENDED";
        instructionNextRunAt = null;
        endedAt = now;
      }

      await tx.terminalScheduledTradeInstruction.update({
        where: { id: instruction.id },
        data: {
          status: instructionStatus,
          nextRunAt: instructionNextRunAt,
          lastAttemptAt: now,
          lastAttemptStatus: "SKIPPED",
          lastFailureCategory: "PRICE_IMPACT_TOO_HIGH",
          lastFailureSummary:
            "Skipped because estimated price impact was at or above the automated safety limit.",
          completedAt,
          endedAt,
          version: { increment: 1 },
        },
      });
    });

    const { notifyTerminalScheduledTradeAttemptSkipped } = await import(
      "@/server/terminal-scheduled-trade-notification.service"
    );
    notifyTerminalScheduledTradeAttemptSkipped(instruction.createdByUserId, {
      instructionId: instruction.id,
      symbol: instruction.symbol,
      summary:
        "Skipped because estimated price impact was at or above the automated safety limit. Review this trade manually.",
    });
    return "skipped";
  }

  // Automated jobs must never pass interactive high-impact acknowledgement.
  if (preview.requiresHighImpactConfirmation) {
    await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, {
      category: "PRICE_IMPACT_TOO_HIGH",
      customerSummary:
        "Price impact requires manual confirmation and cannot run on a schedule.",
      transient: false,
    });
    return "failed";
  }

  const idempotencyKey = buildOccurrenceIdempotencyKey(occurrenceId);

  try {
    const fill = await submitTerminalCryptoOrder(user, {
      portfolioId: instruction.portfolioId,
      symbol: instruction.symbol,
      side,
      grossFlorins,
      quantity,
      clientKey: idempotencyKey,
      expectedMarketStateVersion: preview.marketStateVersion,
      quoteExpiresAt: preview.quoteExpiresAt,
      quoteFingerprint: preview.quoteFingerprint,
      acceptHighPriceImpact: false,
    });

    await recordSuccess(instruction, occurrenceId, scheduledRunAt, now, fill.orderId);
    return "submitted";
  } catch (error) {
    if (error instanceof CryptoOrderError) {
      const failure = mapCryptoOrderErrorToFailure(error);
      if (failure.transient) {
        await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
      } else {
        await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
      }
      return "failed";
    }
    await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, {
      category: "TRANSIENT_ERROR",
      customerSummary: "A temporary error occurred while submitting the crypto order.",
      technicalDetails: error instanceof Error ? error.message : String(error),
      transient: true,
    });
    return "failed";
  }
}

async function processOccurrence(
  instruction: TerminalScheduledTradeInstruction,
  occurrenceId: string,
  scheduledRunAt: Date,
  now: Date,
): Promise<"submitted" | "failed" | "skipped" | "deferred"> {
  const occurrence = await prisma.terminalScheduledTradeOccurrence.findUniqueOrThrow({
    where: { id: occurrenceId },
  });

  if (occurrence.status === "SUBMITTED") return "skipped";

  await prisma.terminalScheduledTradeOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      startedAt: now,
    },
  });

  if (isCryptoInstruction(instruction)) {
    return processCryptoOccurrence(instruction, occurrenceId, scheduledRunAt, now);
  }

  const revalidation = await revalidateInstruction(instruction, instruction.createdByUserId);
  if (revalidation) {
    await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, revalidation);
    return "failed";
  }

  if (instruction.instrumentKind === "CRYPTO" || instruction.executionVenue === "ALTA_CRYPTO") {
    return processCryptoOccurrence(instruction, occurrenceId, scheduledRunAt, now);
  }

  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const client = getTseClient({ userId: instruction.createdByUserId });
  if (client instanceof UnavailableTseClient) {
    await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, {
      category: "TSE_UNAVAILABLE",
      customerSummary: "Market connection is unavailable.",
      transient: true,
    });
    return "failed";
  }

  const [security, marketStatus, snapshot] = await Promise.all([
    client.getSecurity(instruction.symbol),
    client.getMarketStatus(),
    (await import("@/lib/terminal/terminal-local.service")).getLocalPortfolioSnapshot(
      instruction.portfolioId,
    ),
  ]);

  const session = canAttemptScheduledTrade(now, marketStatus.status);
  if (!session.allow) {
    await prisma.$transaction(async (tx) => {
      await tx.terminalScheduledTradeOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: "SKIPPED",
          failureCategory: "MARKET_UNAVAILABLE",
          customerFailureSummary: "Waiting for market availability.",
          nextRetryAt: session.deferUntil,
          completedAt: now,
        },
      });
      // Keep the same occurrence slot retryable via instruction nextRunAt.
      await tx.terminalScheduledTradeInstruction.update({
        where: { id: instruction.id },
        data: {
          nextRunAt: session.deferUntil,
          lastAttemptAt: now,
          lastAttemptStatus: "SKIPPED",
          lastFailureCategory: "MARKET_UNAVAILABLE",
          lastFailureSummary: "Waiting for market availability.",
          version: { increment: 1 },
        },
      });
    });

    const { notifyTerminalScheduledTradeAttemptSkipped } = await import(
      "@/server/terminal-scheduled-trade-notification.service"
    );
    notifyTerminalScheduledTradeAttemptSkipped(instruction.createdByUserId, {
      instructionId: instruction.id,
      symbol: instruction.symbol,
      summary: "Waiting for market availability.",
    });
    return "deferred";
  }

  const quantity = decimalToNumber(instruction.quantity);
  const holding = snapshot.holdings.find((h) => h.symbol === instruction.symbol) ?? null;
  const preview = validateOrderPreview({
    order: {
      portfolioId: instruction.portfolioId,
      symbol: instruction.symbol,
      side: instruction.side === "BUY" ? "buy" : "sell",
      type: "market",
      quantity,
    },
    security,
    marketStatus: marketStatus.status,
    buyingPower: snapshot.buyingPower,
    holding,
  });

  if (!preview.ok) {
    const failure = mapPreviewErrorsToFailureCategory(preview.errors);
    if (failure.transient) {
      await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
    } else {
      await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
    }
    return failure.transient ? "failed" : "failed";
  }

  const idempotencyKey = buildOccurrenceIdempotencyKey(occurrenceId);
  let submitResult;
  try {
    submitResult = await client.submitOrder({
      portfolioId: instruction.portfolioId,
      symbol: instruction.symbol,
      side: instruction.side === "BUY" ? "buy" : "sell",
      type: "market",
      quantity,
      clientKey: idempotencyKey,
    });
  } catch (error) {
    await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, {
      category: "TRANSIENT_ERROR",
      customerSummary: "A temporary error occurred while submitting the order.",
      technicalDetails: error instanceof Error ? error.message : String(error),
      transient: true,
    });
    return "failed";
  }

  if (!submitResult.ok) {
    const failure = mapPreviewErrorsToFailureCategory(submitResult.errors);
    const code = submitResult.code;
    const transient = code === "unavailable" || failure.transient;
    if (transient) {
      await recordTransientFailure(instruction, occurrenceId, scheduledRunAt, now, {
        ...failure,
        category: code === "unavailable" ? "TSE_UNAVAILABLE" : failure.category,
        transient: true,
      });
    } else {
      await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, failure);
    }
    return "failed";
  }

  await recordSuccess(instruction, occurrenceId, scheduledRunAt, now, submitResult.order.id);
  return "submitted";
}

async function recordSuccess(
  instruction: TerminalScheduledTradeInstruction,
  occurrenceId: string,
  scheduledRunAt: Date,
  now: Date,
  orderId: string,
): Promise<void> {
  const nextRun =
    instruction.scheduleType === "RECURRING" && instruction.frequency
      ? computeNextRunAt(scheduledRunAt, instruction.frequency)
      : null;

  let instructionStatus = instruction.status;
  let instructionNextRunAt: Date | null = nextRun;
  let endedAt: Date | null = null;
  let completedAt: Date | null = null;

  if (instruction.scheduleType === "ONE_TIME") {
    instructionStatus = "COMPLETED";
    instructionNextRunAt = null;
    completedAt = now;
  } else if (nextRun && isPastEndDate(instruction.endAt, nextRun)) {
    instructionStatus = "ENDED";
    instructionNextRunAt = null;
    endedAt = now;
  }

  await prisma.$transaction(async (tx) => {
    await tx.terminalScheduledTradeOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: "SUBMITTED",
        terminalOrderId: orderId,
        failureCategory: "NONE",
        customerFailureSummary: null,
        technicalDetails: null,
        nextRetryAt: null,
        completedAt: now,
      },
    });

    await tx.terminalScheduledTradeInstruction.update({
      where: { id: instruction.id },
      data: {
        status: instructionStatus,
        nextRunAt: instructionNextRunAt,
        consecutiveFailures: 0,
        lastAttemptAt: now,
        lastAttemptStatus: "SUBMITTED",
        lastFailureCategory: "NONE",
        lastFailureSummary: null,
        lastSubmittedOrderId: orderId,
        completedAt,
        endedAt,
        version: { increment: 1 },
      },
    });
  });

  const { notifyTerminalScheduledTradeOrderSubmitted, notifyTerminalScheduledTradeCompleted, notifyTerminalScheduledTradeEnded } =
    await import("@/server/terminal-scheduled-trade-notification.service");

  notifyTerminalScheduledTradeOrderSubmitted(instruction.createdByUserId, {
    instructionId: instruction.id,
    symbol: instruction.symbol,
    side: instruction.side,
    quantity: decimalToNumber(instruction.quantity),
    orderId,
  });

  if (instructionStatus === "COMPLETED") {
    notifyTerminalScheduledTradeCompleted(instruction.createdByUserId, {
      instructionId: instruction.id,
      symbol: instruction.symbol,
    });
  }
  if (instructionStatus === "ENDED") {
    notifyTerminalScheduledTradeEnded(instruction.createdByUserId, {
      instructionId: instruction.id,
      symbol: instruction.symbol,
    });
  }
}

async function recordPermanentFailure(
  instruction: TerminalScheduledTradeInstruction,
  occurrenceId: string,
  scheduledRunAt: Date,
  now: Date,
  failure: FailureResolution,
): Promise<void> {
  const consecutiveFailures = instruction.consecutiveFailures + 1;
  const shouldPause =
    instruction.scheduleType === "RECURRING" && consecutiveFailures >= FAILURE_THRESHOLD;

  let nextRunAt: Date | null = instruction.nextRunAt;
  let instructionStatus = instruction.status;
  let completedAt: Date | null = null;
  let endedAt: Date | null = null;

  if (instruction.scheduleType === "ONE_TIME") {
    instructionStatus = "COMPLETED";
    nextRunAt = null;
    completedAt = now;
  } else if (instruction.scheduleType === "RECURRING" && instruction.frequency) {
    const advanced = computeNextRunAt(scheduledRunAt, instruction.frequency);
    if (isPastEndDate(instruction.endAt, advanced)) {
      instructionStatus = "ENDED";
      nextRunAt = null;
      endedAt = now;
    } else {
      nextRunAt = advanced;
      instructionStatus = shouldPause ? "PAUSED" : "ACTIVE";
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.terminalScheduledTradeOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: "FAILED",
        failureCategory: failure.category,
        customerFailureSummary: failure.customerSummary,
        technicalDetails: failure.technicalDetails ?? null,
        nextRetryAt: null,
        completedAt: now,
      },
    });

    await tx.terminalScheduledTradeInstruction.update({
      where: { id: instruction.id },
      data: {
        status: instructionStatus,
        nextRunAt,
        consecutiveFailures,
        lastAttemptAt: now,
        lastAttemptStatus: "FAILED",
        lastFailureCategory: failure.category,
        lastFailureSummary: failure.customerSummary,
        pausedAt: shouldPause ? now : instruction.pausedAt,
        completedAt,
        endedAt,
        version: { increment: 1 },
      },
    });
  });

  const { notifyTerminalScheduledTradeAttemptFailed } = await import(
    "@/server/terminal-scheduled-trade-notification.service"
  );
  notifyTerminalScheduledTradeAttemptFailed(instruction.createdByUserId, {
    instructionId: instruction.id,
    symbol: instruction.symbol,
    summary: failure.customerSummary,
    paused: shouldPause,
  });
}

async function recordTransientFailure(
  instruction: TerminalScheduledTradeInstruction,
  occurrenceId: string,
  scheduledRunAt: Date,
  now: Date,
  failure: FailureResolution,
): Promise<void> {
  const occurrence = await prisma.terminalScheduledTradeOccurrence.findUniqueOrThrow({
    where: { id: occurrenceId },
  });
  const exhausted = occurrence.attemptCount >= MAX_TRANSIENT_RETRIES;

  if (exhausted) {
    await recordPermanentFailure(instruction, occurrenceId, scheduledRunAt, now, {
      ...failure,
      category: "TRANSIENT_ERROR",
      customerSummary: "This scheduled trade failed after repeated attempts.",
      transient: false,
    });
    return;
  }

  const nextRetryAt = new Date(now.getTime() + transientRetryDelayMs(occurrence.attemptCount));

  await prisma.$transaction(async (tx) => {
    await tx.terminalScheduledTradeOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: "FAILED",
        failureCategory: failure.category,
        customerFailureSummary: failure.customerSummary,
        technicalDetails: failure.technicalDetails ?? null,
        nextRetryAt,
        completedAt: now,
      },
    });

    await tx.terminalScheduledTradeInstruction.update({
      where: { id: instruction.id },
      data: {
        lastAttemptAt: now,
        lastAttemptStatus: "FAILED",
        lastFailureCategory: failure.category,
        lastFailureSummary: failure.customerSummary,
        version: { increment: 1 },
      },
    });
  });
}

export async function executeDueTerminalScheduledTrades(
  options: ExecuteDueScheduledTradesOptions = {},
): Promise<ExecuteDueScheduledTradesResult> {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    return { dueCount: 0, submittedCount: 0, failedCount: 0, skippedCount: 0, deferredCount: 0 };
  }

  const now = options.now ?? new Date();
  const [instructions, retries] = await Promise.all([
    findDueInstructions(now),
    findRetryOccurrences(now),
  ]);

  let submittedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let deferredCount = 0;

  const work: Array<{ instruction: TerminalScheduledTradeInstruction; scheduledRunAt: Date; occurrenceId?: string }> =
    [];

  for (const instruction of instructions) {
    if (!instruction.nextRunAt) {
      skippedCount += 1;
      continue;
    }
    work.push({ instruction, scheduledRunAt: instruction.nextRunAt });
  }

  for (const row of retries) {
    work.push({
      instruction: row.instruction,
      scheduledRunAt: row.scheduledRunAt,
      occurrenceId: row.id,
    });
  }

  for (const item of work.slice(0, BATCH_LIMIT)) {
    let occurrenceId = item.occurrenceId;
    if (!occurrenceId) {
      const claim = await claimOccurrence(item.instruction, item.scheduledRunAt, now);
      if (claim === "skipped") {
        skippedCount += 1;
        continue;
      }
      occurrenceId = claim.occurrenceId;
    }

    const outcome = await processOccurrence(
      item.instruction,
      occurrenceId,
      item.scheduledRunAt,
      now,
    ).catch((error) => {
      console.error("[terminal-scheduled-trade] unexpected execution error", {
        instructionId: item.instruction.id,
        occurrenceId,
        error,
      });
      failedCount += 1;
      return "failed" as const;
    });

    if (outcome === "submitted") submittedCount += 1;
    else if (outcome === "failed") failedCount += 1;
    else if (outcome === "deferred") deferredCount += 1;
    else skippedCount += 1;
  }

  return {
    dueCount: work.length,
    submittedCount,
    failedCount,
    skippedCount,
    deferredCount,
  };
}
