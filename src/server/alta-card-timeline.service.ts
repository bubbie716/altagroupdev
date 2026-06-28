import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  firstTierChangePreviousTier,
  resolveAltaCardOpeningTierCode,
} from "@/lib/bank/alta-card-timeline.helpers";
import { prisma } from "@/server/db";

export async function resolveAltaCardOpeningTiersByCardId(
  cardIds: string[],
): Promise<Map<string, AltaCardTierCode>> {
  const uniqueIds = [...new Set(cardIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const [cards, tierAudits] = await Promise.all([
    prisma.altaCard.findMany({
      where: { id: { in: uniqueIds } },
      include: { application: { select: { approvedTier: true, requestedTier: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: "ALTA_CARD_TIER_CHANGED", entityId: { in: uniqueIds } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const firstAuditByCard = new Map<string, (typeof tierAudits)[number]>();
  for (const audit of tierAudits) {
    if (audit.entityId && !firstAuditByCard.has(audit.entityId)) {
      firstAuditByCard.set(audit.entityId, audit);
    }
  }

  const result = new Map<string, AltaCardTierCode>();
  for (const card of cards) {
    const audit = firstAuditByCard.get(card.id);
    result.set(
      card.id,
      resolveAltaCardOpeningTierCode({
        currentTier: card.tier,
        approvedTier: card.application?.approvedTier ?? null,
        requestedTier: card.application?.requestedTier ?? null,
        firstTierChangePreviousTier: firstTierChangePreviousTier(
          audit?.metadata as Record<string, unknown> | null,
        ),
      }),
    );
  }

  return result;
}
