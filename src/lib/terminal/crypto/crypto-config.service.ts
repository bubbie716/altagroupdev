/**
 * Versioned crypto fee configuration (Phase 5).
 * Future orders only — never rewrites historical settlements or prices.
 *
 * Mutable today: buy/sell fee bps split (total / revenue / stabilization).
 * Read-only until migration: peg, curve rate, market-impact calibration targets.
 */

import type { AltaUser } from "@/lib/auth/types";
import { isCorporateAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import {
  CRYPTO_ASSET_CONFIGS,
  LAUNCH_ASSET_SYMBOLS,
  NVA_TARGET_IMPACT_PERCENT,
  VLT_TARGET_IMPACT_PERCENT,
  type CryptoAssetSymbol,
} from "./crypto-constants";
import { serializeCryptoPrice } from "./crypto-decimal";
import {
  CryptoOpsError,
  requireConfirmation,
  requireIdempotencyKey,
  requireNonemptyReason,
} from "./crypto-ops-errors";

export type CryptoFeeConfigProposal = {
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
};

export type UpdateCryptoFeeConfigInput = {
  symbol: string;
  fees: CryptoFeeConfigProposal;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedAssetVersion: number;
};

export type UpdateCryptoFeeConfigResult = {
  changeId: string;
  symbol: string;
  configVersion: number;
  effectiveAt: string;
  previous: CryptoFeeConfigProposal;
  next: CryptoFeeConfigProposal;
  replayed: boolean;
};

export type CryptoConfigSurface = {
  symbol: string;
  assetVersion: number;
  currentConfigVersion: number;
  fees: CryptoFeeConfigProposal & {
    mutable: true;
    readiness: string;
  };
  pegOrStartingPrice: {
    value: string;
    mutable: false;
    readiness: string;
  };
  curveRate: {
    value: string | null;
    mutable: false;
    readiness: string;
  };
  marketImpactThreshold: {
    value: string | null;
    mutable: false;
    readiness: string;
  };
  stablecoinPeg: {
    value: string | null;
    mutable: false;
    readiness: string;
  };
  recentChanges: Array<{
    id: string;
    configVersion: number;
    changeSummary: string;
    reason: string;
    actorUserId: string;
    previous: CryptoFeeConfigProposal;
    next: CryptoFeeConfigProposal;
    effectiveAt: string;
    createdAt: string;
  }>;
};

function assertFeeProposal(fees: CryptoFeeConfigProposal): void {
  const { totalFeeBps, revenueFeeBps, stabilizationFeeBps } = fees;
  for (const n of [totalFeeBps, revenueFeeBps, stabilizationFeeBps]) {
    if (!Number.isInteger(n) || n < 0 || n > 10_000) {
      throw new CryptoOpsError(
        "VALIDATION_FAILED",
        "Fee basis points must be integers from 0 to 10000.",
      );
    }
  }
  if (revenueFeeBps + stabilizationFeeBps !== totalFeeBps) {
    throw new CryptoOpsError(
      "VALIDATION_FAILED",
      "Revenue fee + stabilization fee must equal total fee.",
    );
  }
}

export async function getCryptoConfigSurface(symbolInput: string): Promise<CryptoConfigSurface | null> {
  const symbol = symbolInput.trim().toUpperCase();
  const asset = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol },
    include: {
      configChanges: {
        orderBy: { configVersion: "desc" },
        take: 12,
      },
    },
  });
  if (!asset) return null;

  const currentConfigVersion = asset.configChanges[0]?.configVersion ?? 0;
  const impact =
    symbol === "NVA"
      ? `${NVA_TARGET_IMPACT_PERCENT}% per ƒ100 gross from launch`
      : symbol === "VLT"
        ? `${VLT_TARGET_IMPACT_PERCENT}% per ƒ100 gross from launch`
        : null;

  return {
    symbol,
    assetVersion: asset.version,
    currentConfigVersion,
    fees: {
      totalFeeBps: asset.totalFeeBps,
      revenueFeeBps: asset.revenueFeeBps,
      stabilizationFeeBps: asset.stabilizationFeeBps,
      mutable: true,
      readiness:
        "Corporate admin may change fee bps for future orders. Historical fills keep their settled fees.",
    },
    pegOrStartingPrice: {
      value: serializeCryptoPrice(asset.pegOrStartingPrice),
      mutable: false,
      readiness:
        "Peg / launch price changes require a reviewed migration. Live edits would invalidate reserve liability math.",
    },
    curveRate: {
      value: asset.curveRate?.toString() ?? null,
      mutable: false,
      readiness:
        "Bonding-curve rate is migration-only while markets can hold circulating supply. Use the curve recalibration migration path.",
    },
    marketImpactThreshold: {
      value: impact,
      mutable: false,
      readiness:
        "Launch impact targets are application constants used to derive curve rates. Not editable from ops UI.",
    },
    stablecoinPeg: {
      value: asset.kind === "STABLE" ? serializeCryptoPrice(asset.pegOrStartingPrice) : null,
      mutable: false,
      readiness:
        asset.kind === "STABLE"
          ? "NPFC ƒ1.00 peg is foundational. Changing it requires a reviewed schema/ops migration."
          : "Not a stablecoin asset.",
    },
    recentChanges: asset.configChanges.map((row) => ({
      id: row.id,
      configVersion: row.configVersion,
      changeSummary: row.changeSummary,
      reason: row.reason,
      actorUserId: row.actorUserId,
      previous: {
        totalFeeBps: row.previousTotalFeeBps,
        revenueFeeBps: row.previousRevenueFeeBps,
        stabilizationFeeBps: row.previousStabilizationFeeBps,
      },
      next: {
        totalFeeBps: row.nextTotalFeeBps,
        revenueFeeBps: row.nextRevenueFeeBps,
        stabilizationFeeBps: row.nextStabilizationFeeBps,
      },
      effectiveAt: row.effectiveAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function updateCryptoFeeConfig(
  actor: AltaUser,
  input: UpdateCryptoFeeConfigInput,
): Promise<UpdateCryptoFeeConfigResult> {
  if (!isCorporateAdmin(actor)) {
    throw new CryptoOpsError("FORBIDDEN");
  }
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const symbol = input.symbol.trim().toUpperCase();
  assertFeeProposal(input.fees);

  const existing = await prisma.terminalCryptoAssetConfigChange.findFirst({
    where: { asset: { symbol }, idempotencyKey },
  });
  if (existing) {
    return {
      changeId: existing.id,
      symbol,
      configVersion: existing.configVersion,
      effectiveAt: existing.effectiveAt.toISOString(),
      previous: {
        totalFeeBps: existing.previousTotalFeeBps,
        revenueFeeBps: existing.previousRevenueFeeBps,
        stabilizationFeeBps: existing.previousStabilizationFeeBps,
      },
      next: {
        totalFeeBps: existing.nextTotalFeeBps,
        revenueFeeBps: existing.nextRevenueFeeBps,
        stabilizationFeeBps: existing.nextStabilizationFeeBps,
      },
      replayed: true,
    };
  }

  const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
    "@/server/financial-idempotency.service"
  );

  try {
    return await beginFinancialIdempotency({
      userId: actor.id,
      scope: "terminal_crypto_fee_config",
      idempotencyKey,
      payload: {
        symbol,
        fees: input.fees,
        expectedAssetVersion: input.expectedAssetVersion,
        reason,
      },
      execute: async () => {
        return prisma.$transaction(async (tx) => {
          const asset = await tx.terminalCryptoAsset.findUnique({
            where: { symbol },
          });
          if (!asset) throw new CryptoOpsError("NOT_FOUND");
          if (asset.version !== input.expectedAssetVersion) {
            throw new CryptoOpsError("VERSION_CONFLICT");
          }
          if (asset.status === "CLOSED") {
            throw new CryptoOpsError(
              "VALIDATION_FAILED",
              "Closed assets cannot receive fee configuration changes.",
            );
          }

          const previous: CryptoFeeConfigProposal = {
            totalFeeBps: asset.totalFeeBps,
            revenueFeeBps: asset.revenueFeeBps,
            stabilizationFeeBps: asset.stabilizationFeeBps,
          };
          const next = input.fees;
          if (
            previous.totalFeeBps === next.totalFeeBps &&
            previous.revenueFeeBps === next.revenueFeeBps &&
            previous.stabilizationFeeBps === next.stabilizationFeeBps
          ) {
            throw new CryptoOpsError(
              "VALIDATION_FAILED",
              "Proposed fees match the current configuration.",
            );
          }

          // NPFC stabilization must remain 0 (conversion fee is all revenue).
          if (asset.kind === "STABLE" && next.stabilizationFeeBps !== 0) {
            throw new CryptoOpsError(
              "VALIDATION_FAILED",
              "Stablecoin assets must keep stabilization fee at 0 bps.",
            );
          }

          const last = await tx.terminalCryptoAssetConfigChange.findFirst({
            where: { assetId: asset.id },
            orderBy: { configVersion: "desc" },
            select: { configVersion: true },
          });
          const configVersion = (last?.configVersion ?? 0) + 1;
          const changeSummary = `Fees ${previous.totalFeeBps}→${next.totalFeeBps} bps (revenue ${previous.revenueFeeBps}→${next.revenueFeeBps}, stabilization ${previous.stabilizationFeeBps}→${next.stabilizationFeeBps}). Applies to future orders only.`;

          const change = await tx.terminalCryptoAssetConfigChange.create({
            data: {
              assetId: asset.id,
              configVersion,
              previousTotalFeeBps: previous.totalFeeBps,
              previousRevenueFeeBps: previous.revenueFeeBps,
              previousStabilizationFeeBps: previous.stabilizationFeeBps,
              previousCurveRate: asset.curveRate,
              previousPegOrStartingPrice: asset.pegOrStartingPrice,
              nextTotalFeeBps: next.totalFeeBps,
              nextRevenueFeeBps: next.revenueFeeBps,
              nextStabilizationFeeBps: next.stabilizationFeeBps,
              nextCurveRate: asset.curveRate,
              nextPegOrStartingPrice: asset.pegOrStartingPrice,
              changeSummary,
              reason,
              actorUserId: actor.id,
              idempotencyKey,
              expectedAssetVersion: input.expectedAssetVersion,
            },
          });

          const updated = await tx.terminalCryptoAsset.updateMany({
            where: { id: asset.id, version: input.expectedAssetVersion },
            data: {
              totalFeeBps: next.totalFeeBps,
              revenueFeeBps: next.revenueFeeBps,
              stabilizationFeeBps: next.stabilizationFeeBps,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new CryptoOpsError("VERSION_CONFLICT");
          }

          const { writeAuditLog } = await import("@/server/audit.service");
          await writeAuditLog({
            actorUserId: actor.id,
            action: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
            entityType: "TERMINAL_CRYPTO_CONFIG",
            entityId: change.id,
            metadata: {
              symbol,
              configVersion: String(configVersion),
              idempotencyKey,
              reason,
              previousTotalFeeBps: String(previous.totalFeeBps),
              nextTotalFeeBps: String(next.totalFeeBps),
              previousRevenueFeeBps: String(previous.revenueFeeBps),
              nextRevenueFeeBps: String(next.revenueFeeBps),
              previousStabilizationFeeBps: String(previous.stabilizationFeeBps),
              nextStabilizationFeeBps: String(next.stabilizationFeeBps),
              impact: "future_orders_only",
              effectiveAt: change.effectiveAt.toISOString(),
            },
          });

          return {
            changeId: change.id,
            symbol,
            configVersion,
            effectiveAt: change.effectiveAt.toISOString(),
            previous,
            next,
            replayed: false,
          };
        });
      },
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new CryptoOpsError("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

/** Drift helper for ops UI — compares live fees to launch constants when applicable. */
export function feeConfigMatchesAuthoritative(symbol: string, fees: CryptoFeeConfigProposal): boolean {
  const sym = symbol.toUpperCase() as CryptoAssetSymbol;
  if (!LAUNCH_ASSET_SYMBOLS.includes(sym)) return true;
  const cfg = CRYPTO_ASSET_CONFIGS[sym];
  return (
    fees.totalFeeBps === cfg.totalFeeBps &&
    fees.revenueFeeBps === cfg.revenueFeeBps &&
    fees.stabilizationFeeBps === cfg.stabilizationFeeBps
  );
}
