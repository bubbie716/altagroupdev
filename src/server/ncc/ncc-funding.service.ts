import { Prisma, type TerminalFundingRequest, type TerminalTransferRequestStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
  isCompanyOwnedBankAccount,
} from "@/lib/bank/account-ownership";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { asDecimal, decimalToNumber, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { findAccessibleBankAccount } from "@/server/bank-account-access.service";
import { getInstitutionPrimaryRouting } from "@/server/ncc/ncc-institution.service";
import { submitInstruction } from "@/server/ncc/ncc-settlement.service";
import {
  ensureUserTerminalCashAccount,
  getUserTerminalCashAccount,
} from "@/server/ncc/terminal-cash.service";

export class NccFundingError extends Error {
  constructor(
    message: string,
    readonly code: string = message,
  ) {
    super(message);
    this.name = "NccFundingError";
  }
}

/** Minimum / maximum customer website funding amounts (FLR). */
export const NCC_FUNDING_MIN_AMOUNT = 0.01;
export const NCC_FUNDING_MAX_AMOUNT = 1_000_000;

export type CustomerFundingStatusLabel =
  | "Preparing"
  | "Sent to NCC"
  | "Completed"
  | "Delayed—still processing"
  | "Needs review"
  | "Failed"
  | "Reversed";

export type TerminalFundingRequestView = {
  id: string;
  userId: string;
  sourceBankAccountId: string;
  terminalCashAccountId: string;
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

/** Sanitized customer-facing funding result for the Bank website. */
export type CustomerTerminalFundingView = {
  requestId: string;
  amount: string;
  currency: string;
  status: TerminalTransferRequestStatus;
  statusLabel: CustomerFundingStatusLabel;
  publicReference: string | null;
  sourceAccountLabel: string;
  sourceAccountNumber: string;
  sourceBankAccountId: string;
  destinationLabel: string;
  memo: string | null;
  failureMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  bankAvailableBalance: string | null;
  terminalAvailableBalance: string | null;
  isFinal: boolean;
  isProcessing: boolean;
};

function mapFundingRequest(row: TerminalFundingRequest): TerminalFundingRequestView {
  return {
    id: row.id,
    userId: row.userId,
    sourceBankAccountId: row.sourceBankAccountId,
    terminalCashAccountId: row.terminalCashAccountId,
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

export function customerFundingStatusLabel(
  status: TerminalTransferRequestStatus,
  executionStatus?: string | null,
): CustomerFundingStatusLabel {
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED" || status === "CANCELLED") return "Failed";
  if (status === "REVERSED") return "Reversed";
  if (executionStatus === "MANUAL_REVIEW") return "Needs review";
  if (executionStatus === "RETRY_PENDING" || status === "SOURCE_COMMITTED") {
    return "Delayed—still processing";
  }
  if (status === "NCC_POSTED") return "Sent to NCC";
  return "Preparing";
}

export function customerFundingErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "INVALID_AMOUNT":
      return "Enter a valid amount greater than zero with up to two decimal places.";
    case "AMOUNT_TOO_SMALL":
      return `The minimum transfer amount is ${NCC_FUNDING_MIN_AMOUNT.toFixed(2)} FLR.`;
    case "AMOUNT_TOO_LARGE":
      return `The maximum transfer amount is ${NCC_FUNDING_MAX_AMOUNT.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} FLR.`;
    case "UNSUPPORTED_CURRENCY":
      return "Only FLR transfers are supported.";
    case "SOURCE_ACCOUNT_NOT_ACCESSIBLE":
    case "FORBIDDEN":
      return "That Bank account is not available for this transfer.";
    case "SOURCE_ACCOUNT_INACTIVE":
      return "That Bank account is not active.";
    case "SOURCE_ACCOUNT_RESTRICTED":
      return "Withdrawals are restricted on that Bank account.";
    case "COMPANY_SOURCE_NOT_SUPPORTED":
      return "Business Bank accounts cannot fund a personal Alta Terminal account yet.";
    case "CURRENCY_MISMATCH":
      return "The selected account currency is not supported for this transfer.";
    case "INSUFFICIENT_FUNDS":
      return "Your available Bank balance is insufficient for this transfer.";
    case "NCC_ROUTING_NOT_CONFIGURED":
      return "NCC routing is temporarily unavailable. Try again shortly.";
    case "IDEMPOTENCY_CONFLICT":
      return "This transfer request conflicts with a previous submission. Start a new transfer.";
    case "IDEMPOTENCY_KEY_REQUIRED":
      return "Unable to submit the transfer. Refresh the page and try again.";
    case "NOT_FOUND":
      return "Transfer not found.";
    default:
      return "We couldn’t complete this transfer. Please try again or contact support.";
  }
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
  if (executionStatus === "FAILED") return "FAILED";
  if (
    executionStatus === "SOURCE_COMMITTED" ||
    executionStatus === "CREDITING_DESTINATION" ||
    executionStatus === "DESTINATION_CREDITED" ||
    executionStatus === "RETRY_PENDING" ||
    executionStatus === "MANUAL_REVIEW"
  ) {
    return "SOURCE_COMMITTED";
  }
  if (instructionStatus === "SETTLED") return "NCC_POSTED";
  return "PREPARING";
}

function parseFundingAmount(amount: number | string): { value: number; normalized: string } {
  const raw = typeof amount === "number" ? amount.toFixed(2) : String(amount).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new NccFundingError("INVALID_AMOUNT", "INVALID_AMOUNT");
  }
  const decimal = asDecimal(raw);
  if (decimal.lte(0) || !decimal.isFinite()) {
    throw new NccFundingError("INVALID_AMOUNT", "INVALID_AMOUNT");
  }
  if (decimal.lt(NCC_FUNDING_MIN_AMOUNT)) {
    throw new NccFundingError("AMOUNT_TOO_SMALL", "AMOUNT_TOO_SMALL");
  }
  if (decimal.gt(NCC_FUNDING_MAX_AMOUNT)) {
    throw new NccFundingError("AMOUNT_TOO_LARGE", "AMOUNT_TOO_LARGE");
  }
  return { value: Number(decimal.toFixed(2)), normalized: decimal.toFixed(2) };
}

async function writeFundingAudit(input: {
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
    entityType: "TERMINAL_FUNDING_REQUEST",
    entityId: input.entityId,
    description: input.description,
    institutionId: ALTA_TERMINAL_INSTITUTION_ID,
    metadata: input.metadata,
  });
}

async function toCustomerView(
  row: TerminalFundingRequest,
  options?: { includeBalances?: boolean },
): Promise<CustomerTerminalFundingView> {
  const [bankAccount, instruction, execution] = await Promise.all([
    prisma.bankAccount.findUnique({
      where: { id: row.sourceBankAccountId },
      select: {
        id: true,
        accountName: true,
        accountNumber: true,
        balance: true,
        currency: true,
      },
    }),
    row.settlementInstructionId
      ? prisma.settlementInstruction.findUnique({
          where: { id: row.settlementInstructionId },
          select: { publicReference: true, purpose: true },
        })
      : Promise.resolve(null),
    row.settlementInstructionId
      ? prisma.settlementExecution.findUnique({
          where: { settlementInstructionId: row.settlementInstructionId },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);

  let bankAvailableBalance: string | null = null;
  let terminalAvailableBalance: string | null = null;
  if (options?.includeBalances) {
    if (bankAccount) {
      const holds = await prisma.bankAccountHold.aggregate({
        where: { bankAccountId: bankAccount.id, status: "ACTIVE" },
        _sum: { amount: true },
      });
      const held = asDecimal(holds._sum.amount ?? 0);
      bankAvailableBalance = asDecimal(bankAccount.balance).sub(held).toFixed(2);
    }
    const terminal = await getUserTerminalCashAccount(row.userId, row.currency);
    if (terminal) {
      terminalAvailableBalance = asDecimal(terminal.availableBalance).toFixed(2);
    }
  }

  const statusLabel = customerFundingStatusLabel(row.status, execution?.status);
  const isFinal =
    row.status === "COMPLETED" ||
    row.status === "FAILED" ||
    row.status === "CANCELLED" ||
    row.status === "REVERSED";

  return {
    requestId: row.id,
    amount: asDecimal(row.amount).toFixed(2),
    currency: row.currency,
    status: row.status,
    statusLabel,
    publicReference: instruction?.publicReference ?? null,
    sourceAccountLabel: bankAccount?.accountName ?? "Alta Bank account",
    sourceAccountNumber: bankAccount?.accountNumber ?? "—",
    sourceBankAccountId: row.sourceBankAccountId,
    destinationLabel: "My Alta Terminal account",
    memo: instruction?.purpose && instruction.purpose !== "Terminal funding" ? instruction.purpose : null,
    failureMessage:
      row.status === "FAILED" || row.status === "CANCELLED"
        ? customerFundingErrorMessage(row.failureCode) || row.failureReason
        : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    bankAvailableBalance,
    terminalAvailableBalance,
    isFinal,
    isProcessing: !isFinal,
  };
}

/**
 * Bank → Terminal funding: moves funds from a customer's personal Alta Bank account
 * into their personal Alta Terminal trading-cash account via NCC.
 * Idempotent on `idempotencyKey` with payload conflict detection.
 */
export async function submitTerminalFundingRequest(
  userId: string,
  input: {
    sourceBankAccountId: string;
    amount: number | string;
    currency?: string;
    idempotencyKey: string;
    memo?: string;
  },
): Promise<TerminalFundingRequestView> {
  const { value: amount, normalized: amountNormalized } = parseFundingAmount(input.amount);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new NccFundingError("IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REQUIRED");
  if (idempotencyKey.length > 128) {
    throw new NccFundingError("IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REQUIRED");
  }
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  if (currency !== NCC_DEFAULT_CURRENCY) {
    throw new NccFundingError("UNSUPPORTED_CURRENCY", "UNSUPPORTED_CURRENCY");
  }
  const memo = input.memo?.trim() ? input.memo.trim().slice(0, 256) : undefined;

  const existing = await prisma.terminalFundingRequest.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.userId !== userId) throw new NccFundingError("FORBIDDEN", "FORBIDDEN");
    const samePayload =
      existing.sourceBankAccountId === input.sourceBankAccountId &&
      asDecimal(existing.amount).eq(amountNormalized) &&
      existing.currency === currency;
    if (!samePayload) {
      throw new NccFundingError("IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT");
    }
    return mapFundingRequest(existing);
  }

  const sourceAccount = await findAccessibleBankAccount(userId, input.sourceBankAccountId, "manage");
  if (!sourceAccount) throw new NccFundingError("SOURCE_ACCOUNT_NOT_ACCESSIBLE", "SOURCE_ACCOUNT_NOT_ACCESSIBLE");
  if (isCompanyOwnedBankAccount(sourceAccount) || sourceAccount.companyId) {
    throw new NccFundingError("COMPANY_SOURCE_NOT_SUPPORTED", "COMPANY_SOURCE_NOT_SUPPORTED");
  }
  if (sourceAccount.userId !== userId) {
    throw new NccFundingError("SOURCE_ACCOUNT_NOT_ACCESSIBLE", "SOURCE_ACCOUNT_NOT_ACCESSIBLE");
  }
  if (sourceAccount.status !== "ACTIVE") {
    throw new NccFundingError("SOURCE_ACCOUNT_INACTIVE", "SOURCE_ACCOUNT_INACTIVE");
  }
  if (sourceAccount.restrictWithdrawals) {
    throw new NccFundingError("SOURCE_ACCOUNT_RESTRICTED", "SOURCE_ACCOUNT_RESTRICTED");
  }
  if (sourceAccount.currency !== currency) {
    throw new NccFundingError("CURRENCY_MISMATCH", "CURRENCY_MISMATCH");
  }

  const terminalAccount = await ensureUserTerminalCashAccount(userId, currency);

  const [bankRouting, terminalRouting] = await Promise.all([
    getInstitutionPrimaryRouting(ALTA_BANK_INSTITUTION_ID),
    getInstitutionPrimaryRouting(ALTA_TERMINAL_INSTITUTION_ID),
  ]);
  if (!bankRouting || !terminalRouting) {
    throw new NccFundingError("NCC_ROUTING_NOT_CONFIGURED", "NCC_ROUTING_NOT_CONFIGURED");
  }

  let fundingRequest: TerminalFundingRequest;
  try {
    fundingRequest = await prisma.terminalFundingRequest.create({
      data: {
        userId,
        sourceBankAccountId: sourceAccount.id,
        terminalCashAccountId: terminalAccount.id,
        amount,
        currency,
        status: "CREATED",
        idempotencyKey,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await prisma.terminalFundingRequest.findUnique({ where: { idempotencyKey } });
      if (race) {
        if (race.userId !== userId) throw new NccFundingError("FORBIDDEN", "FORBIDDEN");
        const samePayload =
          race.sourceBankAccountId === input.sourceBankAccountId &&
          asDecimal(race.amount).eq(amountNormalized) &&
          race.currency === currency;
        if (!samePayload) throw new NccFundingError("IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT");
        return mapFundingRequest(race);
      }
    }
    throw error;
  }

  await prisma.terminalFundingRequest.update({
    where: { id: fundingRequest.id },
    data: { status: "PREPARING" },
  });

  try {
    const instruction = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.routingNumberId,
      receivingRoutingNumberId: terminalRouting.routingNumberId,
      amount,
      currency,
      purpose: memo || "Terminal funding",
      idempotencyKey: `funding:${fundingRequest.id}`,
      submittedByUserId: userId,
      sourceAccountNumber: sourceAccount.accountNumber,
      destinationAccountNumber: terminalAccount.accountNumber,
      metadata: {
        fundingRequestId: fundingRequest.id,
        channel: "bank_website",
      },
    });

    const execution = await prisma.settlementExecution.findUnique({
      where: { settlementInstructionId: instruction.id },
    });
    const status = resolveRequestStatus(instruction.status, execution?.status);

    const failureCode =
      instruction.failureCode || execution?.failureCode || null;
    const failureReason =
      instruction.failureReason || execution?.failureReason || null;

    const updated = await prisma.terminalFundingRequest.update({
      where: { id: fundingRequest.id },
      data: {
        settlementInstructionId: instruction.id,
        status,
        failureCode,
        failureReason,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    await writeFundingAudit({
      actorUserId: userId,
      action: NCC_AUDIT.SETTLEMENT_INSTRUCTION_SUBMITTED,
      entityId: updated.id,
      description: `Terminal funding request ${updated.id} for ${updated.amount} ${updated.currency} (${status})`,
      metadata: {
        settlementInstructionId: instruction.id,
        sourceBankAccountId: sourceAccount.id,
        terminalCashAccountId: terminalAccount.id,
        status,
      },
    });

    // Settlement may return a failed instruction without throwing (e.g. adapter NSF).
    // Surface a typed error so website callers never treat failure as success.
    if (status === "FAILED" || status === "CANCELLED") {
      const failCode = failureCode || "FUNDING_FAILED";
      throw new NccFundingError(failCode, failCode);
    }

    return mapFundingRequest(updated);
  } catch (error) {
    if (error instanceof NccFundingError) throw error;
    const code =
      error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : "FUNDING_FAILED";
    const mappedCode = code === "INSUFFICIENT_FUNDS" ? "INSUFFICIENT_FUNDS" : code;
    await prisma.terminalFundingRequest.update({
      where: { id: fundingRequest.id },
      data: {
        status: "FAILED",
        failureCode: mappedCode,
        failureReason: error instanceof Error ? error.message : String(error),
      },
    });
    throw new NccFundingError(mappedCode, mappedCode);
  }
}

/** Customer website submit — returns sanitized view with balances on completion. */
export async function submitCustomerTerminalFunding(
  userId: string,
  input: {
    sourceBankAccountId: string;
    amount: number | string;
    currency?: string;
    idempotencyKey: string;
    memo?: string;
  },
): Promise<CustomerTerminalFundingView> {
  const result = await submitTerminalFundingRequest(userId, input);
  const row = await prisma.terminalFundingRequest.findUniqueOrThrow({ where: { id: result.id } });
  return toCustomerView(row, { includeBalances: true });
}

export async function getTerminalFundingRequest(
  userId: string,
  id: string,
): Promise<TerminalFundingRequestView> {
  const row = await prisma.terminalFundingRequest.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new NccFundingError("NOT_FOUND", "NOT_FOUND");
  return mapFundingRequest(row);
}

export async function getCustomerTerminalFundingRequest(
  userId: string,
  id: string,
): Promise<CustomerTerminalFundingView> {
  const row = await prisma.terminalFundingRequest.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new NccFundingError("NOT_FOUND", "NOT_FOUND");
  return toCustomerView(row, { includeBalances: true });
}

export async function listTerminalFundingRequests(
  userId: string,
  limit = 25,
): Promise<TerminalFundingRequestView[]> {
  const rows = await prisma.terminalFundingRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  return rows.map(mapFundingRequest);
}

export async function listCustomerTerminalFundingHistory(
  userId: string,
  limit = 20,
): Promise<CustomerTerminalFundingView[]> {
  const rows = await prisma.terminalFundingRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  return Promise.all(rows.map((row) => toCustomerView(row)));
}

/** Personal ACTIVE Bank accounts eligible as website funding sources. */
export async function listPersonalFundingSourceAccounts(userId: string) {
  const { listActiveDepositAccounts } = await import("@/server/bank.service");
  const accounts = await listActiveDepositAccounts(userId);
  return accounts.filter(
    (account) =>
      !account.isCompanyAccount &&
      !account.companyId &&
      account.currency === NCC_DEFAULT_CURRENCY &&
      account.status === "active" &&
      !account.restrictWithdrawals,
  );
}

export async function getCustomerTerminalCashSnapshot(userId: string, currency = NCC_DEFAULT_CURRENCY) {
  const account = await ensureUserTerminalCashAccount(userId, currency);
  const { maskPaymentAccountNumber } = await import("@/lib/ncc/ncc-account-number");
  return {
    currency: account.currency,
    accountNumber: account.accountNumber,
    accountNumberMasked: maskPaymentAccountNumber(account.accountNumber),
    availableBalance: asDecimal(account.availableBalance).toFixed(2),
    ledgerBalance: asDecimal(account.ledgerBalance).toFixed(2),
  };
}
