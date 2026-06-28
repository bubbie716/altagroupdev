import type { CustomerRelationshipTimelineEntry } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  extractNewRelationshipTier,
  extractPreviousRelationshipTier,
  formatAltaCardOpenedCustomerCopy,
  formatAltaCardTierUpgradeTimelineCopy,
  formatLoanApprovedTimelineCopy,
  formatRelationshipTierChangedCustomerCopy,
  normalizeLoanFundedTitle,
  resolveAltaCardTierUpgradeFromRow,
  type TimelineRowForEnrichment,
} from "@/lib/bank/relationship-timeline-historical";
import { resolveAltaCardOpeningTiersByCardId } from "@/server/alta-card-timeline.service";
import { prisma } from "@/server/db";

type EnrichmentScope = "personal" | "business";

type EnrichmentContext = {
  openingTiersByCardId: Map<string, AltaCardTierCode>;
  loansById: Map<string, { principalAmount: number }>;
  tierAudits: Array<{
    entityId: string | null;
    createdAt: Date;
    metadata: unknown;
  }>;
};

function decimalToNumber(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function relatedEntityIds(rows: TimelineRowForEnrichment[], eventTypes: string[]): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => eventTypes.includes(row.eventType) && row.relatedEntityId)
        .map((row) => row.relatedEntityId as string),
    ),
  ];
}

export async function loadCustomerTimelineEnrichmentContext(
  rows: TimelineRowForEnrichment[],
): Promise<EnrichmentContext> {
  const cardIds = relatedEntityIds(rows, ["ALTA_CARD_OPENED", "ALTA_CARD_TIER_CHANGED"]);
  const loanIds = relatedEntityIds(rows, ["LOAN_FUNDED", "LOAN_PAID_OFF"]);

  const [openingTiersByCardId, loans, tierAudits] = await Promise.all([
    resolveAltaCardOpeningTiersByCardId(cardIds),
    loanIds.length > 0
      ? prisma.loan.findMany({
          where: { id: { in: loanIds } },
          select: { id: true, principalAmount: true },
        })
      : Promise.resolve([]),
    cardIds.length > 0
      ? prisma.auditLog.findMany({
          where: { action: "ALTA_CARD_TIER_CHANGED", entityId: { in: cardIds } },
          orderBy: { createdAt: "asc" },
          select: { entityId: true, createdAt: true, metadata: true },
        })
      : Promise.resolve([]),
  ]);

  const loansById = new Map<string, { principalAmount: number }>();
  for (const loan of loans) {
    loansById.set(loan.id, { principalAmount: decimalToNumber(loan.principalAmount) });
  }

  return { openingTiersByCardId, loansById, tierAudits };
}

function findTierAuditForRow(
  row: TimelineRowForEnrichment,
  tierAudits: EnrichmentContext["tierAudits"],
) {
  if (!row.relatedEntityId) return null;
  return (
    tierAudits.find(
      (audit) =>
        audit.entityId === row.relatedEntityId &&
        Math.abs(audit.createdAt.getTime() - new Date(row.occurredAt).getTime()) < 60_000,
    ) ?? null
  );
}

function enrichRowCopy(
  row: TimelineRowForEnrichment,
  ctx: EnrichmentContext,
  scope: EnrichmentScope,
): { title: string; description: string | null } {
  const business = scope === "business";

  switch (row.eventType) {
    case "ALTA_CARD_OPENED": {
      if (row.relatedEntityId) {
        const openingTier = ctx.openingTiersByCardId.get(row.relatedEntityId);
        if (openingTier) {
          return formatAltaCardOpenedCustomerCopy(openingTier, { business });
        }
      }
      break;
    }
    case "ALTA_CARD_TIER_CHANGED": {
      const audit = findTierAuditForRow(row, ctx.tierAudits);
      return resolveAltaCardTierUpgradeFromRow(
        row,
        audit?.metadata as Record<string, unknown> | null,
        { business },
      );
    }
    case "LOAN_FUNDED": {
      if (row.relatedEntityId) {
        const loan = ctx.loansById.get(row.relatedEntityId);
        if (loan) {
          return formatLoanApprovedTimelineCopy(loan.principalAmount, { business });
        }
      }
      return {
        title: normalizeLoanFundedTitle(row.title, { business }),
        description: row.description,
      };
    }
    case "RELATIONSHIP_TIER_CHANGED": {
      const tierLabels = business ? COMPANY_RELATIONSHIP_TIER_LABELS : RELATIONSHIP_TIER_LABELS;
      const previousTier = extractPreviousRelationshipTier(row);
      const newTier = extractNewRelationshipTier(row, tierLabels);
      if (newTier) {
        return formatRelationshipTierChangedCustomerCopy(previousTier, newTier, tierLabels, {
          business,
        });
      }
      break;
    }
    default:
      break;
  }

  return { title: row.title, description: row.description };
}

export async function enrichPersonalCustomerTimeline(
  rows: Array<TimelineRowForEnrichment & { id: string }>,
): Promise<CustomerRelationshipTimelineEntry[]> {
  const ctx = await loadCustomerTimelineEnrichmentContext(rows);
  return rows.map((row) => {
    const copy = enrichRowCopy(row, ctx, "personal");
    return {
      id: row.id,
      eventType: row.eventType as CustomerRelationshipTimelineEntry["eventType"],
      title: copy.title,
      description: copy.description,
      occurredAt: row.occurredAt,
    };
  });
}

export async function enrichBusinessCustomerTimeline(
  rows: CompanyRelationshipTimelineEventRow[],
): Promise<CompanyRelationshipTimelineEventRow[]> {
  const ctx = await loadCustomerTimelineEnrichmentContext(rows);
  return rows.map((row) => {
    const copy = enrichRowCopy(row, ctx, "business");
    return { ...row, title: copy.title, description: copy.description };
  });
}
