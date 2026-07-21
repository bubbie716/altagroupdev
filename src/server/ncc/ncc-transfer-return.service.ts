import { Prisma, type NccTransferReturn, type NccTransferReturnStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { asDecimal, decimalToNumber } from "@/lib/ncc/ncc-money";
import { assertTypedConfirmation } from "@/lib/ncc/ncc-staff-permissions";
import { decryptSecret } from "@/server/crypto";
import { prisma } from "@/server/db";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";
import {
  requireInstitutionPermission,
  requireNccStaff,
} from "@/server/ncc/ncc-permissions.service";
import { reconcileInstruction } from "@/server/ncc/ncc-reconciliation.service";
import {
  assertLedgerOnlyReversalDisabled,
  createTransferReturnLedgerInstruction,
  finalizeOriginalInstructionReversed,
} from "@/server/ncc/ncc-settlement.service";
import { NccSettlementError } from "@/server/ncc/ncc-settlement-ledger.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

export class NccTransferReturnError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccTransferReturnError";
  }
}

export type TransferReturnView = {
  id: string;
  publicReference: string;
  originalInstructionId: string;
  institutionId: string;
  amount: string;
  currency: string;
  reason: string;
  status: NccTransferReturnStatus;
  idempotencyKey: string;
  reviewedByUserId: string | null;
  executionApprovedByUserId: string | null;
  returnInstructionId: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const TERMINAL_RETURN_STATUSES = new Set<NccTransferReturnStatus>([
  "COMPLETED",
  "REJECTED",
  "FUNDS_UNAVAILABLE",
  "FAILED",
]);

function generateReturnPublicReference(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `NRT-${stamp}-${suffix}`;
}

function mapReturn(row: NccTransferReturn): TransferReturnView {
  return {
    id: row.id,
    publicReference: row.publicReference,
    originalInstructionId: row.originalInstructionId,
    institutionId: row.institutionId,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    reviewedByUserId: row.reviewedByUserId,
    executionApprovedByUserId: row.executionApprovedByUserId,
    returnInstructionId: row.returnInstructionId,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function writeReturnAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  institutionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_TRANSFER_RETURN",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

async function enqueueReturnOutbox(
  returnRow: NccTransferReturn,
  eventSuffix: string,
  payload: Record<string, unknown>,
  eventType: string = NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
) {
  await enqueueOutboxEvent({
    settlementInstructionId: returnRow.originalInstructionId,
    eventType,
    dedupeKey: `transfer-return.${eventSuffix}:${returnRow.id}`,
    payload: {
      transferReturnId: returnRow.id,
      publicReference: returnRow.publicReference,
      status: returnRow.status,
      ...payload,
    },
  });
}

function extractExecutionAccountRefs(metadata: unknown): {
  sourceAccountReference?: string;
  destinationAccountReference?: string;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const m = metadata as Record<string, unknown>;
  return {
    sourceAccountReference:
      typeof m.internalSourceAccountReference === "string"
        ? m.internalSourceAccountReference
        : typeof m.sourceAccountReference === "string"
          ? m.sourceAccountReference
          : undefined,
    destinationAccountReference:
      typeof m.internalDestinationAccountReference === "string"
        ? m.internalDestinationAccountReference
        : typeof m.destinationAccountReference === "string"
          ? m.destinationAccountReference
          : undefined,
  };
}

/**
 * Request a full-amount transfer return for a SETTLED instruction.
 * Institution portal or API — does not move value until dual-control execution.
 */
export async function requestTransferReturn(input: {
  originalInstructionId: string;
  institutionId: string;
  reason: string;
  idempotencyKey: string;
  requestedByUserId?: string;
  requestedByCredentialId?: string;
}): Promise<TransferReturnView> {
  const reason = input.reason.trim();
  if (!reason) throw new NccTransferReturnError("RETURN_REASON_REQUIRED");
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new NccTransferReturnError("IDEMPOTENCY_KEY_REQUIRED");

  const existing = await prisma.nccTransferReturn.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (
      existing.originalInstructionId !== input.originalInstructionId ||
      existing.institutionId !== input.institutionId
    ) {
      throw new NccTransferReturnError("IDEMPOTENCY_CONFLICT");
    }
    return mapReturn(existing);
  }

  const instruction = await prisma.settlementInstruction.findUnique({
    where: { id: input.originalInstructionId },
  });
  if (!instruction) throw new NccTransferReturnError("NOT_FOUND");
  if (
    instruction.sendingInstitutionId !== input.institutionId &&
    instruction.receivingInstitutionId !== input.institutionId
  ) {
    throw new NccTransferReturnError("FORBIDDEN");
  }
  if (instruction.status !== "SETTLED") {
    throw new NccTransferReturnError("RETURN_REQUIRES_SETTLED");
  }

  const alreadyReversed = await prisma.settlementReversal.findUnique({
    where: { originalInstructionId: instruction.id },
  });
  if (alreadyReversed) throw new NccTransferReturnError("ALREADY_REVERSED");

  const openReturn = await prisma.nccTransferReturn.findFirst({
    where: {
      originalInstructionId: instruction.id,
      status: {
        in: [
          "REQUESTED",
          "PENDING_RECEIVING_INSTITUTION",
          "APPROVED",
          "PROCESSING",
          "MANUAL_REVIEW",
        ],
      },
    },
  });
  if (openReturn) return mapReturn(openReturn);

  let created: NccTransferReturn;
  try {
    created = await prisma.nccTransferReturn.create({
      data: {
        publicReference: generateReturnPublicReference(),
        originalInstructionId: instruction.id,
        institutionId: input.institutionId,
        amount: instruction.amount,
        currency: instruction.currency,
        reason,
        status: "REQUESTED",
        idempotencyKey,
        requestedByUserId: input.requestedByUserId ?? null,
        requestedByCredentialId: input.requestedByCredentialId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.nccTransferReturn.findUnique({ where: { idempotencyKey } });
      if (raced) return mapReturn(raced);
    }
    throw error;
  }

  const actorUserId =
    input.requestedByUserId ??
    (await resolveSystemActorUserId());

  await writeReturnAudit({
    actorUserId,
    action: NCC_AUDIT.TRANSFER_RETURN_REQUESTED,
    entityId: created.id,
    institutionId: input.institutionId,
    description: `Transfer return requested for ${instruction.publicReference}`,
    metadata: { reason, originalInstructionId: instruction.id },
  });

  await enqueueOutboxEvent({
    settlementInstructionId: instruction.id,
    eventType: NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
    dedupeKey: `transfer-return.requested:${created.id}`,
    payload: {
      transferReturnId: created.id,
      publicReference: created.publicReference,
      status: created.status,
      reason,
    },
  });

  try {
    await reconcileInstruction(instruction.id);
  } catch {
    // Reconciliation is best-effort on request.
  }

  return mapReturn(created);
}

export async function staffReviewReturn(input: {
  returnId: string;
  decision: "approve" | "reject" | "need_receiving_approval";
  note?: string;
  confirmation: string;
}): Promise<TransferReturnView> {
  const actor = await requireNccStaff("review_returns");
  assertTypedConfirmation(input.confirmation);

  const row = await prisma.nccTransferReturn.findUnique({ where: { id: input.returnId } });
  if (!row) throw new NccTransferReturnError("NOT_FOUND");
  if (TERMINAL_RETURN_STATUSES.has(row.status) || row.status === "PROCESSING") {
    throw new NccTransferReturnError("RETURN_NOT_REVIEWABLE");
  }
  if (row.status !== "REQUESTED" && row.status !== "PENDING_RECEIVING_INSTITUTION") {
    if (row.status === "APPROVED" && input.decision === "approve") return mapReturn(row);
    throw new NccTransferReturnError("RETURN_NOT_REVIEWABLE");
  }

  let nextStatus: NccTransferReturnStatus;
  if (input.decision === "reject") nextStatus = "REJECTED";
  else if (input.decision === "need_receiving_approval") {
    nextStatus = "PENDING_RECEIVING_INSTITUTION";
  } else {
    nextStatus = "APPROVED";
  }

  const updated = await prisma.nccTransferReturn.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      reviewedByUserId: actor.id,
      reviewNote: input.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  await writeReturnAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.TRANSFER_RETURN_REVIEWED,
    entityId: updated.id,
    institutionId: updated.institutionId,
    description: `Transfer return ${updated.publicReference} reviewed: ${input.decision}`,
    metadata: { decision: input.decision, note: input.note?.trim() || null },
  });

  await enqueueReturnOutbox(updated, `reviewed.${input.decision}`, {
    decision: input.decision,
  });

  return mapReturn(updated);
}

export async function recordReceivingInstitutionApproval(input: {
  returnId: string;
  userId: string;
}): Promise<TransferReturnView> {
  const row = await prisma.nccTransferReturn.findUnique({
    where: { id: input.returnId },
  });
  if (!row) throw new NccTransferReturnError("NOT_FOUND");

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: row.originalInstructionId },
  });
  // Receiving institution of the original payment must approve returning funds.
  await requireInstitutionPermission(instruction.receivingInstitutionId, "approve_reversal");

  if (row.status === "APPROVED" && row.receivingInstitutionApprovedByUserId) {
    return mapReturn(row);
  }
  if (row.status !== "PENDING_RECEIVING_INSTITUTION" && row.status !== "REQUESTED") {
    throw new NccTransferReturnError("RETURN_NOT_AWAITING_RECEIVING_APPROVAL");
  }

  const updated = await prisma.nccTransferReturn.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      receivingInstitutionApprovedByUserId: input.userId,
      receivingInstitutionApprovedAt: new Date(),
    },
  });

  await writeReturnAudit({
    actorUserId: input.userId,
    action: NCC_AUDIT.TRANSFER_RETURN_REVIEWED,
    entityId: updated.id,
    institutionId: instruction.receivingInstitutionId,
    description: `Receiving institution approved transfer return ${updated.publicReference}`,
  });

  return mapReturn(updated);
}

export async function staffApproveReturnExecution(input: {
  returnId: string;
  reason: string;
  confirmation: string;
}): Promise<TransferReturnView> {
  const actor = await requireNccStaff("approve_return_execution");
  assertTypedConfirmation(input.confirmation);
  const reason = input.reason.trim();
  if (!reason) throw new NccTransferReturnError("REASON_REQUIRED");

  const row = await prisma.nccTransferReturn.findUnique({ where: { id: input.returnId } });
  if (!row) throw new NccTransferReturnError("NOT_FOUND");
  if (row.status === "PROCESSING" || row.status === "COMPLETED") {
    return mapReturn(row);
  }
  if (row.status !== "APPROVED") {
    throw new NccTransferReturnError("RETURN_NOT_APPROVED_FOR_EXECUTION");
  }
  if (!row.reviewedByUserId) {
    throw new NccTransferReturnError("RETURN_REVIEWER_REQUIRED");
  }
  if (row.reviewedByUserId === actor.id) {
    throw new NccTransferReturnError(
      "DUAL_CONTROL_REQUIRED",
      "Execution approver must be a distinct staff member from the reviewer",
    );
  }

  const updated = await prisma.nccTransferReturn.update({
    where: { id: row.id },
    data: {
      executionApprovedByUserId: actor.id,
      status: "APPROVED",
      metadata: {
        ...((row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? row.metadata
          : {}) as Record<string, unknown>),
        executionApprovalReason: reason,
      } as Prisma.InputJsonValue,
    },
  });

  await writeReturnAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.TRANSFER_RETURN_EXECUTION_APPROVED,
    entityId: updated.id,
    institutionId: updated.institutionId,
    description: `Transfer return execution approved for ${updated.publicReference}`,
    metadata: {
      reason,
      reviewedByUserId: row.reviewedByUserId,
      executionApprovedByUserId: actor.id,
    },
  });

  return executeTransferReturn(updated.id);
}

/**
 * Execute an approved transfer return end-to-end:
 * 1) Debit original recipient via adapter
 * 2) Move NCC positions (receiver → sender) without marking original REVERSED yet
 * 3) Credit original sender via adapter
 * 4) Mark return COMPLETED + original REVERSED
 */
export async function executeTransferReturn(returnId: string): Promise<TransferReturnView> {
  const row = await prisma.nccTransferReturn.findUnique({ where: { id: returnId } });
  if (!row) throw new NccTransferReturnError("NOT_FOUND");
  if (row.status === "COMPLETED") return mapReturn(row);
  if (TERMINAL_RETURN_STATUSES.has(row.status) && row.status !== "MANUAL_REVIEW") {
    throw new NccTransferReturnError("RETURN_NOT_EXECUTABLE");
  }
  if (!row.executionApprovedByUserId || !row.reviewedByUserId) {
    throw new NccTransferReturnError("RETURN_EXECUTION_APPROVAL_REQUIRED");
  }
  if (row.executionApprovedByUserId === row.reviewedByUserId) {
    throw new NccTransferReturnError("DUAL_CONTROL_REQUIRED");
  }

  const actorUserId = row.executionApprovedByUserId;
  const processing = await prisma.nccTransferReturn.update({
    where: { id: row.id },
    data: { status: "PROCESSING" },
  });

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: processing.originalInstructionId },
    include: { sendingInstitution: true, receivingInstitution: true, execution: true },
  });

  if (instruction.status === "REVERSED") {
    const completed = await prisma.nccTransferReturn.update({
      where: { id: processing.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return mapReturn(completed);
  }
  if (instruction.status !== "SETTLED") {
    return markReturnFailed(processing.id, "RETURN_REQUIRES_SETTLED", "Original instruction is not SETTLED");
  }

  const accountRefs = extractExecutionAccountRefs(instruction.metadata);
  const destinationRef =
    instruction.execution?.destinationAccountReference ??
    accountRefs.destinationAccountReference;
  const sourceRef =
    instruction.execution?.sourceAccountReference ?? accountRefs.sourceAccountReference;

  const recvAdapter = await getAdapterForInstitution(instruction.receivingInstitution);
  const sendAdapter = await getAdapterForInstitution(instruction.sendingInstitution);
  if (!recvAdapter || !sendAdapter) {
    return markReturnFailed(
      processing.id,
      "ADAPTER_UNAVAILABLE",
      "Institution adapter unavailable for transfer return",
    );
  }

  const amountStr = processing.amount.toFixed(2);
  const returnPublicRef = processing.publicReference;

  // 1) Debit / prepare+commit original recipient customer account.
  let recipientHold: string | null = null;
  try {
    const prep = await recvAdapter.prepareDebit({
      settlementInstructionId: `return:${processing.id}`,
      publicReference: returnPublicRef,
      amount: amountStr,
      currency: processing.currency,
      accountReference: destinationRef,
      actorUserId,
      metadata: { transferReturnId: processing.id, leg: "recipient_debit" },
    });
    if (!prep.ok) {
      if (
        prep.code === "INSUFFICIENT_FUNDS" ||
        prep.code === "REVERSAL_INSUFFICIENT_FUNDS" ||
        prep.code.includes("INSUFFICIENT")
      ) {
        return markReturnStatus(processing.id, "FUNDS_UNAVAILABLE", prep.code, prep.reason);
      }
      if (isAmbiguousConnectorFailure(prep.code)) {
        return markReturnStatus(processing.id, "MANUAL_REVIEW", prep.code, prep.reason);
      }
      return markReturnFailed(processing.id, prep.code, prep.reason);
    }
    recipientHold = prep.holdReference;

    const commit = await recvAdapter.commitDebit({
      settlementInstructionId: `return:${processing.id}`,
      publicReference: returnPublicRef,
      amount: amountStr,
      currency: processing.currency,
      accountReference: destinationRef,
      holdReference: prep.holdReference,
      actorUserId,
      metadata: { transferReturnId: processing.id, leg: "recipient_debit" },
    });
    if (!commit.ok) {
      try {
        await recvAdapter.releaseDebit({
          holdReference: prep.holdReference,
          settlementInstructionId: `return:${processing.id}`,
        });
      } catch {
        // best-effort release
      }
      if (isAmbiguousConnectorFailure(commit.code)) {
        return markReturnStatus(processing.id, "MANUAL_REVIEW", commit.code, commit.reason);
      }
      if (commit.code.includes("INSUFFICIENT")) {
        return markReturnStatus(processing.id, "FUNDS_UNAVAILABLE", commit.code, commit.reason);
      }
      return markReturnFailed(processing.id, commit.code, commit.reason);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (recipientHold) {
      try {
        await recvAdapter.releaseDebit({
          holdReference: recipientHold,
          settlementInstructionId: `return:${processing.id}`,
        });
      } catch {
        // ignore
      }
    }
    return markReturnStatus(processing.id, "MANUAL_REVIEW", "CONNECTOR_ERROR", message);
  }

  // 2) NCC ledger reverse (do not mark original REVERSED yet).
  let ledger: { reversalInstructionId: string };
  try {
    ledger = await createTransferReturnLedgerInstruction({
      originalInstructionId: instruction.id,
      returnId: processing.id,
      actorUserId,
      reason: processing.reason,
    });
  } catch (error) {
    if (error instanceof NccSettlementError && error.code === "REVERSAL_INSUFFICIENT_FUNDS") {
      return markReturnStatus(
        processing.id,
        "FUNDS_UNAVAILABLE",
        error.code,
        "Insufficient NCC available balance at original receiving institution",
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof NccSettlementError ? error.code : "LEDGER_RETURN_FAILED";
    return markReturnStatus(processing.id, "MANUAL_REVIEW", code, message);
  }

  await prisma.nccTransferReturn.update({
    where: { id: processing.id },
    data: { returnInstructionId: ledger.reversalInstructionId },
  });

  // 3) Credit original sender via adapter.
  try {
    const credit = await sendAdapter.notifyCredit({
      settlementInstructionId: `return:${processing.id}`,
      publicReference: returnPublicRef,
      amount: amountStr,
      currency: processing.currency,
      accountReference: sourceRef,
      actorUserId,
      metadata: { transferReturnId: processing.id, leg: "sender_credit" },
    });
    if (!credit.ok) {
      if (isAmbiguousConnectorFailure(credit.code)) {
        return markReturnStatus(processing.id, "MANUAL_REVIEW", credit.code, credit.reason);
      }
      return markReturnStatus(processing.id, "MANUAL_REVIEW", credit.code, credit.reason);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return markReturnStatus(processing.id, "MANUAL_REVIEW", "CREDIT_SENDER_ERROR", message);
  }

  // 4) Success — mark original REVERSED + return COMPLETED.
  await finalizeOriginalInstructionReversed({
    originalInstructionId: instruction.id,
    reversalInstructionId: ledger.reversalInstructionId,
    actorUserId,
    reason: processing.reason,
  });

  const completed = await prisma.nccTransferReturn.update({
    where: { id: processing.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      returnInstructionId: ledger.reversalInstructionId,
      failureCode: null,
      failureReason: null,
    },
  });

  await writeReturnAudit({
    actorUserId,
    action: NCC_AUDIT.TRANSFER_RETURN_COMPLETED,
    entityId: completed.id,
    institutionId: completed.institutionId,
    description: `Transfer return ${completed.publicReference} completed`,
    metadata: {
      returnInstructionId: ledger.reversalInstructionId,
      originalInstructionId: instruction.id,
      amount: amountStr,
    },
  });

  await enqueueOutboxEvent({
    settlementInstructionId: instruction.id,
    eventType: NCC_OUTBOX_EVENTS.REVERSED,
    dedupeKey: `transfer-return.completed:${completed.id}`,
    payload: {
      transferReturnId: completed.id,
      returnInstructionId: ledger.reversalInstructionId,
      amount: amountStr,
    },
  });

  try {
    await reconcileInstruction(instruction.id);
  } catch {
    // best-effort
  }

  return mapReturn(completed);
}

function isAmbiguousConnectorFailure(code: string): boolean {
  return (
    code.includes("TIMEOUT") ||
    code.includes("AMBIGUOUS") ||
    code.includes("UNCONFIRMED") ||
    code === "CONNECTOR_STATUS_UNCONFIRMED"
  );
}

async function markReturnFailed(
  returnId: string,
  code: string,
  reason: string,
): Promise<TransferReturnView> {
  return markReturnStatus(returnId, "FAILED", code, reason);
}

async function markReturnStatus(
  returnId: string,
  status: NccTransferReturnStatus,
  code: string,
  reason: string,
): Promise<TransferReturnView> {
  const updated = await prisma.nccTransferReturn.update({
    where: { id: returnId },
    data: {
      status,
      failureCode: code,
      failureReason: reason,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });

  const actorUserId =
    updated.executionApprovedByUserId ??
    updated.reviewedByUserId ??
    (await resolveSystemActorUserId());

  await writeReturnAudit({
    actorUserId,
    action:
      status === "COMPLETED"
        ? NCC_AUDIT.TRANSFER_RETURN_COMPLETED
        : NCC_AUDIT.TRANSFER_RETURN_FAILED,
    entityId: updated.id,
    institutionId: updated.institutionId,
    description: `Transfer return ${updated.publicReference} → ${status}`,
    metadata: { code, reason },
  });

  await enqueueOutboxEvent({
    settlementInstructionId: updated.originalInstructionId,
    eventType:
      status === "MANUAL_REVIEW"
        ? NCC_OUTBOX_EVENTS.MANUAL_REVIEW
        : NCC_OUTBOX_EVENTS.FAILED,
    dedupeKey: `transfer-return.${status.toLowerCase()}:${updated.id}`,
    payload: {
      transferReturnId: updated.id,
      status,
      code,
      reason,
    },
  });

  return mapReturn(updated);
}

/**
 * Recover a MANUAL_REVIEW return by querying participant operation status.
 */
export async function recoverTransferReturnViaOperationStatus(
  returnId: string,
): Promise<TransferReturnView> {
  const actor = await requireNccStaff("manage_exceptions");
  const row = await prisma.nccTransferReturn.findUnique({ where: { id: returnId } });
  if (!row) throw new NccTransferReturnError("NOT_FOUND");
  if (row.status !== "MANUAL_REVIEW" && row.status !== "PROCESSING") {
    return mapReturn(row);
  }

  const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: row.originalInstructionId },
    include: { receivingInstitution: true },
  });

  if (instruction.receivingInstitution.isAlta) {
    // Internal adapters — re-attempt execution.
    return executeTransferReturn(row.id);
  }

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: instruction.receivingInstitutionId },
  });
  if (!connector?.baseUrl) {
    throw new NccTransferReturnError("CONNECTOR_UNAVAILABLE");
  }

  const status = await callExternalConnector({
    baseUrl: connector.baseUrl,
    authSecretEncrypted: connector.authSecretEncrypted,
    timeoutMs: connector.timeoutMs,
    op: "queryStatus",
    body: {
      requestId: `return_status_${row.id}`,
      idempotencyKey: `return:${row.id}`,
    },
  });

  await writeReturnAudit({
    actorUserId: actor.id,
    action: NCC_AUDIT.EXCEPTION_ACTION,
    entityId: row.id,
    institutionId: row.institutionId,
    description: `Operation status lookup for transfer return ${row.publicReference}`,
    metadata: {
      ok: status.ok,
      body: status.ok ? status.body : { code: status.code, reason: status.reason },
    },
  });

  if (!status.ok) {
    if (status.ambiguous) return mapReturn(row);
    return markReturnStatus(row.id, "MANUAL_REVIEW", status.code, status.reason);
  }

  const opStatus =
    typeof status.body.status === "string" ? status.body.status.toUpperCase() : "";
  if (opStatus === "SUCCEEDED" || opStatus === "COMPLETED" || status.body.ok === true) {
    return executeTransferReturn(row.id);
  }
  return mapReturn(row);
}

/** Migration SQL already inserts pending reversal requests; safe no-op helper. */
export async function migratePendingReversalRequests(): Promise<{ migrated: number }> {
  const pending = await prisma.nccSettlementReversalRequest.findMany({
    where: { status: "PENDING_REVIEW" },
  });

  let migrated = 0;
  for (const req of pending) {
    const existing = await prisma.nccTransferReturn.findUnique({
      where: { legacyReversalRequestId: req.id },
    });
    if (existing) continue;

    const instruction = await prisma.settlementInstruction.findUnique({
      where: { id: req.settlementInstructionId },
    });
    if (!instruction) continue;

    try {
      await prisma.nccTransferReturn.create({
        data: {
          publicReference: generateReturnPublicReference(),
          originalInstructionId: instruction.id,
          institutionId: req.institutionId,
          amount: instruction.amount,
          currency: instruction.currency,
          reason: req.reason,
          status: "REQUESTED",
          idempotencyKey: `legacy-reversal:${req.id}`,
          requestedByUserId: req.requestedByUserId,
          requestedByCredentialId: req.requestedByCredentialId,
          legacyReversalRequestId: req.id,
        },
      });
      migrated += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  return { migrated };
}

export { assertLedgerOnlyReversalDisabled };

/** Decrypt helper for ops tooling — not used on public paths. */
export async function decryptInstructionAccountNumber(
  encrypted: string | null | undefined,
): Promise<string | null> {
  if (!encrypted) return null;
  return decryptSecret(encrypted);
}

export function transferReturnAmountNumber(row: NccTransferReturn): number {
  return decimalToNumber(asDecimal(row.amount));
}
