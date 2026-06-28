import {
  monthlyDecimalRateToPercent,
  normalizeTransactionDescriptionSeparators,
  reversalAdjustmentDescription,
  type InterestPaymentBasis,
} from "@/lib/bank/customer-transaction-copy";
import {
  parseAdminAdjustmentReason,
  parseReversalOfReference,
  rewriteAltaCardTransactionDescription,
  rewriteBankTransactionDescription,
  rewriteLoanLedgerDescription,
} from "@/lib/bank/customer-transaction-description-backfill";
import { prisma } from "@/server/db";

export type TransactionDescriptionBackfillResult = {
  bankTransactionsUpdated: number;
  altaCardTransactionsUpdated: number;
  loanLedgerEntriesUpdated: number;
  bankTransactionsSkipped: number;
  altaCardTransactionsSkipped: number;
  loanLedgerEntriesSkipped: number;
};

const BATCH_SIZE = 200;

function resolveDescriptionUpdate(original: string, rewritten: string | null): string | null {
  if (rewritten && rewritten !== original) return rewritten;
  if (original.includes(" — ") || original.includes(". ")) {
    const normalized = normalizeTransactionDescriptionSeparators(original);
    if (normalized !== original) return normalized;
  }
  return null;
}

export async function backfillCustomerTransactionDescriptions(options?: {
  dryRun?: boolean;
}): Promise<TransactionDescriptionBackfillResult> {
  const dryRun = options?.dryRun ?? false;
  const result: TransactionDescriptionBackfillResult = {
    bankTransactionsUpdated: 0,
    altaCardTransactionsUpdated: 0,
    loanLedgerEntriesUpdated: 0,
    bankTransactionsSkipped: 0,
    altaCardTransactionsSkipped: 0,
    loanLedgerEntriesSkipped: 0,
  };

  const descriptionByReference = new Map<string, string>();
  const bankRows = await prisma.bankTransaction.findMany({
    select: {
      id: true,
      type: true,
      status: true,
      description: true,
      referenceCode: true,
      bankAccount: { select: { accountType: true, accountName: true } },
    },
  });

  for (const row of bankRows) {
    descriptionByReference.set(row.referenceCode, row.description);
  }

  const altaPayMerchantByRef = new Map<string, string>();
  for (const row of bankRows) {
    if (!row.referenceCode.endsWith("-IN")) continue;
    const base = row.referenceCode.replace(/-IN$/, "");
    if (!base.startsWith("PAY-")) continue;
    const merchant = row.description
      .replace(/^Alta Pay business payment from /, "")
      .replace(/^Alta Pay from /, "")
      .replace(/ \(Alta Card\)$/, "");
    altaPayMerchantByRef.set(base, merchant);
  }

  const resolveDescriptionByReference = (referenceCode: string) =>
    descriptionByReference.get(referenceCode) ?? null;

  const resolveAltaPayMerchantByPaymentRef = (paymentRef: string) => {
    const base = paymentRef.replace(/-OUT$|-IN$/, "");
    return altaPayMerchantByRef.get(base) ?? null;
  };

  const interestBasisByReference = new Map<string, InterestPaymentBasis>();
  const txRefById = new Map(bankRows.map((row) => [row.id, row.referenceCode]));

  const [accruals, manualBatchLogs, manualAccountLogs] = await Promise.all([
    prisma.bankInterestAccrual.findMany({
      where: { bankTransactionId: { not: null } },
      select: { bankTransactionId: true, interestRate: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "MANUAL_INTEREST_APPLIED" },
      select: { metadata: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "MANUAL_INTEREST_ACCOUNT_CREDITED" },
      select: { metadata: true, targetTransactionId: true },
    }),
  ]);

  for (const accrual of accruals) {
    if (!accrual.bankTransactionId) continue;
    const referenceCode = txRefById.get(accrual.bankTransactionId);
    if (!referenceCode) continue;
    interestBasisByReference.set(referenceCode, {
      mode: "percentage",
      ratePercent: monthlyDecimalRateToPercent(Number(accrual.interestRate.toString())),
    });
  }

  for (const log of manualBatchLogs) {
    if (!log.metadata || typeof log.metadata !== "object") continue;
    const meta = log.metadata as Record<string, unknown>;
    const results = meta.results;
    if (!Array.isArray(results)) continue;
    for (const entry of results) {
      if (!entry || typeof entry !== "object") continue;
      const referenceCode = (entry as Record<string, unknown>).referenceCode;
      if (typeof referenceCode !== "string") continue;
      if (meta.mode === "FIXED_AMOUNT") {
        interestBasisByReference.set(referenceCode, { mode: "fixed" });
      } else if (meta.mode === "PERCENTAGE" && typeof meta.percentageRate === "number") {
        interestBasisByReference.set(referenceCode, {
          mode: "percentage",
          ratePercent: meta.percentageRate,
        });
      }
    }
  }

  for (const log of manualAccountLogs) {
    if (!log.metadata || typeof log.metadata !== "object") continue;
    const meta = log.metadata as Record<string, unknown>;
    const referenceCode =
      typeof meta.referenceCode === "string"
        ? meta.referenceCode
        : log.targetTransactionId
          ? txRefById.get(log.targetTransactionId)
          : undefined;
    if (!referenceCode || interestBasisByReference.has(referenceCode)) continue;
    if (meta.mode === "FIXED_AMOUNT") {
      interestBasisByReference.set(referenceCode, { mode: "fixed" });
    } else if (meta.mode === "PERCENTAGE" && typeof meta.percentageRate === "number") {
      interestBasisByReference.set(referenceCode, {
        mode: "percentage",
        ratePercent: meta.percentageRate,
      });
    }
  }

  const resolveInterestPaymentBasis = (referenceCode: string) =>
    interestBasisByReference.get(referenceCode) ?? null;

  const bankUpdates: Array<{ id: string; description: string }> = [];
  const pendingById = new Map<string, string>();

  for (const row of bankRows) {
    const admin = parseAdminAdjustmentReason(row.description);
    if (admin && parseReversalOfReference(admin.reason)) {
      continue;
    }
    const next = resolveDescriptionUpdate(
      row.description,
      rewriteBankTransactionDescription(row, {
        resolveDescriptionByReference,
        resolveAltaPayMerchantByPaymentRef,
        resolveInterestPaymentBasis: () => resolveInterestPaymentBasis(row.referenceCode),
      }),
    );
    if (!next) {
      result.bankTransactionsSkipped += 1;
      continue;
    }
    pendingById.set(row.id, next);
    descriptionByReference.set(row.referenceCode, next);
  }

  for (const row of bankRows) {
    const admin = parseAdminAdjustmentReason(row.description);
    const reversalRef = admin ? parseReversalOfReference(admin.reason) : null;
    if (!reversalRef) continue;

    const original = descriptionByReference.get(reversalRef);
    if (!original) {
      result.bankTransactionsSkipped += 1;
      continue;
    }

    const rewrittenOriginal =
      rewriteBankTransactionDescription(
        { ...row, description: original },
        {
          resolveDescriptionByReference,
          resolveAltaPayMerchantByPaymentRef,
          resolveInterestPaymentBasis: () => resolveInterestPaymentBasis(row.referenceCode),
        },
      ) ?? original;
    const next = reversalAdjustmentDescription(rewrittenOriginal);
    if (next === row.description) {
      result.bankTransactionsSkipped += 1;
      continue;
    }
    pendingById.set(row.id, next);
  }

  for (const [id, description] of pendingById) {
    bankUpdates.push({ id, description });
  }

  if (!dryRun && bankUpdates.length > 0) {
    for (let i = 0; i < bankUpdates.length; i += BATCH_SIZE) {
      const batch = bankUpdates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((update) =>
          prisma.bankTransaction.update({
            where: { id: update.id },
            data: { description: update.description },
          }),
        ),
      );
    }
  }
  result.bankTransactionsUpdated = bankUpdates.length;

  const cardRows = await prisma.altaCardTransaction.findMany({
    select: {
      id: true,
      description: true,
      type: true,
      metadata: true,
      altaCard: { select: { cardLastFour: true } },
      altaEmployeeCard: { select: { cardLastFour: true } },
    },
  });

  const cardUpdates: Array<{ id: string; description: string }> = [];
  for (const row of cardRows) {
    const next = resolveDescriptionUpdate(row.description, rewriteAltaCardTransactionDescription(row));
    if (!next) {
      result.altaCardTransactionsSkipped += 1;
      continue;
    }
    cardUpdates.push({ id: row.id, description: next });
  }

  if (!dryRun && cardUpdates.length > 0) {
    for (let i = 0; i < cardUpdates.length; i += BATCH_SIZE) {
      const batch = cardUpdates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((update) =>
          prisma.altaCardTransaction.update({
            where: { id: update.id },
            data: { description: update.description },
          }),
        ),
      );
    }
  }
  result.altaCardTransactionsUpdated = cardUpdates.length;

  const ledgerRows = await prisma.loanLedgerEntry.findMany({
    select: { id: true, description: true },
  });

  const ledgerUpdates: Array<{ id: string; description: string }> = [];
  for (const row of ledgerRows) {
    const next = resolveDescriptionUpdate(row.description, rewriteLoanLedgerDescription(row.description));
    if (!next) {
      result.loanLedgerEntriesSkipped += 1;
      continue;
    }
    ledgerUpdates.push({ id: row.id, description: next });
  }

  if (!dryRun && ledgerUpdates.length > 0) {
    for (let i = 0; i < ledgerUpdates.length; i += BATCH_SIZE) {
      const batch = ledgerUpdates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((update) =>
          prisma.loanLedgerEntry.update({
            where: { id: update.id },
            data: { description: update.description },
          }),
        ),
      );
    }
  }
  result.loanLedgerEntriesUpdated = ledgerUpdates.length;

  return result;
}
