import type {
  NccLiquidityOperation,
  NccLiquidityOperationType,
  SettlementAccount,
} from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  asDecimal,
  assertPositiveMoneyAmount,
  moneyAdd,
  moneyLt,
  moneySub,
  NCC_DEFAULT_CURRENCY,
} from "@/lib/ncc/ncc-money";
import { prisma } from "@/server/db";
import { enqueueOutboxEvent } from "@/server/ncc/ncc-outbox.service";
import { requireInstitutionPermission, requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccLiquidityError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccLiquidityError";
  }
}

const CORRECTION_REASON_MIN = 20;

export const NCC_LIQUIDITY_OUTBOX = {
  REQUESTED: "liquidity.requested",
  APPLIED: "liquidity.applied",
  REJECTED: "liquidity.rejected",
  LOW_LIQUIDITY: "liquidity.low",
  INSUFFICIENT: "liquidity.insufficient",
} as const;

async function writeLiquidityAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  institutionId: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_LIQUIDITY_OPERATION",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

function serializeOp(op: NccLiquidityOperation) {
  return {
    id: op.id,
    institutionId: op.institutionId,
    settlementAccountId: op.settlementAccountId,
    currency: op.currency,
    amount: op.amount.toString(),
    operationType: op.operationType,
    externalReference: op.externalReference,
    reason: op.reason,
    idempotencyKey: op.idempotencyKey,
    status: op.status,
    requestedByUserId: op.requestedByUserId,
    approvedByUserId: op.approvedByUserId,
    balanceBeforeLedger: op.balanceBeforeLedger?.toString() ?? null,
    balanceBeforeAvailable: op.balanceBeforeAvailable?.toString() ?? null,
    balanceAfterLedger: op.balanceAfterLedger?.toString() ?? null,
    balanceAfterAvailable: op.balanceAfterAvailable?.toString() ?? null,
    failureCode: op.failureCode,
    createdAt: op.createdAt.toISOString(),
    approvedAt: op.approvedAt?.toISOString() ?? null,
    appliedAt: op.appliedAt?.toISOString() ?? null,
    rejectedAt: op.rejectedAt?.toISOString() ?? null,
    cancelledAt: op.cancelledAt?.toISOString() ?? null,
  };
}

async function emitLiquidityAlert(input: {
  institutionId: string;
  settlementAccountId: string;
  kind: "LOW_LIQUIDITY" | "INSUFFICIENT_LIQUIDITY";
  available: string;
  threshold: string | null;
  actorUserId?: string;
}) {
  await enqueueOutboxEvent({
    eventType:
      input.kind === "LOW_LIQUIDITY"
        ? NCC_LIQUIDITY_OUTBOX.LOW_LIQUIDITY
        : NCC_LIQUIDITY_OUTBOX.INSUFFICIENT,
    dedupeKey: `${input.kind}:${input.settlementAccountId}:${input.available}`,
    payload: {
      institutionId: input.institutionId,
      settlementAccountId: input.settlementAccountId,
      available: input.available,
      threshold: input.threshold,
      kind: input.kind,
    },
  });
  if (input.actorUserId) {
    await writeLiquidityAudit({
      actorUserId: input.actorUserId,
      action:
        input.kind === "LOW_LIQUIDITY"
          ? NCC_AUDIT.LIQUIDITY_LOW_ALERT
          : NCC_AUDIT.LIQUIDITY_INSUFFICIENT_ALERT,
      entityId: input.settlementAccountId,
      description: `${input.kind}: available=${input.available}`,
      institutionId: input.institutionId,
      metadata: { available: input.available, threshold: input.threshold },
    });
  }
}

export async function maybeAlertLowLiquidity(
  account: SettlementAccount,
  actorUserId?: string,
): Promise<void> {
  if (account.lowLiquidityThreshold == null) return;
  const available = asDecimal(account.availableBalance);
  const threshold = asDecimal(account.lowLiquidityThreshold);
  if (available.lte(threshold)) {
    await emitLiquidityAlert({
      institutionId: account.institutionId,
      settlementAccountId: account.id,
      kind: "LOW_LIQUIDITY",
      available: available.toFixed(2),
      threshold: threshold.toFixed(2),
      actorUserId,
    });
  }
}

export async function alertInsufficientLiquidity(input: {
  institutionId: string;
  settlementAccountId: string;
  available: string;
  required: string;
  actorUserId?: string;
}): Promise<void> {
  await emitLiquidityAlert({
    institutionId: input.institutionId,
    settlementAccountId: input.settlementAccountId,
    kind: "INSUFFICIENT_LIQUIDITY",
    available: input.available,
    threshold: input.required,
    actorUserId: input.actorUserId,
  });
}

type LiquidityRequestInput = {
  settlementAccountId: string;
  amount: string | number;
  operationType: NccLiquidityOperationType;
  reason: string;
  idempotencyKey: string;
  externalReference?: string | null;
  /** For AUTHORIZED_CORRECTION: CREDIT increases balances, DEBIT decreases. */
  correctionDirection?: "CREDIT" | "DEBIT";
};

/** Core request path — caller enforces staff authorization. Idempotent on idempotencyKey. */
export async function requestLiquidityOperationForActor(
  actorUserId: string,
  input: LiquidityRequestInput,
): Promise<ReturnType<typeof serializeOp>> {
  const reason = input.reason.trim();
  if (!reason) throw new NccLiquidityError("REASON_REQUIRED");
  if (!input.idempotencyKey.trim()) throw new NccLiquidityError("IDEMPOTENCY_KEY_REQUIRED");

  const existing = await prisma.nccLiquidityOperation.findUnique({
    where: { idempotencyKey: input.idempotencyKey.trim() },
  });
  if (existing) return serializeOp(existing);

  const amount = assertPositiveMoneyAmount(input.amount);
  if (
    input.operationType === "AUTHORIZED_CORRECTION" &&
    reason.length < CORRECTION_REASON_MIN
  ) {
    throw new NccLiquidityError(
      "CORRECTION_REASON_TOO_SHORT",
      `Corrections require a reason of at least ${CORRECTION_REASON_MIN} characters`,
    );
  }
  if (input.operationType === "AUTHORIZED_CORRECTION" && !input.correctionDirection) {
    throw new NccLiquidityError("CORRECTION_DIRECTION_REQUIRED");
  }

  const account = await prisma.settlementAccount.findUnique({
    where: { id: input.settlementAccountId },
  });
  if (!account) throw new NccLiquidityError("SETTLEMENT_ACCOUNT_NOT_FOUND");

  const op = await prisma.nccLiquidityOperation.create({
    data: {
      institutionId: account.institutionId,
      settlementAccountId: account.id,
      currency: account.currency || NCC_DEFAULT_CURRENCY,
      amount,
      operationType: input.operationType,
      externalReference: input.externalReference?.trim() || null,
      reason,
      idempotencyKey: input.idempotencyKey.trim(),
      status: "PENDING_APPROVAL",
      requestedByUserId: actorUserId,
      metadata: input.correctionDirection
        ? { correctionDirection: input.correctionDirection }
        : undefined,
    },
  });

  await enqueueOutboxEvent({
    eventType: NCC_LIQUIDITY_OUTBOX.REQUESTED,
    dedupeKey: `liquidity.requested:${op.id}`,
    payload: {
      operationId: op.id,
      institutionId: op.institutionId,
      operationType: op.operationType,
      amount: amount.toFixed(2),
    },
  });

  await writeLiquidityAudit({
    actorUserId,
    action: NCC_AUDIT.LIQUIDITY_REQUESTED,
    entityId: op.id,
    description: `Liquidity ${op.operationType} requested for ${amount.toFixed(2)} ${op.currency}`,
    institutionId: op.institutionId,
    metadata: {
      settlementAccountId: op.settlementAccountId,
      operationType: op.operationType,
      amount: amount.toFixed(2),
      externalReference: op.externalReference,
    },
  });

  return serializeOp(op);
}

/** Request a liquidity operation — NCC staff only. Idempotent on idempotencyKey. */
export async function requestLiquidityOperation(
  input: LiquidityRequestInput,
): Promise<ReturnType<typeof serializeOp>> {
  const actor = await requireNccStaff("manage_liquidity");
  return requestLiquidityOperationForActor(actor.id, input);
}

async function applyLiquidityInTransaction(
  op: NccLiquidityOperation,
  approverUserId: string,
): Promise<NccLiquidityOperation> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<NccLiquidityOperation[]>`
      SELECT * FROM "NccLiquidityOperation" WHERE id = ${op.id} FOR UPDATE
    `;
    const current = locked[0];
    if (!current) throw new NccLiquidityError("NOT_FOUND");
    if (current.status === "APPLIED") return current;
    if (current.status !== "PENDING_APPROVAL" && current.status !== "APPROVED") {
      throw new NccLiquidityError("OPERATION_NOT_APPROVABLE", `Status ${current.status}`);
    }

    const accounts = await tx.$queryRaw<SettlementAccount[]>`
      SELECT * FROM "SettlementAccount" WHERE id = ${current.settlementAccountId} FOR UPDATE
    `;
    const account = accounts[0];
    if (!account) throw new NccLiquidityError("SETTLEMENT_ACCOUNT_NOT_FOUND");

    const beforeLedger = asDecimal(account.ledgerBalance);
    const beforeAvailable = asDecimal(account.availableBalance);
    const amount = asDecimal(current.amount);
    let afterLedger = beforeLedger;
    let afterAvailable = beforeAvailable;

    const meta = (current.metadata ?? {}) as { correctionDirection?: "CREDIT" | "DEBIT" };

    if (current.operationType === "OPENING_BALANCE_AUTHORIZATION") {
      // Authorize current balances as opening — do not rewrite.
      afterLedger = beforeLedger;
      afterAvailable = beforeAvailable;
    } else if (current.operationType === "FUNDING") {
      afterLedger = moneyAdd(beforeLedger, amount);
      afterAvailable = moneyAdd(beforeAvailable, amount);
    } else if (current.operationType === "WITHDRAWAL") {
      if (moneyLt(beforeAvailable, amount)) {
        throw new NccLiquidityError("WITHDRAWAL_EXCEEDS_AVAILABLE");
      }
      afterLedger = moneySub(beforeLedger, amount);
      afterAvailable = moneySub(beforeAvailable, amount);
      if (afterLedger.lt(0) || afterAvailable.lt(0)) {
        throw new NccLiquidityError("NEGATIVE_BALANCE_DENIED");
      }
    } else if (current.operationType === "AUTHORIZED_CORRECTION") {
      const dir = meta.correctionDirection;
      if (dir === "DEBIT") {
        if (moneyLt(beforeAvailable, amount)) {
          throw new NccLiquidityError("CORRECTION_EXCEEDS_AVAILABLE");
        }
        afterLedger = moneySub(beforeLedger, amount);
        afterAvailable = moneySub(beforeAvailable, amount);
      } else {
        afterLedger = moneyAdd(beforeLedger, amount);
        afterAvailable = moneyAdd(beforeAvailable, amount);
      }
      if (afterLedger.lt(0) || afterAvailable.lt(0)) {
        throw new NccLiquidityError("NEGATIVE_BALANCE_DENIED");
      }
    }

    if (current.operationType !== "OPENING_BALANCE_AUTHORIZATION") {
      await tx.settlementAccount.update({
        where: { id: account.id },
        data: {
          ledgerBalance: afterLedger,
          availableBalance: afterAvailable,
        },
      });
    }

    if (current.operationType === "OPENING_BALANCE_AUTHORIZATION") {
      await tx.settlementAccount.update({
        where: { id: account.id },
        data: { legacyFloatReviewStatus: "AUTHORIZED" },
      });
    } else if (
      account.legacyFloatReviewStatus === "REQUIRES_REVIEW" &&
      current.operationType === "AUTHORIZED_CORRECTION"
    ) {
      await tx.settlementAccount.update({
        where: { id: account.id },
        data: { legacyFloatReviewStatus: "CORRECTED" },
      });
    }

    const now = new Date();
    const applied = await tx.nccLiquidityOperation.update({
      where: { id: current.id },
      data: {
        status: "APPLIED",
        approvedByUserId: approverUserId,
        approvedAt: current.approvedAt ?? now,
        appliedAt: now,
        balanceBeforeLedger: beforeLedger,
        balanceBeforeAvailable: beforeAvailable,
        balanceAfterLedger: afterLedger,
        balanceAfterAvailable: afterAvailable,
      },
    });

    await enqueueOutboxEvent(
      {
        eventType: NCC_LIQUIDITY_OUTBOX.APPLIED,
        dedupeKey: `liquidity.applied:${applied.id}`,
        payload: {
          operationId: applied.id,
          institutionId: applied.institutionId,
          operationType: applied.operationType,
          amount: amount.toFixed(2),
          balanceAfterAvailable: afterAvailable.toFixed(2),
        },
      },
      tx,
    );

    return applied;
  });
}

/** Core approve/apply — dual control: approver ≠ requester. Idempotent. */
export async function approveLiquidityOperationForActor(
  approverUserId: string,
  input: { operationId: string },
): Promise<ReturnType<typeof serializeOp>> {
  const op = await prisma.nccLiquidityOperation.findUnique({
    where: { id: input.operationId },
  });
  if (!op) throw new NccLiquidityError("NOT_FOUND");
  if (op.status === "APPLIED") return serializeOp(op);
  if (op.status === "REJECTED" || op.status === "CANCELLED" || op.status === "FAILED") {
    throw new NccLiquidityError("OPERATION_TERMINAL", `Status ${op.status}`);
  }
  if (op.requestedByUserId === approverUserId) {
    throw new NccLiquidityError("SELF_APPROVAL_DENIED");
  }

  try {
    const applied = await applyLiquidityInTransaction(op, approverUserId);
    await writeLiquidityAudit({
      actorUserId: approverUserId,
      action: NCC_AUDIT.LIQUIDITY_APPLIED,
      entityId: applied.id,
      description: `Liquidity ${applied.operationType} applied for ${applied.amount.toString()} ${applied.currency}`,
      institutionId: applied.institutionId,
      metadata: {
        settlementAccountId: applied.settlementAccountId,
        balanceAfterAvailable: applied.balanceAfterAvailable?.toString(),
      },
    });

    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { id: applied.settlementAccountId },
    });
    await maybeAlertLowLiquidity(account, approverUserId);

    return serializeOp(applied);
  } catch (error) {
    if (error instanceof NccLiquidityError && error.code === "WITHDRAWAL_EXCEEDS_AVAILABLE") {
      await prisma.nccLiquidityOperation.update({
        where: { id: op.id },
        data: {
          status: "FAILED",
          failureCode: error.code,
          approvedByUserId: approverUserId,
          approvedAt: new Date(),
        },
      });
    }
    throw error;
  }
}

/** Approve and apply — dual control: approver ≠ requester. Idempotent. */
export async function approveLiquidityOperation(input: {
  operationId: string;
}): Promise<ReturnType<typeof serializeOp>> {
  const approver = await requireNccStaff("approve_liquidity");
  return approveLiquidityOperationForActor(approver.id, input);
}

export async function rejectLiquidityOperation(input: {
  operationId: string;
  reason: string;
}): Promise<ReturnType<typeof serializeOp>> {
  const actor = await requireNccStaff("approve_liquidity");
  const reason = input.reason.trim();
  if (!reason) throw new NccLiquidityError("REASON_REQUIRED");

  const op = await prisma.nccLiquidityOperation.findUnique({
    where: { id: input.operationId },
  });
  if (!op) throw new NccLiquidityError("NOT_FOUND");
  if (op.status === "APPLIED") throw new NccLiquidityError("ALREADY_APPLIED");
  if (op.status === "REJECTED") return serializeOp(op);
  if (op.requestedByUserId === actor.id) {
    throw new NccLiquidityError("SELF_APPROVAL_DENIED");
  }

  const updated = await prisma.nccLiquidityOperation.update({
    where: { id: op.id },
    data: {
      status: "REJECTED",
      approvedByUserId: actor.id,
      rejectedAt: new Date(),
      failureCode: "REJECTED",
      metadata: {
        ...((op.metadata as object) ?? {}),
        rejectionReason: reason,
      },
    },
  });

  await enqueueOutboxEvent({
    eventType: NCC_LIQUIDITY_OUTBOX.REJECTED,
    dedupeKey: `liquidity.rejected:${updated.id}`,
    payload: { operationId: updated.id, reason },
  });

  await writeLiquidityAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.LIQUIDITY_REJECTED,
    entityId: updated.id,
    description: `Liquidity operation rejected: ${reason}`,
    institutionId: updated.institutionId,
  });

  return serializeOp(updated);
}

export async function setSettlementAccountThreshold(input: {
  settlementAccountId: string;
  threshold: string | number | null;
}): Promise<SettlementAccount> {
  const actor = await requireNccStaff("manage_liquidity");
  const threshold =
    input.threshold == null || input.threshold === ""
      ? null
      : assertPositiveMoneyAmount(input.threshold);

  const updated = await prisma.settlementAccount.update({
    where: { id: input.settlementAccountId },
    data: { lowLiquidityThreshold: threshold },
  });

  await writeLiquidityAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.LIQUIDITY_THRESHOLD_SET,
    entityId: updated.id,
    description: `Low-liquidity threshold set to ${threshold?.toFixed(2) ?? "none"}`,
    institutionId: updated.institutionId,
    metadata: { threshold: threshold?.toFixed(2) ?? null },
  });

  await maybeAlertLowLiquidity(updated, actor.id);
  return updated;
}

export async function freezeSettlementAccount(input: {
  settlementAccountId: string;
  reason: string;
}): Promise<SettlementAccount> {
  const actor = await requireNccStaff("manage_liquidity");
  const reason = input.reason.trim();
  if (!reason) throw new NccLiquidityError("REASON_REQUIRED");

  const updated = await prisma.settlementAccount.update({
    where: { id: input.settlementAccountId },
    data: {
      status: "FROZEN",
      frozenAt: new Date(),
      frozenReason: reason,
    },
  });

  await writeLiquidityAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.SETTLEMENT_ACCOUNT_FROZEN,
    entityId: updated.id,
    description: `Settlement account frozen: ${reason}`,
    institutionId: updated.institutionId,
  });

  return updated;
}

export async function unfreezeSettlementAccount(input: {
  settlementAccountId: string;
  reason: string;
}): Promise<SettlementAccount> {
  const actor = await requireNccStaff("manage_liquidity");
  const reason = input.reason.trim();
  if (!reason) throw new NccLiquidityError("REASON_REQUIRED");

  const updated = await prisma.settlementAccount.update({
    where: { id: input.settlementAccountId },
    data: {
      status: "ACTIVE",
      frozenAt: null,
      frozenReason: null,
    },
  });

  await writeLiquidityAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.SETTLEMENT_ACCOUNT_UNFROZEN,
    entityId: updated.id,
    description: `Settlement account unfrozen: ${reason}`,
    institutionId: updated.institutionId,
  });

  return updated;
}

export async function listLiquidityOperations(
  institutionId: string,
  options?: { limit?: number },
) {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const rows = await prisma.nccLiquidityOperation.findMany({
    where: { institutionId },
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 50, 200),
  });
  return rows.map(serializeOp);
}

export async function getLiquidityPortalView(institutionId: string) {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const account = await prisma.settlementAccount.findFirst({
    where: { institutionId, currency: NCC_DEFAULT_CURRENCY },
  });
  const recent = await listLiquidityOperations(institutionId, { limit: 20 });
  return {
    account: account
      ? {
          id: account.id,
          currency: account.currency,
          ledgerBalance: account.ledgerBalance.toString(),
          availableBalance: account.availableBalance.toString(),
          status: account.status,
          lowLiquidityThreshold: account.lowLiquidityThreshold?.toString() ?? null,
          legacyFloatReviewStatus: account.legacyFloatReviewStatus,
          frozenAt: account.frozenAt?.toISOString() ?? null,
          frozenReason: account.frozenReason,
        }
      : null,
    recentOperations: recent,
  };
}
