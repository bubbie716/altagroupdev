/**
 * Authoritative Alta Terminal fictional-crypto asset lifecycle transitions (Phase 4).
 *
 * Permission matrix (enforced here + server functions):
 * - Corporate admin: activate, resume→ACTIVE, close, and all Terminal-admin actions
 * - Terminal admin: halt, redemption-only (from ACTIVE/HALTED/REDEMPTION_ONLY)
 * - Bank-only: denied at requireTerminalAdmin / requireAdmin boundary
 */

import type { AltaUser } from "@/lib/auth/types";
import { isCorporateAdmin, isTerminalAdmin } from "@/lib/auth/permissions";
import type { TerminalCryptoAssetStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { d } from "./crypto-decimal";
import {
  CryptoOpsError,
  requireConfirmation,
  requireIdempotencyKey,
  requireNonemptyReason,
} from "./crypto-ops-errors";
import { evaluateActivationReadiness } from "./crypto-activation-readiness.service";

export type CryptoLifecycleStatus = TerminalCryptoAssetStatus;

export type CryptoLifecycleTransition =
  | "DRAFT_TO_ACTIVE"
  | "DRAFT_TO_CLOSED"
  | "ACTIVE_TO_HALTED"
  | "ACTIVE_TO_REDEMPTION_ONLY"
  | "HALTED_TO_REDEMPTION_ONLY"
  | "HALTED_TO_ACTIVE"
  | "REDEMPTION_ONLY_TO_ACTIVE"
  | "REDEMPTION_ONLY_TO_HALTED"
  | "REDEMPTION_ONLY_TO_CLOSED";

type TransitionSpec = {
  from: CryptoLifecycleStatus;
  to: CryptoLifecycleStatus;
  /** Corporate admin required (activate / resume / close). */
  corporateOnly: boolean;
  requiresReadiness: boolean;
  requiresZeroCirculation: boolean;
  /** DRAFT→CLOSED also requires no settlements / wallet holdings. */
  requiresNoActivity?: boolean;
};

const TRANSITIONS: Record<CryptoLifecycleTransition, TransitionSpec> = {
  DRAFT_TO_ACTIVE: {
    from: "DRAFT",
    to: "ACTIVE",
    corporateOnly: true,
    requiresReadiness: true,
    requiresZeroCirculation: false,
  },
  DRAFT_TO_CLOSED: {
    from: "DRAFT",
    to: "CLOSED",
    corporateOnly: true,
    requiresReadiness: false,
    requiresZeroCirculation: true,
    requiresNoActivity: true,
  },
  ACTIVE_TO_HALTED: {
    from: "ACTIVE",
    to: "HALTED",
    corporateOnly: false,
    requiresReadiness: false,
    requiresZeroCirculation: false,
  },
  ACTIVE_TO_REDEMPTION_ONLY: {
    from: "ACTIVE",
    to: "REDEMPTION_ONLY",
    corporateOnly: false,
    requiresReadiness: false,
    requiresZeroCirculation: false,
  },
  HALTED_TO_REDEMPTION_ONLY: {
    from: "HALTED",
    to: "REDEMPTION_ONLY",
    corporateOnly: false,
    requiresReadiness: false,
    requiresZeroCirculation: false,
  },
  HALTED_TO_ACTIVE: {
    from: "HALTED",
    to: "ACTIVE",
    corporateOnly: true,
    requiresReadiness: true,
    requiresZeroCirculation: false,
  },
  REDEMPTION_ONLY_TO_ACTIVE: {
    from: "REDEMPTION_ONLY",
    to: "ACTIVE",
    corporateOnly: true,
    requiresReadiness: true,
    requiresZeroCirculation: false,
  },
  REDEMPTION_ONLY_TO_HALTED: {
    from: "REDEMPTION_ONLY",
    to: "HALTED",
    corporateOnly: false,
    requiresReadiness: false,
    requiresZeroCirculation: false,
  },
  REDEMPTION_ONLY_TO_CLOSED: {
    from: "REDEMPTION_ONLY",
    to: "CLOSED",
    corporateOnly: true,
    requiresReadiness: false,
    requiresZeroCirculation: true,
  },
};

export function resolveLifecycleTransition(
  from: CryptoLifecycleStatus,
  to: CryptoLifecycleStatus,
): CryptoLifecycleTransition | null {
  for (const [key, spec] of Object.entries(TRANSITIONS) as Array<
    [CryptoLifecycleTransition, TransitionSpec]
  >) {
    if (spec.from === from && spec.to === to) return key;
  }
  return null;
}

export function isLifecycleTransitionAllowed(
  from: CryptoLifecycleStatus,
  to: CryptoLifecycleStatus,
): boolean {
  return resolveLifecycleTransition(from, to) != null;
}

export function transitionRequiresCorporateAdmin(transition: CryptoLifecycleTransition): boolean {
  return TRANSITIONS[transition].corporateOnly;
}

export function assertActorMayPerformLifecycleTransition(
  user: AltaUser,
  transition: CryptoLifecycleTransition,
): void {
  const corp = isCorporateAdmin(user);
  const terminal = isTerminalAdmin(user);
  if (!corp && !terminal) {
    throw new CryptoOpsError("FORBIDDEN");
  }
  if (TRANSITIONS[transition].corporateOnly && !corp) {
    throw new CryptoOpsError("FORBIDDEN");
  }
}

export type TransitionCryptoAssetStatusInput = {
  symbol: string;
  toStatus: CryptoLifecycleStatus;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedStatus: CryptoLifecycleStatus;
  expectedVersion: number;
  /** Optional typed-symbol confirmation for activate/close. */
  typedSymbol?: string;
};

export type TransitionCryptoAssetStatusResult = {
  assetId: string;
  symbol: string;
  fromStatus: CryptoLifecycleStatus;
  toStatus: CryptoLifecycleStatus;
  version: number;
  statusChangeId: string;
  replayed: boolean;
};

export async function transitionCryptoAssetStatus(
  actor: AltaUser,
  input: TransitionCryptoAssetStatusInput,
): Promise<TransitionCryptoAssetStatusResult> {
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const symbol = input.symbol.trim().toUpperCase();

  const transition = resolveLifecycleTransition(input.expectedStatus, input.toStatus);
  if (!transition) {
    throw new CryptoOpsError("INVALID_TRANSITION");
  }
  assertActorMayPerformLifecycleTransition(actor, transition);

  const spec = TRANSITIONS[transition];
  if (
    (spec.to === "ACTIVE" || spec.to === "CLOSED") &&
    input.typedSymbol?.trim().toUpperCase() !== symbol
  ) {
    throw new CryptoOpsError(
      "VALIDATION_FAILED",
      "Type the asset symbol to confirm this privileged action.",
    );
  }

  const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
    "@/server/financial-idempotency.service"
  );

  try {
    return await beginFinancialIdempotency({
      userId: actor.id,
      scope: "terminal_crypto_lifecycle",
      idempotencyKey,
      payload: {
        symbol,
        toStatus: input.toStatus,
        expectedStatus: input.expectedStatus,
        expectedVersion: input.expectedVersion,
        reason,
      },
      execute: () =>
        executeLifecycleTransition(actor, {
          symbol,
          toStatus: input.toStatus,
          reason,
          idempotencyKey,
          expectedStatus: input.expectedStatus,
          expectedVersion: input.expectedVersion,
          transition,
          spec,
        }),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new CryptoOpsError("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

async function executeLifecycleTransition(
  actor: AltaUser,
  input: {
    symbol: string;
    toStatus: CryptoLifecycleStatus;
    reason: string;
    idempotencyKey: string;
    expectedStatus: CryptoLifecycleStatus;
    expectedVersion: number;
    transition: CryptoLifecycleTransition;
    spec: TransitionSpec;
  },
): Promise<TransitionCryptoAssetStatusResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TerminalCryptoAsset" WHERE symbol = ${input.symbol} FOR UPDATE`;

    const asset = await tx.terminalCryptoAsset.findUnique({
      where: { symbol: input.symbol },
      include: { marketState: true },
    });
    if (!asset) throw new CryptoOpsError("NOT_FOUND");

    // Replay via status-change uniqueness
    const existingChange = await tx.terminalCryptoAssetStatusChange.findUnique({
      where: {
        assetId_idempotencyKey: {
          assetId: asset.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existingChange) {
      return {
        assetId: asset.id,
        symbol: asset.symbol,
        fromStatus: existingChange.fromStatus,
        toStatus: existingChange.toStatus,
        version: asset.version,
        statusChangeId: existingChange.id,
        replayed: true,
      };
    }

    if (asset.status !== input.expectedStatus || asset.version !== input.expectedVersion) {
      throw new CryptoOpsError("VERSION_CONFLICT", undefined, {
        status: asset.status,
        version: String(asset.version),
      });
    }

    if (asset.status !== input.spec.from || input.toStatus !== input.spec.to) {
      throw new CryptoOpsError("INVALID_TRANSITION");
    }

    if (input.spec.requiresReadiness) {
      const readiness = await evaluateActivationReadiness(asset.symbol, { tx });
      if (!readiness.allPassed) {
        throw new CryptoOpsError("READINESS_BLOCKED", undefined, {
          failedChecks: String(readiness.items.filter((i) => !i.passed).length),
        });
      }
    }

    const circulating = d(asset.marketState?.circulatingSupply?.toString() ?? "0");
    if (input.spec.requiresZeroCirculation && !circulating.equals(0)) {
      throw new CryptoOpsError("CIRCULATION_NOT_ZERO");
    }

    if (input.spec.requiresNoActivity) {
      const settlementCount = await tx.terminalCryptoOrderSettlement.count({
        where: { assetId: asset.id },
      });
      const walletHoldings = await tx.terminalCryptoWalletBalance.count({
        where: {
          assetId: asset.id,
          OR: [{ availableQuantity: { gt: 0 } }, { reservedQuantity: { gt: 0 } }],
        },
      });
      if (settlementCount > 0 || walletHoldings > 0 || !circulating.equals(0)) {
        throw new CryptoOpsError("ACTIVITY_PRESENT");
      }
    }

    if (input.spec.to === "CLOSED") {
      const criticalOpen = await tx.terminalCryptoReconciliationIssue.count({
        where: {
          assetId: asset.id,
          status: "OPEN",
          severity: "CRITICAL",
        },
      });
      if (criticalOpen > 0) {
        throw new CryptoOpsError("READINESS_BLOCKED", "Unresolved critical reconciliation issues block close.");
      }
    }

    const updated = await tx.terminalCryptoAsset.update({
      where: { id: asset.id },
      data: {
        status: input.toStatus,
        version: { increment: 1 },
      },
    });

    const statusChange = await tx.terminalCryptoAssetStatusChange.create({
      data: {
        assetId: asset.id,
        fromStatus: asset.status,
        toStatus: input.toStatus,
        reason: input.reason,
        actorUserId: actor.id,
        idempotencyKey: input.idempotencyKey,
        expectedVersion: input.expectedVersion,
      },
    });

    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: actor.id,
      action: `TERMINAL_CRYPTO_STATUS_${input.toStatus}`,
      entityType: "TERMINAL_CRYPTO_ASSET",
      entityId: asset.id,
      description: `${asset.symbol}: ${asset.status} → ${input.toStatus}. ${input.reason}`,
      metadata: {
        source: "OPERATOR",
        symbol: asset.symbol,
        fromStatus: asset.status,
        toStatus: input.toStatus,
        transition: input.transition,
        statusChangeId: statusChange.id,
        reason: input.reason,
      },
    });

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      fromStatus: asset.status,
      toStatus: updated.status,
      version: updated.version,
      statusChangeId: statusChange.id,
      replayed: false,
    };
  });
}

/** Pure helper exported for unit tests. */
export function listAllowedLifecycleTransitions(): Array<{
  key: CryptoLifecycleTransition;
  from: CryptoLifecycleStatus;
  to: CryptoLifecycleStatus;
  corporateOnly: boolean;
}> {
  return (Object.entries(TRANSITIONS) as Array<[CryptoLifecycleTransition, TransitionSpec]>).map(
    ([key, spec]) => ({
      key,
      from: spec.from,
      to: spec.to,
      corporateOnly: spec.corporateOnly,
    }),
  );
}
