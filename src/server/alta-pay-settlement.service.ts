import type { PaymentType } from "@prisma/client";
import type { TransactionClient } from "@/server/financial-integrity.service";
import {
  altaPayFromDescription,
  altaPayToDescription,
} from "@/lib/bank/customer-transaction-copy";
import { recordPairedPaymentInTx } from "@/server/payment-entity.service";

export type SettleToCompanyOperatingAccountInput = {
  paymentType: PaymentType;
  referenceBase: string;
  payerUserId: string;
  payerLabel: string;
  companyId: string;
  companyName: string;
  sourceAccountId: string;
  destinationAccountId: string;
  grossAmount: number;
  initiatedByUserId: string;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  outDescription?: string;
  inDescription?: string;
};

export type SettleToCompanyOperatingAccountResult = {
  paymentId: string;
  transferGroupId: string;
  outTransactionId: string;
  inTransactionId: string;
  referenceBase: string;
};

/** Instant intrabank settlement from payer account to company operating account. */
export async function settleToCompanyOperatingAccountInTx(
  tx: TransactionClient,
  input: SettleToCompanyOperatingAccountInput,
): Promise<SettleToCompanyOperatingAccountResult> {
  const { assertAccountAvailableForDebitInTx, lockBankAccountsInOrder } = await import(
    "@/server/financial-integrity.service"
  );

  await lockBankAccountsInOrder(tx, [input.sourceAccountId, input.destinationAccountId]);
  await assertAccountAvailableForDebitInTx(tx, input.sourceAccountId, input.grossAmount, {
    message: "This payment couldn't be completed because your available balance is insufficient.",
  });

  await tx.bankAccount.update({
    where: { id: input.sourceAccountId },
    data: { balance: { decrement: input.grossAmount } },
  });
  await tx.bankAccount.update({
    where: { id: input.destinationAccountId },
    data: { balance: { increment: input.grossAmount } },
  });

  const outReference = `${input.referenceBase}-OUT`;
  const inReference = `${input.referenceBase}-IN`;
  const memo = input.memo?.trim() || null;

  const outTx = await tx.bankTransaction.create({
    data: {
      bankAccountId: input.sourceAccountId,
      type: "WITHDRAWAL",
      amount: input.grossAmount,
      status: "APPROVED",
      description: input.outDescription ?? altaPayToDescription(input.companyName),
      memo,
      referenceCode: outReference,
      proofImageUrl: null,
    },
  });

  const inTx = await tx.bankTransaction.create({
    data: {
      bankAccountId: input.destinationAccountId,
      type: "DEPOSIT",
      amount: input.grossAmount,
      status: "APPROVED",
      description: input.inDescription ?? altaPayFromDescription(input.payerLabel),
      memo,
      referenceCode: inReference,
      proofImageUrl: null,
    },
  });

  const { paymentId, transferGroupId } = await recordPairedPaymentInTx(tx, {
    paymentType: input.paymentType,
    referenceCode: input.referenceBase,
    payerUserId: input.payerUserId,
    sourceBankAccountId: input.sourceAccountId,
    destinationBankAccountId: input.destinationAccountId,
    amount: input.grossAmount,
    initiatedByUserId: input.initiatedByUserId,
    memo,
    debitTransactionId: outTx.id,
    creditTransactionId: inTx.id,
    metadata: {
      companyId: input.companyId,
      payeeName: input.companyName,
      ...input.metadata,
    },
  });

  return {
    paymentId,
    transferGroupId,
    outTransactionId: outTx.id,
    inTransactionId: inTx.id,
    referenceBase: input.referenceBase,
  };
}
