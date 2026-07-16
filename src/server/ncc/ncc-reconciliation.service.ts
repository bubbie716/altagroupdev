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
  bankDebitFound: boolean;
  bankCreditFound: boolean;
  terminalDebitFound: boolean;
  terminalCreditFound: boolean;
  fundingRequestId: string | null;
  fundingRequestStatus: string | null;
  withdrawalRequestId: string | null;
  withdrawalRequestStatus: string | null;
  mismatches: string[];
};

/**
 * Reconciles a single settlement instruction across every system it touches:
 * the NCC ledger (SettlementEntry), the end-to-end execution state machine, and
 * whichever institution ledgers (BankAccount/TerminalCashAccount) were involved,
 * plus any linked Terminal funding/withdrawal request.
 */
export async function reconcileInstruction(instructionId: string): Promise<SettlementReconciliation> {
  const instruction = await prisma.settlementInstruction.findUnique({ where: { id: instructionId } });
  if (!instruction) throw new NccReconciliationError("NOT_FOUND", "NOT_FOUND");

  const [execution, entries, bankDebit, bankCredit, terminalEntries, fundingRequest, withdrawalRequest] =
    await Promise.all([
      prisma.settlementExecution.findUnique({ where: { settlementInstructionId: instructionId } }),
      prisma.settlementEntry.findMany({ where: { settlementInstructionId: instructionId } }),
      prisma.bankTransaction.findUnique({ where: { referenceCode: `NCC-DBT-${instructionId}` } }),
      prisma.bankTransaction.findUnique({ where: { referenceCode: `NCC-CDT-${instructionId}` } }),
      prisma.terminalCashEntry.findMany({ where: { settlementInstructionId: instructionId } }),
      prisma.terminalFundingRequest.findFirst({ where: { settlementInstructionId: instructionId } }),
      prisma.terminalWithdrawalRequest.findFirst({ where: { settlementInstructionId: instructionId } }),
    ]);

  const terminalDebitFound = terminalEntries.some((e) => e.entryType === "WITHDRAWAL_DEBIT");
  const terminalCreditFound = terminalEntries.some((e) => e.entryType === "FUNDING_CREDIT");
  const sourceSideEffectFound = !!bankDebit || terminalDebitFound;
  const destinationSideEffectFound = !!bankCredit || terminalCreditFound;
  const sourceSideEffectExpected = !!execution?.sourceAccountReference;
  const destinationSideEffectExpected = !!execution?.destinationAccountReference;

  const mismatches: string[] = [];
  if (instruction.status === "SETTLED" && entries.length !== 2) {
    mismatches.push(`Expected 2 settlement entries for a SETTLED instruction, found ${entries.length}`);
  }
  if ((instruction.status === "FAILED" || instruction.status === "CANCELLED") && entries.length > 0) {
    mismatches.push("Settlement ledger entries exist despite a non-settled instruction status");
  }
  if (execution?.status === "COMPLETED" && sourceSideEffectExpected && !sourceSideEffectFound) {
    mismatches.push("Execution COMPLETED but no source debit side effect found on the institution ledger");
  }
  if (execution?.status === "COMPLETED" && destinationSideEffectExpected && !destinationSideEffectFound) {
    mismatches.push("Execution COMPLETED but no destination credit side effect found on the institution ledger");
  }

  const findings: ReconciliationFindings = {
    instructionStatus: instruction.status,
    executionStatus: execution?.status ?? null,
    entryCount: entries.length,
    sourceAccountReference: execution?.sourceAccountReference ?? null,
    destinationAccountReference: execution?.destinationAccountReference ?? null,
    bankDebitFound: !!bankDebit,
    bankCreditFound: !!bankCredit,
    terminalDebitFound,
    terminalCreditFound,
    fundingRequestId: fundingRequest?.id ?? null,
    fundingRequestStatus: fundingRequest?.status ?? null,
    withdrawalRequestId: withdrawalRequest?.id ?? null,
    withdrawalRequestStatus: withdrawalRequest?.status ?? null,
    mismatches,
  };

  let status: SettlementReconciliationStatus;
  if (execution?.status === "MANUAL_REVIEW") {
    status = "MANUAL_REVIEW";
  } else if (execution?.status === "COMPENSATED") {
    status = "COMPENSATED";
  } else if (mismatches.length > 0) {
    status =
      sourceSideEffectExpected && !sourceSideEffectFound
        ? "MISSING_SOURCE"
        : destinationSideEffectExpected && !destinationSideEffectFound
          ? "MISSING_DESTINATION"
          : "MISMATCH";
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

  return prisma.settlementReconciliation.create({
    data: {
      settlementInstructionId: instructionId,
      status,
      findings: findings as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function listReconciliations(
  instructionId: string,
): Promise<SettlementReconciliation[]> {
  return prisma.settlementReconciliation.findMany({
    where: { settlementInstructionId: instructionId },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReconciliation(
  id: string,
  actorUserId: string,
  note: string,
): Promise<SettlementReconciliation> {
  const trimmed = note.trim();
  if (!trimmed) throw new NccReconciliationError("RESOLUTION_NOTE_REQUIRED", "RESOLUTION_NOTE_REQUIRED");

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
