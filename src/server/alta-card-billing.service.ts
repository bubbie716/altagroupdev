import { applyInterestForDueStatements } from "@/server/alta-card-interest.service";
import {
  applyLateFeesForDueStatements,
  getActiveFeesTotal,
  markOverdueStatements,
} from "@/server/alta-card-fee.service";
import { runAutopayForDueStatements } from "@/server/alta-card-autopay.service";
import { prisma } from "@/server/db";
import { markDelinquentCardsForOverdueStatements } from "@/server/alta-card-delinquency.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";
import type { AltaCardBillingSummary } from "@/lib/bank/alta-card-types";

export type AltaCardBillingProcessResult = {
  autopay: Awaited<ReturnType<typeof runAutopayForDueStatements>>;
  overdueMarked: string[];
  lateFees: Awaited<ReturnType<typeof applyLateFeesForDueStatements>>;
  interest: Awaited<ReturnType<typeof applyInterestForDueStatements>>;
};

/**
 * Monthly billing processor for Alta Card statements.
 * Invoked by `/api/cron/alta-card-billing` and internal scheduler jobs.
 */
export async function processAltaCardBilling(actorUserId?: string): Promise<AltaCardBillingProcessResult> {
  const actor = actorUserId ?? (await resolveSystemActorUserId());
  const autopay = await runAutopayForDueStatements(actor);
  const { marked } = await markOverdueStatements();
  await markDelinquentCardsForOverdueStatements(marked, actor);
  const lateFees = await applyLateFeesForDueStatements(actor);
  const interest = await applyInterestForDueStatements(actor);

  return {
    autopay,
    overdueMarked: marked,
    lateFees,
    interest,
  };
}

function earliestIsoDate(values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => !!value).sort();
  return dates[0] ?? null;
}

async function buildCardBillingSummary(
  userId: string,
  cardId: string,
): Promise<AltaCardBillingSummary> {
  const { assertCardAccess } = await import("@/server/alta-card.service");
  const { resolveAltaCardBillingDates } = await import("@/server/alta-card-statement.service");

  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("NOT_FOUND");
  await assertCardAccess(userId, card);

  const [activeFeesTotal, overdueCount, billingDates] = await Promise.all([
    getActiveFeesTotal(cardId),
    prisma.altaCardStatement.count({
      where: { altaCardId: cardId, status: "OVERDUE" },
    }),
    resolveAltaCardBillingDates(prisma, cardId),
  ]);

  return {
    currentBalance: Number(card.currentBalance),
    statementBalance: Number(card.statementBalance),
    minimumPayment: Number(card.minimumPaymentDue),
    paymentDueDate: billingDates.paymentDueDate?.toISOString() ?? null,
    billingPeriodStart: billingDates.billingPeriodStart?.toISOString() ?? null,
    billingPeriodEnd: billingDates.billingPeriodEnd?.toISOString() ?? null,
    nextStatementDate: billingDates.nextStatementDate?.toISOString() ?? null,
    interestRate: Number(card.interestRate),
    activeFeesTotal,
    hasOverdueStatement: overdueCount > 0,
  };
}

export async function getCardBillingSummary(
  userId: string,
  cardId: string,
): Promise<AltaCardBillingSummary> {
  return buildCardBillingSummary(userId, cardId);
}

/** Aggregates billing dates across all active company business cards. */
export async function getCompanyBillingSummary(
  userId: string,
  companyId: string,
): Promise<AltaCardBillingSummary | null> {
  const { assertCompanyAltaCardViewAccess } = await import("@/server/alta-card.service");

  await assertCompanyAltaCardViewAccess(userId, companyId);

  const cards = await prisma.altaCard.findMany({
    where: { companyId, cardType: "BUSINESS", status: { not: "CLOSED" } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (cards.length === 0) return null;

  const summaries = await Promise.all(
    cards.map((card) => buildCardBillingSummary(userId, card.id)),
  );

  const primary = summaries[0]!;

  return {
    currentBalance: summaries.reduce((sum, row) => sum + row.currentBalance, 0),
    statementBalance: summaries.reduce((sum, row) => sum + row.statementBalance, 0),
    minimumPayment: summaries.reduce((sum, row) => sum + row.minimumPayment, 0),
    paymentDueDate: earliestIsoDate(summaries.map((row) => row.paymentDueDate)),
    billingPeriodStart: primary.billingPeriodStart,
    billingPeriodEnd: earliestIsoDate(summaries.map((row) => row.billingPeriodEnd)),
    nextStatementDate: earliestIsoDate(summaries.map((row) => row.nextStatementDate)),
    interestRate: primary.interestRate,
    activeFeesTotal: summaries.reduce((sum, row) => sum + row.activeFeesTotal, 0),
    hasOverdueStatement: summaries.some((row) => row.hasOverdueStatement),
  };
}
