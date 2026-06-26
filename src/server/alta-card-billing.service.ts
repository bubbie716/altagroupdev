import { applyInterestForDueStatements } from "@/server/alta-card-interest.service";
import {
  applyLateFeesForDueStatements,
  getActiveFeesTotal,
  markOverdueStatements,
} from "@/server/alta-card-fee.service";
import { prisma } from "@/server/db";

export type AltaCardBillingProcessResult = {
  overdueMarked: string[];
  lateFees: Awaited<ReturnType<typeof applyLateFeesForDueStatements>>;
  interest: Awaited<ReturnType<typeof applyInterestForDueStatements>>;
};

/**
 * Monthly billing processor for Alta Card statements.
 * Invoked by `/api/cron/alta-card-billing` and internal scheduler jobs.
 */
export async function processAltaCardBilling(actorUserId?: string): Promise<AltaCardBillingProcessResult> {
  const { marked } = await markOverdueStatements();
  const lateFees = await applyLateFeesForDueStatements(actorUserId);
  const interest = await applyInterestForDueStatements(actorUserId);

  return {
    overdueMarked: marked,
    lateFees,
    interest,
  };
}

export async function getCardBillingSummary(
  userId: string,
  cardId: string,
): Promise<import("@/lib/bank/alta-card-types").AltaCardBillingSummary> {
  const { assertCardAccess } = await import("@/server/alta-card.service");
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("NOT_FOUND");
  await assertCardAccess(userId, card);

  const [activeFeesTotal, overdueCount] = await Promise.all([
    getActiveFeesTotal(cardId),
    prisma.altaCardStatement.count({
      where: { altaCardId: cardId, status: "OVERDUE" },
    }),
  ]);

  return {
    currentBalance: Number(card.currentBalance),
    statementBalance: Number(card.statementBalance),
    minimumPayment: Number(card.minimumPaymentDue),
    paymentDueDate: card.paymentDueDate?.toISOString() ?? null,
    billingPeriodStart: card.currentBillingCycleStart?.toISOString() ?? null,
    billingPeriodEnd: card.currentBillingCycleEnd?.toISOString() ?? null,
    nextStatementDate: card.nextStatementDate?.toISOString() ?? null,
    interestRate: Number(card.interestRate),
    activeFeesTotal,
    hasOverdueStatement: overdueCount > 0,
  };
}
