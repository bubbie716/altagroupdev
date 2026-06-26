import type { AltaCardStatementStatus, Prisma } from "@prisma/client";
import type {
  AltaCardStatementDetail,
  AltaCardStatementRow,
  AltaCardStatementStatusCode,
} from "@/lib/bank/alta-card-types";
import { calculateRemainingStatementBalance } from "@/lib/bank/alta-card-minimum-payment";
import { mapAltaCardTransactionRow, altaCardTransactionInclude } from "@/server/alta-card-mapper";

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

export function toAltaCardStatementStatusCode(
  value: AltaCardStatementStatus,
): AltaCardStatementStatusCode {
  return value.toLowerCase() as AltaCardStatementStatusCode;
}

export function toDbAltaCardStatementStatus(
  value: AltaCardStatementStatusCode,
): AltaCardStatementStatus {
  return value.toUpperCase() as AltaCardStatementStatus;
}

export function mapAltaCardStatementRow(
  row: Prisma.AltaCardStatementGetPayload<object>,
): AltaCardStatementRow {
  const statementBalance = decimalToNumber(row.statementBalance);
  const amountPaid = decimalToNumber(row.amountPaid);
  const storedRemaining = decimalToNumber(row.remainingBalance);
  const remainingBalance =
    storedRemaining > 0 || row.status !== "OPEN"
      ? storedRemaining
      : calculateRemainingStatementBalance(statementBalance, amountPaid);

  return {
    id: row.id,
    altaCardId: row.altaCardId,
    statementNumber: row.statementNumber,
    billingPeriodStart: row.billingPeriodStart.toISOString(),
    billingPeriodEnd: row.billingPeriodEnd.toISOString(),
    statementDate: row.statementDate?.toISOString() ?? null,
    dueDate: row.dueDate.toISOString(),
    previousBalance: decimalToNumber(row.previousBalance),
    purchases: decimalToNumber(row.purchases),
    payments: decimalToNumber(row.payments),
    adjustments: decimalToNumber(row.adjustments),
    interestCharged: decimalToNumber(row.interestCharged),
    feesCharged: decimalToNumber(row.feesCharged),
    statementBalance,
    amountPaid,
    feesPaid: decimalToNumber(row.feesPaid),
    interestPaid: decimalToNumber(row.interestPaid),
    principalPaid: decimalToNumber(row.principalPaid),
    remainingBalance,
    minimumPayment: decimalToNumber(row.minimumPayment),
    endingBalance: decimalToNumber(row.endingBalance),
    status: toAltaCardStatementStatusCode(row.status),
    paidAt: row.paidAt?.toISOString() ?? null,
    overdueAt: row.overdueAt?.toISOString() ?? null,
    interestAppliedAt: row.interestAppliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAltaCardStatementDetail(
  row: Prisma.AltaCardStatementGetPayload<{
    include: { transactions: { include: typeof altaCardTransactionInclude } };
  }>,
): AltaCardStatementDetail {
  return {
    ...mapAltaCardStatementRow(row),
    transactions: row.transactions.map(mapAltaCardTransactionRow),
  };
}
