import type { SettlementCompensation, SettlementExecution } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { prisma } from "@/server/db";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { reverseNccLedgerPositionsForCompensation } from "@/server/ncc/ncc-settlement.service";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";

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

export type AutoCompensationAttemptResult =
  | { outcome: "compensated"; result: CompensationResult }
  | { outcome: "already_compensated"; result: CompensationResult }
  | { outcome: "needs_manual_review"; code: string; reason: string }
  | { outcome: "ineligible"; code: string; reason: string };

const POST_LEDGER_COMPENSABLE = new Set([
  "MANUAL_REVIEW",
  "FAILED",
  "COMPENSATING",
]);

/**
 * Confirmed destination-credit failure codes eligible for automatic compensation.
 * Configurable via NCC_AUTO_COMPENSATION_CODES (comma-separated) at process start.
 */
export const AUTO_COMPENSATION_ELIGIBLE_CODES: ReadonlySet<string> = new Set(
  (
    process.env.NCC_AUTO_COMPENSATION_CODES ??
    "DESTINATION_CREDIT_CONFIRMED_FAILED,ACCOUNT_CLOSED,ACCOUNT_NOT_FOUND"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const AMBIGUOUS_FAILURE_CODES = new Set([
  "CONNECTOR_TIMEOUT",
  "CONNECTOR_STATUS_UNCONFIRMED",
  "CREDIT_DESTINATION_ERROR",
  "DESTINATION_CREDIT_TIMEOUT",
  "AMBIGUOUS",
]);

/** Authorization is enforced by requireNccStaff("initiate_compensation") at the staff entrypoint. */
export function assertActorMayCompensate(_user: Pick<AltaUser, "tags">): void {
  // no-op — kept for call-site compatibility with older tests
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
 * adapter credit and restores NCC positions via reverseNccLedgerPositionsForCompensation.
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

  const sendAdapter = await getAdapterForInstitution(instruction.sendingInstitution);
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
  // Uses internal ledger helper — public reverseInstruction is disabled.
  if (instruction.status === "SETTLED") {
    await reverseNccLedgerPositionsForCompensation(
      instruction.id,
      input.actorUserId,
      trimmedReason,
    );
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
  const actor = await requireNccStaff("initiate_compensation");
  assertActorMayCompensate(actor);
  return compensatePostLedgerFailure({
    instructionId: input.instructionId,
    actorUserId: actor.id,
    reason: input.reason,
    escalateActiveRetry: input.escalateActiveRetry,
  });
}

/**
 * Automatic compensation eligibility — confirmed destination failures only.
 * Requires SETTLED instruction, source committed, no successful destination credit,
 * no existing compensation, failure code in allowlist, status MANUAL_REVIEW or FAILED.
 */
export function isAutoCompensationEligible(
  instructionStatus: string,
  execution: Pick<
    SettlementExecution,
    | "status"
    | "sourceCommitReference"
    | "destinationCreditReference"
    | "failureCode"
  > | null,
  hasCompensation: boolean,
): { ok: true } | { ok: false; code: string; reason: string } {
  if (hasCompensation) {
    return { ok: false, code: "ALREADY_COMPENSATED", reason: "Compensation already exists" };
  }
  const base = isCompensationEligible(instructionStatus, execution);
  if (!base.ok) return base;
  if (!execution) {
    return { ok: false, code: "EXECUTION_NOT_FOUND", reason: "No settlement execution found" };
  }
  if (execution.status !== "MANUAL_REVIEW" && execution.status !== "FAILED") {
    return {
      ok: false,
      code: "AUTO_COMPENSATION_STATUS",
      reason: `Automatic compensation requires MANUAL_REVIEW or FAILED, got ${execution.status}`,
    };
  }
  if (execution.destinationCreditReference) {
    return {
      ok: false,
      code: "DESTINATION_ALREADY_CREDITED",
      reason: "Destination credit reference present — do not auto-compensate",
    };
  }
  if (!execution.sourceCommitReference) {
    return {
      ok: false,
      code: "COMPENSATION_REQUIRES_SOURCE_COMMITTED",
      reason: "Source debit must be committed before automatic compensation",
    };
  }
  const failureCode = execution.failureCode?.trim() ?? "";
  if (!failureCode || !AUTO_COMPENSATION_ELIGIBLE_CODES.has(failureCode)) {
    return {
      ok: false,
      code: "AUTO_COMPENSATION_CODE_INELIGIBLE",
      reason: `Failure code ${failureCode || "(none)"} is not in the automatic compensation allowlist`,
    };
  }
  if (AMBIGUOUS_FAILURE_CODES.has(failureCode)) {
    return {
      ok: false,
      code: "AMBIGUOUS_DESTINATION_STATUS",
      reason: "Ambiguous destination failures require manual review",
    };
  }
  return { ok: true };
}

type DestinationStatusProbe =
  | { kind: "confirmed_failed" }
  | { kind: "credited" }
  | { kind: "ambiguous"; code: string; reason: string }
  | { kind: "connector_unavailable"; code: string; reason: string }
  | { kind: "skipped_internal" };

async function probeDestinationCreditStatus(instructionId: string): Promise<DestinationStatusProbe> {
  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: instructionId },
    include: { receivingInstitution: true, execution: true },
  });
  const execution = instruction.execution;
  if (!execution) {
    return { kind: "ambiguous", code: "EXECUTION_NOT_FOUND", reason: "No execution" };
  }

  const meta =
    instruction.metadata && typeof instruction.metadata === "object" && !Array.isArray(instruction.metadata)
      ? (instruction.metadata as Record<string, unknown>)
      : {};
  if (meta.destinationCreditConfirmedFailed === true || meta.creditConfirmedFailed === true) {
    return { kind: "confirmed_failed" };
  }
  if (meta.destinationCreditConfirmed === true || execution.destinationCreditReference) {
    return { kind: "credited" };
  }

  const adapter = await getAdapterForInstitution(instruction.receivingInstitution);
  if (!adapter) {
    return {
      kind: "connector_unavailable",
      code: "DESTINATION_ADAPTER_UNAVAILABLE",
      reason: "Destination adapter unavailable — cannot auto-compensate",
    };
  }

  // Internal Alta adapters have no remote status lookup; rely on confirmed failure codes.
  if (instruction.receivingInstitution.isAlta) {
    return { kind: "skipped_internal" };
  }

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: instruction.receivingInstitutionId },
  });
  if (!connector || !connector.baseUrl || connector.status === "DISABLED" || connector.status === "DRAFT") {
    return {
      kind: "connector_unavailable",
      code: "CONNECTOR_UNAVAILABLE",
      reason: "Participant connector unavailable — cannot auto-compensate",
    };
  }

  const status = await callExternalConnector({
    baseUrl: connector.baseUrl,
    authSecretEncrypted: connector.authSecretEncrypted,
    timeoutMs: connector.timeoutMs,
    op: "queryStatus",
    body: {
      requestId: `auto_comp_status_${instructionId}`,
      idempotencyKey: `credit:${instructionId}`,
    },
  });

  if (!status.ok) {
    if (status.ambiguous || status.code === "CONNECTOR_TIMEOUT") {
      return {
        kind: "ambiguous",
        code: status.code,
        reason: status.reason,
      };
    }
    return {
      kind: "connector_unavailable",
      code: status.code,
      reason: status.reason,
    };
  }

  const opStatus =
    typeof status.body.status === "string" ? status.body.status.toUpperCase() : "";
  if (
    opStatus === "FAILED" ||
    opStatus === "REJECTED" ||
    opStatus === "ERROR" ||
    status.body.credited === false ||
    status.body.ok === false
  ) {
    return { kind: "confirmed_failed" };
  }
  if (
    opStatus === "CREDITED" ||
    opStatus === "SUCCESS" ||
    opStatus === "SUCCEEDED" ||
    status.body.credited === true
  ) {
    return { kind: "credited" };
  }
  return {
    kind: "ambiguous",
    code: "CONNECTOR_STATUS_UNCONFIRMED",
    reason: "Destination status lookup did not confirm failure or credit",
  };
}

/**
 * System-actor automatic compensation for confirmed destination-credit failures.
 * Never returns a no-op success when a required connector is unavailable.
 */
export async function attemptAutomaticCompensation(
  instructionId: string,
): Promise<AutoCompensationAttemptResult> {
  const existing = await prisma.settlementCompensation.findUnique({
    where: { settlementInstructionId: instructionId },
  });
  if (existing) {
    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { id: existing.settlementExecutionId },
    });
    return {
      outcome: "already_compensated",
      result: { compensation: existing, execution, alreadyCompensated: true },
    };
  }

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: instructionId },
  });
  const execution = await prisma.settlementExecution.findUnique({
    where: { settlementInstructionId: instructionId },
  });

  const eligibility = isAutoCompensationEligible(instruction.status, execution, false);
  if (!eligibility.ok) {
    return { outcome: "ineligible", code: eligibility.code, reason: eligibility.reason };
  }

  const probe = await probeDestinationCreditStatus(instructionId);
  if (probe.kind === "credited") {
    return {
      outcome: "needs_manual_review",
      code: "DESTINATION_MAY_BE_CREDITED",
      reason: "Status lookup indicates destination may already be credited",
    };
  }
  if (probe.kind === "ambiguous") {
    return {
      outcome: "needs_manual_review",
      code: probe.code,
      reason: probe.reason,
    };
  }
  if (probe.kind === "connector_unavailable") {
    throw new NccCompensationError(probe.reason, probe.code);
  }

  const actorUserId = await resolveSystemActorUserId();
  const result = await compensatePostLedgerFailure({
    instructionId,
    actorUserId,
    reason: `Automatic compensation for confirmed destination failure (${execution?.failureCode})`,
  });

  return {
    outcome: result.alreadyCompensated ? "already_compensated" : "compensated",
    result,
  };
}
