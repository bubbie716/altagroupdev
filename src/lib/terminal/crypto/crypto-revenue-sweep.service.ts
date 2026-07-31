/**
 * Corporate-admin revenue sweep: move accrued Terminal crypto revenue into a
 * configured Terminal cash portfolio without touching protected/stabilization/customer wallets.
 */

import type { AltaUser } from "@/lib/auth/types";
import { isCorporateAdmin } from "@/lib/auth/permissions";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { d, roundDownMoney, serializeCryptoMoney } from "./crypto-decimal";
import {
  CryptoOpsError,
  requireConfirmation,
  requireIdempotencyKey,
  requireNonemptyReason,
} from "./crypto-ops-errors";

export type SweepCryptoRevenueInput = {
  symbol: string;
  amount: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedMarketStateVersion: number;
};

export type SweepCryptoRevenueResult = {
  sweepId: string;
  symbol: string;
  amount: string;
  destinationPortfolioId: string;
  accruedRevenueBefore: string;
  accruedRevenueAfter: string;
  cashLedgerEntryId: string;
  replayed: boolean;
};

export function resolveRevenueSweepDestinationPortfolioId(): string | null {
  const id = process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID?.trim();
  return id || null;
}

export async function validateRevenueSweepDestination(
  portfolioId: string,
): Promise<{ ok: true } | { ok: false; code: "DESTINATION_INVALID" }> {
  const portfolio = await prisma.terminalPortfolio.findUnique({
    where: { id: portfolioId },
    include: { cashAccount: true },
  });
  if (!portfolio || portfolio.status !== "ACTIVE") {
    return { ok: false, code: "DESTINATION_INVALID" };
  }
  return { ok: true };
}

export async function sweepCryptoRevenue(
  actor: AltaUser,
  input: SweepCryptoRevenueInput,
): Promise<SweepCryptoRevenueResult> {
  if (!isCorporateAdmin(actor)) {
    throw new CryptoOpsError("FORBIDDEN");
  }
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const symbol = input.symbol.trim().toUpperCase();

  let amount: Prisma.Decimal;
  try {
    amount = roundDownMoney(d(input.amount));
  } catch {
    throw new CryptoOpsError("VALIDATION_FAILED", "Amount must be a decimal string.");
  }
  if (!amount.greaterThan(0)) {
    throw new CryptoOpsError("NEGATIVE_AMOUNT");
  }

  const destinationPortfolioId = resolveRevenueSweepDestinationPortfolioId();
  if (!destinationPortfolioId) {
    throw new CryptoOpsError("DESTINATION_NOT_CONFIGURED");
  }
  const destCheck = await validateRevenueSweepDestination(destinationPortfolioId);
  if (!destCheck.ok) {
    throw new CryptoOpsError("DESTINATION_INVALID");
  }

  const existing = await prisma.terminalCryptoRevenueSweep.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      sweepId: existing.id,
      symbol,
      amount: serializeCryptoMoney(existing.amount),
      destinationPortfolioId: existing.destinationPortfolioId,
      accruedRevenueBefore: serializeCryptoMoney(existing.accruedRevenueBefore),
      accruedRevenueAfter: serializeCryptoMoney(existing.accruedRevenueAfter),
      cashLedgerEntryId: existing.cashLedgerEntryId ?? "",
      replayed: true,
    };
  }

  const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
    "@/server/financial-idempotency.service"
  );

  try {
    return await beginFinancialIdempotency({
      userId: actor.id,
      scope: "terminal_crypto_revenue_sweep",
      idempotencyKey,
      payload: {
        symbol,
        amount: amount.toFixed(2),
        destinationPortfolioId,
        expectedMarketStateVersion: input.expectedMarketStateVersion,
        reason,
      },
      execute: () =>
        executeSweep(actor, {
          symbol,
          amount,
          reason,
          idempotencyKey,
          destinationPortfolioId,
          expectedMarketStateVersion: input.expectedMarketStateVersion,
        }),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new CryptoOpsError("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

async function executeSweep(
  actor: AltaUser,
  input: {
    symbol: string;
    amount: Prisma.Decimal;
    reason: string;
    idempotencyKey: string;
    destinationPortfolioId: string;
    expectedMarketStateVersion: number;
  },
): Promise<SweepCryptoRevenueResult> {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.terminalCryptoAsset.findUnique({
      where: { symbol: input.symbol },
      include: { marketState: true },
    });
    if (!asset?.marketState) throw new CryptoOpsError("NOT_FOUND");

    await tx.$queryRaw`SELECT id FROM "TerminalCryptoMarketState" WHERE "assetId" = ${asset.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TerminalPortfolioCashAccount" WHERE "portfolioId" = ${input.destinationPortfolioId} FOR UPDATE`;

    const marketState = await tx.terminalCryptoMarketState.findUniqueOrThrow({
      where: { assetId: asset.id },
    });
    if (marketState.version !== input.expectedMarketStateVersion) {
      throw new CryptoOpsError("VERSION_CONFLICT", undefined, {
        version: String(marketState.version),
      });
    }

    const before = d(marketState.accruedRevenue.toString());
    if (input.amount.greaterThan(before)) {
      throw new CryptoOpsError("INSUFFICIENT_REVENUE");
    }
    const after = before.minus(input.amount);

    let cash = await tx.terminalPortfolioCashAccount.findUnique({
      where: { portfolioId: input.destinationPortfolioId },
    });
    if (!cash) {
      cash = await tx.terminalPortfolioCashAccount.create({
        data: {
          portfolioId: input.destinationPortfolioId,
          availableCash: 0,
          reservedCash: 0,
          currency: "FLORIN",
          version: 0,
        },
      });
    }

    const nextCash = d(cash.availableCash.toString()).plus(input.amount);
    const entryKey = `revenue-sweep:${input.idempotencyKey}:TERMINAL_REVENUE`;

    await tx.terminalCryptoMarketState.update({
      where: { id: marketState.id },
      data: {
        accruedRevenue: after,
        version: { increment: 1 },
      },
    });

    await tx.terminalCryptoMarketLedgerEntry.create({
      data: {
        assetId: asset.id,
        kind: "REVENUE_SWEEP",
        account: "TERMINAL_REVENUE",
        delta: input.amount.neg(),
        balanceAfter: after,
        entryKey,
        actorUserId: actor.id,
        source: "terminal_crypto_ops",
        externalReference: input.idempotencyKey,
      },
    });

    const cashEntry = await tx.terminalCashLedgerEntry.create({
      data: {
        portfolioId: input.destinationPortfolioId,
        cashAccountId: cash.id,
        amount: input.amount,
        availableCashAfter: nextCash,
        reservedCashAfter: cash.reservedCash,
        kind: "ADJUSTMENT",
        status: "POSTED",
        description: `Crypto revenue sweep from ${asset.symbol}`,
        idempotencyKey: `crypto-revenue-sweep:${input.idempotencyKey}`,
        actorUserId: actor.id,
        source: "terminal_crypto_revenue_sweep",
        externalReference: input.idempotencyKey,
      },
    });

    await tx.terminalPortfolioCashAccount.update({
      where: { id: cash.id },
      data: {
        availableCash: nextCash,
        version: { increment: 1 },
      },
    });

    const sweep = await tx.terminalCryptoRevenueSweep.create({
      data: {
        assetId: asset.id,
        amount: input.amount,
        destinationPortfolioId: input.destinationPortfolioId,
        cashLedgerEntryId: cashEntry.id,
        marketLedgerEntryKey: entryKey,
        reason: input.reason,
        actorUserId: actor.id,
        idempotencyKey: input.idempotencyKey,
        accruedRevenueBefore: before,
        accruedRevenueAfter: after,
      },
    });

    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: actor.id,
      action: "TERMINAL_CRYPTO_REVENUE_SWEEP",
      entityType: "TERMINAL_CRYPTO_REVENUE_SWEEP",
      entityId: sweep.id,
      description: `Swept ƒ${serializeCryptoMoney(input.amount)} ${asset.symbol} revenue to Terminal portfolio.`,
      metadata: {
        source: "OPERATOR",
        symbol: asset.symbol,
        amount: serializeCryptoMoney(input.amount),
        destinationPortfolioId: input.destinationPortfolioId,
        reason: input.reason,
      },
    });

    return {
      sweepId: sweep.id,
      symbol: asset.symbol,
      amount: serializeCryptoMoney(input.amount),
      destinationPortfolioId: input.destinationPortfolioId,
      accruedRevenueBefore: serializeCryptoMoney(before),
      accruedRevenueAfter: serializeCryptoMoney(after),
      cashLedgerEntryId: cashEntry.id,
      replayed: false,
    };
  });
}
