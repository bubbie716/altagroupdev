import type { PaymentType, Prisma, TransferGroupType } from "@prisma/client";
import type { TransactionClient } from "@/server/financial-integrity.service";
import { paymentTypeToTransferGroupType } from "@/lib/bank/account-ownership";

export type RecordPairedPaymentInput = {
  paymentType: PaymentType;
  referenceCode: string;
  payerUserId?: string | null;
  recipientUserId?: string | null;
  sourceBankAccountId: string;
  destinationBankAccountId: string;
  amount: number;
  currency?: string;
  initiatedByUserId: string;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  debitTransactionId: string;
  creditTransactionId: string;
};

export type RecordPairedPaymentResult = {
  paymentId: string;
  transferGroupId: string;
};

function toTransferGroupType(paymentType: PaymentType): TransferGroupType {
  return paymentTypeToTransferGroupType(paymentType);
}

/** Creates Payment + TransferGroup and links paired ledger entries. Safe to call inside existing money-movement transactions. */
export async function recordPairedPaymentInTx(
  tx: TransactionClient,
  input: RecordPairedPaymentInput,
): Promise<RecordPairedPaymentResult> {
  const now = new Date();
  const groupType = toTransferGroupType(input.paymentType);

  const transferGroup = await tx.transferGroup.create({
    data: {
      groupType,
      status: "COMPLETED",
      referenceCode: input.referenceCode,
      completedAt: now,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await tx.bankTransaction.update({
    where: { id: input.debitTransactionId },
    data: { transferGroupId: transferGroup.id, ledgerRole: "DEBIT" },
  });
  await tx.bankTransaction.update({
    where: { id: input.creditTransactionId },
    data: { transferGroupId: transferGroup.id, ledgerRole: "CREDIT" },
  });

  const payment = await tx.payment.create({
    data: {
      paymentType: input.paymentType,
      status: "COMPLETED",
      payerUserId: input.payerUserId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      sourceBankAccountId: input.sourceBankAccountId,
      destinationBankAccountId: input.destinationBankAccountId,
      amount: input.amount,
      currency: input.currency ?? "FLR",
      referenceCode: input.referenceCode,
      memo: input.memo ?? null,
      initiatedByUserId: input.initiatedByUserId,
      transferGroupId: transferGroup.id,
      completedAt: now,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return { paymentId: payment.id, transferGroupId: transferGroup.id };
}

export type RecordAdjustmentReversalGroupInput = {
  referenceCode: string;
  originalTransactionId: string;
  originalReferenceCode: string;
  reversalTransactionId: string;
  reversalReferenceCode: string;
  reversedByUserId: string;
  reason: string;
};

/** Groups an original adjustment with its offsetting reversal under a TransferGroup. */
export async function recordAdjustmentReversalGroupInTx(
  tx: TransactionClient,
  input: RecordAdjustmentReversalGroupInput,
): Promise<{ transferGroupId: string }> {
  const now = new Date();
  const transferGroup = await tx.transferGroup.create({
    data: {
      groupType: "ADJUSTMENT_REVERSAL",
      status: "COMPLETED",
      referenceCode: input.referenceCode,
      completedAt: now,
      metadata: {
        originalTransactionId: input.originalTransactionId,
        originalReferenceCode: input.originalReferenceCode,
        reversalReferenceCode: input.reversalReferenceCode,
        reversedByUserId: input.reversedByUserId,
        reason: input.reason,
      },
    },
  });

  await tx.bankTransaction.update({
    where: { id: input.originalTransactionId },
    data: { transferGroupId: transferGroup.id, ledgerRole: "SINGLE" },
  });
  await tx.bankTransaction.update({
    where: { id: input.reversalTransactionId },
    data: { transferGroupId: transferGroup.id, ledgerRole: "REVERSAL_CREDIT" },
  });

  return { transferGroupId: transferGroup.id };
}

export async function findPaymentByReferenceCode(referenceCode: string) {
  const { prisma } = await import("@/server/db");
  return prisma.payment.findUnique({
    where: { referenceCode },
    include: {
      transferGroup: {
        include: {
          ledgerEntries: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

export async function findTransferGroupByReferenceCode(referenceCode: string) {
  const { prisma } = await import("@/server/db");
  return prisma.transferGroup.findUnique({
    where: { referenceCode },
    include: {
      ledgerEntries: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
}
