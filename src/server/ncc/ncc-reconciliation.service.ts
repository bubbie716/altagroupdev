import { createHash } from "node:crypto";
import { Prisma, type SettlementReconciliation, type SettlementReconciliationStatus } from "@prisma/client";
import { prisma } from "@/server/db";

export class NccReconciliationError extends Error {
  constructor(
    message: string,
    readonly code: string = message,
  ) {
    super(message);
    this.name = "NccReconciliationError";
  }
}

type ReconciliationFindings = {
  instructionStatus: string;
  executionStatus: string | null;
  entryCount: number;
  sourceAccountReference: string | null;
  destinationAccountReference: string | null;
  sourceCommitReference: string | null;
  destinationCreditReference: string | null;
  sourceRestoreReference: string | null;
  compensationId: string | null;
  participantSourceRef: string | null;
  participantDestinationRef: string | null;
  bankDebitFound: boolean;
  bankCreditFound: boolean;
  terminalDebitFound: boolean;
  terminalCreditFound: boolean;
  fundingRequestId: string | null;
  fundingRequestStatus: string | null;
  withdrawalRequestId: string | null;
  withdrawalRequestStatus: string | null;
  liquidityOpsNearSettlement: number;
  findingCodes: string[];
  mismatches: string[];
  evidence?: unknown;
  findingsHash: string;
};

function hashFindings(findings: Omit<ReconciliationFindings, "findingsHash" | "evidence">): string {
  return createHash("sha256").update(JSON.stringify(findings)).digest("hex").slice(0, 32);
}

/**
 * Reconciles a single settlement instruction across every system it touches.
 * Never moves money. Idempotent: unchanged status+findings returns the latest row.
 */
export async function reconcileInstruction(instructionId: string): Promise<SettlementReconciliation> {
  const instruction = await prisma.settlementInstruction.findUnique({ where: { id: instructionId } });
  if (!instruction) throw new NccReconciliationError("NOT_FOUND", "NOT_FOUND");

  const settlementWindowStart = new Date(
    (instruction.settledAt ?? instruction.updatedAt).getTime() - 24 * 60 * 60 * 1000,
  );
  const settlementWindowEnd = new Date(
    (instruction.settledAt ?? instruction.updatedAt).getTime() + 24 * 60 * 60 * 1000,
  );

  const [
    execution,
    entries,
    compensation,
    bankDebit,
    bankCredit,
    terminalEntries,
    fundingRequest,
    withdrawalRequest,
    liquidityOpsNearSettlement,
  ] = await Promise.all([
    prisma.settlementExecution.findUnique({ where: { settlementInstructionId: instructionId } }),
    prisma.settlementEntry.findMany({ where: { settlementInstructionId: instructionId } }),
    prisma.settlementCompensation.findUnique({ where: { settlementInstructionId: instructionId } }),
    prisma.bankTransaction.findUnique({ where: { referenceCode: `NCC-DBT-${instructionId}` } }),
    prisma.bankTransaction.findUnique({ where: { referenceCode: `NCC-CDT-${instructionId}` } }),
    prisma.terminalCashEntry.findMany({ where: { settlementInstructionId: instructionId } }),
    prisma.terminalFundingRequest.findFirst({ where: { settlementInstructionId: instructionId } }),
    prisma.terminalWithdrawalRequest.findFirst({ where: { settlementInstructionId: instructionId } }),
    prisma.nccLiquidityOperation.count({
      where: {
        institutionId: {
          in: [instruction.sendingInstitutionId, instruction.receivingInstitutionId],
        },
        createdAt: { gte: settlementWindowStart, lte: settlementWindowEnd },
      },
    }),
  ]);

  const terminalDebits = terminalEntries.filter((e) => e.entryType === "WITHDRAWAL_DEBIT");
  const terminalCredits = terminalEntries.filter((e) => e.entryType === "FUNDING_CREDIT");
  const terminalDebitFound = terminalDebits.length > 0;
  const terminalCreditFound = terminalCredits.length > 0;
  const sourceSideEffectFound = !!bankDebit || terminalDebitFound;
  const destinationSideEffectFound = !!bankCredit || terminalCreditFound;
  const sourceSideEffectExpected = !!execution?.sourceAccountReference;
  const destinationSideEffectExpected = !!execution?.destinationAccountReference;

  const findingCodes: string[] = [];
  const mismatches: string[] = [];

  if (instruction.status === "SETTLED" && entries.length !== 2) {
    findingCodes.push("MISMATCH");
    mismatches.push(`Expected 2 settlement entries for a SETTLED instruction, found ${entries.length}`);
  }
  if ((instruction.status === "FAILED" || instruction.status === "CANCELLED") && entries.length > 0) {
    findingCodes.push("MISMATCH");
    mismatches.push("Settlement ledger entries exist despite a non-settled instruction status");
  }
  if (execution?.status === "COMPLETED" && sourceSideEffectExpected && !sourceSideEffectFound) {
    findingCodes.push("MISSING_SOURCE");
    mismatches.push("Execution COMPLETED but no source debit side effect found on the institution ledger");
  }
  if (execution?.status === "COMPLETED" && destinationSideEffectExpected && !destinationSideEffectFound) {
    findingCodes.push("MISSING_DESTINATION");
    mismatches.push(
      "Execution COMPLETED but no destination credit side effect found on the institution ledger",
    );
  }
  if (terminalDebits.length > 1 || (!!bankDebit && terminalDebitFound)) {
    findingCodes.push("DUPLICATE");
    mismatches.push("Duplicate source debit side effects detected");
  }
  if (terminalCredits.length > 1 || (!!bankCredit && terminalCreditFound)) {
    findingCodes.push("DUPLICATE");
    mismatches.push("Duplicate destination credit side effects detected");
  }

  const staleHold = await prisma.bankAccountHold.findFirst({
    where: {
      status: "ACTIVE",
      nccOperationKey: { contains: instructionId },
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (staleHold) {
    findingCodes.push("STALE_RESERVATION");
    mismatches.push("Stale ACTIVE bank hold still associated with this instruction");
  }

  if (compensation) {
    findingCodes.push("COMPENSATED");
  }

  const findingsBase = {
    instructionStatus: instruction.status,
    executionStatus: execution?.status ?? null,
    entryCount: entries.length,
    sourceAccountReference: execution?.sourceAccountReference ?? null,
    destinationAccountReference: execution?.destinationAccountReference ?? null,
    sourceCommitReference: execution?.sourceCommitReference ?? null,
    destinationCreditReference: execution?.destinationCreditReference ?? null,
    sourceRestoreReference: compensation?.sourceRestoreReference ?? null,
    compensationId: compensation?.id ?? null,
    participantSourceRef: execution?.sourceAccountReference ?? null,
    participantDestinationRef: execution?.destinationAccountReference ?? null,
    bankDebitFound: !!bankDebit,
    bankCreditFound: !!bankCredit,
    terminalDebitFound,
    terminalCreditFound,
    fundingRequestId: fundingRequest?.id ?? null,
    fundingRequestStatus: fundingRequest?.status ?? null,
    withdrawalRequestId: withdrawalRequest?.id ?? null,
    withdrawalRequestStatus: withdrawalRequest?.status ?? null,
    liquidityOpsNearSettlement,
    findingCodes: [...new Set(findingCodes)],
    mismatches,
  };

  const findingsHash = hashFindings(findingsBase);
  const findings: ReconciliationFindings = { ...findingsBase, findingsHash };

  let status: SettlementReconciliationStatus;
  if (execution?.status === "MANUAL_REVIEW" && mismatches.length === 0 && !compensation) {
    status = "MANUAL_REVIEW";
  } else if (compensation || execution?.status === "COMPENSATED") {
    status = mismatches.length > 0 && !findingCodes.includes("COMPENSATED") ? "MISMATCH" : "COMPENSATED";
    if (compensation) status = "COMPENSATED";
  } else if (findingCodes.includes("DUPLICATE")) {
    status = "DUPLICATE";
  } else if (findingCodes.includes("STALE_RESERVATION") && mismatches.length === 1) {
    status = "STALE_RESERVATION";
  } else if (findingCodes.includes("MISSING_SOURCE")) {
    status = "MISSING_SOURCE";
  } else if (findingCodes.includes("MISSING_DESTINATION")) {
    status = "MISSING_DESTINATION";
  } else if (mismatches.length > 0) {
    status = "MISMATCH";
  } else if (instruction.status === "SETTLED" && (!execution || execution.status === "COMPLETED")) {
    status = "MATCHED";
  } else if (
    (instruction.status === "FAILED" || instruction.status === "CANCELLED") &&
    entries.length === 0
  ) {
    status = "MATCHED";
  } else {
    status = "PENDING";
  }

  const latest = await prisma.settlementReconciliation.findFirst({
    where: { settlementInstructionId: instructionId },
    orderBy: { createdAt: "desc" },
  });
  if (latest) {
    const priorFindings = latest.findings as { findingsHash?: string } | null;
    if (latest.status === status && priorFindings?.findingsHash === findingsHash) {
      return latest;
    }
    // Unchanged MATCHED after resolve keeps findings; do not recreate identical MATCHED.
    if (
      latest.status === "RESOLVED" &&
      status === "MATCHED" &&
      priorFindings?.findingsHash === findingsHash
    ) {
      return latest;
    }
  }

  const created = await prisma.settlementReconciliation.create({
    data: {
      settlementInstructionId: instructionId,
      status,
      findings: findings as unknown as Prisma.InputJsonValue,
    },
  });

  if (
    status === "MISMATCH" ||
    status === "MISSING_SOURCE" ||
    status === "MISSING_DESTINATION" ||
    status === "DUPLICATE" ||
    status === "STALE_RESERVATION"
  ) {
    try {
      const { writeAuditLog } = await import("@/server/audit.service");
      const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
      const actorUserId = await resolveSystemActorUserId();
      await writeAuditLog({
        actorUserId,
        action: "NCC_RECONCILIATION_MISMATCH_ALERT",
        entityType: "SETTLEMENT_RECONCILIATION",
        entityId: created.id,
        description: `Reconciliation ${status} for ${instruction.publicReference}`,
        institutionId: instruction.sendingInstitutionId,
        metadata: {
          settlementInstructionId: instructionId,
          status,
          findingCodes: findings.findingCodes,
        },
      });
    } catch {
      // Alert is best-effort.
    }
  }

  return created;
}

export async function listReconciliations(
  instructionId: string,
): Promise<SettlementReconciliation[]> {
  return prisma.settlementReconciliation.findMany({
    where: { settlementInstructionId: instructionId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Attach external participant evidence to findings JSON. Never deletes prior findings.
 */
export async function attachReconciliationEvidence(
  id: string,
  evidence: Record<string, unknown>,
  actorUserId: string,
): Promise<SettlementReconciliation> {
  const row = await prisma.settlementReconciliation.findUnique({ where: { id } });
  if (!row) throw new NccReconciliationError("NOT_FOUND", "NOT_FOUND");

  const prior =
    row.findings && typeof row.findings === "object" && !Array.isArray(row.findings)
      ? (row.findings as Record<string, unknown>)
      : {};

  const updated = await prisma.settlementReconciliation.update({
    where: { id },
    data: {
      findings: {
        ...prior,
        evidence: {
          ...(typeof prior.evidence === "object" && prior.evidence && !Array.isArray(prior.evidence)
            ? (prior.evidence as Record<string, unknown>)
            : {}),
          ...evidence,
          attachedAt: new Date().toISOString(),
          attachedByUserId: actorUserId,
        },
      } as Prisma.InputJsonValue,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "NCC_RECONCILIATION_EVIDENCE_ATTACHED",
    entityType: "SETTLEMENT_RECONCILIATION",
    entityId: id,
    description: `External evidence attached to reconciliation ${id}`,
    metadata: {
      settlementInstructionId: updated.settlementInstructionId,
      evidenceKeys: Object.keys(evidence),
    },
  });

  return updated;
}

export async function resolveReconciliation(
  id: string,
  actorUserId: string,
  note: string,
): Promise<SettlementReconciliation> {
  const trimmed = note.trim();
  if (!trimmed) throw new NccReconciliationError("RESOLUTION_NOTE_REQUIRED", "RESOLUTION_NOTE_REQUIRED");

  const existing = await prisma.settlementReconciliation.findUnique({ where: { id } });
  if (!existing) throw new NccReconciliationError("NOT_FOUND", "NOT_FOUND");

  // Resolution never deletes mismatch findings — status moves to RESOLVED, findings retained.
  const updated = await prisma.settlementReconciliation.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: actorUserId,
      resolutionNote: trimmed,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "NCC_RECONCILIATION_RESOLVED",
    entityType: "SETTLEMENT_RECONCILIATION",
    entityId: id,
    description: `Reconciliation ${id} resolved`,
    metadata: { note: trimmed, settlementInstructionId: updated.settlementInstructionId },
  });

  return updated;
}

/** Sweeps recently-terminal instructions that have no reconciliation record yet. */
export async function runReconciliationSweep(limit = 50): Promise<SettlementReconciliation[]> {
  const candidates = await prisma.settlementInstruction.findMany({
    where: {
      status: { in: ["SETTLED", "FAILED"] },
      reconciliations: { none: {} },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 200),
    select: { id: true },
  });

  const results: SettlementReconciliation[] = [];
  for (const candidate of candidates) {
    results.push(await reconcileInstruction(candidate.id));
  }
  return results;
}
