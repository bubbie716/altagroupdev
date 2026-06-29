import type { RelationshipTimelineEventRow } from "@/lib/bank/relationship-intelligence-types";
import { prisma } from "@/server/db";

/** Drop company-scoped product events from a user's personal timeline (including legacy rows). */
export async function excludeBusinessScopedPersonalTimelineRows(
  rows: RelationshipTimelineEventRow[],
): Promise<RelationshipTimelineEventRow[]> {
  if (rows.length === 0) return rows;

  const cardIds = new Set<string>();
  const loanIds = new Set<string>();
  const bankAccountIds = new Set<string>();
  const loanApplicationIds = new Set<string>();

  for (const row of rows) {
    if (!row.relatedEntityId) continue;
    switch (row.relatedEntityType) {
      case "ALTA_CARD":
        cardIds.add(row.relatedEntityId);
        break;
      case "LOAN":
        loanIds.add(row.relatedEntityId);
        break;
      case "BANK_ACCOUNT":
        bankAccountIds.add(row.relatedEntityId);
        break;
      case "LOAN_APPLICATION":
        loanApplicationIds.add(row.relatedEntityId);
        break;
    }
  }

  const [cards, loans, bankAccounts, loanApplications] = await Promise.all([
    cardIds.size
      ? prisma.altaCard.findMany({
          where: { id: { in: [...cardIds] } },
          select: { id: true, companyId: true },
        })
      : [],
    loanIds.size
      ? prisma.loan.findMany({
          where: { id: { in: [...loanIds] } },
          select: { id: true, companyId: true },
        })
      : [],
    bankAccountIds.size
      ? prisma.bankAccount.findMany({
          where: { id: { in: [...bankAccountIds] } },
          select: { id: true, companyId: true },
        })
      : [],
    loanApplicationIds.size
      ? prisma.loanApplication.findMany({
          where: { id: { in: [...loanApplicationIds] } },
          select: { id: true, companyId: true },
        })
      : [],
  ]);

  const businessIdsByEntityType = {
    ALTA_CARD: new Set(cards.filter((card) => card.companyId).map((card) => card.id)),
    LOAN: new Set(loans.filter((loan) => loan.companyId).map((loan) => loan.id)),
    BANK_ACCOUNT: new Set(
      bankAccounts.filter((account) => account.companyId).map((account) => account.id),
    ),
    LOAN_APPLICATION: new Set(
      loanApplications.filter((application) => application.companyId).map((application) => application.id),
    ),
  } as const;

  return rows.filter((row) => {
    if (row.eventType === "BUSINESS_ACCOUNT_OPENED") return false;
    if (!row.relatedEntityId || !row.relatedEntityType) return true;
    const businessIds =
      businessIdsByEntityType[row.relatedEntityType as keyof typeof businessIdsByEntityType];
    return !businessIds?.has(row.relatedEntityId);
  });
}
