import { Prisma, type SettlementExecution } from "@prisma/client";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { assertTypedConfirmation } from "@/lib/ncc/ncc-staff-permissions";
import { prisma } from "@/server/db";
import {
  attemptAutomaticCompensation,
  compensatePostLedgerFailure,
  isCompensationEligible,
} from "@/server/ncc/ncc-compensation.service";
import { advanceExecution } from "@/server/ncc/ncc-execution.service";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { listOutboxEventsForInstruction } from "@/server/ncc/ncc-outbox.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccExceptionError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccExceptionError";
  }
}

type ExceptionMeta = {
  exceptionNotes?: Array<{ at: string; byUserId: string; note: string }>;
  exceptionOwnerUserId?: string | null;
  automaticRetryStopped?: boolean;
  automaticRetryStoppedAt?: string | null;
  automaticRetryStoppedByUserId?: string | null;
};

function readInstructionMeta(metadata: unknown): ExceptionMeta & Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as ExceptionMeta & Record<string, unknown>;
}

async function writeExceptionAudit(input: {
  actorUserId: string;
  entityId: string;
  description: string;
  institutionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.EXCEPTION_ACTION,
    entityType: "SETTLEMENT_EXECUTION",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

async function loadByExecutionId(executionId: string) {
  const execution = await prisma.settlementExecution.findUnique({
    where: { id: executionId },
    include: {
      instruction: {
        include: {
          sendingInstitution: true,
          receivingInstitution: true,
          compensation: true,
        },
      },
      compensation: true,
    },
  });
  if (!execution) throw new NccExceptionError("NOT_FOUND");
  return execution;
}

async function loadByInstructionId(instructionId: string) {
  const instruction = await prisma.settlementInstruction.findUnique({
    where: { id: instructionId },
    include: {
      execution: true,
      sendingInstitution: true,
      receivingInstitution: true,
      compensation: true,
    },
  });
  if (!instruction) throw new NccExceptionError("NOT_FOUND");
  if (!instruction.execution) throw new NccExceptionError("EXECUTION_NOT_FOUND");
  return instruction;
}

async function patchInstructionExceptionMeta(
  instructionId: string,
  patch: Partial<ExceptionMeta>,
): Promise<Record<string, unknown>> {
  const row = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: instructionId },
  });
  const current = readInstructionMeta(row.metadata);
  const next = { ...current, ...patch };
  await prisma.settlementInstruction.update({
    where: { id: instructionId },
    data: { metadata: next as Prisma.InputJsonValue },
  });
  return next;
}

function resumeStatusForStep(execution: SettlementExecution): SettlementExecution["status"] {
  switch (execution.currentStep) {
    case "CREDIT_DESTINATION":
      return "CREDITING_DESTINATION";
    case "COMMIT_SOURCE":
      return "COMMITTING_SOURCE";
    case "POST_NCC_LEDGER":
      return "POSTING_NCC_LEDGER";
    case "PREPARE_SOURCE":
      return "PREPARING_SOURCE";
    case "FINALIZE":
      return "DESTINATION_CREDITED";
    default:
      return "VALIDATING";
  }
}

/** Force an immediate retry advance. Accepts execution id. */
export async function retryExecutionNow(executionId: string): Promise<SettlementExecution> {
  const actor = await requireNccStaff("manage_exceptions");
  const execution = await loadByExecutionId(executionId);

  if (execution.status === "COMPLETED" || execution.status === "COMPENSATED") {
    throw new NccExceptionError("EXECUTION_TERMINAL");
  }
  if (execution.status === "COMPENSATING") {
    throw new NccExceptionError("EXECUTION_BUSY");
  }

  if (
    execution.status !== "RETRY_PENDING" &&
    execution.status !== "MANUAL_REVIEW" &&
    execution.status !== "FAILED"
  ) {
    // Already in-flight — advance once.
    const advanced = await advanceExecution(execution.id);
    await writeExceptionAudit({
      actorUserId: actor.id,
      entityId: advanced.id,
      institutionId: execution.instruction.sendingInstitutionId,
      description: `Exception retry-now for ${execution.instruction.publicReference}`,
      metadata: { priorStatus: execution.status, nextStatus: advanced.status },
    });
    return advanced;
  }

  const resumed = await prisma.settlementExecution.update({
    where: { id: execution.id },
    data: {
      status: resumeStatusForStep(execution),
      nextRetryAt: null,
      lastAttemptAt: new Date(),
    },
  });

  const meta = readInstructionMeta(execution.instruction.metadata);
  if (meta.automaticRetryStopped) {
    await patchInstructionExceptionMeta(execution.settlementInstructionId, {
      automaticRetryStopped: false,
      automaticRetryStoppedAt: null,
      automaticRetryStoppedByUserId: null,
    });
  }

  const advanced = await advanceExecution(resumed.id);
  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: advanced.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Exception retry-now for ${execution.instruction.publicReference}`,
    metadata: { priorStatus: execution.status, nextStatus: advanced.status },
  });
  return advanced;
}

/** Stop automatic retry — move RETRY_PENDING to MANUAL_REVIEW (idempotent). */
export async function stopAutomaticRetry(
  executionId: string,
  reason: string,
): Promise<SettlementExecution> {
  const actor = await requireNccStaff("manage_exceptions");
  const trimmed = reason.trim();
  if (!trimmed) throw new NccExceptionError("REASON_REQUIRED");

  const execution = await loadByExecutionId(executionId);
  const meta = readInstructionMeta(execution.instruction.metadata);

  if (meta.automaticRetryStopped && execution.status === "MANUAL_REVIEW") {
    return execution;
  }
  if (execution.status === "COMPLETED" || execution.status === "COMPENSATED") {
    return execution;
  }
  if (execution.status !== "RETRY_PENDING" && execution.status !== "MANUAL_REVIEW") {
    throw new NccExceptionError("STOP_RETRY_NOT_AVAILABLE");
  }

  const updated =
    execution.status === "RETRY_PENDING"
      ? await prisma.settlementExecution.update({
          where: { id: execution.id },
          data: {
            status: "MANUAL_REVIEW",
            nextRetryAt: null,
            failureCode: execution.failureCode ?? "AUTOMATIC_RETRY_STOPPED",
            failureReason: trimmed,
          },
        })
      : execution;

  await patchInstructionExceptionMeta(execution.settlementInstructionId, {
    automaticRetryStopped: true,
    automaticRetryStoppedAt: new Date().toISOString(),
    automaticRetryStoppedByUserId: actor.id,
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: updated.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Automatic retry stopped for ${execution.instruction.publicReference}`,
    metadata: { reason: trimmed },
  });

  return updated;
}

/** Resume automatic retry after a staff stop. */
export async function resumeAutomaticRetry(executionId: string): Promise<SettlementExecution> {
  const actor = await requireNccStaff("manage_exceptions");
  const execution = await loadByExecutionId(executionId);
  const meta = readInstructionMeta(execution.instruction.metadata);

  if (!meta.automaticRetryStopped && execution.status === "RETRY_PENDING") {
    return execution;
  }
  if (execution.status === "COMPLETED" || execution.status === "COMPENSATED") {
    return execution;
  }
  if (execution.status !== "MANUAL_REVIEW" && execution.status !== "RETRY_PENDING") {
    throw new NccExceptionError("RESUME_RETRY_NOT_AVAILABLE");
  }

  const updated = await prisma.settlementExecution.update({
    where: { id: execution.id },
    data: {
      status: "RETRY_PENDING",
      nextRetryAt: new Date(),
    },
  });

  await patchInstructionExceptionMeta(execution.settlementInstructionId, {
    automaticRetryStopped: false,
    automaticRetryStoppedAt: null,
    automaticRetryStoppedByUserId: null,
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: updated.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Automatic retry resumed for ${execution.instruction.publicReference}`,
  });

  return updated;
}

/** Escalate an in-flight retry to MANUAL_REVIEW. */
export async function escalateManualReview(
  executionId: string,
  reason: string,
): Promise<SettlementExecution> {
  const actor = await requireNccStaff("manage_exceptions");
  const trimmed = reason.trim();
  if (!trimmed) throw new NccExceptionError("REASON_REQUIRED");

  const execution = await loadByExecutionId(executionId);
  if (execution.status === "MANUAL_REVIEW") {
    await addExceptionNote({ executionId, note: trimmed });
    return execution;
  }
  if (execution.status === "COMPLETED" || execution.status === "COMPENSATED") {
    throw new NccExceptionError("EXECUTION_TERMINAL");
  }

  const updated = await prisma.settlementExecution.update({
    where: { id: execution.id },
    data: {
      status: "MANUAL_REVIEW",
      nextRetryAt: null,
      failureCode: execution.failureCode ?? "ESCALATED_MANUAL_REVIEW",
      failureReason: trimmed,
    },
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: updated.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Escalated ${execution.instruction.publicReference} to MANUAL_REVIEW`,
    metadata: { reason: trimmed },
  });

  return updated;
}

/** Alias matching staff control naming. */
export const escalateToManualReview = escalateManualReview;

/** Query participant connector operation status. */
export async function queryParticipantOperationStatus(executionId: string): Promise<{
  kind: "internal" | "external";
  ok: boolean;
  status?: string;
  body?: Record<string, unknown>;
  code?: string;
  reason?: string;
}> {
  const actor = await requireNccStaff("manage_exceptions");
  const execution = await loadByExecutionId(executionId);
  const instruction = execution.instruction;

  if (instruction.receivingInstitution.isAlta) {
    await writeExceptionAudit({
      actorUserId: actor.id,
      entityId: execution.id,
      institutionId: instruction.sendingInstitutionId,
      description: `Operation status probe (internal) for ${instruction.publicReference}`,
    });
    return {
      kind: "internal",
      ok: true,
      status: execution.status,
      body: {
        executionStatus: execution.status,
        destinationCreditReference: execution.destinationCreditReference,
        failureCode: execution.failureCode,
      },
    };
  }

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: instruction.receivingInstitutionId },
  });
  if (!connector?.baseUrl || connector.status === "DISABLED" || connector.status === "DRAFT") {
    throw new NccExceptionError("CONNECTOR_UNAVAILABLE");
  }

  await getAdapterForInstitution(instruction.receivingInstitution);

  const result = await callExternalConnector({
    baseUrl: connector.baseUrl,
    authSecretEncrypted: connector.authSecretEncrypted,
    timeoutMs: connector.timeoutMs,
    op: "queryStatus",
    body: {
      requestId: `exception_status_${execution.settlementInstructionId}`,
      idempotencyKey: `credit:${execution.settlementInstructionId}`,
      publicReference: instruction.publicReference,
      settlementInstructionId: execution.settlementInstructionId,
      operationReference:
        execution.destinationCreditReference ?? execution.sourceCommitReference ?? undefined,
    },
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: execution.id,
    institutionId: instruction.sendingInstitutionId,
    description: `Operation status probe (external) for ${instruction.publicReference}`,
    metadata: { ok: result.ok },
  });

  if (!result.ok) {
    return { kind: "external", ok: false, code: result.code, reason: result.reason };
  }

  return {
    kind: "external",
    ok: true,
    status: typeof result.body.status === "string" ? result.body.status : undefined,
    body: result.body,
  };
}

/** Initiate eligible post-ledger compensation (staff). Idempotent if already compensated. */
export async function initiateEligibleCompensation(input: {
  instructionId: string;
  reason: string;
  confirmation: string;
  escalateActiveRetry?: boolean;
  automatic?: boolean;
}) {
  const actor = await requireNccStaff("initiate_compensation");
  assertTypedConfirmation(input.confirmation);
  const reason = input.reason.trim();
  if (!reason) throw new NccExceptionError("REASON_REQUIRED");

  const instruction = await loadByInstructionId(input.instructionId);

  if (instruction.compensation) {
    return {
      alreadyCompensated: true,
      compensation: instruction.compensation,
      execution: instruction.execution!,
    };
  }

  const eligibility = isCompensationEligible(instruction.status, instruction.execution, {
    escalateActiveRetry: input.escalateActiveRetry,
  });
  if (!eligibility.ok) {
    throw new NccExceptionError(eligibility.code, eligibility.reason);
  }

  if (input.automatic) {
    const result = await attemptAutomaticCompensation(input.instructionId);
    await writeExceptionAudit({
      actorUserId: actor.id,
      entityId: instruction.execution!.id,
      institutionId: instruction.sendingInstitutionId,
      description: `Automatic compensation attempt for ${instruction.publicReference}`,
      metadata: { outcome: result.outcome },
    });
    return result;
  }

  const result = await compensatePostLedgerFailure({
    instructionId: input.instructionId,
    actorUserId: actor.id,
    reason,
    escalateActiveRetry: input.escalateActiveRetry,
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: instruction.execution!.id,
    institutionId: instruction.sendingInstitutionId,
    description: `Compensation initiated for ${instruction.publicReference}`,
    metadata: { alreadyCompensated: result.alreadyCompensated },
  });

  return result;
}

export async function attemptSystemCompensation(instructionId: string) {
  await requireNccStaff("initiate_compensation");
  return attemptAutomaticCompensation(instructionId);
}

export async function addExceptionNote(input: {
  executionId: string;
  note: string;
}): Promise<ExceptionMeta> {
  const actor = await requireNccStaff("manage_exceptions");
  const trimmed = input.note.trim();
  if (!trimmed) throw new NccExceptionError("NOTE_REQUIRED");

  const execution = await loadByExecutionId(input.executionId);
  const meta = readInstructionMeta(execution.instruction.metadata);
  const notes = [...(meta.exceptionNotes ?? [])];
  notes.push({
    at: new Date().toISOString(),
    byUserId: actor.id,
    note: trimmed,
  });

  const next = await patchInstructionExceptionMeta(execution.settlementInstructionId, {
    exceptionNotes: notes,
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: execution.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Exception note added for ${execution.instruction.publicReference}`,
    metadata: { note: trimmed },
  });

  return next;
}

export async function assignExceptionOwner(input: {
  executionId: string;
  ownerUserId: string | null;
}): Promise<ExceptionMeta> {
  const actor = await requireNccStaff("manage_exceptions");
  const execution = await loadByExecutionId(input.executionId);

  if (input.ownerUserId) {
    await prisma.user.findUniqueOrThrow({ where: { id: input.ownerUserId } });
  }

  const next = await patchInstructionExceptionMeta(execution.settlementInstructionId, {
    exceptionOwnerUserId: input.ownerUserId,
  });

  await writeExceptionAudit({
    actorUserId: actor.id,
    entityId: execution.id,
    institutionId: execution.instruction.sendingInstitutionId,
    description: `Exception owner assigned for ${execution.instruction.publicReference}`,
    metadata: { ownerUserId: input.ownerUserId },
  });

  return next;
}

/** Execution timeline for ops. */
export async function getExecutionTimeline(executionId: string) {
  await requireNccStaff("manage_exceptions");
  const execution = await loadByExecutionId(executionId);
  const instruction = execution.instruction;
  const outbox = await listOutboxEventsForInstruction(execution.settlementInstructionId);
  const reversals = await prisma.settlementReversal.findMany({
    where: { originalInstructionId: execution.settlementInstructionId },
  });
  const entries = await prisma.settlementEntry.findMany({
    where: { settlementInstructionId: execution.settlementInstructionId },
    orderBy: { createdAt: "asc" },
  });
  const reconciliations = await prisma.settlementReconciliation.findMany({
    where: { settlementInstructionId: execution.settlementInstructionId },
    orderBy: { createdAt: "asc" },
  });
  const meta = readInstructionMeta(instruction.metadata);

  return {
    instruction: {
      id: instruction.id,
      publicReference: instruction.publicReference,
      status: instruction.status,
      amount: instruction.amount.toFixed(2),
      currency: instruction.currency,
      createdAt: instruction.createdAt.toISOString(),
      settledAt: instruction.settledAt?.toISOString() ?? null,
    },
    execution: {
      id: execution.id,
      status: execution.status,
      currentStep: execution.currentStep,
      attemptCount: execution.attemptCount,
      failureCode: execution.failureCode,
      failureReason: execution.failureReason,
      nextRetryAt: execution.nextRetryAt?.toISOString() ?? null,
      updatedAt: execution.updatedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString() ?? null,
    },
    compensation: execution.compensation
      ? {
          id: execution.compensation.id,
          reason: execution.compensation.reason,
          createdAt: execution.compensation.createdAt.toISOString(),
        }
      : null,
    reversals: reversals.map((r) => ({
      id: r.id,
      reversalInstructionId: r.reversalInstructionId,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
    entries: entries.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: e.amount.toFixed(2),
      institutionId: e.institutionId,
      createdAt: e.createdAt.toISOString(),
    })),
    outbox: outbox.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      processedAt: e.processedAt?.toISOString() ?? null,
    })),
    reconciliations: reconciliations.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    exceptionOwnerUserId: meta.exceptionOwnerUserId ?? null,
    automaticRetryStopped: Boolean(meta.automaticRetryStopped),
    notes: meta.exceptionNotes ?? [],
  };
}

export async function listExceptionQueue(limit = 50) {
  await requireNccStaff("manage_exceptions");
  return prisma.settlementExecution.findMany({
    where: {
      status: { in: ["MANUAL_REVIEW", "RETRY_PENDING", "FAILED", "COMPENSATING"] },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(limit, 100),
    include: {
      instruction: {
        select: {
          publicReference: true,
          amount: true,
          currency: true,
          sendingInstitutionId: true,
          receivingInstitutionId: true,
          status: true,
          metadata: true,
        },
      },
      compensation: { select: { id: true, createdAt: true } },
    },
  });
}
