import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isAdmin } from "@/lib/auth/permissions";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { submitOperatorInternalTransfer } from "@/server/bank.service";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function badRequest(msg: string): never {
  throw new Error(`BAD_REQUEST:${msg}`);
}

export async function reopenBankAccount(
  actorUserId: string,
  accountId: string,
  reason: string,
): Promise<void> {
  await requireOperator();
  const trimmed = reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("NOT_FOUND");
  if (account.status !== "CLOSED") badRequest("Only closed accounts can be reopened");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: { status: "ACTIVE" },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ACCOUNT_REOPENED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    targetUserId: account.userId,
    description: `Reopened account ${account.accountNumber}`,
    metadata: { reason: trimmed },
  });
}

export async function setAccountRestrictions(
  actorUserId: string,
  accountId: string,
  input: {
    restrictDeposits?: boolean;
    restrictWithdrawals?: boolean;
    restrictTransfers?: boolean;
    reason: string;
  },
): Promise<void> {
  await requireOperator();
  const trimmed = input.reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("NOT_FOUND");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      restrictDeposits: input.restrictDeposits ?? account.restrictDeposits,
      restrictWithdrawals: input.restrictWithdrawals ?? account.restrictWithdrawals,
      restrictTransfers: input.restrictTransfers ?? account.restrictTransfers,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ACCOUNT_RESTRICTIONS_UPDATED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    description: `Updated account restrictions for ${account.accountNumber}`,
    metadata: {
      reason: trimmed,
      restrictDeposits: input.restrictDeposits,
      restrictWithdrawals: input.restrictWithdrawals,
      restrictTransfers: input.restrictTransfers,
    },
  });
}

export async function applyAccountHold(
  actorUserId: string,
  accountId: string,
  amount: number,
  reason: string,
): Promise<{ holdId: string }> {
  await requireOperator();
  if (amount <= 0) badRequest("Hold amount must be greater than zero");
  const trimmed = reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.status !== "ACTIVE") badRequest("Account must be active");

  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  const available = await getAccountAvailableBalance(accountId);
  if (amount > available) badRequest("Hold amount exceeds available balance");

  const hold = await prisma.bankAccountHold.create({
    data: {
      bankAccountId: accountId,
      amount,
      reason: trimmed,
      createdById: actorUserId,
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ACCOUNT_HOLD_APPLIED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    description: `Hold of ${amount} on ${account.accountNumber}`,
    metadata: { holdId: hold.id, amount, reason: trimmed },
  });

  return { holdId: hold.id };
}

export async function releaseAccountHold(
  actorUserId: string,
  holdId: string,
  reason: string,
): Promise<void> {
  await requireOperator();
  const trimmed = reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const hold = await prisma.bankAccountHold.findUnique({
    where: { id: holdId },
    include: { bankAccount: true },
  });
  if (!hold || hold.status !== "ACTIVE") badRequest("Hold not found or already released");

  await prisma.bankAccountHold.update({
    where: { id: holdId },
    data: { status: "RELEASED", releasedById: actorUserId, releasedAt: new Date() },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ACCOUNT_HOLD_RELEASED",
    entityType: "BANK_ACCOUNT",
    entityId: hold.bankAccountId,
    targetAccountId: hold.bankAccountId,
    description: `Released hold on ${hold.bankAccount.accountNumber}`,
    metadata: { holdId, reason: trimmed },
  });
}

export async function listAccountHolds(accountId: string) {
  await requireOperator();
  return prisma.bankAccountHold.findMany({
    where: { bankAccountId: accountId },
    include: { createdBy: true, releasedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function adminManualTransfer(
  actorUserId: string,
  input: {
    fromAccountId: string;
    toAccountNumber: string;
    amount: number;
    memo: string;
    reason: string;
  },
): Promise<{ referenceCode: string }> {
  await requireOperator();
  const trimmed = input.reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const result = await submitOperatorInternalTransfer({
    fromAccountId: input.fromAccountId,
    toAccountNumber: input.toAccountNumber,
    amount: input.amount,
    memo: `${input.memo.trim() || "Operator transfer"} · ${trimmed}`,
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ADMIN_MANUAL_TRANSFER",
    entityType: "BANK_ACCOUNT",
    entityId: input.fromAccountId,
    targetAccountId: input.fromAccountId,
    description: `Manual transfer ${result.referenceCode}`,
    metadata: { ...input, reason: trimmed },
  });

  return result;
}

export async function reverseAdjustment(
  actorUserId: string,
  transactionId: string,
  reason: string,
): Promise<{ referenceCode: string }> {
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!actorRecord) throw new Error("FORBIDDEN");
  const actor = mapDbUserToAltaUser(actorRecord);
  await requireOperator();

  const trimmed = reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const original = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: true },
  });
  if (!original || original.type !== "ADJUSTMENT" || original.status !== "APPROVED") {
    badRequest("Only approved adjustments can be reversed");
  }

  const amount = decimalToNumber(original.amount);
  const direction = original.description.toLowerCase().includes("debit") ? "credit" : "debit";

  const { adminAdjustBankAccount } = await import("@/server/bank.service");
  const result = await adminAdjustBankAccount(actorUserId, {
    accountId: original.bankAccountId,
    direction: direction as "credit" | "debit",
    amount,
    reason: `Reversal of ${original.referenceCode}: ${trimmed}`,
    allowOverdraft: isAdmin(actor),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ADJUSTMENT_REVERSED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetTransactionId: transactionId,
    targetAccountId: original.bankAccountId,
    description: `Reversed adjustment ${original.referenceCode}`,
    metadata: { originalReference: original.referenceCode, reversalReference: result.referenceCode, reason: trimmed },
  });

  return { referenceCode: result.referenceCode };
}

export async function getAccountOpsSummary(accountId: string) {
  await requireOperator();
  const [account, holds, scheduled, statements] = await Promise.all([
    prisma.bankAccount.findUnique({
      where: { id: accountId },
      select: {
        restrictDeposits: true,
        restrictWithdrawals: true,
        restrictTransfers: true,
      },
    }),
    listAccountHolds(accountId),
    prisma.scheduledPayment.findMany({
      where: { bankAccountId: accountId },
      orderBy: { nextRunDate: "asc" },
      take: 20,
      select: {
        id: true,
        label: true,
        amount: true,
        nextRunDate: true,
        status: true,
      },
    }),
    prisma.bankStatement.findMany({
      where: { bankAccountId: accountId },
      orderBy: { periodEnd: "desc" },
      take: 10,
      select: {
        id: true,
        statementNumber: true,
        periodEnd: true,
        status: true,
      },
    }),
  ]);
  if (!account) throw new Error("NOT_FOUND");

  const activeHoldTotal = holds
    .filter((h) => h.status === "ACTIVE")
    .reduce((sum, h) => sum + decimalToNumber(h.amount), 0);

  return {
    holds: holds.map((h) => ({
      id: h.id,
      amount: decimalToNumber(h.amount),
      reason: h.reason,
      status: h.status,
      createdAt: h.createdAt.toISOString(),
    })),
    activeHoldTotal,
    scheduled: scheduled.map((s) => ({
      id: s.id,
      label: s.label,
      amount: decimalToNumber(s.amount),
      nextRunDate: s.nextRunDate?.toISOString() ?? null,
      status: s.status,
    })),
    statements: statements.map((s) => ({
      id: s.id,
      statementNumber: s.statementNumber,
      periodEnd: s.periodEnd.toISOString(),
      status: s.status,
    })),
    restrictions: {
      restrictDeposits: account.restrictDeposits,
      restrictWithdrawals: account.restrictWithdrawals,
      restrictTransfers: account.restrictTransfers,
    },
  };
}
