import { Prisma, type AltaCardStatementStatus, type AltaCardTransactionType } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type {
  AltaCardStatementDetail,
  AltaCardStatementRow,
  AltaCardStatementStatusCode,
} from "@/lib/bank/alta-card-types";
import {
  calculateAltaCardMinimumPayment,
  calculateRemainingStatementBalance,
  deriveStatementStatus,
  roundMoney,
} from "@/lib/bank/alta-card-minimum-payment";
import {
  getAltaCardDueDate,
  getCalendarPaymentDueForPeriodStart,
  getCalendarStatementCloseForPeriodStart,
  getInitialBillingCycle,
  getNextBillingCycle,
} from "@/lib/bank/alta-card-billing-cycle";
import { allocatePaymentToBuckets } from "@/lib/bank/alta-card-payment-allocation";
import { canManageCompanyAltaCard, isAdmin, isOperator } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import {
  mapAltaCardStatementDetail,
  mapAltaCardStatementRow,
  toDbAltaCardStatementStatus,
} from "@/server/alta-card-statement-mapper";
import { altaCardTransactionInclude } from "@/server/alta-card-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

const UNPAID_STATUSES: AltaCardStatementStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function assertOperatorOrAdmin(user: AltaUser): void {
  if (!isAdmin(user) && !isOperator(user)) forbidden();
}

async function assertStatementGenerationActor(user: AltaUser, actorUserId: string): Promise<void> {
  if (isAdmin(user) || isOperator(user)) return;
  const { isSystemActorUserId } = await import("@/server/system-actor.service");
  if (await isSystemActorUserId(actorUserId)) return;
  forbidden();
}

async function auditStatementEvent(
  actorUserId: string,
  action: string,
  description: string,
  cardId: string,
  statement: AltaCardStatementRow,
  extra?: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "ALTA_CARD",
    entityId: cardId,
    description,
    metadata: {
      cardId,
      statementId: statement.id,
      statementNumber: statement.statementNumber,
      amount: statement.statementBalance,
      actorUserId,
      ...extra,
    },
  });
}

type PeriodTotals = {
  purchases: number;
  payments: number;
  adjustments: number;
  interestCharged: number;
  feesCharged: number;
};

function aggregateTransactions(
  txs: { type: AltaCardTransactionType; amount: Prisma.Decimal }[],
): PeriodTotals {
  const totals: PeriodTotals = {
    purchases: 0,
    payments: 0,
    adjustments: 0,
    interestCharged: 0,
    feesCharged: 0,
  };

  for (const tx of txs) {
    const amount = decimalToNumber(tx.amount);
    switch (tx.type) {
      case "PURCHASE":
      case "ALTA_PAY":
      case "CASH_ADVANCE":
        totals.purchases += amount;
        break;
      case "PAYMENT":
        totals.payments += amount;
        break;
      case "ADJUSTMENT_CREDIT":
        totals.adjustments -= amount;
        break;
      case "ADJUSTMENT_DEBIT":
        totals.adjustments += amount;
        break;
      case "INTEREST":
        totals.interestCharged += amount;
        break;
      case "FEE":
        totals.feesCharged += amount;
        break;
      case "REVERSAL":
        totals.adjustments -= amount;
        break;
      default:
        break;
    }
  }

  return {
    purchases: roundMoney(totals.purchases),
    payments: roundMoney(totals.payments),
    adjustments: roundMoney(totals.adjustments),
    interestCharged: roundMoney(totals.interestCharged),
    feesCharged: roundMoney(totals.feesCharged),
  };
}

async function getPreviousBalance(altaCardId: string): Promise<number> {
  const last = await prisma.altaCardStatement.findFirst({
    where: {
      altaCardId,
      status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    orderBy: { statementNumber: "desc" },
  });
  if (!last) return 0;
  if (last.status === "PAID") return 0;
  return decimalToNumber(last.remainingBalance);
}

async function nextStatementNumber(
  altaCardId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const last = await tx.altaCardStatement.findFirst({
    where: { altaCardId },
    orderBy: { statementNumber: "desc" },
    select: { statementNumber: true },
  });
  return (last?.statementNumber ?? 0) + 1;
}

export type AltaCardResolvedBillingDates = {
  paymentDueDate: Date | null;
  nextStatementDate: Date | null;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
};

/** Resolve display dates from statement records (calendar policy, not stale card columns). */
export async function resolveAltaCardBillingDates(
  tx: Prisma.TransactionClient | typeof prisma,
  altaCardId: string,
): Promise<AltaCardResolvedBillingDates> {
  const [currentUnpaid, openStatement] = await Promise.all([
    tx.altaCardStatement.findFirst({
      where: { altaCardId, status: { in: UNPAID_STATUSES } },
      orderBy: { statementNumber: "asc" },
    }),
    tx.altaCardStatement.findFirst({
      where: { altaCardId, status: "OPEN" },
      orderBy: { statementNumber: "desc" },
    }),
  ]);

  const nextStatementDate = openStatement
    ? getCalendarStatementCloseForPeriodStart(openStatement.billingPeriodStart)
    : null;
  const billingPeriodStart = openStatement?.billingPeriodStart ?? null;
  const billingPeriodEnd = openStatement
    ? getCalendarStatementCloseForPeriodStart(openStatement.billingPeriodStart)
    : null;

  const paymentSource = currentUnpaid ?? openStatement;
  const paymentDueDate = paymentSource
    ? getCalendarPaymentDueForPeriodStart(paymentSource.billingPeriodStart)
    : null;

  return {
    paymentDueDate,
    nextStatementDate,
    billingPeriodStart,
    billingPeriodEnd,
  };
}

/** Earliest payment due: unpaid statement first, otherwise the open billing cycle. */
export async function resolveAltaCardPaymentDueDate(
  tx: Prisma.TransactionClient | typeof prisma,
  altaCardId: string,
): Promise<Date | null> {
  const { paymentDueDate } = await resolveAltaCardBillingDates(tx, altaCardId);
  return paymentDueDate;
}

export async function syncCardBillingSummary(
  tx: Prisma.TransactionClient,
  altaCardId: string,
): Promise<void> {
  const unpaid = await tx.altaCardStatement.findMany({
    where: { altaCardId, status: { in: UNPAID_STATUSES } },
    orderBy: { statementNumber: "asc" },
  });

  const totalRemaining = roundMoney(
    unpaid.reduce((sum, s) => sum + decimalToNumber(s.remainingBalance), 0),
  );

  const currentUnpaid = unpaid[0];
  const minimumPaymentDue = currentUnpaid
    ? roundMoney(
        Math.min(
          calculateAltaCardMinimumPayment(decimalToNumber(currentUnpaid.statementBalance)),
          decimalToNumber(currentUnpaid.remainingBalance),
        ),
      )
    : 0;

  const billingDates = await resolveAltaCardBillingDates(tx, altaCardId);

  await tx.altaCard.update({
    where: { id: altaCardId },
    data: {
      statementBalance: toDecimal(totalRemaining),
      minimumPaymentDue: toDecimal(minimumPaymentDue),
      paymentDueDate: billingDates.paymentDueDate,
      dueDate: billingDates.paymentDueDate,
      nextStatementDate: billingDates.nextStatementDate,
      currentBillingCycleStart: billingDates.billingPeriodStart,
      currentBillingCycleEnd: billingDates.billingPeriodEnd,
    },
  });
}

export async function initializeBillingCycleForCard(
  tx: Prisma.TransactionClient,
  altaCardId: string,
  anchorDate = new Date(),
): Promise<void> {
  const { billingPeriodStart, billingPeriodEnd, dueDate } = getInitialBillingCycle(anchorDate);
  const statementNumber = await nextStatementNumber(altaCardId, tx);

  const openStatement = await tx.altaCardStatement.create({
    data: {
      altaCardId,
      statementNumber,
      billingPeriodStart,
      billingPeriodEnd,
      dueDate,
      status: "OPEN",
    },
  });

  await tx.altaCard.update({
    where: { id: altaCardId },
    data: {
      currentBillingCycleStart: billingPeriodStart,
      currentBillingCycleEnd: billingPeriodEnd,
      currentStatementId: openStatement.id,
      nextStatementDate: billingPeriodEnd,
      paymentDueDate: dueDate,
      dueDate,
    },
  });
}

async function collectPeriodTransactions(
  tx: Prisma.TransactionClient,
  altaCardId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return tx.altaCardTransaction.findMany({
    where: {
      altaCardId,
      status: "COMPLETED",
      altaCardStatementId: null,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });
}

async function finalizeOpenStatement(
  tx: Prisma.TransactionClient,
  cardId: string,
  openStatementId: string,
  actorUserId: string,
): Promise<AltaCardStatementRow> {
  const openStatement = await tx.altaCardStatement.findUnique({ where: { id: openStatementId } });
  if (!openStatement || openStatement.status !== "OPEN") badRequest("No open billing cycle to close");

  const periodTxs = await collectPeriodTransactions(
    tx,
    cardId,
    openStatement.billingPeriodStart,
    openStatement.billingPeriodEnd,
  );

  const totals = aggregateTransactions(periodTxs);
  const previousBalance = await getPreviousBalance(cardId);
  const endingBalance = roundMoney(
    previousBalance +
      totals.purchases -
      totals.payments +
      totals.adjustments +
      totals.interestCharged +
      totals.feesCharged,
  );
  const statementBalance = Math.max(0, endingBalance);
  const minimumPayment = calculateAltaCardMinimumPayment(statementBalance);
  const statementDate = openStatement.billingPeriodEnd;
  const dueDate = getAltaCardDueDate(openStatement.billingPeriodEnd);

  const issued = await tx.altaCardStatement.update({
    where: { id: openStatement.id },
    data: {
      status: "ISSUED",
      statementDate,
      dueDate,
      previousBalance: toDecimal(previousBalance),
      purchases: toDecimal(totals.purchases),
      payments: toDecimal(totals.payments),
      adjustments: toDecimal(totals.adjustments),
      interestCharged: toDecimal(totals.interestCharged),
      feesCharged: toDecimal(totals.feesCharged),
      statementBalance: toDecimal(statementBalance),
      minimumPayment: toDecimal(minimumPayment),
      endingBalance: toDecimal(endingBalance),
      amountPaid: toDecimal(0),
      feesPaid: toDecimal(0),
      interestPaid: toDecimal(0),
      principalPaid: toDecimal(0),
      remainingBalance: toDecimal(statementBalance),
    },
  });

  if (periodTxs.length > 0) {
    await tx.altaCardTransaction.updateMany({
      where: { id: { in: periodTxs.map((t) => t.id) } },
      data: { altaCardStatementId: issued.id },
    });
  }

  const { billingPeriodStart: nextStart, billingPeriodEnd: nextEnd, dueDate: nextDue } =
    getNextBillingCycle(openStatement.billingPeriodEnd);
  const nextNumber = await nextStatementNumber(cardId, tx);

  const nextOpen = await tx.altaCardStatement.create({
    data: {
      altaCardId: cardId,
      statementNumber: nextNumber,
      billingPeriodStart: nextStart,
      billingPeriodEnd: nextEnd,
      dueDate: nextDue,
      status: "OPEN",
    },
  });

  await tx.altaCard.update({
    where: { id: cardId },
    data: {
      currentBillingCycleStart: nextStart,
      currentBillingCycleEnd: nextEnd,
      currentStatementId: nextOpen.id,
      lastStatementDate: statementDate,
      nextStatementDate: nextEnd,
      paymentDueDate: dueDate,
      dueDate,
    },
  });

  await syncCardBillingSummary(tx, cardId);

  const row = mapAltaCardStatementRow(issued);
  await auditStatementEvent(
    actorUserId,
    "ALTA_CARD_STATEMENT_GENERATED",
    `Statement #${row.statementNumber} issued`,
    cardId,
    row,
  );

  return row;
}

function assertCanGenerateCardStatement(
  user: AltaUser,
  card: { ownerUserId: string | null; companyId: string | null; cardType: string },
): void {
  if (isAdmin(user) || isOperator(user)) return;
  if (card.cardType === "PERSONAL" && card.ownerUserId === user.id) return;
  if (card.cardType === "BUSINESS" && card.companyId && canManageCompanyAltaCard(user, card.companyId)) {
    return;
  }
  forbidden();
}

function parsePeriod(start: string, end: string): { periodStart: Date; periodEnd: Date } {
  const periodStart = start.includes("T")
    ? new Date(start)
    : new Date(`${start}T00:00:00.000Z`);
  const periodEnd = end.includes("T") ? new Date(end) : new Date(`${end}T23:59:59.999Z`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    badRequest("Invalid statement period dates.");
  }
  if (periodEnd <= periodStart) {
    badRequest("Period end must be after period start.");
  }
  return { periodStart, periodEnd };
}

async function calculatePreviousBalanceFromHistory(
  altaCardId: string,
  before: Date,
): Promise<number> {
  const txs = await prisma.altaCardTransaction.findMany({
    where: {
      altaCardId,
      status: "COMPLETED",
      createdAt: { lt: before },
    },
    orderBy: { createdAt: "asc" },
  });

  let balance = 0;
  for (const tx of txs) {
    const amount = decimalToNumber(tx.amount);
    switch (tx.type) {
      case "PURCHASE":
      case "ALTA_PAY":
      case "CASH_ADVANCE":
      case "ADJUSTMENT_DEBIT":
      case "INTEREST":
      case "FEE":
        balance += amount;
        break;
      case "PAYMENT":
      case "ADJUSTMENT_CREDIT":
      case "REVERSAL":
        balance -= amount;
        break;
      default:
        break;
    }
  }

  return roundMoney(Math.max(0, balance));
}

async function findPeriodTransactions(
  altaCardId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return prisma.altaCardTransaction.findMany({
    where: {
      altaCardId,
      status: "COMPLETED",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: altaCardTransactionInclude,
    orderBy: { createdAt: "asc" },
  });
}

type CustomPeriodStatementTotals = {
  totals: PeriodTotals;
  previousBalance: number;
  endingBalance: number;
  statementBalance: number;
};

async function calculateCustomPeriodStatementTotals(
  cardId: string,
  periodStart: Date,
  periodTxs: { type: AltaCardTransactionType; amount: Prisma.Decimal }[],
): Promise<CustomPeriodStatementTotals> {
  const totals = aggregateTransactions(periodTxs);
  const previousBalance = await calculatePreviousBalanceFromHistory(cardId, periodStart);
  const endingBalance = roundMoney(
    previousBalance +
      totals.purchases -
      totals.payments +
      totals.adjustments +
      totals.interestCharged +
      totals.feesCharged,
  );
  const statementBalance = Math.max(0, endingBalance);
  return { totals, previousBalance, endingBalance, statementBalance };
}

/** Custom period summaries are informational only — no payment due dates or minimums. */
function customPeriodStatementWriteData(
  periodEnd: Date,
  { totals, previousBalance, endingBalance, statementBalance }: CustomPeriodStatementTotals,
) {
  return {
    statementDate: periodEnd,
    dueDate: periodEnd,
    previousBalance: toDecimal(previousBalance),
    purchases: toDecimal(totals.purchases),
    payments: toDecimal(totals.payments),
    adjustments: toDecimal(totals.adjustments),
    interestCharged: toDecimal(totals.interestCharged),
    feesCharged: toDecimal(totals.feesCharged),
    statementBalance: toDecimal(statementBalance),
    minimumPayment: toDecimal(0),
    endingBalance: toDecimal(endingBalance),
    remainingBalance: toDecimal(0),
    amountPaid: toDecimal(0),
    feesPaid: toDecimal(0),
    interestPaid: toDecimal(0),
    principalPaid: toDecimal(0),
  };
}

export async function generateCardStatementForPeriod(
  userId: string,
  cardId: string,
  periodStartInput: string,
  periodEndInput: string,
): Promise<AltaCardStatementDetail> {
  const { assertCardAccess } = await import("@/server/alta-card.service");

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!userRecord) notFound();
  const altaUser = mapDbUserToAltaUser(userRecord);

  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  await assertCardAccess(userId, card);
  assertCanGenerateCardStatement(altaUser, card);

  const { periodStart, periodEnd } = parsePeriod(periodStartInput, periodEndInput);

  const existing = await prisma.altaCardStatement.findFirst({
    where: {
      altaCardId: cardId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      status: { not: "VOID" },
    },
    include: {
      transactions: {
        include: altaCardTransactionInclude,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (existing) {
    if (existing.status === "GENERATED") {
      const periodTxs = await findPeriodTransactions(cardId, periodStart, periodEnd);
      const computed = await calculateCustomPeriodStatementTotals(cardId, periodStart, periodTxs);
      const updated = await prisma.altaCardStatement.update({
        where: { id: existing.id },
        data: customPeriodStatementWriteData(periodEnd, computed),
        include: {
          transactions: {
            include: altaCardTransactionInclude,
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return mapAltaCardStatementDetail({ ...updated, transactions: periodTxs });
    }
    return mapAltaCardStatementDetail(existing);
  }

  const periodTxs = await findPeriodTransactions(cardId, periodStart, periodEnd);
  const computed = await calculateCustomPeriodStatementTotals(cardId, periodStart, periodTxs);
  const statementNumber = await nextStatementNumber(cardId);

  const created = await prisma.altaCardStatement.create({
    data: {
      altaCardId: cardId,
      statementNumber,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      ...customPeriodStatementWriteData(periodEnd, computed),
      status: "GENERATED",
    },
    include: {
      transactions: {
        include: altaCardTransactionInclude,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const row = mapAltaCardStatementRow(created);
  await auditStatementEvent(
    userId,
    "ALTA_CARD_STATEMENT_GENERATED",
    `Activity summary #${row.statementNumber} generated for custom period`,
    cardId,
    row,
    { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), activitySummary: true },
  );

  return mapAltaCardStatementDetail({ ...created, transactions: periodTxs });
}

export async function generateStatement(
  actorUserId: string,
  cardId: string,
): Promise<AltaCardStatementRow> {
  const user = await getAltaUser(actorUserId);
  await assertStatementGenerationActor(user, actorUserId);

  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  if (!card.currentStatementId) badRequest("Card has no active billing cycle");

  return prisma.$transaction((tx) => finalizeOpenStatement(tx, cardId, card.currentStatementId!, actorUserId));
}

export async function regenerateOpenStatement(
  actorUserId: string,
  cardId: string,
): Promise<AltaCardStatementRow> {
  const user = await getAltaUser(actorUserId);
  assertOperatorOrAdmin(user);

  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card?.currentStatementId) notFound();

  const open = await prisma.altaCardStatement.findUnique({ where: { id: card.currentStatementId } });
  if (!open || open.status !== "OPEN") badRequest("Only open cycles can be regenerated");

  const periodTxs = await collectPeriodTransactions(
    prisma,
    cardId,
    open.billingPeriodStart,
    open.billingPeriodEnd,
  );
  const totals = aggregateTransactions(periodTxs);

  const updated = await prisma.altaCardStatement.update({
    where: { id: open.id },
    data: {
      purchases: toDecimal(totals.purchases),
      payments: toDecimal(totals.payments),
      adjustments: toDecimal(totals.adjustments),
      interestCharged: toDecimal(totals.interestCharged),
      feesCharged: toDecimal(totals.feesCharged),
    },
  });

  return mapAltaCardStatementRow(updated);
}

export async function voidStatement(
  actorUserId: string,
  statementId: string,
): Promise<AltaCardStatementRow> {
  const user = await getAltaUser(actorUserId);
  assertOperatorOrAdmin(user);

  const statement = await prisma.altaCardStatement.findUnique({ where: { id: statementId } });
  if (!statement) notFound();
  if (statement.status === "VOID") badRequest("Statement is already void");
  if (statement.status === "OPEN") badRequest("Cannot void an open billing cycle");
  if (decimalToNumber(statement.amountPaid) > 0) {
    badRequest("Cannot void a statement with payments applied");
  }

  const voided = await prisma.$transaction(async (tx) => {
    await tx.altaCardTransaction.updateMany({
      where: { altaCardStatementId: statementId },
      data: { altaCardStatementId: null },
    });

    const updated = await tx.altaCardStatement.update({
      where: { id: statementId },
      data: { status: "VOID" },
    });

    await syncCardBillingSummary(tx, statement.altaCardId);
    return updated;
  });

  const row = mapAltaCardStatementRow(voided);
  await auditStatementEvent(
    actorUserId,
    "ALTA_CARD_STATEMENT_VOIDED",
    `Statement #${row.statementNumber} voided`,
    statement.altaCardId,
    row,
  );

  return row;
}

export async function allocatePaymentToStatements(
  tx: Prisma.TransactionClient,
  altaCardId: string,
  paymentAmount: number,
  actorUserId: string,
): Promise<number[]> {
  let remaining = paymentAmount;
  const paidStatementNumbers: number[] = [];

  const unpaid = await tx.altaCardStatement.findMany({
    where: { altaCardId, status: { in: UNPAID_STATUSES } },
    orderBy: { statementNumber: "asc" },
  });

  for (const statement of unpaid) {
    if (remaining <= 0) break;

    const statementBalance = decimalToNumber(statement.statementBalance);
    const alreadyPaid = decimalToNumber(statement.amountPaid);
    const due = calculateRemainingStatementBalance(statementBalance, alreadyPaid);
    if (due <= 0) continue;

    const appliedToStatement = roundMoney(Math.min(remaining, due));
    const allocation = allocatePaymentToBuckets(appliedToStatement, {
      feesCharged: decimalToNumber(statement.feesCharged),
      interestCharged: decimalToNumber(statement.interestCharged),
      statementBalance,
      feesPaid: decimalToNumber(statement.feesPaid),
      interestPaid: decimalToNumber(statement.interestPaid),
      principalPaid: decimalToNumber(statement.principalPaid),
    });

    const newFeesPaid = roundMoney(decimalToNumber(statement.feesPaid) + allocation.toFees);
    const newInterestPaid = roundMoney(decimalToNumber(statement.interestPaid) + allocation.toInterest);
    const newPrincipalPaid = roundMoney(decimalToNumber(statement.principalPaid) + allocation.toPrincipal);
    const newPaid = roundMoney(alreadyPaid + allocation.totalApplied);
    const newRemaining = calculateRemainingStatementBalance(statementBalance, newPaid);

    const statusCode = deriveStatementStatus(
      statementBalance,
      newPaid,
      statement.status.toLowerCase() as "issued" | "partially_paid" | "paid" | "overdue",
    );

    await tx.altaCardStatement.update({
      where: { id: statement.id },
      data: {
        amountPaid: toDecimal(newPaid),
        feesPaid: toDecimal(newFeesPaid),
        interestPaid: toDecimal(newInterestPaid),
        principalPaid: toDecimal(newPrincipalPaid),
        remainingBalance: toDecimal(newRemaining),
        status: toDbAltaCardStatementStatus(statusCode),
        paidAt: newRemaining <= 0 ? new Date() : null,
      },
    });

    if (allocation.toFees > 0) {
      await tx.altaCardFee.updateMany({
        where: {
          altaCardStatementId: statement.id,
          status: "ACTIVE",
        },
        data: { status: "PAID" },
      });
    }

    if (statusCode === "paid") {
      paidStatementNumbers.push(statement.statementNumber);
    }

    remaining = roundMoney(remaining - allocation.totalApplied);
  }

  await syncCardBillingSummary(tx, altaCardId);

  const { maybeRestoreActiveFromDelinquency } = await import("@/server/alta-card-delinquency.service");
  await maybeRestoreActiveFromDelinquency(tx, altaCardId, actorUserId);

  return paidStatementNumbers;
}

export async function listCardStatements(
  userId: string,
  cardId: string,
): Promise<AltaCardStatementRow[]> {
  const { assertCardAccess } = await import("@/server/alta-card.service");
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  await assertCardAccess(userId, card);

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  const altaUser = userRecord ? mapDbUserToAltaUser(userRecord) : null;
  const isStaffUser = altaUser ? isAdmin(altaUser) || isOperator(altaUser) : false;

  const customerVisibleStatuses = [
    "GENERATED",
    "ISSUED",
    "PAID",
    "PARTIALLY_PAID",
    "OVERDUE",
  ] as const;
  const staffVisibleStatuses = [...customerVisibleStatuses, "VOID"] as const;

  const statements = await prisma.altaCardStatement.findMany({
    where: {
      altaCardId: cardId,
      status: { in: [...(isStaffUser ? staffVisibleStatuses : customerVisibleStatuses)] },
    },
    orderBy: { statementNumber: "desc" },
  });

  return statements.map(mapAltaCardStatementRow);
}

export async function getCardStatementDetail(
  userId: string,
  cardId: string,
  statementId: string,
): Promise<AltaCardStatementDetail> {
  const { assertCardAccess } = await import("@/server/alta-card.service");
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();
  await assertCardAccess(userId, card);

  const statement = await prisma.altaCardStatement.findFirst({
    where: { id: statementId, altaCardId: cardId },
    include: {
      transactions: {
        include: altaCardTransactionInclude,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!statement) notFound();

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  const altaUser = userRecord ? mapDbUserToAltaUser(userRecord) : null;
  const isStaffUser = altaUser ? isAdmin(altaUser) || isOperator(altaUser) : false;
  if (statement.status === "OPEN" && !isStaffUser) notFound();

  let transactions = statement.transactions;
  if (
    statement.status === "GENERATED" ||
    statement.status === "OPEN" ||
    transactions.length === 0
  ) {
    transactions = await findPeriodTransactions(
      cardId,
      statement.billingPeriodStart,
      statement.billingPeriodEnd,
    );
  }

  return mapAltaCardStatementDetail({ ...statement, transactions });
}

export async function generateStatementsForEligibleCards(): Promise<{
  processed: number;
  generated: string[];
  skipped: string[];
}> {
  const now = new Date();
  const cards = await prisma.altaCard.findMany({
    where: {
      status: "ACTIVE",
      nextStatementDate: { lte: now },
      currentStatementId: { not: null },
    },
    select: { id: true, cardLastFour: true },
  });

  const generated: string[] = [];
  const skipped: string[] = [];

  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  let systemActorId: string;
  try {
    systemActorId = await resolveSystemActorUserId();
  } catch {
    return { processed: cards.length, generated: [], skipped: cards.map((c) => c.id) };
  }

  for (const card of cards) {
    try {
      await generateStatement(systemActorId, card.id);
      generated.push(card.id);
    } catch {
      skipped.push(card.id);
    }
  }

  return { processed: cards.length, generated, skipped };
}
