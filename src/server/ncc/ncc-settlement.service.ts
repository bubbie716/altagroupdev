import { Prisma, type FinancialInstitution, type SettlementInstruction, type SettlementInstructionStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  assertPositiveMoneyAmount,
  asDecimal,
  decimalToNumber,
  generateSettlementPublicReference,
  hashSettlementPayload,
  moneyLt,
  NCC_DEFAULT_CURRENCY,
  toMoneyDecimal,
} from "@/lib/ncc/ncc-money";
import {
  canInstitutionOriginateSettlement,
  canInstitutionReceiveSettlement,
  isRoutingNumberUsable,
} from "@/lib/ncc/ncc-permissions";
import { NccSettlementError, postNccLedgerEntries } from "@/server/ncc/ncc-settlement-ledger.service";
import { advanceExecution, createOrGetExecution } from "@/server/ncc/ncc-execution.service";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";

export { NccSettlementError };

export type SubmitSettlementInstructionInput = {
  sendingInstitutionId: string;
  receivingInstitutionId: string;
  sendingRoutingNumberId: string;
  receivingRoutingNumberId: string;
  amount: number;
  currency?: string;
  purpose?: string;
  externalReference?: string;
  idempotencyKey: string;
  submittedByUserId?: string;
  metadata?: Record<string, unknown>;
};

export type SettlementInstructionView = {
  id: string;
  publicReference: string;
  idempotencyKey: string;
  sendingInstitutionId: string;
  receivingInstitutionId: string;
  sendingRoutingNumberId: string;
  receivingRoutingNumberId: string;
  currency: string;
  amount: number;
  purpose: string | null;
  externalReference: string | null;
  status: SettlementInstructionStatus;
  submittedByUserId: string | null;
  submittedAt: string | null;
  validatedAt: string | null;
  settledAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  reversedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapInstruction(row: SettlementInstruction): SettlementInstructionView {
  return {
    id: row.id,
    publicReference: row.publicReference,
    idempotencyKey: row.idempotencyKey,
    sendingInstitutionId: row.sendingInstitutionId,
    receivingInstitutionId: row.receivingInstitutionId,
    sendingRoutingNumberId: row.sendingRoutingNumberId,
    receivingRoutingNumberId: row.receivingRoutingNumberId,
    currency: row.currency,
    amount: decimalToNumber(row.amount),
    purpose: row.purpose,
    externalReference: row.externalReference,
    status: row.status,
    submittedByUserId: row.submittedByUserId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function stableSubmitPayload(input: SubmitSettlementInstructionInput) {
  return {
    sendingInstitutionId: input.sendingInstitutionId,
    receivingInstitutionId: input.receivingInstitutionId,
    sendingRoutingNumberId: input.sendingRoutingNumberId,
    receivingRoutingNumberId: input.receivingRoutingNumberId,
    amount: Number(input.amount.toFixed(2)),
    currency: (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase(),
    purpose: input.purpose ?? null,
    externalReference: input.externalReference ?? null,
  };
}

async function writeNccAudit(input: {
  actorUserId: string;
  action: string;
  entityType: "SETTLEMENT_INSTRUCTION" | "SETTLEMENT_ACCOUNT" | "FINANCIAL_INSTITUTION";
  entityId: string;
  description: string;
  /** Primary institution scope for portal audit isolation — typically the sender. */
  institutionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId,
    metadata: input.metadata,
  });
}

function assertInstitutionCanSend(institution: FinancialInstitution): void {
  if (!canInstitutionOriginateSettlement(institution.status)) {
    throw new NccSettlementError("INSTITUTION_CANNOT_ORIGINATE", "INSTITUTION_CANNOT_ORIGINATE");
  }
  if (!institution.isNCCParticipant) {
    throw new NccSettlementError("INSTITUTION_NOT_NCC_PARTICIPANT", "INSTITUTION_NOT_NCC_PARTICIPANT");
  }
}

function assertInstitutionCanReceive(institution: FinancialInstitution): void {
  if (!canInstitutionReceiveSettlement(institution.status)) {
    throw new NccSettlementError("INSTITUTION_CANNOT_RECEIVE", "INSTITUTION_CANNOT_RECEIVE");
  }
  if (!institution.isNCCParticipant) {
    throw new NccSettlementError("INSTITUTION_NOT_NCC_PARTICIPANT", "INSTITUTION_NOT_NCC_PARTICIPANT");
  }
}

/** Reads `sourceAccountReference` / `destinationAccountReference` out of instruction metadata. */
function extractAccountReferences(metadata: unknown): {
  sourceAccountReference?: string;
  destinationAccountReference?: string;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const m = metadata as Record<string, unknown>;
  return {
    sourceAccountReference: typeof m.sourceAccountReference === "string" ? m.sourceAccountReference : undefined,
    destinationAccountReference:
      typeof m.destinationAccountReference === "string" ? m.destinationAccountReference : undefined,
  };
}

export async function getInstruction(id: string): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  return mapInstruction(row);
}

/**
 * Runs an already-created, already-validated instruction through end-to-end
 * execution (adapter prepare → NCC ledger → adapter commit → adapter credit).
 * Always creates a SettlementExecution — adapters treat a missing account
 * reference as an NCC-only float move (no customer ledger mutation).
 */
async function runInstructionToCompletion(
  instructionId: string,
  actorUserId: string,
  metadata?: unknown,
): Promise<SettlementInstructionView> {
  const current = await getInstruction(instructionId);
  if (current.status === "FAILED" || current.status === "REVERSED" || current.status === "CANCELLED") {
    return current;
  }

  let validated = current;
  if (current.status !== "SETTLED") {
    validated = await validateInstruction(instructionId, actorUserId);
    if (validated.status === "FAILED") return validated;
  }

  const accountRefs = extractAccountReferences(metadata);
  const execution = await createOrGetExecution(instructionId, accountRefs);
  const finalExecution = await advanceExecution(execution.id);

  if (finalExecution.status === "FAILED") {
    // Instruction may already be SETTLED (NCC ledger posted). Do not fail the
    // instruction after value has moved on the NCC ledger — leave MANUAL_REVIEW
    // / FAILED on the execution for ops recovery.
    if (validated.status !== "SETTLED") {
      return failInstruction(
        instructionId,
        finalExecution.failureCode ?? "EXECUTION_FAILED",
        finalExecution.failureReason ?? "Settlement execution failed",
        actorUserId,
      );
    }
  }

  return getInstruction(instructionId);
}

export async function submitInstruction(
  input: SubmitSettlementInstructionInput,
): Promise<SettlementInstructionView> {
  assertPositiveMoneyAmount(input.amount);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new NccSettlementError("IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REQUIRED");

  const payload = stableSubmitPayload(input);
  const requestHash = hashSettlementPayload(payload);
  const currency = payload.currency;
  const amount = toMoneyDecimal(input.amount);

  if (input.sendingInstitutionId === input.receivingInstitutionId) {
    throw new NccSettlementError("SELF_SETTLEMENT_DENIED", "SELF_SETTLEMENT_DENIED");
  }

  const existing = await prisma.settlementInstruction.findUnique({
    where: {
      sendingInstitutionId_idempotencyKey: {
        sendingInstitutionId: input.sendingInstitutionId,
        idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new NccSettlementError("IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT");
    }
    // Resume incomplete execution on duplicate submission (crash recovery).
    if (
      existing.status !== "FAILED" &&
      existing.status !== "CANCELLED" &&
      existing.status !== "REVERSED"
    ) {
      return runInstructionToCompletion(
        existing.id,
        existing.submittedByUserId ?? input.submittedByUserId ?? "system",
        existing.metadata,
      );
    }
    return mapInstruction(existing);
  }

  const [sending, receiving, sendRouting, recvRouting] = await Promise.all([
    prisma.financialInstitution.findUniqueOrThrow({ where: { id: input.sendingInstitutionId } }),
    prisma.financialInstitution.findUniqueOrThrow({ where: { id: input.receivingInstitutionId } }),
    prisma.routingNumber.findUniqueOrThrow({ where: { id: input.sendingRoutingNumberId } }),
    prisma.routingNumber.findUniqueOrThrow({ where: { id: input.receivingRoutingNumberId } }),
  ]);

  assertInstitutionCanSend(sending);
  assertInstitutionCanReceive(receiving);

  if (sendRouting.institutionId !== sending.id) {
    throw new NccSettlementError("SENDING_ROUTING_MISMATCH", "SENDING_ROUTING_MISMATCH");
  }
  if (recvRouting.institutionId !== receiving.id) {
    throw new NccSettlementError("RECEIVING_ROUTING_MISMATCH", "RECEIVING_ROUTING_MISMATCH");
  }
  if (!isRoutingNumberUsable(sendRouting.status) || !isRoutingNumberUsable(recvRouting.status)) {
    throw new NccSettlementError("ROUTING_NUMBER_UNUSABLE", "ROUTING_NUMBER_UNUSABLE");
  }

  const actorId = input.submittedByUserId ?? sending.primaryContactUserId;
  if (!actorId) throw new NccSettlementError("SUBMITTER_REQUIRED", "SUBMITTER_REQUIRED");

  let created: SettlementInstruction;
  try {
    created = await prisma.$transaction(async (tx) => {
      const row = await tx.settlementInstruction.create({
        data: {
          publicReference: generateSettlementPublicReference(),
          idempotencyKey,
          requestHash,
          sendingInstitutionId: sending.id,
          receivingInstitutionId: receiving.id,
          sendingRoutingNumberId: sendRouting.id,
          receivingRoutingNumberId: recvRouting.id,
          currency,
          amount,
          purpose: input.purpose?.trim() || null,
          externalReference: input.externalReference?.trim() || null,
          status: "SUBMITTED",
          submittedByUserId: actorId,
          submittedAt: new Date(),
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await enqueueOutboxEvent(
        {
          settlementInstructionId: row.id,
          eventType: NCC_OUTBOX_EVENTS.SUBMITTED,
          dedupeKey: `settlement.submitted:${row.id}`,
          payload: {
            publicReference: row.publicReference,
            amount: row.amount.toString(),
            currency: row.currency,
            sendingInstitutionId: row.sendingInstitutionId,
            receivingInstitutionId: row.receivingInstitutionId,
          },
        },
        tx,
      );
      return row;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const race = await prisma.settlementInstruction.findUnique({
        where: {
          sendingInstitutionId_idempotencyKey: {
            sendingInstitutionId: input.sendingInstitutionId,
            idempotencyKey,
          },
        },
      });
      if (race) {
        if (race.requestHash !== requestHash) {
          throw new NccSettlementError("IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT");
        }
        return mapInstruction(race);
      }
    }
    throw error;
  }

  await writeNccAudit({
    actorUserId: actorId,
    action: NCC_AUDIT.SETTLEMENT_INSTRUCTION_SUBMITTED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: created.id,
    description: `Settlement instruction ${created.publicReference} submitted`,
    institutionId: created.sendingInstitutionId,
    metadata: {
      amount: decimalToNumber(created.amount),
      currency: created.currency,
      sendingInstitutionId: created.sendingInstitutionId,
      receivingInstitutionId: created.receivingInstitutionId,
    },
  });

  // Always attempt immediate end-to-end execution — there is no deferred
  // "settle later" path for normal submissions anymore.
  return runInstructionToCompletion(created.id, actorId, input.metadata);
}

export async function validateInstruction(
  id: string,
  actorUserId: string,
): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  if (row.status === "SETTLED" || row.status === "REVERSED") return mapInstruction(row);
  if (row.status === "FAILED" || row.status === "CANCELLED") {
    throw new NccSettlementError("INSTRUCTION_NOT_VALIDATABLE", "INSTRUCTION_NOT_VALIDATABLE");
  }

  const [sendingAccount, receivingAccount] = await Promise.all([
    prisma.settlementAccount.findUnique({
      where: {
        institutionId_currency: {
          institutionId: row.sendingInstitutionId,
          currency: row.currency,
        },
      },
    }),
    prisma.settlementAccount.findUnique({
      where: {
        institutionId_currency: {
          institutionId: row.receivingInstitutionId,
          currency: row.currency,
        },
      },
    }),
  ]);

  if (!sendingAccount || sendingAccount.status !== "ACTIVE") {
    return failInstruction(id, "SENDER_ACCOUNT_UNAVAILABLE", "Sending settlement account unavailable", actorUserId);
  }
  if (!receivingAccount || receivingAccount.status !== "ACTIVE") {
    return failInstruction(id, "RECEIVER_ACCOUNT_UNAVAILABLE", "Receiving settlement account unavailable", actorUserId);
  }
  if (moneyLt(asDecimal(sendingAccount.availableBalance), asDecimal(row.amount))) {
    return failInstruction(id, "INSUFFICIENT_FUNDS", "Insufficient settlement available balance", actorUserId);
  }

  const updated = await prisma.settlementInstruction.update({
    where: { id },
    data: { status: "VALIDATING", validatedAt: new Date() },
  });

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_VALIDATED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: id,
    description: `Settlement instruction ${row.publicReference} validated`,
    institutionId: row.sendingInstitutionId,
  });

  return mapInstruction(updated);
}

/**
 * Posts NCC ledger entries for an instruction — NCC ledger finality only. Kept
 * as an internal primitive used by the execution orchestrator (and available for
 * ops/manual re-settlement); prefer `submitInstruction` for the normal path.
 */
export async function settleInstruction(
  id: string,
  actorUserId: string,
): Promise<SettlementInstructionView> {
  const { instruction } = await postNccLedgerEntries(id);

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_SETTLED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: instruction.id,
    description: `Settlement instruction ${instruction.publicReference} settled`,
    institutionId: instruction.sendingInstitutionId,
    metadata: {
      amount: decimalToNumber(instruction.amount),
      currency: instruction.currency,
      receivingInstitutionId: instruction.receivingInstitutionId,
    },
  });

  return mapInstruction(instruction);
}

export async function failInstruction(
  id: string,
  code: string,
  reason: string,
  actorUserId: string,
): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  if (row.status === "SETTLED" || row.status === "REVERSED") {
    throw new NccSettlementError("INSTRUCTION_ALREADY_FINAL", "INSTRUCTION_ALREADY_FINAL");
  }
  if (row.status === "FAILED") return mapInstruction(row);

  const updated = await prisma.settlementInstruction.update({
    where: { id },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      failureCode: code,
      failureReason: reason,
    },
  });

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_FAILED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: id,
    description: `Settlement instruction ${row.publicReference} failed: ${code}`,
    institutionId: row.sendingInstitutionId,
    metadata: { code, reason },
  });

  return mapInstruction(updated);
}

export async function cancelInstruction(
  id: string,
  actorUserId: string,
  reason: string,
): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  if (row.status === "SETTLED" || row.status === "REVERSED") {
    throw new NccSettlementError("CANCEL_AFTER_SETTLEMENT_DENIED", "CANCEL_AFTER_SETTLEMENT_DENIED");
  }
  if (row.status === "CANCELLED") return mapInstruction(row);
  if (row.status === "SETTLING") {
    throw new NccSettlementError("CANCEL_WHILE_SETTLING_DENIED", "CANCEL_WHILE_SETTLING_DENIED");
  }

  const execution = await prisma.settlementExecution.findUnique({
    where: { settlementInstructionId: id },
  });
  if (
    execution &&
    execution.status !== "NOT_STARTED" &&
    execution.status !== "FAILED" &&
    execution.status !== "COMPENSATED"
  ) {
    throw new NccSettlementError(
      "CANCEL_AFTER_PREPARATION_DENIED",
      "CANCEL_AFTER_PREPARATION_DENIED",
    );
  }

  const updated = await prisma.settlementInstruction.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      failureReason: reason,
    },
  });

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_CANCELLED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: id,
    description: `Settlement instruction ${row.publicReference} cancelled`,
    institutionId: row.sendingInstitutionId,
    metadata: { reason },
  });

  return mapInstruction(updated);
}

export async function reverseInstruction(
  id: string,
  actorUserId: string,
  reason: string,
): Promise<SettlementInstructionView> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new NccSettlementError("REVERSAL_REASON_REQUIRED", "REVERSAL_REASON_REQUIRED");

  const original = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!original) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");

  const existingReversal = await prisma.settlementReversal.findUnique({
    where: { originalInstructionId: id },
  });
  if (existingReversal || original.status === "REVERSED") {
    throw new NccSettlementError("ALREADY_REVERSED", "ALREADY_REVERSED");
  }
  if (original.status !== "SETTLED") {
    throw new NccSettlementError("REVERSAL_REQUIRES_SETTLED", "REVERSAL_REQUIRES_SETTLED");
  }

  const reversal = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<SettlementInstruction[]>`
      SELECT * FROM "SettlementInstruction" WHERE id = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row || row.status !== "SETTLED") {
      throw new NccSettlementError("REVERSAL_REQUIRES_SETTLED", "REVERSAL_REQUIRES_SETTLED");
    }
    const already = await tx.settlementReversal.findUnique({
      where: { originalInstructionId: id },
    });
    if (already) throw new NccSettlementError("ALREADY_REVERSED", "ALREADY_REVERSED");

    const amount = decimalToNumber(row.amount);

    const sendAccounts = await tx.$queryRaw<
      { id: string; ledgerBalance: Prisma.Decimal; availableBalance: Prisma.Decimal }[]
    >`
      SELECT id, "ledgerBalance", "availableBalance"
      FROM "SettlementAccount"
      WHERE "institutionId" = ${row.sendingInstitutionId} AND currency = ${row.currency}
      FOR UPDATE
    `;
    const recvAccounts = await tx.$queryRaw<
      { id: string; ledgerBalance: Prisma.Decimal; availableBalance: Prisma.Decimal }[]
    >`
      SELECT id, "ledgerBalance", "availableBalance"
      FROM "SettlementAccount"
      WHERE "institutionId" = ${row.receivingInstitutionId} AND currency = ${row.currency}
      FOR UPDATE
    `;
    const originalSender = sendAccounts[0];
    const originalReceiver = recvAccounts[0];
    if (!originalSender || !originalReceiver) {
      throw new NccSettlementError("SETTLEMENT_ACCOUNT_MISSING", "SETTLEMENT_ACCOUNT_MISSING");
    }
    if (decimalToNumber(originalReceiver.availableBalance) < amount) {
      throw new NccSettlementError("REVERSAL_INSUFFICIENT_FUNDS", "REVERSAL_INSUFFICIENT_FUNDS");
    }

    const recvBefore = decimalToNumber(originalReceiver.ledgerBalance);
    const sendBefore = decimalToNumber(originalSender.ledgerBalance);
    const recvAfter = Number((recvBefore - amount).toFixed(2));
    const sendAfter = Number((sendBefore + amount).toFixed(2));
    if (recvAfter < 0) {
      throw new NccSettlementError("NEGATIVE_BALANCE_DENIED", "NEGATIVE_BALANCE_DENIED");
    }

    const reversalInstruction = await tx.settlementInstruction.create({
      data: {
        publicReference: generateSettlementPublicReference(),
        idempotencyKey: `reversal:${row.id}`,
        requestHash: hashSettlementPayload({ originalId: row.id, reason: trimmedReason }),
        sendingInstitutionId: row.receivingInstitutionId,
        receivingInstitutionId: row.sendingInstitutionId,
        sendingRoutingNumberId: row.receivingRoutingNumberId,
        receivingRoutingNumberId: row.sendingRoutingNumberId,
        currency: row.currency,
        amount: row.amount,
        purpose: `Reversal of ${row.publicReference}`,
        externalReference: row.publicReference,
        status: "SETTLED",
        submittedByUserId: actorUserId,
        submittedAt: new Date(),
        validatedAt: new Date(),
        settledAt: new Date(),
        metadata: { reversalOf: row.id, reason: trimmedReason },
      },
    });

    await tx.settlementAccount.update({
      where: { id: originalReceiver.id },
      data: {
        ledgerBalance: recvAfter,
        availableBalance: { decrement: amount },
      },
    });
    await tx.settlementAccount.update({
      where: { id: originalSender.id },
      data: {
        ledgerBalance: sendAfter,
        availableBalance: { increment: amount },
      },
    });

    await tx.settlementEntry.createMany({
      data: [
        {
          settlementInstructionId: reversalInstruction.id,
          settlementAccountId: originalReceiver.id,
          institutionId: row.receivingInstitutionId,
          entryType: "REVERSAL_DEBIT",
          amount: row.amount,
          currency: row.currency,
          balanceBefore: recvBefore,
          balanceAfter: recvAfter,
        },
        {
          settlementInstructionId: reversalInstruction.id,
          settlementAccountId: originalSender.id,
          institutionId: row.sendingInstitutionId,
          entryType: "REVERSAL_CREDIT",
          amount: row.amount,
          currency: row.currency,
          balanceBefore: sendBefore,
          balanceAfter: sendAfter,
        },
      ],
    });

    await tx.settlementReversal.create({
      data: {
        originalInstructionId: row.id,
        reversalInstructionId: reversalInstruction.id,
        reason: trimmedReason,
        actorUserId,
        metadata: { originalPublicReference: row.publicReference },
      },
    });

    await tx.settlementInstruction.update({
      where: { id: row.id },
      data: { status: "REVERSED", reversedAt: new Date() },
    });

    await enqueueOutboxEvent(
      {
        settlementInstructionId: row.id,
        eventType: NCC_OUTBOX_EVENTS.REVERSED,
        dedupeKey: `settlement.reversed:${row.id}`,
        payload: {
          reason: trimmedReason,
          reversalInstructionId: reversalInstruction.id,
          actorUserId,
        },
      },
      tx,
    );

    return reversalInstruction;
  });

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_REVERSED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: id,
    description: `Settlement instruction reversed; compensating ${reversal.publicReference}`,
    institutionId: original.sendingInstitutionId,
    metadata: { reason: trimmedReason, reversalInstructionId: reversal.id },
  });

  return getInstruction(id);
}

export const nccSettlementService = {
  submitInstruction,
  validateInstruction,
  settleInstruction,
  failInstruction,
  cancelInstruction,
  reverseInstruction,
  getInstruction,
};
