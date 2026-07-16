import type { SettlementCompensation, SettlementExecution } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canAccessInternal } from "@/lib/auth/permissions";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { prisma } from "@/server/db";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { reverseInstruction } from "@/server/ncc/ncc-settlement.service";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccCompensationError extends Error {
  constructor(
    message: string,
    readonly code: string = message,
  ) {
    super(message);
    this.name = "NccCompensationError";
  }
}

export type CompensationResult = {
  compensation: SettlementCompensation;
  execution: SettlementExecution;
  alreadyCompensated: boolean;
};

const POST_LEDGER_COMPENSABLE = new Set([
  "MANUAL_REVIEW",
  "FAILED",
  "COMPENSATING",
]);

/** Staff authorization gate for compensation — NCC staff / internal operators only. */
export function assertActorMayCompensate(user: Pick<AltaUser, "tags">): void {
  if (!canAccessInternal(user as AltaUser)) {
    throw new NccCompensationError("FORBIDDEN", "FORBIDDEN");
  }
}

/**
 * Eligibility for authorized post-ledger compensation:
 * - Instruction SETTLED (NCC ledger posted)
 * - Source debit committed
 * - Destination not successfully completed
 * - Not already COMPLETED / COMPENSATED
 * - Execution in MANUAL_REVIEW / FAILED (or RETRY_PENDING with escalateActiveRetry)
 */
export function isCompensationEligible(
  instructionStatus: string,
  execution: Pick<
    SettlementExecution,
    "status" | "sourceCommitReference" | "destinationCreditReference"
  > | null,
  options?: { escalateActiveRetry?: boolean },
): { ok: true } | { ok: false; code: string; reason: string } {
  if (!execution) {
    return { ok: false, code: "EXECUTION_NOT_FOUND", reason: "No settlement execution found" };
  }
  if (execution.status === "COMPLETED") {
    return { ok: false, code: "COMPENSATION_DENIED_COMPLETED", reason: "Completed executions cannot be compensated" };
  }
  if (execution.status === "COMPENSATED") {
    return { ok: false, code: "ALREADY_COMPENSATED", reason: "Execution is already compensated" };
  }
  if (instructionStatus !== "SETTLED" && instructionStatus !== "REVERSED") {
    return {
      ok: false,
      code: "COMPENSATION_REQUIRES_NCC_POSTED",
      reason: "Compensation requires NCC ledger finality (SETTLED)",
    };
  }
  if (!execution.sourceCommitReference) {
    return {
      ok: false,
      code: "COMPENSATION_REQUIRES_SOURCE_COMMITTED",
      reason: "Source debit must be committed before compensation",
    };
  }
  if (execution.status === "RETRY_PENDING") {
    if (!options?.escalateActiveRetry) {
      return {
        ok: false,
        code: "COMPENSATION_RETRY_ACTIVE",
        reason: "Safe destination-credit retry remains active; escalate explicitly to compensate",
      };
    }
  } else if (!POST_LEDGER_COMPENSABLE.has(execution.status)) {
    return {
      ok: false,
      code: "COMPENSATION_INELIGIBLE_STATUS",
      reason: `Execution status ${execution.status} is not eligible for compensation`,
    };
  }
  return { ok: true };
}

/**
 * Authorized post-ledger compensation workflow.
 * Never edits/deletes original financial records — restores source via compensating
 * adapter credit and restores NCC positions via reverseInstruction.
 */
export async function compensatePostLedgerFailure(input: {
  instructionId: string;
  actorUserId: string;
  reason: string;
  escalateActiveRetry?: boolean;
}): Promise<CompensationResult> {
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    throw new NccCompensationError("COMPENSATION_REASON_REQUIRED", "COMPENSATION_REASON_REQUIRED");
  }

  const existing = await prisma.settlementCompensation.findUnique({
    where: { settlementInstructionId: input.instructionId },
  });
  if (existing) {
    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { id: existing.settlementExecutionId },
    });
    return { compensation: existing, execution, alreadyCompensated: true };
  }

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: input.instructionId },
    include: { sendingInstitution: true, receivingInstitution: true },
  });
  const execution = await prisma.settlementExecution.findUnique({
    where: { settlementInstructionId: input.instructionId },
  });

  const eligibility = isCompensationEligible(instruction.status, execution, {
    escalateActiveRetry: input.escalateActiveRetry,
  });
  if (!eligibility.ok) {
    throw new NccCompensationError(eligibility.reason, eligibility.code);
  }
  if (!execution) throw new NccCompensationError("EXECUTION_NOT_FOUND", "EXECUTION_NOT_FOUND");

  await prisma.settlementExecution.update({
    where: { id: execution.id },
    data: { status: "COMPENSATING", failureReason: trimmedReason, lastAttemptAt: new Date() },
  });

  const sendAdapter = getAdapterForInstitution(instruction.sendingInstitution);
  if (!sendAdapter) {
    throw new NccCompensationError(
      "SOURCE_ADAPTER_UNAVAILABLE",
      "SOURCE_ADAPTER_UNAVAILABLE",
    );
  }

  const restore = await sendAdapter.compensateDebit({
    settlementInstructionId: instruction.id,
    publicReference: instruction.publicReference,
    amount: instruction.amount.toString(),
    currency: instruction.currency,
    accountReference: execution.sourceAccountReference ?? undefined,
    actorUserId: input.actorUserId,
  });
  if (!restore.ok) {
    throw new NccCompensationError(restore.reason, restore.code);
  }

  // Restore NCC settlement positions via compensating instruction (immutable entries).
  if (instruction.status === "SETTLED") {
    await reverseInstruction(instruction.id, input.actorUserId, trimmedReason);
  }

  const compensation = await prisma.$transaction(async (tx) => {
    const record = await tx.settlementCompensation.create({
      data: {
        settlementInstructionId: instruction.id,
        settlementExecutionId: execution.id,
        compensatingInstructionId: (
          await tx.settlementReversal.findUnique({
            where: { originalInstructionId: instruction.id },
          })
        )?.reversalInstructionId,
        sourceRestoreReference: restore.externalReference,
        reason: trimmedReason,
        actorUserId: input.actorUserId,
        metadata: {
          priorExecutionStatus: execution.status,
          priorFailureCode: execution.failureCode,
        },
      },
    });

    const updatedExecution = await tx.settlementExecution.update({
      where: { id: execution.id },
      data: {
        status: "COMPENSATED",
        failureCode: execution.failureCode ?? "COMPENSATED",
        failureReason: trimmedReason,
        completedAt: new Date(),
      },
    });

    await enqueueOutboxEvent(
      {
        settlementInstructionId: instruction.id,
        eventType: NCC_OUTBOX_EVENTS.COMPENSATED,
        dedupeKey: `settlement.compensated:${instruction.id}`,
        payload: {
          compensationId: record.id,
          executionId: updatedExecution.id,
          sourceRestoreReference: restore.externalReference,
          reason: trimmedReason,
        },
      },
      tx,
    );

    return { record, updatedExecution };
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.SETTLEMENT_COMPENSATED,
    entityType: "SETTLEMENT_COMPENSATION",
    entityId: compensation.record.id,
    description: `Post-ledger compensation completed for ${instruction.publicReference}`,
    institutionId: instruction.sendingInstitutionId,
    metadata: {
      settlementInstructionId: instruction.id,
      settlementExecutionId: execution.id,
      reason: trimmedReason,
      sourceRestoreReference: restore.externalReference,
    },
  });

  return {
    compensation: compensation.record,
    execution: compensation.updatedExecution,
    alreadyCompensated: false,
  };
}

/** Staff-gated entry point — requires NCC / internal authorization. */
export async function staffCompensatePostLedgerFailure(input: {
  instructionId: string;
  reason: string;
  escalateActiveRetry?: boolean;
}): Promise<CompensationResult> {
  const actor = await requireNccStaff();
  assertActorMayCompensate(actor);
  return compensatePostLedgerFailure({
    instructionId: input.instructionId,
    actorUserId: actor.id,
    reason: input.reason,
    escalateActiveRetry: input.escalateActiveRetry,
  });
}
