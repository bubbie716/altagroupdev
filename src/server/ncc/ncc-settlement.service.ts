import {
  Prisma,
  type FinancialInstitution,
  type SettlementExecutionStatus,
  type SettlementInstruction,
  type SettlementInstructionStatus,
} from "@prisma/client";
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
import { validateNccAccountIdentifierEnvelope } from "@/lib/ncc/ncc-account-number";
import { resolveSettlementPaymentAddresses } from "@/server/ncc/ncc-account-resolution.service";
import { NccSettlementError, postNccLedgerEntries } from "@/server/ncc/ncc-settlement-ledger.service";
import { advanceExecution, createOrGetExecution } from "@/server/ncc/ncc-execution.service";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { enqueueOutboxEvent, NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";

/** Execution statuses still before irrevocable NCC ledger posting — cancelable. */
const PRE_LEDGER_CANCELABLE_EXECUTION = new Set<SettlementExecutionStatus>([
  "NOT_STARTED",
  "VALIDATING",
  "PREPARING_SOURCE",
  "SOURCE_PREPARED",
  "FAILED",
]);

/** Execution statuses at or after irrevocable NCC ledger posting — never cancelable. */
const POST_LEDGER_EXECUTION = new Set<SettlementExecutionStatus>([
  "POSTING_NCC_LEDGER",
  "NCC_LEDGER_POSTED",
  "COMMITTING_SOURCE",
  "SOURCE_COMMITTED",
  "CREDITING_DESTINATION",
  "DESTINATION_CREDITED",
  "COMPLETED",
  "COMPENSATING",
  "COMPENSATED",
  "RETRY_PENDING",
  "MANUAL_REVIEW",
]);

/** Shared cancel eligibility for portal/API — must match cancelInstruction. */
export function isInstructionCancelable(
  status: SettlementInstructionStatus,
  executionStatus: SettlementExecutionStatus | null | undefined,
): boolean {
  if (status === "SETTLED" || status === "REVERSED" || status === "CANCELLED" || status === "FAILED") {
    return false;
  }
  if (status === "SETTLING") return false;
  if (!executionStatus) return true;
  if (POST_LEDGER_EXECUTION.has(executionStatus)) return false;
  return PRE_LEDGER_CANCELABLE_EXECUTION.has(executionStatus);
}

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
  /**
   * Opaque institution-specific account identifier (API field name retained for v1).
   * Not a database id; format is owned by the sending institution.
   */
  sourceAccountNumber?: string | null;
  /** Opaque institution-specific account identifier for the receiving institution. */
  destinationAccountNumber?: string | null;
  /**
   * Non-addressing metadata only. Do not pass sourceAccountReference /
   * destinationAccountReference — those are resolved internally.
   */
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

/**
 * Canonical request fields for idempotency. Account identifiers are preserved
 * exactly after envelope validation — no case change or punctuation stripping.
 */
function stableSubmitPayload(
  input: SubmitSettlementInstructionInput,
  routingNumbers: { sending: string; receiving: string },
  accountIdentifiers: {
    sourceAccountNumber: string | null;
    destinationAccountNumber: string | null;
  },
) {
  return {
    sendingInstitutionId: input.sendingInstitutionId,
    receivingInstitutionId: input.receivingInstitutionId,
    sendingRoutingNumberId: input.sendingRoutingNumberId,
    receivingRoutingNumberId: input.receivingRoutingNumberId,
    sendingRoutingNumber: routingNumbers.sending,
    receivingRoutingNumber: routingNumbers.receiving,
    sourceAccountNumber: accountIdentifiers.sourceAccountNumber,
    destinationAccountNumber: accountIdentifiers.destinationAccountNumber,
    amount: Number(input.amount.toFixed(2)),
    currency: (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase(),
    purpose: input.purpose ?? null,
    externalReference: input.externalReference ?? null,
  };
}

function envelopeOptionalAccountIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  const checked = validateNccAccountIdentifierEnvelope(value);
  if (!checked.ok) {
    throw new NccSettlementError(checked.code, checked.code);
  }
  return checked.value;
}

/** Strip legacy public account-reference keys from metadata before persistence. */
function sanitizeInstructionMetadata(
  metadata: Record<string, unknown> | undefined,
  resolved: {
    sourceInternalReference: string | null;
    destinationInternalReference: string | null;
  },
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...(metadata ?? {}) };
  delete copy.sourceAccountReference;
  delete copy.destinationAccountReference;
  delete copy.sourceAccountNumber;
  delete copy.destinationAccountNumber;
  // Internal execution refs only — never returned on public API.
  if (resolved.sourceInternalReference) {
    copy.internalSourceAccountReference = resolved.sourceInternalReference;
  }
  if (resolved.destinationInternalReference) {
    copy.internalDestinationAccountReference = resolved.destinationInternalReference;
  }
  return copy;
}

function extractInternalAccountReferences(metadata: unknown): {
  sourceAccountReference?: string;
  destinationAccountReference?: string;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const m = metadata as Record<string, unknown>;
  const source =
    typeof m.internalSourceAccountReference === "string"
      ? m.internalSourceAccountReference
      : typeof m.sourceAccountReference === "string"
        ? m.sourceAccountReference
        : undefined;
  const destination =
    typeof m.internalDestinationAccountReference === "string"
      ? m.internalDestinationAccountReference
      : typeof m.destinationAccountReference === "string"
        ? m.destinationAccountReference
        : undefined;
  return {
    sourceAccountReference: source,
    destinationAccountReference: destination,
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

export async function getInstruction(id: string): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  return mapInstruction(row);
}

/** Resume only when risk allows money movement; hold MANUAL_REVIEW / COMPLIANCE_HOLD. */
async function resumeSubmittedInstructionIfRiskAllows(
  instruction: SettlementInstruction,
  actorUserId: string,
): Promise<SettlementInstructionView> {
  const decision = await prisma.nccRiskDecision.findUnique({
    where: { settlementInstructionId: instruction.id },
  });
  if (
    decision &&
    (decision.outcome === "MANUAL_REVIEW" ||
      decision.outcome === "COMPLIANCE_HOLD" ||
      decision.outcome === "REJECT")
  ) {
    return mapInstruction(instruction);
  }
  return runInstructionToCompletion(instruction.id, actorUserId, instruction.metadata);
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

  const accountRefs = extractInternalAccountReferences(metadata);
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

  // Network settlement switch — distinct from public-site maintenance mode.
  const { assertNetworkAllowsNewSettlement } = await import(
    "@/server/ncc/ncc-network-control.service"
  );
  try {
    await assertNetworkAllowsNewSettlement();
  } catch (error) {
    const code = error instanceof Error ? error.message : "NETWORK_BLOCKED";
    throw new NccSettlementError(code, code);
  }

  if (input.sendingInstitutionId === input.receivingInstitutionId) {
    throw new NccSettlementError("SELF_SETTLEMENT_DENIED", "SELF_SETTLEMENT_DENIED");
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
    throw new NccSettlementError("ROUTING_NUMBER_UNAVAILABLE", "ROUTING_NUMBER_UNAVAILABLE");
  }

  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  const amount = toMoneyDecimal(input.amount);
  // Envelope-validate before hash so identifiers are exact opaque strings.
  const sourceAccountNumber = envelopeOptionalAccountIdentifier(input.sourceAccountNumber);
  const destinationAccountNumber = envelopeOptionalAccountIdentifier(
    input.destinationAccountNumber,
  );
  const payload = stableSubmitPayload(
    input,
    {
      sending: sendRouting.routingNumber,
      receiving: recvRouting.routingNumber,
    },
    { sourceAccountNumber, destinationAccountNumber },
  );
  const requestHash = hashSettlementPayload(payload);

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
      return resumeSubmittedInstructionIfRiskAllows(
        existing,
        existing.submittedByUserId ?? input.submittedByUserId ?? "system",
      );
    }
    return mapInstruction(existing);
  }

  // Resolve opaque account identifiers before any NCC ledger posting.
  const resolved = await resolveSettlementPaymentAddresses({
    sendingInstitution: sending,
    receivingInstitution: receiving,
    sendingRoutingNumber: sendRouting.routingNumber,
    receivingRoutingNumber: recvRouting.routingNumber,
    currency,
    sourceAccountNumber,
    destinationAccountNumber,
  });

  const actorId = input.submittedByUserId ?? sending.primaryContactUserId;
  if (!actorId) throw new NccSettlementError("SUBMITTER_REQUIRED", "SUBMITTER_REQUIRED");

  const metadata = sanitizeInstructionMetadata(input.metadata, resolved);

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
          metadata: metadata as Prisma.InputJsonValue,
          sourceAccountNumberMasked: resolved.sourceAccountNumberMasked,
          destinationAccountNumberMasked: resolved.destinationAccountNumberMasked,
          sendingRoutingNumberUsed: resolved.sendingRoutingNumberUsed,
          receivingRoutingNumberUsed: resolved.receivingRoutingNumberUsed,
          addressResolvedAt: resolved.addressResolvedAt,
          sourceResolverKey: resolved.sourceResolverKey,
          destinationResolverKey: resolved.destinationResolverKey,
          sourceAccountNumberEncrypted: resolved.sourceAccountNumberEncrypted,
          destinationAccountNumberEncrypted: resolved.destinationAccountNumberEncrypted,
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
            sourceAccountNumberMasked: row.sourceAccountNumberMasked,
            destinationAccountNumberMasked: row.destinationAccountNumberMasked,
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
        return resumeSubmittedInstructionIfRiskAllows(
          race,
          race.submittedByUserId ?? actorId,
        );
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
      sourceAccountNumberMasked: created.sourceAccountNumberMasked,
      destinationAccountNumberMasked: created.destinationAccountNumberMasked,
    },
  });

  // Risk evaluation before any prepare / ledger / money movement.
  const { evaluateSettlementRisk } = await import("@/server/ncc/ncc-risk.service");
  const risk = await evaluateSettlementRisk({
    institutionId: created.sendingInstitutionId,
    amount: created.amount,
    settlementInstructionId: created.id,
  });

  if (risk.outcome === "REJECT") {
    return failInstruction(
      created.id,
      risk.reasonCode ?? "RISK_REJECTED",
      risk.reason ?? "Settlement rejected by risk policy",
      actorId,
    );
  }

  if (risk.outcome === "MANUAL_REVIEW" || risk.outcome === "COMPLIANCE_HOLD") {
    // Persist execution in MANUAL_REVIEW — do not prepare or move money.
    const execution = await createOrGetExecution(
      created.id,
      extractInternalAccountReferences(created.metadata),
    );
    if (execution.status === "NOT_STARTED" || execution.status === "RETRY_PENDING") {
      await prisma.settlementExecution.update({
        where: { id: execution.id },
        data: {
          status: "MANUAL_REVIEW",
          failureCode: risk.reasonCode ?? risk.outcome,
          failureReason: risk.reason ?? "Held before money movement by risk policy",
          lastAttemptAt: new Date(),
        },
      });
    }
    await enqueueOutboxEvent({
      settlementInstructionId: created.id,
      eventType: NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
      dedupeKey: `settlement.manual_review:risk:${created.id}`,
      payload: {
        reason: risk.reason ?? risk.outcome,
        reasonCode: risk.reasonCode,
        riskDecisionId: risk.decisionId,
      },
    });
    return mapInstruction(created);
  }

  // ALLOW / OVERRIDE_ALLOW — attempt immediate end-to-end execution.
  return runInstructionToCompletion(created.id, actorId, created.metadata);
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

  if (
    sendingAccount &&
    (sendingAccount.status === "FROZEN" || sendingAccount.frozenAt != null)
  ) {
    return failInstruction(
      id,
      "SENDER_ACCOUNT_FROZEN",
      "Sending settlement account is frozen",
      actorUserId,
    );
  }
  if (!sendingAccount || sendingAccount.status !== "ACTIVE") {
    return failInstruction(id, "SENDER_ACCOUNT_UNAVAILABLE", "Sending settlement account unavailable", actorUserId);
  }
  if (!receivingAccount || receivingAccount.status !== "ACTIVE") {
    return failInstruction(id, "RECEIVER_ACCOUNT_UNAVAILABLE", "Receiving settlement account unavailable", actorUserId);
  }
  if (moneyLt(asDecimal(sendingAccount.availableBalance), asDecimal(row.amount))) {
    try {
      const { alertInsufficientLiquidity } = await import("@/server/ncc/ncc-liquidity.service");
      await alertInsufficientLiquidity({
        institutionId: row.sendingInstitutionId,
        settlementAccountId: sendingAccount.id,
        available: asDecimal(sendingAccount.availableBalance).toFixed(2),
        required: asDecimal(row.amount).toFixed(2),
        actorUserId,
      });
    } catch {
      // Alert is best-effort; settlement failure still proceeds.
    }
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
  const trimmedReason = reason.trim() || "Cancelled";

  // Concurrent cancel/execute: lock instruction row first.
  const { updated, publicReference, sendingInstitutionId, holdToRelease, alreadyCancelled } =
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<SettlementInstruction[]>`
        SELECT * FROM "SettlementInstruction" WHERE id = ${id} FOR UPDATE
      `;
      const row = locked[0];
      if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");

      if (row.status === "CANCELLED") {
        return {
          updated: row,
          publicReference: row.publicReference,
          sendingInstitutionId: row.sendingInstitutionId,
          holdToRelease: null as {
            holdReference: string;
            sendingInstitutionId: string;
          } | null,
          alreadyCancelled: true,
        };
      }

      if (row.status === "SETTLED" || row.status === "REVERSED") {
        throw new NccSettlementError(
          "CANCEL_AFTER_SETTLEMENT_DENIED",
          "CANCEL_AFTER_SETTLEMENT_DENIED",
        );
      }
      if (row.status === "FAILED") {
        throw new NccSettlementError("INSTRUCTION_ALREADY_FINAL", "INSTRUCTION_ALREADY_FINAL");
      }
      if (row.status === "SETTLING") {
        throw new NccSettlementError(
          "CANCEL_WHILE_SETTLING_DENIED",
          "CANCEL_WHILE_SETTLING_DENIED",
        );
      }

      const execution = await tx.settlementExecution.findUnique({
        where: { settlementInstructionId: id },
      });

      if (execution && POST_LEDGER_EXECUTION.has(execution.status)) {
        throw new NccSettlementError(
          "CANCEL_AFTER_LEDGER_DENIED",
          "Cancellation is not allowed after irrevocable NCC ledger posting",
        );
      }
      if (execution && !PRE_LEDGER_CANCELABLE_EXECUTION.has(execution.status)) {
        throw new NccSettlementError(
          "CANCEL_AFTER_PREPARATION_DENIED",
          "CANCEL_AFTER_PREPARATION_DENIED",
        );
      }

      const cancelled = await tx.settlementInstruction.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          failureCode: "CANCELLED",
          failureReason: trimmedReason,
        },
      });

      if (execution && execution.status !== "FAILED") {
        await tx.settlementExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            failureCode: "CANCELLED",
            failureReason: trimmedReason,
            completedAt: new Date(),
          },
        });
      }

      await enqueueOutboxEvent(
        {
          settlementInstructionId: id,
          eventType: NCC_OUTBOX_EVENTS.CANCELLED,
          dedupeKey: `settlement.cancelled:${id}`,
          payload: {
            publicReference: cancelled.publicReference,
            reason: trimmedReason,
            actorUserId,
          },
        },
        tx,
      );
      await enqueueOutboxEvent(
        {
          settlementInstructionId: id,
          eventType: NCC_OUTBOX_EVENTS.FAILED,
          dedupeKey: `settlement.failed:cancel:${id}`,
          payload: {
            publicReference: cancelled.publicReference,
            failureCode: "CANCELLED",
            reason: trimmedReason,
          },
        },
        tx,
      );

      return {
        updated: cancelled,
        publicReference: cancelled.publicReference,
        sendingInstitutionId: cancelled.sendingInstitutionId,
        holdToRelease:
          execution?.sourcePreparationReference
            ? {
                holdReference: execution.sourcePreparationReference,
                sendingInstitutionId: cancelled.sendingInstitutionId,
              }
            : null,
        alreadyCancelled: false,
      };
    });

  if (alreadyCancelled) return mapInstruction(updated);

  // Release prepared source hold outside the DB lock (idempotent adapter call).
  // Cancellation is not compensation — this only releases a pre-ledger hold.
  if (holdToRelease) {
    const sending = await prisma.financialInstitution.findUnique({
      where: { id: holdToRelease.sendingInstitutionId },
    });
    if (sending) {
      const adapter = await getAdapterForInstitution(sending);
      if (adapter) {
        await adapter.releaseDebit({
          holdReference: holdToRelease.holdReference,
          settlementInstructionId: id,
        });
      }
    }
  }

  await writeNccAudit({
    actorUserId,
    action: NCC_AUDIT.SETTLEMENT_CANCELLED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: id,
    description: `Settlement instruction ${publicReference} cancelled`,
    institutionId: sendingInstitutionId,
    metadata: { reason: trimmedReason },
  });

  return mapInstruction(updated);
}

/**
 * Direct ledger-only reversal is disabled for production/staff/API use.
 * Value returns must go through the transfer-return dual-control workflow.
 */
export function assertLedgerOnlyReversalDisabled(): never {
  throw new NccSettlementError(
    "LEDGER_ONLY_REVERSAL_DISABLED",
    "LEDGER_ONLY_REVERSAL_DISABLED",
  );
}

/**
 * Public reverse entry point — always disabled.
 * Compensation must call {@link reverseNccLedgerPositionsForCompensation}.
 * Participant returns must use the transfer-return service.
 */
export async function reverseInstruction(
  _id: string,
  _actorUserId: string,
  _reason: string,
): Promise<SettlementInstructionView> {
  assertLedgerOnlyReversalDisabled();
}

export type ReverseNccLedgerResult = {
  originalInstructionId: string;
  reversalInstructionId: string;
  publicReference: string;
};

type ApplyNccLedgerReverseInput = {
  originalInstructionId: string;
  actorUserId: string;
  reason: string;
  /** Stable idempotency key for the compensating instruction. */
  idempotencyKey: string;
  /**
   * When true (compensation path): mark original REVERSED + SettlementReversal + outbox.
   * When false (transfer-return path): move NCC positions only; caller finalizes later.
   */
  markOriginalReversed: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Immutable NCC position reverse (receiver → sender). Used ONLY by compensation
 * (markOriginalReversed=true) or transfer-return ledger leg (false until adapters finish).
 */
async function applyNccLedgerReversePositions(
  input: ApplyNccLedgerReverseInput,
): Promise<ReverseNccLedgerResult> {
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    throw new NccSettlementError("REVERSAL_REASON_REQUIRED", "REVERSAL_REASON_REQUIRED");
  }

  const original = await prisma.settlementInstruction.findUnique({
    where: { id: input.originalInstructionId },
  });
  if (!original) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");

  const existingReversal = await prisma.settlementReversal.findUnique({
    where: { originalInstructionId: input.originalInstructionId },
  });
  if (existingReversal || original.status === "REVERSED") {
    // Compensation path is not silently idempotent — callers check eligibility first.
    // Transfer-return resume uses the compensating-instruction idempotency key below.
    if (input.markOriginalReversed) {
      throw new NccSettlementError("ALREADY_REVERSED", "ALREADY_REVERSED");
    }
    if (existingReversal) {
      return {
        originalInstructionId: input.originalInstructionId,
        reversalInstructionId: existingReversal.reversalInstructionId,
        publicReference: original.publicReference,
      };
    }
    throw new NccSettlementError("ALREADY_REVERSED", "ALREADY_REVERSED");
  }
  if (original.status !== "SETTLED") {
    throw new NccSettlementError("REVERSAL_REQUIRES_SETTLED", "REVERSAL_REQUIRES_SETTLED");
  }

  // Idempotent resume: compensating instruction already created for this key.
  const existingCompensating = await prisma.settlementInstruction.findUnique({
    where: {
      sendingInstitutionId_idempotencyKey: {
        sendingInstitutionId: original.receivingInstitutionId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existingCompensating) {
    if (input.markOriginalReversed && original.status === "SETTLED") {
      await finalizeOriginalInstructionReversed({
        originalInstructionId: original.id,
        reversalInstructionId: existingCompensating.id,
        actorUserId: input.actorUserId,
        reason: trimmedReason,
      });
    }
    return {
      originalInstructionId: original.id,
      reversalInstructionId: existingCompensating.id,
      publicReference: existingCompensating.publicReference,
    };
  }

  const reversal = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<SettlementInstruction[]>`
      SELECT * FROM "SettlementInstruction" WHERE id = ${input.originalInstructionId} FOR UPDATE
    `;
    const row = locked[0];
    if (!row || row.status !== "SETTLED") {
      throw new NccSettlementError("REVERSAL_REQUIRES_SETTLED", "REVERSAL_REQUIRES_SETTLED");
    }
    const already = await tx.settlementReversal.findUnique({
      where: { originalInstructionId: input.originalInstructionId },
    });
    if (already) {
      return {
        id: already.reversalInstructionId,
        publicReference: row.publicReference,
      };
    }

    const raced = await tx.settlementInstruction.findUnique({
      where: {
        sendingInstitutionId_idempotencyKey: {
          sendingInstitutionId: row.receivingInstitutionId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (raced) {
      return { id: raced.id, publicReference: raced.publicReference };
    }

    const amount = asDecimal(row.amount);
    const amountNum = decimalToNumber(amount);

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
    if (moneyLt(asDecimal(originalReceiver.availableBalance), amount)) {
      throw new NccSettlementError("REVERSAL_INSUFFICIENT_FUNDS", "REVERSAL_INSUFFICIENT_FUNDS");
    }

    const recvBefore = decimalToNumber(originalReceiver.ledgerBalance);
    const sendBefore = decimalToNumber(originalSender.ledgerBalance);
    const recvAfter = Number((recvBefore - amountNum).toFixed(2));
    const sendAfter = Number((sendBefore + amountNum).toFixed(2));
    if (recvAfter < 0) {
      throw new NccSettlementError("NEGATIVE_BALANCE_DENIED", "NEGATIVE_BALANCE_DENIED");
    }

    const reversalInstruction = await tx.settlementInstruction.create({
      data: {
        publicReference: generateSettlementPublicReference(),
        idempotencyKey: input.idempotencyKey,
        requestHash: hashSettlementPayload({
          originalId: row.id,
          reason: trimmedReason,
          idempotencyKey: input.idempotencyKey,
        }),
        sendingInstitutionId: row.receivingInstitutionId,
        receivingInstitutionId: row.sendingInstitutionId,
        sendingRoutingNumberId: row.receivingRoutingNumberId,
        receivingRoutingNumberId: row.sendingRoutingNumberId,
        currency: row.currency,
        amount: row.amount,
        purpose: `Reversal of ${row.publicReference}`,
        externalReference: row.publicReference,
        status: "SETTLED",
        submittedByUserId: input.actorUserId,
        submittedAt: new Date(),
        validatedAt: new Date(),
        settledAt: new Date(),
        metadata: {
          reversalOf: row.id,
          reason: trimmedReason,
          ...(input.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    await tx.settlementAccount.update({
      where: { id: originalReceiver.id },
      data: {
        ledgerBalance: recvAfter,
        availableBalance: { decrement: amountNum },
      },
    });
    await tx.settlementAccount.update({
      where: { id: originalSender.id },
      data: {
        ledgerBalance: sendAfter,
        availableBalance: { increment: amountNum },
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

    if (input.markOriginalReversed) {
      await tx.settlementReversal.create({
        data: {
          originalInstructionId: row.id,
          reversalInstructionId: reversalInstruction.id,
          reason: trimmedReason,
          actorUserId: input.actorUserId,
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
            actorUserId: input.actorUserId,
          },
        },
        tx,
      );
    }

    return reversalInstruction;
  });

  if (input.markOriginalReversed) {
    await writeNccAudit({
      actorUserId: input.actorUserId,
      action: NCC_AUDIT.SETTLEMENT_REVERSED,
      entityType: "SETTLEMENT_INSTRUCTION",
      entityId: input.originalInstructionId,
      description: `Settlement instruction reversed; compensating ${reversal.publicReference}`,
      institutionId: original.sendingInstitutionId,
      metadata: { reason: trimmedReason, reversalInstructionId: reversal.id },
    });
  }

  return {
    originalInstructionId: input.originalInstructionId,
    reversalInstructionId: reversal.id,
    publicReference: reversal.publicReference,
  };
}

/**
 * Compensation-only NCC ledger reverse. Marks the original instruction REVERSED.
 * Must not be used for participant transfer returns.
 */
export async function reverseNccLedgerPositionsForCompensation(
  id: string,
  actorUserId: string,
  reason: string,
): Promise<ReverseNccLedgerResult> {
  return applyNccLedgerReversePositions({
    originalInstructionId: id,
    actorUserId,
    reason,
    idempotencyKey: `reversal:${id}`,
    markOriginalReversed: true,
    metadata: { path: "compensation" },
  });
}

/**
 * Transfer-return NCC ledger leg — moves positions without marking original REVERSED
 * until adapter legs complete ({@link finalizeOriginalInstructionReversed}).
 */
export async function createTransferReturnLedgerInstruction(input: {
  originalInstructionId: string;
  returnId: string;
  actorUserId: string;
  reason: string;
}): Promise<ReverseNccLedgerResult> {
  return applyNccLedgerReversePositions({
    originalInstructionId: input.originalInstructionId,
    actorUserId: input.actorUserId,
    reason: input.reason,
    idempotencyKey: `transfer-return:${input.returnId}`,
    markOriginalReversed: false,
    metadata: { path: "transfer_return", transferReturnId: input.returnId },
  });
}

/** Finalize original instruction after a successful end-to-end transfer return. */
export async function finalizeOriginalInstructionReversed(input: {
  originalInstructionId: string;
  reversalInstructionId: string;
  actorUserId: string;
  reason: string;
}): Promise<void> {
  const trimmedReason = input.reason.trim();
  const original = await prisma.settlementInstruction.findUnique({
    where: { id: input.originalInstructionId },
  });
  if (!original) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  if (original.status === "REVERSED") return;

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<SettlementInstruction[]>`
      SELECT * FROM "SettlementInstruction" WHERE id = ${input.originalInstructionId} FOR UPDATE
    `;
    const row = locked[0];
    if (!row || row.status === "REVERSED") return;
    if (row.status !== "SETTLED") {
      throw new NccSettlementError("REVERSAL_REQUIRES_SETTLED", "REVERSAL_REQUIRES_SETTLED");
    }

    const existing = await tx.settlementReversal.findUnique({
      where: { originalInstructionId: input.originalInstructionId },
    });
    if (!existing) {
      await tx.settlementReversal.create({
        data: {
          originalInstructionId: input.originalInstructionId,
          reversalInstructionId: input.reversalInstructionId,
          reason: trimmedReason,
          actorUserId: input.actorUserId,
          metadata: { originalPublicReference: row.publicReference },
        },
      });
    }

    await tx.settlementInstruction.update({
      where: { id: input.originalInstructionId },
      data: { status: "REVERSED", reversedAt: new Date() },
    });

    await enqueueOutboxEvent(
      {
        settlementInstructionId: input.originalInstructionId,
        eventType: NCC_OUTBOX_EVENTS.REVERSED,
        dedupeKey: `settlement.reversed:${input.originalInstructionId}`,
        payload: {
          reason: trimmedReason,
          reversalInstructionId: input.reversalInstructionId,
          actorUserId: input.actorUserId,
        },
      },
      tx,
    );
  });

  await writeNccAudit({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.SETTLEMENT_REVERSED,
    entityType: "SETTLEMENT_INSTRUCTION",
    entityId: input.originalInstructionId,
    description: `Settlement instruction reversed via transfer return`,
    institutionId: original.sendingInstitutionId,
    metadata: {
      reason: trimmedReason,
      reversalInstructionId: input.reversalInstructionId,
    },
  });
}

/** Resume execution for an already-submitted instruction (e.g. after risk override). */
export async function continueSubmittedInstruction(
  instructionId: string,
  actorUserId: string,
): Promise<SettlementInstructionView> {
  const row = await prisma.settlementInstruction.findUnique({ where: { id: instructionId } });
  if (!row) throw new NccSettlementError("NOT_FOUND", "NOT_FOUND");
  return runInstructionToCompletion(instructionId, actorUserId, row.metadata);
}

export const nccSettlementService = {
  submitInstruction,
  validateInstruction,
  settleInstruction,
  failInstruction,
  cancelInstruction,
  reverseInstruction,
  reverseNccLedgerPositionsForCompensation,
  createTransferReturnLedgerInstruction,
  finalizeOriginalInstructionReversed,
  continueSubmittedInstruction,
  getInstruction,
  isInstructionCancelable,
  assertLedgerOnlyReversalDisabled,
};
