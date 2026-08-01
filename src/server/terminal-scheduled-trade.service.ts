import type {
  TerminalScheduledTradeFrequency,
  TerminalScheduledTradeInstruction,
  TerminalScheduledTradeOccurrence,
  TerminalScheduledTradeScheduleType,
  TerminalScheduledTradeStatus,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  TERMINAL_SCHEDULED_TRADE_TIME_ZONE_POLICY,
  calculateResumeNextRunAt,
  normalizeStartAtMustBeFuture,
} from "@/lib/terminal/scheduled-trade-schedule";
import type {
  CreateScheduledTradeInput,
  ScheduledTradeDetail,
  ScheduledTradeFrequency,
  ScheduledTradeInstrumentKind,
  ScheduledTradeInstructionRow,
  ScheduledTradeOccurrenceRow,
  ScheduledTradePreviewInput,
  ScheduledTradePreviewResult,
  ScheduledTradeScheduleType,
  ScheduledTradeSizingMode,
  ScheduledTradeStatus,
} from "@/lib/terminal/scheduled-trade-types";
import { isTerminalCryptoSymbol } from "@/lib/terminal/crypto/crypto-instrument";
import { validateOrderPreview } from "@/lib/terminal/order-validation";
import { prisma } from "@/server/db";

const DEFAULT_CRYPTO_MAX_PRICE_IMPACT = 10;

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function resolveInstrumentKind(
  input: Pick<CreateScheduledTradeInput, "symbol" | "instrumentKind">,
): ScheduledTradeInstrumentKind {
  if (input.instrumentKind === "CRYPTO" || input.instrumentKind === "STOCK") {
    return input.instrumentKind;
  }
  return isTerminalCryptoSymbol(input.symbol) ? "CRYPTO" : "STOCK";
}

function resolveSizingMode(
  instrumentKind: ScheduledTradeInstrumentKind,
  _side: "buy" | "sell",
  explicit?: ScheduledTradeSizingMode,
): ScheduledTradeSizingMode {
  if (instrumentKind === "CRYPTO") {
    return "FLORIN_AMOUNT";
  }
  return explicit === "FLORIN_AMOUNT" ? "FLORIN_AMOUNT" : "QUANTITY";
}

function emptyPreviewBase(
  input: CreateScheduledTradeInput,
  extras: Partial<ScheduledTradePreviewResult> & { errors: string[]; warnings: string[] },
): ScheduledTradePreviewResult {
  const instrumentKind = resolveInstrumentKind(input);
  const sizingMode = resolveSizingMode(instrumentKind, input.side, input.sizingMode);
  return {
    ok: extras.errors.length === 0,
    errors: extras.errors,
    warnings: extras.warnings,
    portfolioId: input.portfolioId,
    symbol: input.symbol.trim().toUpperCase(),
    side: input.side,
    quantity: input.quantity ?? 0,
    florinAmount: input.florinAmount ?? null,
    instrumentKind,
    sizingMode,
    maxPriceImpactPercent: input.maxPriceImpactPercent ?? DEFAULT_CRYPTO_MAX_PRICE_IMPACT,
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    nextRunAt: input.startAt,
    estimatedValue: extras.estimatedValue ?? null,
    estimatedFees: extras.estimatedFees ?? null,
  };
}

function mapScheduleType(value: TerminalScheduledTradeScheduleType): ScheduledTradeScheduleType {
  return value === "ONE_TIME" ? "one_time" : "recurring";
}

function mapFrequency(
  value: TerminalScheduledTradeFrequency | null,
): ScheduledTradeFrequency | null {
  if (!value) return null;
  switch (value) {
    case "WEEKLY":
      return "weekly";
    case "BIWEEKLY":
      return "biweekly";
    case "MONTHLY":
      return "monthly";
  }
}

function mapStatus(value: TerminalScheduledTradeStatus): ScheduledTradeStatus {
  switch (value) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "ENDED":
      return "ended";
  }
}

function toDbScheduleType(value: ScheduledTradeScheduleType): TerminalScheduledTradeScheduleType {
  return value === "one_time" ? "ONE_TIME" : "RECURRING";
}

function toDbFrequency(
  value: ScheduledTradeFrequency | null | undefined,
): TerminalScheduledTradeFrequency | null {
  if (!value) return null;
  switch (value) {
    case "weekly":
      return "WEEKLY";
    case "biweekly":
      return "BIWEEKLY";
    case "monthly":
      return "MONTHLY";
  }
}

function parseInstant(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) badRequest(`${label} is invalid.`);
  return date;
}

async function assertCanViewPortfolio(user: AltaUser, portfolioId: string) {
  const { getTerminalPortfolioForUser, getTerminalPortfolioRecordIncludingArchived } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  try {
    return await getTerminalPortfolioForUser(user, portfolioId);
  } catch {
    const record = await getTerminalPortfolioRecordIncludingArchived(user, portfolioId);
    if (!record) notFound();
    return {
      id: record.id,
      name: record.name,
      ownerType: record.ownerType,
      ownerUserId: record.ownerUserId,
      ownerCompanyId: record.ownerCompanyId,
      ownerLabel: record.ownerLabel,
      status: record.status,
      isDefault: record.isDefault,
      totalValue: null,
      dayChange: null,
      dayChangePercent: null,
      valuationAvailable: false,
      cashBalance: null,
      capabilities: {
        canView: true,
        canTrade: false,
        canRename: false,
        canArchive: false,
      },
    };
  }
}

function validateCreateInput(input: CreateScheduledTradeInput, now: Date) {
  const errors: string[] = [];
  if (!input.portfolioId?.trim()) errors.push("Portfolio is required.");
  if (!input.symbol?.trim()) errors.push("Symbol is required.");

  const instrumentKind = resolveInstrumentKind(input);
  const sizingMode = resolveSizingMode(instrumentKind, input.side, input.sizingMode);
  const maxPriceImpactPercent =
    input.maxPriceImpactPercent ?? DEFAULT_CRYPTO_MAX_PRICE_IMPACT;

  if (instrumentKind === "CRYPTO") {
    const florins = input.florinAmount ?? 0;
    if (!(florins > 0) || !Number.isFinite(florins)) {
      errors.push("Enter a valid florin amount.");
    }
    if (!(maxPriceImpactPercent > 0) || !Number.isFinite(maxPriceImpactPercent)) {
      errors.push("Max price impact must be a positive number.");
    }
  } else {
    if (!(input.quantity > 0) || !Number.isFinite(input.quantity)) {
      errors.push("Enter a valid share quantity.");
    } else if (!Number.isInteger(input.quantity)) {
      errors.push("Share quantity must be a whole number.");
    }
  }

  if (input.scheduleType === "recurring" && !input.frequency) {
    errors.push("Frequency is required for recurring schedules.");
  }
  if (input.scheduleType === "one_time" && input.frequency) {
    errors.push("One-time schedules cannot have a frequency.");
  }

  let startAt: Date;
  try {
    startAt = normalizeStartAtMustBeFuture(parseInstant(input.startAt, "Start time"), now);
  } catch (error) {
    errors.push(error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Invalid start time.");
    startAt = now;
  }

  let endAt: Date | null = null;
  if (input.endAt) {
    endAt = parseInstant(input.endAt, "End date");
    if (endAt.getTime() < startAt.getTime()) {
      errors.push("End date must be on or after the start time.");
    }
  }

  return { errors, startAt, endAt, instrumentKind, sizingMode, maxPriceImpactPercent };
}

async function loadInstructionForUser(user: AltaUser, instructionId: string) {
  const row = await prisma.terminalScheduledTradeInstruction.findUnique({
    where: { id: instructionId },
    include: {
      portfolio: { select: { id: true, name: true, ownerCompanyId: true, ownerUserId: true } },
      occurrences: { orderBy: { scheduledRunAt: "desc" }, take: 12 },
    },
  });
  if (!row) notFound();
  if (row.createdByUserId !== user.id) {
    await assertCanViewPortfolio(user, row.portfolioId);
  }
  return row;
}

function mapOccurrence(row: TerminalScheduledTradeOccurrence): ScheduledTradeOccurrenceRow {
  return {
    id: row.id,
    instructionId: row.instructionId,
    scheduledRunAt: row.scheduledRunAt.toISOString(),
    status: row.status.toLowerCase() as ScheduledTradeOccurrenceRow["status"],
    attemptCount: row.attemptCount,
    terminalOrderId: row.terminalOrderId,
    failureCategory: row.failureCategory
      ? (row.failureCategory.toLowerCase() as ScheduledTradeOccurrenceRow["failureCategory"])
      : null,
    customerFailureSummary: row.customerFailureSummary,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapInstructionRow(
  row: TerminalScheduledTradeInstruction & { portfolio: { name: string } },
): ScheduledTradeInstructionRow {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    portfolioName: row.portfolio.name,
    symbol: row.symbol,
    side: row.side === "BUY" ? "buy" : "sell",
    quantity: decimalToNumber(row.quantity),
    florinAmount: row.florinAmount != null ? decimalToNumber(row.florinAmount) : null,
    instrumentKind: row.instrumentKind === "CRYPTO" ? "CRYPTO" : "STOCK",
    sizingMode: row.sizingMode === "FLORIN_AMOUNT" ? "FLORIN_AMOUNT" : "QUANTITY",
    maxPriceImpactPercent: decimalToNumber(row.maxPriceImpactPercent) || DEFAULT_CRYPTO_MAX_PRICE_IMPACT,
    scheduleType: mapScheduleType(row.scheduleType),
    frequency: mapFrequency(row.frequency),
    startAt: row.startAt.toISOString(),
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    status: mapStatus(row.status),
    consecutiveFailures: row.consecutiveFailures,
    lastFailureSummary: row.lastFailureSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDetail(
  row: TerminalScheduledTradeInstruction & {
    portfolio: { name: string };
    occurrences: TerminalScheduledTradeOccurrence[];
  },
): ScheduledTradeDetail {
  const base = mapInstructionRow(row);
  return {
    ...base,
    orderType: "market",
    timeZonePolicy: row.timeZonePolicy,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastAttemptStatus: row.lastAttemptStatus
      ? (row.lastAttemptStatus.toLowerCase() as ScheduledTradeDetail["lastAttemptStatus"])
      : null,
    lastFailureCategory: row.lastFailureCategory
      ? (row.lastFailureCategory.toLowerCase() as ScheduledTradeDetail["lastFailureCategory"])
      : null,
    lastSubmittedOrderId: row.lastSubmittedOrderId,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    resumedAt: row.resumedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    recentOccurrences: row.occurrences.map(mapOccurrence),
  };
}

export async function previewCreateScheduledTrade(
  user: AltaUser,
  input: ScheduledTradePreviewInput,
): Promise<ScheduledTradePreviewResult> {
  const now = new Date();
  const { errors, startAt, endAt, instrumentKind, sizingMode, maxPriceImpactPercent } =
    validateCreateInput(input, now);
  const warnings: string[] = [];

  const { getTerminalPortfolioForUser, assertCanTradePortfolio } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  let portfolio;
  try {
    portfolio = await getTerminalPortfolioForUser(user, input.portfolioId);
    assertCanTradePortfolio(user, portfolio);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Portfolio unavailable.");
    return emptyPreviewBase(input, { errors, warnings });
  }

  const symbol = input.symbol.trim().toUpperCase();

  if (instrumentKind === "CRYPTO") {
    return previewCryptoScheduledTrade(user, input, {
      errors,
      warnings,
      startAt,
      endAt,
      instrumentKind,
      sizingMode,
      maxPriceImpactPercent,
      symbol,
    });
  }

  const { getTseClient } = await import("@/lib/terminal/tse-client");
  const { getLocalPortfolioSnapshot } = await import("@/lib/terminal/terminal-local.service");
  const client = getTseClient({ userId: user.id });
  const [security, marketStatus, snapshot] = await Promise.all([
    client.getSecurity(symbol),
    client.getMarketStatus(),
    getLocalPortfolioSnapshot(input.portfolioId),
  ]);

  const holding = snapshot.holdings.find((h) => h.symbol === symbol) ?? null;
  // Creation uses indicative quotes only. Market session, buying power, and holdings
  // are revalidated at each occurrence — surface them as warnings, not hard blocks.
  // When TSE is unavailable, still allow creating the instruction (authorization to attempt later).
  let estimatedValue: number | null = null;
  let estimatedFees: number | null = null;

  if (client.mode === "unavailable") {
    warnings.push(
      "Market connection is unavailable. The schedule will be saved, and each attempt will re-check connectivity before submitting.",
    );
  } else if (!security) {
    errors.push("Unknown symbol");
  } else {
    const preview = validateOrderPreview({
      order: {
        portfolioId: input.portfolioId,
        symbol,
        side: input.side,
        type: "market",
        quantity: input.quantity,
      },
      security,
      marketStatus: marketStatus.status,
      buyingPower: snapshot.buyingPower,
      holding,
    });

    const hardError = (msg: string) =>
      /halted|valid share quantity|whole number|portfolio is required|unknown symbol/i.test(msg);

    for (const err of preview.errors) {
      if (hardError(err)) errors.push(err);
      else
        warnings.push(
          `${err} Checked again at each attempt — Florins and shares are not reserved now.`,
        );
    }
    warnings.push(...preview.warnings);
    estimatedValue = preview.estimatedValue > 0 ? preview.estimatedValue : null;
    estimatedFees = preview.estimatedFees > 0 ? preview.estimatedFees : null;
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    portfolioId: input.portfolioId,
    symbol,
    side: input.side,
    quantity: input.quantity,
    florinAmount: null,
    instrumentKind: "STOCK",
    sizingMode: "QUANTITY",
    maxPriceImpactPercent: DEFAULT_CRYPTO_MAX_PRICE_IMPACT,
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    startAt: startAt.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    nextRunAt: startAt.toISOString(),
    estimatedValue,
    estimatedFees,
  };
}

async function previewCryptoScheduledTrade(
  user: AltaUser,
  input: ScheduledTradePreviewInput,
  ctx: {
    errors: string[];
    warnings: string[];
    startAt: Date;
    endAt: Date | null;
    instrumentKind: ScheduledTradeInstrumentKind;
    sizingMode: ScheduledTradeSizingMode;
    maxPriceImpactPercent: number;
    symbol: string;
  },
): Promise<ScheduledTradePreviewResult> {
  const { errors, warnings, startAt, endAt, instrumentKind, sizingMode, maxPriceImpactPercent, symbol } =
    ctx;

  let estimatedValue: number | null = null;
  let estimatedFees: number | null = null;

  try {
    const { previewTerminalCryptoOrder } = await import(
      "@/lib/terminal/crypto/terminal-crypto-preview.service"
    );
    const { CryptoOrderError } = await import("@/lib/terminal/crypto/crypto-order-types");

    const preview = await previewTerminalCryptoOrder(user, {
      portfolioId: input.portfolioId,
      symbol,
      side: input.side === "buy" ? "BUY" : "SELL",
      grossFlorins: String(input.florinAmount ?? ""),
    });

    estimatedValue = Number.parseFloat(preview.grossTradeValue);
    estimatedFees = Number.parseFloat(preview.totalFee);
    if (!Number.isFinite(estimatedValue)) estimatedValue = null;
    if (!Number.isFinite(estimatedFees)) estimatedFees = null;

    const impact = Number.parseFloat(preview.priceImpactPercent);
    if (Number.isFinite(impact) && Math.abs(impact) >= maxPriceImpactPercent) {
      warnings.push(
        `Current estimated price impact is about ${Math.abs(impact).toFixed(2)}%. Attempts at or above ${maxPriceImpactPercent}% are skipped automatically.`,
      );
    }
    for (const warning of preview.warnings) {
      warnings.push(warning.message);
    }
  } catch (error) {
    const { CryptoOrderError } = await import("@/lib/terminal/crypto/crypto-order-types");
    if (error instanceof CryptoOrderError) {
      // Soft-block draft/unavailable at create for clearer UX; cash/holdings remain warnings.
      if (
        error.code === "ASSET_DRAFT" ||
        error.code === "CRYPTO_UNAVAILABLE" ||
        error.code === "ASSET_CLOSED" ||
        error.code === "ASSET_HALTED" ||
        error.code === "REDEMPTION_ONLY"
      ) {
        errors.push(error.customerMessage);
      } else if (
        error.code === "INSUFFICIENT_CASH" ||
        error.code === "INSUFFICIENT_HOLDINGS" ||
        error.code === "WALLET_FROZEN"
      ) {
        warnings.push(
          `${error.customerMessage} Checked again at each attempt — Florins and coins are not reserved now.`,
        );
      } else if (error.code === "VALIDATION_FAILED") {
        errors.push(error.customerMessage);
      } else {
        warnings.push(error.customerMessage);
      }
    } else {
      warnings.push(
        "Crypto preview is temporarily unavailable. The schedule can still be saved and will re-check at each attempt.",
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    portfolioId: input.portfolioId,
    symbol,
    side: input.side,
    quantity: 0,
    florinAmount: input.florinAmount ?? null,
    instrumentKind,
    sizingMode,
    maxPriceImpactPercent,
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    startAt: startAt.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    nextRunAt: startAt.toISOString(),
    estimatedValue,
    estimatedFees,
  };
}

export async function createScheduledTrade(
  user: AltaUser,
  input: CreateScheduledTradeInput,
): Promise<ScheduledTradeDetail> {
  const preview = await previewCreateScheduledTrade(user, input);
  if (!preview.ok) badRequest(preview.errors[0] ?? "Unable to create scheduled trade.");

  const now = new Date();
  const { startAt, endAt, instrumentKind, sizingMode, maxPriceImpactPercent } =
    validateCreateInput(input, now);
  const symbol = input.symbol.trim().toUpperCase();

  const portfolio = await (
    await import("@/lib/terminal/terminal-portfolio.service")
  ).getTerminalPortfolioForUser(user, input.portfolioId);

  const quantity =
    instrumentKind === "CRYPTO" && sizingMode === "FLORIN_AMOUNT" ? 0 : input.quantity;
  const florinAmount =
    instrumentKind === "CRYPTO" && sizingMode === "FLORIN_AMOUNT"
      ? (input.florinAmount ?? null)
      : null;

  const row = await prisma.terminalScheduledTradeInstruction.create({
    data: {
      portfolioId: input.portfolioId,
      createdByUserId: user.id,
      companyId: portfolio.ownerType === "company" ? portfolio.ownerCompanyId : null,
      symbol,
      side: input.side === "buy" ? "BUY" : "SELL",
      orderType: "MARKET",
      instrumentKind: instrumentKind === "CRYPTO" ? "CRYPTO" : "STOCK",
      executionVenue: instrumentKind === "CRYPTO" ? "ALTA_CRYPTO" : "TSE",
      sizingMode: sizingMode === "FLORIN_AMOUNT" ? "FLORIN_AMOUNT" : "QUANTITY",
      quantity,
      florinAmount,
      maxPriceImpactPercent,
      scheduleType: toDbScheduleType(input.scheduleType),
      frequency: toDbFrequency(input.frequency),
      startAt,
      nextRunAt: startAt,
      endAt,
      timeZonePolicy: TERMINAL_SCHEDULED_TRADE_TIME_ZONE_POLICY,
      status: "ACTIVE",
    },
    include: {
      portfolio: { select: { name: true } },
      occurrences: true,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  const sizeLabel =
    instrumentKind === "CRYPTO" && sizingMode === "FLORIN_AMOUNT"
      ? `ƒ${florinAmount}`
      : String(quantity);
  await writeAuditLog({
    actorUserId: user.id,
    action: "TERMINAL_SCHEDULED_TRADE_CREATED",
    entityType: "TERMINAL_SCHEDULED_TRADE_INSTRUCTION",
    entityId: row.id,
    description: `Scheduled ${input.side} ${sizeLabel} ${symbol}`,
    targetUserId: portfolio.ownerUserId ?? user.id,
    targetCompanyId: portfolio.ownerCompanyId ?? undefined,
    metadata: auditSourceMetadata("website", {
      portfolioId: input.portfolioId,
      scheduleType: input.scheduleType,
      instrumentKind,
      startAt: startAt.toISOString(),
    }),
  });

  const { notifyTerminalScheduledTradeCreated } = await import(
    "@/server/terminal-scheduled-trade-notification.service"
  );
  notifyTerminalScheduledTradeCreated(user.id, mapInstructionRow(row));

  return mapDetail(row);
}

export async function listScheduledTradesForUser(
  user: AltaUser,
  portfolioId?: string,
): Promise<ScheduledTradeInstructionRow[]> {
  const { listAccessibleTerminalPortfolios } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  const accessible = await listAccessibleTerminalPortfolios(user);
  const accessibleIds = new Set(accessible.map((p) => p.id));
  if (portfolioId) {
    if (!accessibleIds.has(portfolioId)) return [];
  }

  const rows = await prisma.terminalScheduledTradeInstruction.findMany({
    where: {
      portfolioId: portfolioId ? portfolioId : { in: [...accessibleIds] },
    },
    include: { portfolio: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { nextRunAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapInstructionRow);
}

export async function getScheduledTradeDetail(
  user: AltaUser,
  instructionId: string,
): Promise<ScheduledTradeDetail> {
  const row = await loadInstructionForUser(user, instructionId);
  return mapDetail(row);
}

export async function pauseScheduledTrade(
  user: AltaUser,
  instructionId: string,
): Promise<ScheduledTradeDetail> {
  const existing = await loadInstructionForUser(user, instructionId);
  if (existing.createdByUserId !== user.id) badRequest("Only the creator can pause this schedule.");
  if (existing.status !== "ACTIVE") badRequest("Only active schedules can be paused.");

  const row = await prisma.terminalScheduledTradeInstruction.update({
    where: { id: instructionId },
    data: { status: "PAUSED", pausedAt: new Date(), version: { increment: 1 } },
    include: {
      portfolio: { select: { name: true } },
      occurrences: { orderBy: { scheduledRunAt: "desc" }, take: 12 },
    },
  });

  const { notifyTerminalScheduledTradePaused } = await import(
    "@/server/terminal-scheduled-trade-notification.service"
  );
  notifyTerminalScheduledTradePaused(user.id, mapInstructionRow(row));

  return mapDetail(row);
}

export async function resumeScheduledTrade(
  user: AltaUser,
  instructionId: string,
): Promise<ScheduledTradeDetail> {
  const existing = await loadInstructionForUser(user, instructionId);
  if (existing.createdByUserId !== user.id) badRequest("Only the creator can resume this schedule.");
  if (existing.status !== "PAUSED") badRequest("Only paused schedules can be resumed.");

  const now = new Date();
  const nextRunAt = calculateResumeNextRunAt(existing, now);
  if (!nextRunAt) badRequest("This schedule has no upcoming runs.");

  const row = await prisma.terminalScheduledTradeInstruction.update({
    where: { id: instructionId },
    data: {
      status: "ACTIVE",
      nextRunAt,
      resumedAt: now,
      consecutiveFailures: 0,
      version: { increment: 1 },
    },
    include: {
      portfolio: { select: { name: true } },
      occurrences: { orderBy: { scheduledRunAt: "desc" }, take: 12 },
    },
  });

  const { notifyTerminalScheduledTradeResumed } = await import(
    "@/server/terminal-scheduled-trade-notification.service"
  );
  notifyTerminalScheduledTradeResumed(user.id, mapInstructionRow(row));

  return mapDetail(row);
}

export async function cancelScheduledTrade(
  user: AltaUser,
  instructionId: string,
): Promise<ScheduledTradeDetail> {
  const existing = await loadInstructionForUser(user, instructionId);
  if (existing.createdByUserId !== user.id) badRequest("Only the creator can cancel this schedule.");
  if (["COMPLETED", "CANCELLED", "ENDED"].includes(existing.status)) {
    badRequest("This schedule cannot be cancelled.");
  }

  const row = await prisma.terminalScheduledTradeInstruction.update({
    where: { id: instructionId },
    data: { status: "CANCELLED", cancelledAt: new Date(), nextRunAt: null, version: { increment: 1 } },
    include: {
      portfolio: { select: { name: true } },
      occurrences: { orderBy: { scheduledRunAt: "desc" }, take: 12 },
    },
  });

  const { notifyTerminalScheduledTradeCancelled } = await import(
    "@/server/terminal-scheduled-trade-notification.service"
  );
  notifyTerminalScheduledTradeCancelled(user.id, mapInstructionRow(row));

  return mapDetail(row);
}

export async function listScheduledTradeOccurrences(
  user: AltaUser,
  instructionId: string,
): Promise<ScheduledTradeOccurrenceRow[]> {
  await loadInstructionForUser(user, instructionId);
  const rows = await prisma.terminalScheduledTradeOccurrence.findMany({
    where: { instructionId },
    orderBy: { scheduledRunAt: "desc" },
    take: 100,
  });
  return rows.map(mapOccurrence);
}
