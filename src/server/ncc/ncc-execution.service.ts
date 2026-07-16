import {
  Prisma,
  type SettlementExecution,
  type SettlementExecutionStatus,
  type SettlementExecutionStep,
  type SettlementInstruction,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { NccSettlementError, postNccLedgerEntries } from "@/server/ncc/ncc-settlement-ledger.service";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import type { InstitutionAdapter } from "@/server/ncc/institution-adapter";
import {
  enqueueOutboxEvent,
  NCC_OUTBOX_EVENTS,
  type OutboxDbClient,
} from "@/server/ncc/ncc-outbox.service";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";

/**
 * End-to-end settlement execution orchestrator.
 *
 * SettlementInstruction.status SETTLED = NCC ledger finality only.
 * SettlementExecution.status COMPLETED = end-to-end destination credit confirmed.
 *
 * Orchestration order: validate → prepareDebit → post NCC ledger → commitDebit →
 * notifyCredit → COMPLETED. State transitions are persisted BEFORE each external
 * (adapter / ledger) call so a crash mid-step resumes by re-attempting the same
 * step — all adapter operations and postNccLedgerEntries are idempotent.
 *
 * Both sending and receiving institution adapters must be registered before any
 * source preparation or NCC ledger posting. Missing adapters fail permanently
 * with SOURCE_ADAPTER_UNAVAILABLE / DESTINATION_ADAPTER_UNAVAILABLE.
 */

const TERMINAL_STATUSES = new Set<SettlementExecutionStatus>([
  "COMPLETED",
  "RETRY_PENDING",
  "MANUAL_REVIEW",
  "FAILED",
  "COMPENSATING",
  "COMPENSATED",
]);

/** Maps a persisted currentStep back to the in-flight action status that attempts it —
 * used to resume a RETRY_PENDING execution at the right step. */
const STEP_ACTION_STATUS: Record<SettlementExecutionStep, SettlementExecutionStatus> = {
  VALIDATE: "VALIDATING",
  PREPARE_SOURCE: "PREPARING_SOURCE",
  POST_NCC_LEDGER: "POSTING_NCC_LEDGER",
  COMMIT_SOURCE: "COMMITTING_SOURCE",
  CREDIT_DESTINATION: "CREDITING_DESTINATION",
  FINALIZE: "DESTINATION_CREDITED",
  IDLE: "VALIDATING",
};

const MAX_STEPS_PER_CALL = 20;

const NON_RETRYABLE_LEDGER_CODES = new Set([
  "INSUFFICIENT_FUNDS",
  "SENDER_ACCOUNT_UNAVAILABLE",
  "RECEIVER_ACCOUNT_UNAVAILABLE",
  "NEGATIVE_BALANCE_DENIED",
  "LEDGER_IMBALANCE",
  "INSTRUCTION_NOT_SETTLEABLE",
  "NOT_FOUND",
]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeExecutionAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  institutionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "SETTLEMENT_EXECUTION",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

export type CreateExecutionInput = {
  sourceAccountReference?: string;
  destinationAccountReference?: string;
};

/** Creates the SettlementExecution row for an instruction, or returns the existing one. */
export async function createOrGetExecution(
  instructionId: string,
  input?: CreateExecutionInput,
): Promise<SettlementExecution> {
  const existing = await prisma.settlementExecution.findUnique({
    where: { settlementInstructionId: instructionId },
  });
  if (existing) {
    const needsRefs =
      existing.status === "NOT_STARTED" &&
      ((input?.sourceAccountReference && !existing.sourceAccountReference) ||
        (input?.destinationAccountReference && !existing.destinationAccountReference));
    if (needsRefs) {
      return prisma.settlementExecution.update({
        where: { id: existing.id },
        data: {
          sourceAccountReference: input?.sourceAccountReference ?? existing.sourceAccountReference,
          destinationAccountReference: input?.destinationAccountReference ?? existing.destinationAccountReference,
        },
      });
    }
    return existing;
  }

  try {
    return await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: instructionId,
        status: "NOT_STARTED",
        currentStep: "VALIDATE",
        sourceAccountReference: input?.sourceAccountReference ?? null,
        destinationAccountReference: input?.destinationAccountReference ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.settlementExecution.findUniqueOrThrow({
        where: { settlementInstructionId: instructionId },
      });
    }
    throw error;
  }
}

async function persistTransition(
  execution: SettlementExecution,
  status: SettlementExecutionStatus,
  currentStep: SettlementExecutionStep,
  extra?: Prisma.SettlementExecutionUpdateInput,
): Promise<SettlementExecution> {
  return prisma.settlementExecution.update({
    where: { id: execution.id },
    data: { status, currentStep, ...extra },
  });
}

/** Permanent business failure — not retryable. Emits settlement.failed outbox event. */
async function markFailed(executionId: string, code: string, reason: string): Promise<SettlementExecution> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementExecution.update({
      where: { id: executionId },
      data: { status: "FAILED", failureCode: code, failureReason: reason, lastAttemptAt: new Date() },
    });
    await enqueueOutboxEvent(
      {
        settlementInstructionId: updated.settlementInstructionId,
        eventType: NCC_OUTBOX_EVENTS.FAILED,
        dedupeKey: `settlement.failed:${updated.settlementInstructionId}:${code}`,
        payload: {
          executionId: updated.id,
          failureCode: code,
          failureReason: reason,
        },
      },
      tx,
    );
    return updated;
  });
}

/** Escalates an execution to manual review — no further automatic retries. */
export async function markManualReview(
  executionId: string,
  code: string,
  reason: string,
): Promise<SettlementExecution> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementExecution.update({
      where: { id: executionId },
      data: {
        status: "MANUAL_REVIEW",
        failureCode: code,
        failureReason: reason,
        lastAttemptAt: new Date(),
      },
    });
    await enqueueOutboxEvent(
      {
        settlementInstructionId: updated.settlementInstructionId,
        eventType: NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
        dedupeKey: `settlement.manual_review:${updated.settlementInstructionId}`,
        payload: {
          executionId: updated.id,
          failureCode: code,
          failureReason: reason,
        },
      },
      tx,
    );
    return updated;
  });
}

/** Schedules a backed-off retry for a transient failure, escalating to manual review past maxAttempts. */
export async function scheduleRetry(
  executionId: string,
  code: string,
  reason: string,
): Promise<SettlementExecution> {
  const execution = await prisma.settlementExecution.findUniqueOrThrow({ where: { id: executionId } });
  const attemptCount = execution.attemptCount + 1;
  if (attemptCount >= execution.maxAttempts) {
    return markManualReview(executionId, code, reason);
  }
  const backoffMs = Math.min(2 ** attemptCount * 30_000, 30 * 60_000);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementExecution.update({
      where: { id: executionId },
      data: {
        status: "RETRY_PENDING",
        attemptCount,
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + backoffMs),
        failureCode: code,
        failureReason: reason,
      },
    });
    await enqueueOutboxEvent(
      {
        settlementInstructionId: updated.settlementInstructionId,
        eventType: NCC_OUTBOX_EVENTS.RETRY_PENDING,
        dedupeKey: `settlement.retry_pending:${updated.settlementInstructionId}:${attemptCount}`,
        payload: {
          executionId: updated.id,
          attemptCount,
          failureCode: code,
          failureReason: reason,
          nextRetryAt: updated.nextRetryAt?.toISOString() ?? null,
        },
      },
      tx,
    );
    return updated;
  });
}

type StepContext = {
  instruction: SettlementInstruction;
  sendAdapter: InstitutionAdapter;
  recvAdapter: InstitutionAdapter;
};

async function assertAdaptersAvailable(
  execution: SettlementExecution,
  instruction: SettlementInstruction & {
    sendingInstitution: { id: string; slug: string; isAlta: boolean };
    receivingInstitution: { id: string; slug: string; isAlta: boolean };
  },
): Promise<StepContext | SettlementExecution> {
  const sendAdapter = getAdapterForInstitution(instruction.sendingInstitution);
  const recvAdapter = getAdapterForInstitution(instruction.receivingInstitution);

  if (!sendAdapter) {
    const failed = await markFailed(
      execution.id,
      "SOURCE_ADAPTER_UNAVAILABLE",
      `No institution adapter registered for sending institution ${instruction.sendingInstitutionId}`,
    );
    await writeExecutionAudit({
      actorUserId: instruction.submittedByUserId ?? "system",
      action: NCC_AUDIT.SETTLEMENT_FAILED,
      entityId: failed.id,
      description: `Settlement execution failed: SOURCE_ADAPTER_UNAVAILABLE`,
      institutionId: instruction.sendingInstitutionId,
      metadata: {
        failureCode: "SOURCE_ADAPTER_UNAVAILABLE",
        settlementInstructionId: instruction.id,
      },
    });
    return failed;
  }

  if (!recvAdapter) {
    const failed = await markFailed(
      execution.id,
      "DESTINATION_ADAPTER_UNAVAILABLE",
      `No institution adapter registered for receiving institution ${instruction.receivingInstitutionId}`,
    );
    await writeExecutionAudit({
      actorUserId: instruction.submittedByUserId ?? "system",
      action: NCC_AUDIT.SETTLEMENT_FAILED,
      entityId: failed.id,
      description: `Settlement execution failed: DESTINATION_ADAPTER_UNAVAILABLE`,
      institutionId: instruction.sendingInstitutionId,
      metadata: {
        failureCode: "DESTINATION_ADAPTER_UNAVAILABLE",
        settlementInstructionId: instruction.id,
      },
    });
    return failed;
  }

  return { instruction, sendAdapter, recvAdapter };
}

async function performValidate(execution: SettlementExecution, ctx: StepContext): Promise<SettlementExecution> {
  try {
    if (execution.sourceAccountReference) {
      const result = await ctx.sendAdapter.validateAccountReference({
        accountReference: execution.sourceAccountReference,
      });
      if (!result.ok) return markFailed(execution.id, result.code, `Source validation failed: ${result.reason}`);
    }
    if (execution.destinationAccountReference) {
      const result = await ctx.recvAdapter.validateAccountReference({
        accountReference: execution.destinationAccountReference,
      });
      if (!result.ok) {
        return markFailed(execution.id, result.code, `Destination validation failed: ${result.reason}`);
      }
    }
    return persistTransition(execution, "PREPARING_SOURCE", "PREPARE_SOURCE");
  } catch (error) {
    return scheduleRetry(execution.id, "VALIDATION_ERROR", errorMessage(error));
  }
}

async function performPrepareSource(execution: SettlementExecution, ctx: StepContext): Promise<SettlementExecution> {
  try {
    const result = await ctx.sendAdapter.prepareDebit({
      settlementInstructionId: ctx.instruction.id,
      publicReference: ctx.instruction.publicReference,
      amount: ctx.instruction.amount.toString(),
      currency: ctx.instruction.currency,
      accountReference: execution.sourceAccountReference ?? undefined,
      actorUserId: ctx.instruction.submittedByUserId ?? undefined,
    });
    if (!result.ok) return markFailed(execution.id, result.code, result.reason);
    return persistTransition(execution, "SOURCE_PREPARED", "POST_NCC_LEDGER", {
      sourcePreparationReference: result.holdReference,
    });
  } catch (error) {
    return scheduleRetry(execution.id, "PREPARE_SOURCE_ERROR", errorMessage(error));
  }
}

async function performPostLedger(execution: SettlementExecution): Promise<SettlementExecution> {
  try {
    await postNccLedgerEntries(execution.settlementInstructionId);
    return persistTransition(execution, "NCC_LEDGER_POSTED", "COMMIT_SOURCE");
  } catch (error) {
    if (error instanceof NccSettlementError && NON_RETRYABLE_LEDGER_CODES.has(error.code)) {
      return markFailed(execution.id, error.code, error.message);
    }
    return scheduleRetry(execution.id, "POST_LEDGER_ERROR", errorMessage(error));
  }
}

async function performCommitSource(execution: SettlementExecution, ctx: StepContext): Promise<SettlementExecution> {
  try {
    if (!execution.sourcePreparationReference) {
      return markFailed(execution.id, "SOURCE_PREPARATION_MISSING", "Source preparation reference missing before commit");
    }
    const result = await ctx.sendAdapter.commitDebit({
      settlementInstructionId: ctx.instruction.id,
      publicReference: ctx.instruction.publicReference,
      amount: ctx.instruction.amount.toString(),
      currency: ctx.instruction.currency,
      accountReference: execution.sourceAccountReference ?? undefined,
      holdReference: execution.sourcePreparationReference,
      actorUserId: ctx.instruction.submittedByUserId ?? undefined,
    });
    if (!result.ok) {
      // Ledger has already posted at this point — this is a post-ledger operational
      // failure, not settlement failure. Retry/escalate rather than fail the instruction.
      return scheduleRetry(execution.id, result.code, result.reason);
    }
    return persistTransition(execution, "SOURCE_COMMITTED", "CREDIT_DESTINATION", {
      sourceCommitReference: result.externalReference,
    });
  } catch (error) {
    return scheduleRetry(execution.id, "COMMIT_SOURCE_ERROR", errorMessage(error));
  }
}

async function performCreditDestination(
  execution: SettlementExecution,
  ctx: StepContext,
): Promise<SettlementExecution> {
  try {
    const result = await ctx.recvAdapter.notifyCredit({
      settlementInstructionId: ctx.instruction.id,
      publicReference: ctx.instruction.publicReference,
      amount: ctx.instruction.amount.toString(),
      currency: ctx.instruction.currency,
      accountReference: execution.destinationAccountReference ?? undefined,
      actorUserId: ctx.instruction.submittedByUserId ?? undefined,
    });
    if (!result.ok) {
      // NCC ledger is already settled — destination crediting is retried/escalated, not failed.
      return scheduleRetry(execution.id, result.code, result.reason);
    }
    return persistTransition(execution, "DESTINATION_CREDITED", "FINALIZE", {
      destinationCreditReference: result.externalReference ?? `credited:${execution.settlementInstructionId}`,
    });
  } catch (error) {
    return scheduleRetry(execution.id, "CREDIT_DESTINATION_ERROR", errorMessage(error));
  }
}

async function finalizeCompleted(execution: SettlementExecution): Promise<SettlementExecution> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlementExecution.update({
      where: { id: execution.id },
      data: { status: "COMPLETED", currentStep: "FINALIZE", completedAt: new Date() },
    });
    await enqueueOutboxEvent(
      {
        settlementInstructionId: updated.settlementInstructionId,
        eventType: NCC_OUTBOX_EVENTS.COMPLETED,
        dedupeKey: `settlement.completed:${updated.settlementInstructionId}`,
        payload: {
          executionId: updated.id,
          completedAt: updated.completedAt?.toISOString() ?? null,
        },
      },
      tx,
    );
    return updated;
  });
}

async function runStep(execution: SettlementExecution, ctx: StepContext): Promise<SettlementExecution> {
  switch (execution.status) {
    case "NOT_STARTED":
      return persistTransition(execution, "VALIDATING", "VALIDATE");
    case "VALIDATING":
      return performValidate(execution, ctx);
    case "PREPARING_SOURCE":
      return performPrepareSource(execution, ctx);
    case "SOURCE_PREPARED":
      return persistTransition(execution, "POSTING_NCC_LEDGER", "POST_NCC_LEDGER");
    case "POSTING_NCC_LEDGER":
      return performPostLedger(execution);
    case "NCC_LEDGER_POSTED":
      return persistTransition(execution, "COMMITTING_SOURCE", "COMMIT_SOURCE");
    case "COMMITTING_SOURCE":
      return performCommitSource(execution, ctx);
    case "SOURCE_COMMITTED":
      return persistTransition(execution, "CREDITING_DESTINATION", "CREDIT_DESTINATION");
    case "CREDITING_DESTINATION":
      return performCreditDestination(execution, ctx);
    case "DESTINATION_CREDITED":
      return finalizeCompleted(execution);
    default:
      return execution;
  }
}

/**
 * Advances a settlement execution through the state machine until it reaches a
 * stopping state (COMPLETED, RETRY_PENDING, MANUAL_REVIEW, FAILED, COMPENSATING,
 * COMPENSATED) or a per-call step budget is exhausted.
 */
export async function advanceExecution(executionId: string): Promise<SettlementExecution> {
  let execution = await prisma.settlementExecution.findUniqueOrThrow({ where: { id: executionId } });

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: execution.settlementInstructionId },
    include: { sendingInstitution: true, receivingInstitution: true },
  });

  // Adapter availability is validated before any source preparation or NCC ledger posting.
  const adaptersOrFailed = await assertAdaptersAvailable(execution, instruction);
  if (!("sendAdapter" in adaptersOrFailed)) {
    return adaptersOrFailed;
  }
  const ctx = adaptersOrFailed;

  let steps = 0;
  while (!TERMINAL_STATUSES.has(execution.status) && steps < MAX_STEPS_PER_CALL) {
    execution = await runStep(execution, ctx);
    steps += 1;
  }
  return execution;
}

/** Picks up executions whose retry backoff has elapsed and advances them. */
export async function processDueRetries(limit = 25): Promise<SettlementExecution[]> {
  const due = await prisma.settlementExecution.findMany({
    where: { status: "RETRY_PENDING", nextRetryAt: { lte: new Date() } },
    orderBy: { nextRetryAt: "asc" },
    take: Math.min(limit, 100),
  });

  const results: SettlementExecution[] = [];
  for (const execution of due) {
    const resumeStatus = STEP_ACTION_STATUS[execution.currentStep];
    const resumed = await prisma.settlementExecution.update({
      where: { id: execution.id },
      data: { status: resumeStatus },
    });
    results.push(await advanceExecution(resumed.id));
  }
  return results;
}
