/**
 * Append-only external contributions and revenue→stabilization reclassification (Phase 4).
 * Corporate admin only. Never mints customer coins or reduces protected/stabilization via UI.
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

export type CryptoContributionKind =
  | "PROTECTED_RESERVE"
  | "STABILIZATION_FUND"
  | "REVENUE_TO_STABILIZATION";

export type RecordCryptoContributionInput = {
  symbol: string;
  kind: CryptoContributionKind;
  amount: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedMarketStateVersion: number;
  externalReference?: string;
};

export type RecordCryptoContributionResult = {
  contributionId: string;
  symbol: string;
  kind: CryptoContributionKind;
  amount: string;
  replayed: boolean;
};

export async function recordCryptoExternalContribution(
  actor: AltaUser,
  input: RecordCryptoContributionInput,
): Promise<RecordCryptoContributionResult> {
  if (!isCorporateAdmin(actor)) {
    throw new CryptoOpsError("FORBIDDEN");
  }
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const symbol = input.symbol.trim().toUpperCase();

  if (
    input.kind !== "PROTECTED_RESERVE" &&
    input.kind !== "STABILIZATION_FUND" &&
    input.kind !== "REVENUE_TO_STABILIZATION"
  ) {
    throw new CryptoOpsError("VALIDATION_FAILED");
  }

  let amount: Prisma.Decimal;
  try {
    amount = roundDownMoney(d(input.amount));
  } catch {
    throw new CryptoOpsError("VALIDATION_FAILED", "Amount must be a decimal string.");
  }
  if (!amount.greaterThan(0)) {
    throw new CryptoOpsError("NEGATIVE_AMOUNT");
  }

  const existing = await prisma.terminalCryptoExternalContribution.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      contributionId: existing.id,
      symbol,
      kind: existing.kind,
      amount: serializeCryptoMoney(existing.amount),
      replayed: true,
    };
  }

  const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
    "@/server/financial-idempotency.service"
  );

  try {
    return await beginFinancialIdempotency({
      userId: actor.id,
      scope: "terminal_crypto_contribution",
      idempotencyKey,
      payload: {
        symbol,
        kind: input.kind,
        amount: amount.toFixed(2),
        expectedMarketStateVersion: input.expectedMarketStateVersion,
        reason,
        externalReference: input.externalReference ?? null,
      },
      execute: () =>
        executeContribution(actor, {
          symbol,
          kind: input.kind,
          amount,
          reason,
          idempotencyKey,
          expectedMarketStateVersion: input.expectedMarketStateVersion,
          externalReference: input.externalReference?.trim() || null,
        }),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new CryptoOpsError("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

async function executeContribution(
  actor: AltaUser,
  input: {
    symbol: string;
    kind: CryptoContributionKind;
    amount: Prisma.Decimal;
    reason: string;
    idempotencyKey: string;
    expectedMarketStateVersion: number;
    externalReference: string | null;
  },
): Promise<RecordCryptoContributionResult> {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.terminalCryptoAsset.findUnique({
      where: { symbol: input.symbol },
      include: { marketState: true },
    });
    if (!asset?.marketState) throw new CryptoOpsError("NOT_FOUND");

    await tx.$queryRaw`SELECT id FROM "TerminalCryptoMarketState" WHERE "assetId" = ${asset.id} FOR UPDATE`;

    const marketState = await tx.terminalCryptoMarketState.findUniqueOrThrow({
      where: { assetId: asset.id },
    });
    if (marketState.version !== input.expectedMarketStateVersion) {
      throw new CryptoOpsError("VERSION_CONFLICT", undefined, {
        version: String(marketState.version),
      });
    }

    const reserveBefore = d(marketState.protectedReserve.toString());
    const stabBefore = d(marketState.stabilizationFund.toString());
    const revenueBefore = d(marketState.accruedRevenue.toString());

    let reserveAfter = reserveBefore;
    let stabAfter = stabBefore;
    let revenueAfter = revenueBefore;
    const ledgerRows: Array<{
      kind:
        | "EXTERNAL_PROTECTED_CONTRIBUTION"
        | "EXTERNAL_STABILIZATION_CONTRIBUTION"
        | "REVENUE_TO_STABILIZATION";
      account: "PROTECTED_RESERVE" | "STABILIZATION_FUND" | "TERMINAL_REVENUE";
      delta: Prisma.Decimal;
      balanceAfter: Prisma.Decimal;
      seq: number;
    }> = [];

    if (input.kind === "PROTECTED_RESERVE") {
      reserveAfter = reserveBefore.plus(input.amount);
      ledgerRows.push({
        kind: "EXTERNAL_PROTECTED_CONTRIBUTION",
        account: "PROTECTED_RESERVE",
        delta: input.amount,
        balanceAfter: reserveAfter,
        seq: 1,
      });
    } else if (input.kind === "STABILIZATION_FUND") {
      stabAfter = stabBefore.plus(input.amount);
      ledgerRows.push({
        kind: "EXTERNAL_STABILIZATION_CONTRIBUTION",
        account: "STABILIZATION_FUND",
        delta: input.amount,
        balanceAfter: stabAfter,
        seq: 1,
      });
    } else {
      if (input.amount.greaterThan(revenueBefore)) {
        throw new CryptoOpsError("INSUFFICIENT_REVENUE");
      }
      revenueAfter = revenueBefore.minus(input.amount);
      stabAfter = stabBefore.plus(input.amount);
      ledgerRows.push(
        {
          kind: "REVENUE_TO_STABILIZATION",
          account: "TERMINAL_REVENUE",
          delta: input.amount.neg(),
          balanceAfter: revenueAfter,
          seq: 1,
        },
        {
          kind: "REVENUE_TO_STABILIZATION",
          account: "STABILIZATION_FUND",
          delta: input.amount,
          balanceAfter: stabAfter,
          seq: 2,
        },
      );
    }

    await tx.terminalCryptoMarketState.update({
      where: { id: marketState.id },
      data: {
        protectedReserve: reserveAfter,
        stabilizationFund: stabAfter,
        accruedRevenue: revenueAfter,
        version: { increment: 1 },
      },
    });

    for (const row of ledgerRows) {
      await tx.terminalCryptoMarketLedgerEntry.create({
        data: {
          assetId: asset.id,
          kind: row.kind,
          account: row.account,
          delta: row.delta,
          balanceAfter: row.balanceAfter,
          entryKey: `contribution:${input.idempotencyKey}:${row.account}:${row.seq}`,
          actorUserId: actor.id,
          source: "terminal_crypto_ops",
          externalReference: input.externalReference,
        },
      });
    }

    const contribution = await tx.terminalCryptoExternalContribution.create({
      data: {
        assetId: asset.id,
        kind: input.kind,
        amount: input.amount,
        externalReference: input.externalReference,
        reason: input.reason,
        actorUserId: actor.id,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: actor.id,
      action: `TERMINAL_CRYPTO_CONTRIBUTION_${input.kind}`,
      entityType: "TERMINAL_CRYPTO_CONTRIBUTION",
      entityId: contribution.id,
      description: `${asset.symbol} ${input.kind.replaceAll("_", " ").toLowerCase()}: ƒ${serializeCryptoMoney(input.amount)}. ${input.reason}`,
      metadata: {
        source: "OPERATOR",
        symbol: asset.symbol,
        kind: input.kind,
        amount: serializeCryptoMoney(input.amount),
        reason: input.reason,
        externalReference: input.externalReference,
      },
    });

    return {
      contributionId: contribution.id,
      symbol: asset.symbol,
      kind: input.kind,
      amount: serializeCryptoMoney(input.amount),
      replayed: false,
    };
  });
}
