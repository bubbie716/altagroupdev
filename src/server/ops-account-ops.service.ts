import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import { isAdmin } from "@/lib/auth/permissions";
import type { OperatorNotificationOptions } from "@/lib/internal/operator-notification-options";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { submitOperatorInternalTransfer, normalizeAccountNumber } from "@/server/bank.service";
import { formatFlorin } from "@/lib/bank/format";
import { reversalAdjustmentDescription } from "@/lib/bank/customer-transaction-copy";
import {
  adjustmentReversalNote,
  isAdjustmentReversalNote,
} from "@/lib/bank/adjustment-reversal";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function badRequest(msg: string): never {
  throw new Error(`BAD_REQUEST:${msg}`);
}

function notFound(): never {
  throw new Error("NOT_FOUND");
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
    silentNotification?: boolean;
  },
): Promise<{ referenceCode: string }> {
  await requireOperator();
  const trimmed = input.reason.trim();
  if (!trimmed) badRequest("Reason is required");

  const fromAccount = await prisma.bankAccount.findUnique({ where: { id: input.fromAccountId } });
  if (!fromAccount) notFound();

  const toAccountNumber = normalizeAccountNumber(input.toAccountNumber);
  const toAccount = await prisma.bankAccount.findUnique({ where: { accountNumber: toAccountNumber } });

  let result: { referenceCode: string };
  try {
    result = await submitOperatorInternalTransfer({
      fromAccountId: input.fromAccountId,
      toAccountNumber: input.toAccountNumber,
      amount: input.amount,
      memo: `${input.memo.trim() || "Operator transfer"} · ${trimmed}`,
    });
  } catch (error) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId,
      actionAttempted: "ADMIN_MANUAL_TRANSFER",
      failureReason: error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Transfer failed",
      entityType: "BANK_ACCOUNT",
      entityId: input.fromAccountId,
      targetAccountId: input.fromAccountId,
      amount: input.amount,
      source: "INTERNAL",
      internalLink: `/internal/bank/accounts/${input.fromAccountId}`,
    });
    throw error;
  }

  const notificationOptions = { silentNotification: input.silentNotification };
  const { deliverOperatorCustomerNotification, notifyBankAccountCustomersBestEffort } = await import(
    "@/server/customer-operator-notification.service"
  );

  const { auditMetadata: sourceAudit } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions,
    deliver: async () =>
      notifyBankAccountCustomersBestEffort({
        account: {
          id: fromAccount.id,
          accountNumber: fromAccount.accountNumber,
          userId: fromAccount.userId,
          companyId: fromAccount.companyId,
        },
        kind: "manual_debit",
        amount: input.amount,
        customerFacingReason: "Funds were transferred from your account by Alta Bank.",
        source: "admin_manual_transfer",
        actorUserId,
        silentNotification: input.silentNotification,
      }),
  });

  if (toAccount) {
    await deliverOperatorCustomerNotification({
      actorUserId,
      notificationOptions,
      deliver: async () =>
        notifyBankAccountCustomersBestEffort({
          account: {
            id: toAccount.id,
            accountNumber: toAccount.accountNumber,
            userId: toAccount.userId,
            companyId: toAccount.companyId,
          },
          kind: "manual_credit",
          amount: input.amount,
          customerFacingReason: "Funds were deposited to your account by Alta Bank.",
          source: "admin_manual_transfer",
          actorUserId,
          silentNotification: input.silentNotification,
        }),
    });
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "ADMIN_MANUAL_TRANSFER",
    entityType: "BANK_ACCOUNT",
    entityId: input.fromAccountId,
    targetAccountId: input.fromAccountId,
    description: `Manual transfer ${result.referenceCode}`,
    metadata: { ...input, reason: trimmed, source: "website", ...sourceAudit },
  });

  const { sendStaffAuditMessage } = await import("@/server/staff-audit-notification.service");
  sendStaffAuditMessage({
    product: "Banking",
    action: "Manual operator transfer",
    actorUserId,
    details: `${formatFlorin(input.amount)} · ${fromAccount.accountNumber} → ${toAccountNumber}`,
    internalUrl: `/internal/bank/accounts/${input.fromAccountId}`,
    severity: "INFO",
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

  const { isSilentNotificationForbidden, silentNotificationForbiddenMessage } = await import(
    "@/lib/internal/silent-notification-restrictions"
  );
  if (isSilentNotificationForbidden({ kind: "payment_reversed", action: "payment_reversal" }, notificationOptions)) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId,
      actionAttempted: "SILENT_NOTIFICATION",
      auditAction: "OPS_SILENT_NOTIFICATION_REJECTED",
      failureReason: silentNotificationForbiddenMessage({ kind: "payment_reversed", action: "payment_reversal" }),
      entityType: "BANK_TRANSACTION",
      entityId: transactionId,
      source: "INTERNAL",
    });
    badRequest(silentNotificationForbiddenMessage({ kind: "payment_reversed", action: "payment_reversal" }));
  }

  const original = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: true },
  });
  if (!original || original.type !== "ADJUSTMENT" || original.status !== "APPROVED") {
    badRequest("Only approved adjustments can be reversed");
  }
  if (isAdjustmentReversalNote(original.reviewNote)) {
    badRequest("Cannot reverse a reversal adjustment.");
  }

  const existingReversal = await prisma.bankTransaction.findFirst({
    where: {
      bankAccountId: original.bankAccountId,
      type: "ADJUSTMENT",
      status: "APPROVED",
      reviewNote: { contains: adjustmentReversalNote(original.referenceCode) },
    },
  });
  if (existingReversal) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId,
      actionAttempted: "ADJUSTMENT_REVERSAL",
      auditAction: "OPS_ACTION_FAILED",
      failureReason: "Adjustment already reversed",
      entityType: "BANK_TRANSACTION",
      entityId: transactionId,
      targetTransactionId: transactionId,
      targetAccountId: original.bankAccountId,
      source: "INTERNAL",
      internalLink: `/internal/bank/transactions/${transactionId}`,
    });
    badRequest(`This adjustment was already reversed (${existingReversal.referenceCode}).`);
  }

  const amount = decimalToNumber(original.amount);
  const direction = /debit adjustment|admin debit/i.test(original.description) ? "credit" : "debit";
  const linkNote = adjustmentReversalNote(original.referenceCode);

  const { adminAdjustBankAccount } = await import("@/server/bank.service");
  let result: { transactionId: string; referenceCode: string };
  try {
    result = await adminAdjustBankAccount(actorUserId, {
      accountId: original.bankAccountId,
      direction: direction as "credit" | "debit",
      amount,
      reason: `${trimmed} (${linkNote})`,
      customerDescription: reversalAdjustmentDescription(original.description),
      allowOverdraft: isAdmin(actor),
      silentNotification: notificationOptions?.silentNotification,
    });
  } catch (error) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId,
      actionAttempted: "ADJUSTMENT_REVERSAL",
      failureReason: error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Reversal failed",
      entityType: "BANK_TRANSACTION",
      entityId: transactionId,
      targetTransactionId: transactionId,
      targetAccountId: original.bankAccountId,
      amount,
      source: "INTERNAL",
      internalLink: `/internal/bank/transactions/${transactionId}`,
    });
    throw error;
  }

  const { buildOperatorNotificationAuditMetadata } = await import(
    "@/lib/internal/operator-notification-options"
  );
  const auditMetadata = buildOperatorNotificationAuditMetadata(
    actorUserId,
    notificationOptions,
    !notificationOptions?.silentNotification,
  );

  await prisma.$transaction(async (tx) => {
    const { recordAdjustmentReversalGroupInTx } = await import("@/server/payment-entity.service");
    await recordAdjustmentReversalGroupInTx(tx, {
      referenceCode: result.referenceCode,
      originalTransactionId: transactionId,
      originalReferenceCode: original.referenceCode,
      reversalTransactionId: result.transactionId,
      reversalReferenceCode: result.referenceCode,
      reversedByUserId: actorUserId,
      reason: trimmed,
    });
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { buildLinkedReversalMetadata } = await import("@/lib/internal/transaction-reversal-link");
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
      originalTransactionId: transactionId,
      reversalReference: result.referenceCode,
      reason: trimmed,
      reversesAdjustment: original.referenceCode,
      source: "website",
      ...buildLinkedReversalMetadata({
        originalTransactionId: transactionId,
        originalReferenceCode: original.referenceCode,
        reversalTransactionId: result.transactionId,
        reversalReferenceCode: result.referenceCode,
        reversalReason: trimmed,
        reversedByUserId: actorUserId,
        reversalKind: "adjustment",
      }),
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
