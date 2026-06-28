import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";

/**
 * When statements become overdue, promote eligible cards to DELINQUENT.
 * Does not override FROZEN, CLOSED, LOST, PENDING, or EXPIRED.
 */
export async function markDelinquentCardsForOverdueStatements(
  overdueStatementIds: string[],
  actorUserId: string,
): Promise<string[]> {
  if (overdueStatementIds.length === 0) return [];

  const statements = await prisma.altaCardStatement.findMany({
    where: { id: { in: overdueStatementIds } },
    select: { altaCardId: true },
  });
  const cardIds = [...new Set(statements.map((s) => s.altaCardId))];
  const marked: string[] = [];

  for (const cardId of cardIds) {
    const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
    if (!card || card.status !== "ACTIVE") continue;

    await prisma.altaCard.update({
      where: { id: cardId },
      data: { status: "DELINQUENT" },
    });

    await writeAuditLog({
      actorUserId,
      action: "ALTA_CARD_STATUS_CHANGED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      targetUserId: card.ownerUserId,
      targetCompanyId: card.companyId ?? undefined,
      description: "Card marked delinquent due to overdue statement.",
      metadata: {
        previousStatus: "ACTIVE",
        newStatus: "DELINQUENT",
        trigger: "overdue_statement",
        actorType: actorUserId === "alta-system-cron" ? "SYSTEM" : undefined,
      },
    });

    marked.push(cardId);

    const { refreshFromAltaCardContextBestEffort } = await import(
      "@/server/relationship-refresh-hooks.service"
    );
    await refreshFromAltaCardContextBestEffort(
      { ownerUserId: card.ownerUserId, companyId: card.companyId },
      "alta-card-delinquency-changed",
    );
  }

  return marked;
}

/**
 * Restore DELINQUENT → ACTIVE when no overdue statements remain.
 * Does not override manual FROZEN, CLOSED, or LOST.
 */
export async function maybeRestoreActiveFromDelinquency(
  tx: Prisma.TransactionClient,
  cardId: string,
  actorUserId: string,
): Promise<boolean> {
  const card = await tx.altaCard.findUnique({ where: { id: cardId } });
  if (!card || card.status !== "DELINQUENT") return false;

  const overdueCount = await tx.altaCardStatement.count({
    where: {
      altaCardId: cardId,
      status: "OVERDUE",
      remainingBalance: { gt: 0 },
    },
  });
  if (overdueCount > 0) return false;

  await tx.altaCard.update({
    where: { id: cardId },
    data: { status: "ACTIVE" },
  });

  await writeAuditLog({
    actorUserId,
    action: "ALTA_CARD_STATUS_CHANGED",
    entityType: "ALTA_CARD",
    entityId: cardId,
    targetUserId: card.ownerUserId,
    targetCompanyId: card.companyId ?? undefined,
    description: "Card restored to active — overdue statements resolved.",
    metadata: {
      previousStatus: "DELINQUENT",
      newStatus: "ACTIVE",
      trigger: "overdue_cleared",
    },
  });

  const { refreshFromAltaCardContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
  await refreshFromAltaCardContextBestEffort(
    { ownerUserId: card.ownerUserId, companyId: card.companyId },
    "alta-card-delinquency-cleared",
  );

  return true;
}
