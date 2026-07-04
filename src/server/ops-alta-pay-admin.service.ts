import type { AltaPayAdminRow, PaginatedResult } from "@/lib/internal/ops-types";
import { altaPayReversalDescription } from "@/lib/bank/customer-transaction-copy";
import { altaPayReversalMarker } from "@/lib/bank/alta-pay-reversal";
import { requireOperator } from "@/server/permissions.service";
import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export type AltaPaySearchFilters = {
  q?: string;
  companyId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

function mapAltaPayPair(
  outTx: Prisma.BankTransactionGetPayload<{
    include: { bankAccount: { include: { user: true; company: true } } };
  }>,
  inTx: Prisma.BankTransactionGetPayload<{
    include: { bankAccount: { include: { user: true; company: true } } };
  }> | null,
): AltaPayAdminRow {
  const ref = outTx.referenceCode.replace(/-OUT$/, "");
  return {
    referenceCode: ref,
    amount: decimalToNumber(outTx.amount),
    payerLabel: outTx.bankAccount.company?.name ?? outTx.bankAccount.user.discordUsername,
    payerAccountNumber: outTx.bankAccount.accountNumber,
    merchantName: inTx?.bankAccount.company?.name ?? inTx?.bankAccount.accountName ?? "—",
    merchantAccountNumber: inTx?.bankAccount.accountNumber ?? "—",
    status: outTx.status,
    memo: outTx.memo,
    createdAt: outTx.createdAt.toISOString(),
    outTransactionId: outTx.id,
    inTransactionId: inTx?.id ?? "",
  };
}

export async function searchAltaPayPayments(
  filters: AltaPaySearchFilters = {},
): Promise<PaginatedResult<AltaPayAdminRow>> {
  await requireOperator();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  const and: Prisma.BankTransactionWhereInput[] = [
    { referenceCode: { endsWith: "-OUT" } },
    { description: { contains: "Alta Pay", mode: "insensitive" } },
  ];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { referenceCode: { contains: q, mode: "insensitive" } },
        { memo: { contains: q, mode: "insensitive" } },
        { bankAccount: { accountNumber: { contains: q, mode: "insensitive" } } },
        { bankAccount: { company: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.companyId) {
    and.push({
      OR: [
        { bankAccount: { companyId: filters.companyId } },
        {
          referenceCode: { contains: "" },
          bankAccount: { companyId: filters.companyId },
        },
      ],
    });
  }
  if (filters.from) and.push({ createdAt: { gte: new Date(filters.from) } });
  if (filters.to) and.push({ createdAt: { lte: new Date(filters.to) } });

  const where = { AND: and };
  const [total, outRows] = await Promise.all([
    prisma.bankTransaction.count({ where }),
    prisma.bankTransaction.findMany({
      where,
      include: { bankAccount: { include: { user: true, company: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  const inRefs = outRows.map((r) => r.referenceCode.replace(/-OUT$/, "-IN"));
  const inRows = await prisma.bankTransaction.findMany({
    where: { referenceCode: { in: inRefs } },
    include: { bankAccount: { include: { user: true, company: true } } },
  });
  const inByRef = new Map(inRows.map((r) => [r.referenceCode, r]));

  return {
    items: outRows.map((out) => {
      const inRef = out.referenceCode.replace(/-OUT$/, "-IN");
      return mapAltaPayPair(out, inByRef.get(inRef) ?? null);
    }),
    total,
    limit,
    offset,
    hasMore: offset + outRows.length < total,
  };
}

export async function getAltaPayPaymentDetail(referenceCode: string): Promise<AltaPayAdminRow> {
  await requireOperator();
  const base = referenceCode.replace(/-OUT$|-IN$/, "");
  const outTx = await prisma.bankTransaction.findFirst({
    where: { referenceCode: `${base}-OUT` },
    include: { bankAccount: { include: { user: true, company: true } } },
  });
  if (!outTx) throw new Error("NOT_FOUND");
  const inTx = await prisma.bankTransaction.findFirst({
    where: { referenceCode: `${base}-IN` },
    include: { bankAccount: { include: { user: true, company: true } } },
  });
  return mapAltaPayPair(outTx, inTx);
}

export async function reverseAltaPayPayment(
  actorUserId: string,
  referenceCode: string,
  reason: string,
  notificationOptions?: import("@/lib/internal/operator-notification-options").OperatorNotificationOptions,
): Promise<{ reversalReference: string }> {
  await requireOperator();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("BAD_REQUEST:Reason is required");

  const { isSilentNotificationForbidden, silentNotificationForbiddenMessage } = await import(
    "@/lib/internal/silent-notification-restrictions"
  );
  if (isSilentNotificationForbidden({ kind: "payment_reversed", action: "alta_pay_reversal" }, notificationOptions)) {
    const { recordFailedAction } = await import("@/server/failed-action-audit.service");
    await recordFailedAction({
      actorUserId,
      actionAttempted: "SILENT_NOTIFICATION",
      auditAction: "OPS_SILENT_NOTIFICATION_REJECTED",
      failureReason: silentNotificationForbiddenMessage({ kind: "payment_reversed", action: "alta_pay_reversal" }),
      entityType: "BANK_TRANSACTION",
      source: "INTERNAL",
    });
    throw new Error(
      `BAD_REQUEST:${silentNotificationForbiddenMessage({ kind: "payment_reversed", action: "alta_pay_reversal" })}`,
    );
  }

  const payment = await getAltaPayPaymentDetail(referenceCode);
  if (payment.status !== "APPROVED") throw new Error("BAD_REQUEST:Only approved payments can be reversed");

  const outTx = await prisma.bankTransaction.findUnique({ where: { id: payment.outTransactionId } });
  const inTx = payment.inTransactionId
    ? await prisma.bankTransaction.findUnique({ where: { id: payment.inTransactionId } })
    : null;
  if (!outTx || !inTx) throw new Error("NOT_FOUND");

  const originalBase = payment.referenceCode;
  const reversalMarker = altaPayReversalMarker(originalBase);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const revBase = `PAY-REV-${date}-${suffix}`;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const { assertAltaPayNotReversed } = await import("@/server/alta-pay-reversal.service");
      const { lockBankAccountsInOrder, assertAccountAvailableForDebitInTx } = await import(
        "@/server/financial-integrity.service"
      );

      await assertAltaPayNotReversed(tx, originalBase);
      await lockBankAccountsInOrder(tx, [inTx.bankAccountId, outTx.bankAccountId]);
      await assertAccountAvailableForDebitInTx(tx, inTx.bankAccountId, Number(outTx.amount.toString()), {
        message: "Payee account has insufficient balance to reverse this Alta Pay payment.",
      });

      await tx.bankAccount.update({
        where: { id: inTx.bankAccountId },
        data: { balance: { decrement: outTx.amount } },
      });
      await tx.bankAccount.update({
        where: { id: outTx.bankAccountId },
        data: { balance: { increment: outTx.amount } },
      });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: inTx.bankAccountId,
          type: "WITHDRAWAL",
          amount: outTx.amount,
          status: "APPROVED",
          description: altaPayReversalDescription(payment.merchantName),
          memo: reversalMarker,
          referenceCode: `${revBase}-OUT`,
          reviewedById: actorUserId,
          reviewedAt: now,
          reviewNote: `${trimmed} · ${reversalMarker}`,
        },
      });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: outTx.bankAccountId,
          type: "DEPOSIT",
          amount: outTx.amount,
          status: "APPROVED",
          description: altaPayReversalDescription(payment.merchantName),
          memo: reversalMarker,
          referenceCode: `${revBase}-IN`,
          reviewedById: actorUserId,
          reviewedAt: now,
          reviewNote: `${trimmed} · ${reversalMarker}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already reversed")) {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId,
        action: "ALTA_PAY_REVERSAL_REJECTED",
        entityType: "BANK_TRANSACTION",
        entityId: payment.outTransactionId,
        targetTransactionId: payment.outTransactionId,
        description: `Rejected duplicate Alta Pay reversal for ${originalBase}`,
        metadata: {
          referenceCode: originalBase,
          reason: trimmed,
          rejectionReason: "already_reversed",
          source: "website",
        },
      });
    }
    throw error;
  }

  const { deliverOperatorCustomerNotification } = await import(
    "@/server/customer-operator-notification.service"
  );
  const { auditMetadata } = await deliverOperatorCustomerNotification({
    actorUserId,
    notificationOptions,
    silentRestriction: { kind: "payment_reversed", action: "alta_pay_reversal" },
    deliver: async () => {
      const { notifyBankAccountCustomersBestEffort } = await import(
        "@/server/customer-operator-notification.service"
      );
      const outAccount = await prisma.bankAccount.findUnique({ where: { id: outTx.bankAccountId } });
      const inAccount = await prisma.bankAccount.findUnique({ where: { id: inTx.bankAccountId } });
      let sent = false;
      if (outAccount) {
        sent =
          (await notifyBankAccountCustomersBestEffort({
            account: {
              id: outAccount.id,
              accountNumber: outAccount.accountNumber,
              userId: outAccount.userId,
              companyId: outAccount.companyId,
            },
            kind: "payment_reversed",
            amount: payment.amount,
            transactionId: payment.outTransactionId,
            source: "alta_pay_reversed_payer",
            silentNotification: notificationOptions?.silentNotification,
          })) || sent;
      }
      if (inAccount && inAccount.id !== outAccount?.id) {
        sent =
          (await notifyBankAccountCustomersBestEffort({
            account: {
              id: inAccount.id,
              accountNumber: inAccount.accountNumber,
              userId: inAccount.userId,
              companyId: inAccount.companyId,
            },
            kind: "payment_reversed",
            amount: payment.amount,
            transactionId: payment.inTransactionId,
            source: "alta_pay_reversed_payee",
            silentNotification: notificationOptions?.silentNotification,
          })) || sent;
      }
      return sent;
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { buildLinkedReversalMetadata } = await import("@/lib/internal/transaction-reversal-link");
  await writeAuditLog({
    actorUserId,
    action: "BANK_PAYMENT_REVERSED",
    entityType: "BANK_TRANSACTION",
    entityId: payment.outTransactionId,
    targetTransactionId: payment.outTransactionId,
    description: `Reversed Alta Pay ${payment.referenceCode}`,
    metadata: {
      referenceCode: payment.referenceCode,
      reversalReference: revBase,
      reason: trimmed,
      amount: payment.amount,
      reversesPayment: originalBase,
      idempotencyKey: `alta-pay-reversal:${originalBase}`,
      source: "website",
      ...buildLinkedReversalMetadata({
        originalTransactionId: payment.outTransactionId,
        originalReferenceCode: originalBase,
        reversalReferenceCode: revBase,
        reversalReason: trimmed,
        reversedByUserId: actorUserId,
        reversalKind: "alta_pay",
      }),
      ...auditMetadata,
    },
  });

  return { reversalReference: revBase };
}
