import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  altaPayReversalMarker,
  altaPayPaymentReversalKey,
  normalizeAltaPayReference,
} from "@/lib/bank/alta-pay-reversal";
import type { TransactionClient } from "@/server/financial-integrity.service";

export async function findAltaPayReversalInTx(
  tx: TransactionClient,
  originalBaseReference: string,
): Promise<{ referenceCode: string } | null> {
  const marker = altaPayReversalMarker(originalBaseReference);
  const existing = await tx.bankTransaction.findFirst({
    where: {
      referenceCode: { startsWith: "PAY-REV-" },
      OR: [{ memo: { contains: marker } }, { reviewNote: { contains: marker } }],
    },
    select: { referenceCode: true },
  });
  if (!existing) return null;
  return { referenceCode: existing.referenceCode.replace(/-OUT$|-IN$/, "") };
}

export async function assertAltaPayNotReversed(
  tx: TransactionClient,
  originalBaseReference: string,
): Promise<void> {
  const existing = await findAltaPayReversalInTx(tx, originalBaseReference);
  if (existing) {
    throw new Error(
      `BAD_REQUEST:This Alta Pay payment was already reversed (${existing.referenceCode}).`,
    );
  }
}

export async function findAltaPayReversal(originalBaseReference: string) {
  return prisma.$transaction(async (tx) => findAltaPayReversalInTx(tx, originalBaseReference));
}

export function buildAltaPayReversalAuditMetadata(input: {
  originalBaseReference: string;
  reversalReference: string;
  reason: string;
}) {
  return {
    referenceCode: input.originalBaseReference,
    reversalReference: input.reversalReference,
    reason: input.reason,
    reversesPayment: input.originalBaseReference,
    idempotencyKey: altaPayPaymentReversalKey(input.originalBaseReference),
  };
}

export function normalizeAltaPayReferenceCode(referenceCode: string): string {
  return normalizeAltaPayReference(referenceCode);
}

export type AltaPayPaymentLeg = Prisma.BankTransactionGetPayload<object>;
