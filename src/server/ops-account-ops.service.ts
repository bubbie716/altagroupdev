import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isAdmin } from "@/lib/auth/permissions";
import type { OperatorNotificationOptions } from "@/lib/internal/operator-notification-options";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { submitOperatorInternalTransfer } from "@/server/bank.service";
import { reversalAdjustmentDescription } from "@/lib/bank/customer-transaction-copy";

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
  notificationOptions?: OperatorNotificationOptions,
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

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions,
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: "account_reopened",
        source: "reopen_account",
        silentNotification: notificationOptions?.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BANK_ACCOUNT_REOPENED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    targetUserId: account.userId,
    description: `Reopened account ${account.accountNumber}`,
    metadata: { reason: trimmed, source: "website", ...auditMetadata },
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
    silentNotification?: boolean;
  },
): Promise<void> {
  await requireOperator();
  const trimmed = input.reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("NOT_FOUND");

  const before = {
    restrictDeposits: account.restrictDeposits,
    restrictWithdrawals: account.restrictWithdrawals,
    restrictTransfers: account.restrictTransfers,
  };
  const after = {
    restrictDeposits: input.restrictDeposits ?? account.restrictDeposits,
    restrictWithdrawals: input.restrictWithdrawals ?? account.restrictWithdrawals,
    restrictTransfers: input.restrictTransfers ?? account.restrictTransfers,
  };

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: after,
  });

  const { detectRestrictionNotificationKinds } = await import(
    "@/lib/bank/account-restriction-notification"
  );
  const { operatorNotificationAuditAction } = await import(
    "@/lib/bank/customer-operator-notification-copy"
  );
  const notificationKinds = detectRestrictionNotificationKinds(before, after);
  const notificationOptions: OperatorNotificationOptions = {
    silentNotification: input.silentNotification,
  };

  let customerNotificationSent = false;
  if (notificationKinds.length > 0) {
    const { deliverOperatorCustomerNotification } = await import(
      "@/server/customer-operator-notification.service"
    );
    const result = await deliverOperatorCustomerNotification({
      actorUserId,
      notificationOptions,
      deliver: async () => {
        const { notifyBankAccountCustomersBestEffort } = await import(
          "@/server/customer-operator-notification.service"
        );
        let sent = false;
        for (const kind of notificationKinds) {
          const ok = await notifyBankAccountCustomersBestEffort({
            account: {
              id: account.id,
              accountNumber: account.accountNumber,
              userId: account.userId,
              companyId: account.companyId,
            },
            kind,
            source: "set_account_restrictions",
            silentNotification: input.silentNotification,
          });
          sent = sent || ok;
        }
        return sent;
      },
    });
    customerNotificationSent = result.customerNotificationSent;
  }

  const { buildOperatorNotificationAuditMetadata } = await import(
    "@/lib/internal/operator-notification-options"
  );
  const auditMetadata =
    notificationKinds.length > 0
      ? buildOperatorNotificationAuditMetadata(
          actorUserId,
          notificationOptions,
          customerNotificationSent,
        )
      : buildOperatorNotificationAuditMetadata(actorUserId, notificationOptions, false);

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action:
      notificationKinds.length > 0
        ? operatorNotificationAuditAction(notificationKinds[0]!)
        : "ACCOUNT_RESTRICTIONS_UPDATED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    targetUserId: account.userId,
    description: `Updated account restrictions for ${account.accountNumber}`,
    metadata: {
      reason: trimmed,
      before,
      after,
      notificationKinds,
      source: "website",
      ...auditMetadata,
    },
  });
}

export async function applyAccountHold(
  actorUserId: string,
  accountId: string,
  amount: number,
  reason: string,
  notificationOptions?: OperatorNotificationOptions,
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

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions,
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          userId: account.userId,
          companyId: account.companyId,
        },
        kind: "account_hold_placed",
        amount,
        source: "apply_account_hold",
        silentNotification: notificationOptions?.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BANK_ACCOUNT_HOLD_PLACED",
    entityType: "BANK_ACCOUNT",
    entityId: accountId,
    targetAccountId: accountId,
    targetUserId: account.userId,
    description: `Hold of ${amount} on ${account.accountNumber}`,
    metadata: { holdId: hold.id, amount, reason: trimmed, source: "website", ...auditMetadata },
  });

  return { holdId: hold.id };
}

export async function releaseAccountHold(
  actorUserId: string,
  holdId: string,
  reason: string,
  notificationOptions?: OperatorNotificationOptions,
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

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions,
    deliver: async () =>
      (
        await import("@/server/customer-operator-notification.service")
      ).notifyBankAccountCustomersBestEffort({
        account: {
          id: hold.bankAccount.id,
          accountNumber: hold.bankAccount.accountNumber,
          userId: hold.bankAccount.userId,
          companyId: hold.bankAccount.companyId,
        },
        kind: "account_hold_released",
        amount: decimalToNumber(hold.amount),
        source: "release_account_hold",
        silentNotification: notificationOptions?.silentNotification,
      }),
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BANK_ACCOUNT_HOLD_RELEASED",
    entityType: "BANK_ACCOUNT",
    entityId: hold.bankAccountId,
    targetAccountId: hold.bankAccountId,
    targetUserId: hold.bankAccount.userId,
    description: `Released hold on ${hold.bankAccount.accountNumber}`,
    metadata: {
      holdId,
      reason: trimmed,
      amount: decimalToNumber(hold.amount),
      source: "website",
      ...auditMetadata,
    },
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
  notificationOptions?: OperatorNotificationOptions,
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
  const direction = /debit adjustment|admin debit/i.test(original.description) ? "credit" : "debit";

  const { adminAdjustBankAccount } = await import("@/server/bank.service");
  const result = await adminAdjustBankAccount(actorUserId, {
    accountId: original.bankAccountId,
    direction: direction as "credit" | "debit",
    amount,
    reason: trimmed,
    customerDescription: reversalAdjustmentDescription(original.description),
    allowOverdraft: isAdmin(actor),
    silentNotification: notificationOptions?.silentNotification,
  });

  const { buildOperatorNotificationAuditMetadata } = await import(
    "@/lib/internal/operator-notification-options"
  );
  const auditMetadata = buildOperatorNotificationAuditMetadata(
    actorUserId,
    notificationOptions,
    !notificationOptions?.silentNotification,
  );

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BANK_REVERSAL_POSTED",
    entityType: "BANK_TRANSACTION",
    entityId: transactionId,
    targetTransactionId: transactionId,
    targetAccountId: original.bankAccountId,
    targetUserId: original.bankAccount.userId,
    description: `Reversed adjustment ${original.referenceCode}`,
    metadata: {
      originalReference: original.referenceCode,
      reversalReference: result.referenceCode,
      reason: trimmed,
      source: "website",
      ...auditMetadata,
    },
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
