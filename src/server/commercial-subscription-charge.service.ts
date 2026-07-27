import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { debitBankAccountInTx } from "@/server/financial-integrity.service";

export type CommercialChargeType = "INITIAL_PURCHASE" | "MONTHLY_RENEWAL";

export type CommercialChargeLedgerResult = {
  chargeId: string;
  transactionId: string;
  referenceCode: string;
  billingPeriod: string;
  billingCycleId: string;
  amount: number;
  billingAccountId: string;
  nextBillingAt: Date;
  reconciled: boolean;
};

type Tx = Prisma.TransactionClient;

function generateCommercialBillingReference(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CMP-${date}-${suffix}`;
}

export function commercialBillingPeriodDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function commercialChargeIdempotencyKey(
  chargeType: CommercialChargeType,
  companyId: string,
  billingPeriod: string,
): string {
  return `commercial-pro:${chargeType}:${companyId}:${billingPeriod}`;
}

export function newCommercialBillingCycleId(): string {
  return `cbc_${randomBytes(12).toString("hex")}`;
}

export function initialPurchaseBillingPeriod(cycleId: string): string {
  return `${cycleId}:initial`;
}

export function renewalBillingPeriod(cycleId: string, dueAt: Date): string {
  return `${cycleId}:${commercialBillingPeriodDayKey(dueAt)}`;
}

export async function lockCompanyRowForBilling(tx: Tx, companyId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
}

async function loadBillingAccountInTx(
  tx: Tx,
  companyId: string,
  billingAccountId: string,
) {
  const account = await tx.bankAccount.findFirst({
    where: {
      id: billingAccountId,
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
  });
  if (!account) {
    throw new Error("BAD_REQUEST:Select an active business operating account for billing.");
  }
  return account;
}

/**
 * Debit + bank transaction + SUCCEEDED charge ledger row inside an open Prisma transaction.
 * Callers must already hold a company row lock and have validated entitlement state.
 */
export async function executeCommercialSubscriptionChargeInTx(
  tx: Tx,
  input: {
    companyId: string;
    billingAccountId: string;
    amount: number;
    description: string;
    chargeType: CommercialChargeType;
    billingPeriod: string;
    billingCycleId: string;
  },
): Promise<CommercialChargeLedgerResult> {
  if (input.amount <= 0) {
    throw new Error("BAD_REQUEST:Billing amount must be greater than zero.");
  }

  const idempotencyKey = commercialChargeIdempotencyKey(
    input.chargeType,
    input.companyId,
    input.billingPeriod,
  );

  const existing = await tx.commercialSubscriptionCharge.findUnique({
    where: {
      companyId_billingPeriod_chargeType: {
        companyId: input.companyId,
        billingPeriod: input.billingPeriod,
        chargeType: input.chargeType,
      },
    },
  });

  if (existing?.status === "SUCCEEDED" && existing.bankTransactionId && existing.referenceCode) {
    const company = await tx.company.findUnique({
      where: { id: input.companyId },
      select: { commercialNextBillingAt: true },
    });
    return {
      chargeId: existing.id,
      transactionId: existing.bankTransactionId,
      referenceCode: existing.referenceCode,
      billingPeriod: existing.billingPeriod,
      billingCycleId: existing.billingCycleId ?? input.billingCycleId,
      amount: Number(existing.amount.toString()),
      billingAccountId: existing.billingAccountId,
      nextBillingAt: company?.commercialNextBillingAt ?? new Date(),
      reconciled: true,
    };
  }

  const account = await loadBillingAccountInTx(tx, input.companyId, input.billingAccountId);
  const referenceCode = generateCommercialBillingReference();

  try {
    await debitBankAccountInTx(tx, account.id, input.amount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("INSUFFICIENT") || message.includes("available balance")) {
      throw new Error(
        "BAD_REQUEST:Insufficient funds in the selected billing account. Add funds and try again.",
      );
    }
    throw error;
  }

  const transaction = await tx.bankTransaction.create({
    data: {
      bankAccountId: account.id,
      type: "ADJUSTMENT",
      amount: input.amount,
      status: "APPROVED",
      description: input.description,
      referenceCode,
      reviewedAt: new Date(),
      reviewNote: "Alta Commercial Pro subscription",
    },
  });

  const charge = await tx.commercialSubscriptionCharge.create({
    data: {
      companyId: input.companyId,
      billingAccountId: account.id,
      amount: input.amount,
      billingPeriod: input.billingPeriod,
      chargeType: input.chargeType,
      status: "SUCCEEDED",
      bankTransactionId: transaction.id,
      referenceCode,
      idempotencyKey,
      billingCycleId: input.billingCycleId,
    },
  });

  return {
    chargeId: charge.id,
    transactionId: transaction.id,
    referenceCode,
    billingPeriod: input.billingPeriod,
    billingCycleId: input.billingCycleId,
    amount: input.amount,
    billingAccountId: account.id,
    nextBillingAt: new Date(),
    reconciled: false,
  };
}

/** Stable hash for optional client-supplied purchase idempotency keys. */
export function hashCommercialPurchaseRequest(input: {
  companyId: string;
  billingAccountId: string;
  amount: number;
}): string {
  return createHash("sha256")
    .update(`${input.companyId}:${input.billingAccountId}:${input.amount}`)
    .digest("hex");
}

export async function findSucceededCommercialCharge(
  companyId: string,
  billingPeriod: string,
  chargeType: CommercialChargeType,
) {
  return prisma.commercialSubscriptionCharge.findUnique({
    where: {
      companyId_billingPeriod_chargeType: {
        companyId,
        billingPeriod,
        chargeType,
      },
    },
  });
}
