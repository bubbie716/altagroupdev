import { Prisma, type TerminalWithdrawalRequest, type TerminalTransferRequestStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ALTA_BANK_INSTITUTION_ID, ALTA_TERMINAL_INSTITUTION_ID } from "@/lib/bank/account-ownership";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { decimalToNumber, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { findAccessibleBankAccount } from "@/server/bank-account-access.service";
import { getInstitutionPrimaryRouting } from "@/server/ncc/ncc-institution.service";
import { submitInstruction } from "@/server/ncc/ncc-settlement.service";
import { getTerminalCashAccountById } from "@/server/ncc/terminal-cash.service";

export class NccWithdrawalError extends Error {
  constructor(
    message: string,
    readonly code: string = message,
  ) {
    super(message);
    this.name = "NccWithdrawalError";
  }
}

export type TerminalWithdrawalRequestView = {
  id: string;
  userId: string;
  terminalCashAccountId: string;
  destinationBankAccountId: string;
  settlementInstructionId: string | null;
  amount: number;
  currency: string;
  status: TerminalTransferRequestStatus;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

function mapWithdrawalRequest(row: TerminalWithdrawalRequest): TerminalWithdrawalRequestView {
  return {
    id: row.id,
    userId: row.userId,
    terminalCashAccountId: row.terminalCashAccountId,
    destinationBankAccountId: row.destinationBankAccountId,
    settlementInstructionId: row.settlementInstructionId,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    status: row.status,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** Maps SettlementInstruction + SettlementExecution outcome onto the transfer request lifecycle. */
function resolveRequestStatus(
  instructionStatus: string,
  executionStatus: string | undefined,
): TerminalTransferRequestStatus {
  if (instructionStatus === "FAILED") return "FAILED";
  if (instructionStatus === "CANCELLED") return "CANCELLED";
  if (instructionStatus === "REVERSED") return "REVERSED";
  if (executionStatus === "COMPLETED") return "COMPLETED";
  if (
    executionStatus === "SOURCE_COMMITTED" ||
    executionStatus === "CREDITING_DESTINATION" ||
    executionStatus === "DESTINATION_CREDITED"
  ) {
    return "SOURCE_COMMITTED";
  }
  if (instructionStatus === "SETTLED") return "NCC_POSTED";
  return "PREPARING";
}

async function writeWithdrawalAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "TERMINAL_WITHDRAWAL_REQUEST",
    entityId: input.entityId,
    description: input.description,
    institutionId: ALTA_TERMINAL_INSTITUTION_ID,
    metadata: input.metadata,
  });
}

/**
 * Terminal → Bank withdrawal: moves funds from a customer's Alta Terminal /
 * Exchange trading-cash account back into their Alta Bank account via an NCC
 * settlement instruction. Idempotent on `idempotencyKey`.
 */
export async function submitTerminalWithdrawalRequest(
  userId: string,
  input: {
    terminalCashAccountId: string;
    destinationBankAccountId: string;
    amount: number;
    currency?: string;
    idempotencyKey: string;
  },
): Promise<TerminalWithdrawalRequestView> {
  if (!(input.amount > 0)) throw new NccWithdrawalError("INVALID_AMOUNT", "INVALID_AMOUNT");
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new NccWithdrawalError("IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REQUIRED");
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();

  const existing = await prisma.terminalWithdrawalRequest.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.userId !== userId) throw new NccWithdrawalError("FORBIDDEN", "FORBIDDEN");
    return mapWithdrawalRequest(existing);
  }

  const terminalAccount = await getTerminalCashAccountById(input.terminalCashAccountId);
  if (!terminalAccount || terminalAccount.ownerUserId !== userId) {
    throw new NccWithdrawalError("SOURCE_ACCOUNT_NOT_ACCESSIBLE", "SOURCE_ACCOUNT_NOT_ACCESSIBLE");
  }
  if (terminalAccount.status !== "ACTIVE") {
    throw new NccWithdrawalError("SOURCE_ACCOUNT_INACTIVE", "SOURCE_ACCOUNT_INACTIVE");
  }
  if (terminalAccount.currency !== currency) {
    throw new NccWithdrawalError("CURRENCY_MISMATCH", "CURRENCY_MISMATCH");
  }
  if (terminalAccount.availableBalance < input.amount) {
    throw new NccWithdrawalError("INSUFFICIENT_FUNDS", "INSUFFICIENT_FUNDS");
  }

  const destinationAccount = await findAccessibleBankAccount(userId, input.destinationBankAccountId, "view");
  if (!destinationAccount) {
    throw new NccWithdrawalError("DESTINATION_ACCOUNT_NOT_ACCESSIBLE", "DESTINATION_ACCOUNT_NOT_ACCESSIBLE");
  }
  if (destinationAccount.status !== "ACTIVE") {
    throw new NccWithdrawalError("DESTINATION_ACCOUNT_INACTIVE", "DESTINATION_ACCOUNT_INACTIVE");
  }
  if (destinationAccount.restrictDeposits) {
    throw new NccWithdrawalError("DESTINATION_ACCOUNT_RESTRICTED", "DESTINATION_ACCOUNT_RESTRICTED");
  }
  if (destinationAccount.currency !== currency) {
    throw new NccWithdrawalError("CURRENCY_MISMATCH", "CURRENCY_MISMATCH");
  }

  const [terminalRouting, bankRouting] = await Promise.all([
    getInstitutionPrimaryRouting(ALTA_TERMINAL_INSTITUTION_ID),
    getInstitutionPrimaryRouting(ALTA_BANK_INSTITUTION_ID),
  ]);
  if (!terminalRouting || !bankRouting) {
    throw new NccWithdrawalError("NCC_ROUTING_NOT_CONFIGURED", "NCC_ROUTING_NOT_CONFIGURED");
  }

  let withdrawalRequest: TerminalWithdrawalRequest;
  try {
    withdrawalRequest = await prisma.terminalWithdrawalRequest.create({
      data: {
        userId,
        terminalCashAccountId: terminalAccount.id,
        destinationBankAccountId: destinationAccount.id,
        amount: input.amount,
        currency,
        status: "CREATED",
        idempotencyKey,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await prisma.terminalWithdrawalRequest.findUnique({ where: { idempotencyKey } });
      if (race) return mapWithdrawalRequest(race);
    }
    throw error;
  }

  await prisma.terminalWithdrawalRequest.update({
    where: { id: withdrawalRequest.id },
    data: { status: "PREPARING" },
  });

  const instruction = await submitInstruction({
    sendingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
    receivingInstitutionId: ALTA_BANK_INSTITUTION_ID,
    sendingRoutingNumberId: terminalRouting.routingNumberId,
    receivingRoutingNumberId: bankRouting.routingNumberId,
    amount: input.amount,
    currency,
    purpose: "Terminal withdrawal",
    idempotencyKey: `withdrawal:${withdrawalRequest.id}`,
    submittedByUserId: userId,
    sourceAccountNumber: terminalAccount.accountNumber,
    destinationAccountNumber: destinationAccount.accountNumber,
    metadata: {
      withdrawalRequestId: withdrawalRequest.id,
      channel: "terminal_withdrawal",
    },
  });

  const execution = await prisma.settlementExecution.findUnique({
    where: { settlementInstructionId: instruction.id },
  });
  const status = resolveRequestStatus(instruction.status, execution?.status);

  const updated = await prisma.terminalWithdrawalRequest.update({
    where: { id: withdrawalRequest.id },
    data: {
      settlementInstructionId: instruction.id,
      status,
      failureCode: instruction.failureCode,
      failureReason: instruction.failureReason,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  await writeWithdrawalAudit({
    actorUserId: userId,
    action: NCC_AUDIT.SETTLEMENT_INSTRUCTION_SUBMITTED,
    entityId: updated.id,
    description: `Terminal withdrawal request ${updated.id} for ${updated.amount} ${updated.currency} (${status})`,
    metadata: {
      settlementInstructionId: instruction.id,
      terminalCashAccountId: terminalAccount.id,
      destinationBankAccountId: destinationAccount.id,
      status,
    },
  });

  return mapWithdrawalRequest(updated);
}

export async function getTerminalWithdrawalRequest(
  userId: string,
  id: string,
): Promise<TerminalWithdrawalRequestView> {
  const row = await prisma.terminalWithdrawalRequest.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new NccWithdrawalError("NOT_FOUND", "NOT_FOUND");
  return mapWithdrawalRequest(row);
}

export async function listTerminalWithdrawalRequests(
  userId: string,
  limit = 25,
): Promise<TerminalWithdrawalRequestView[]> {
  const rows = await prisma.terminalWithdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  return rows.map(mapWithdrawalRequest);
}
