import type { PaymentType } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type { TransactionClient } from "@/server/financial-integrity.service";
import {
  altaPayFromDescription,
  altaPayToDescription,
} from "@/lib/bank/customer-transaction-copy";
import {
  recordCardFundedPaymentInTx,
  recordPairedPaymentInTx,
} from "@/server/payment-entity.service";

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

export type SettleCommercialPaymentFromAltaCardInput = {
  paymentType: PaymentType;
  referenceBase: string;
  user: AltaUser;
  cardId: string;
  payerLabel: string;
  companyId: string;
  companyName: string;
  destinationAccountId: string;
  grossAmount: number;
  initiatedByUserId: string;
  memo?: string | null;
  metadata?: Record<string, unknown>;
  inDescription?: string;
  chargeDescription?: string;
};

/** Instant intrabank settlement from Alta Card charge to company operating account. */
export async function settleCommercialPaymentFromAltaCardInTx(
  tx: TransactionClient,
  input: SettleCommercialPaymentFromAltaCardInput,
): Promise<SettleToCompanyOperatingAccountResult & { cardTransactionId: string; fundingSourceLabel: string }> {
  const { lockBankAccountsInOrder } = await import("@/server/financial-integrity.service");
  const { chargeAltaCardForAltaPay } = await import("@/server/alta-card-transaction.service");

  await lockBankAccountsInOrder(tx, [input.destinationAccountId]);

  const cardTx = await chargeAltaCardForAltaPay(tx, {
    user: input.user,
    fundingId: input.cardId,
    amount: input.grossAmount,
    companyId: input.companyId,
    companyName: input.companyName,
    altaPayReference: input.referenceBase,
    memo: input.memo,
  });

  const fundingSourceLabel =
    (cardTx.metadata?.fundingSource as string | undefined) ?? "Alta Card";

  await tx.bankAccount.update({
    where: { id: input.destinationAccountId },
    data: { balance: { increment: input.grossAmount } },
  });

  const inReference = `${input.referenceBase}-IN`;
  const memo = input.memo?.trim() || null;

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

  const { paymentId, transferGroupId } = await recordCardFundedPaymentInTx(tx, {
    paymentType: input.paymentType,
    referenceCode: input.referenceBase,
    payerUserId: input.user.id,
    destinationBankAccountId: input.destinationAccountId,
    amount: input.grossAmount,
    initiatedByUserId: input.initiatedByUserId,
    memo,
    creditTransactionId: inTx.id,
    cardTransactionId: cardTx.id,
    metadata: {
      companyId: input.companyId,
      payeeName: input.companyName,
      fundingSource: fundingSourceLabel,
      ...input.metadata,
    },
  });

  return {
    paymentId,
    transferGroupId,
    outTransactionId: cardTx.id,
    inTransactionId: inTx.id,
    referenceBase: input.referenceBase,
    cardTransactionId: cardTx.id,
    fundingSourceLabel,
  };
}
