import type { CustomerRelationshipTimelineEntry } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import { isCustomerVisibleCompanyTimelineEvent } from "@/lib/bank/company-relationship-timeline-config";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import { CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES } from "@/lib/bank/relationship-timeline-config";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  extractNewRelationshipTier,
  formatAltaCardOpenedCustomerCopy,
  formatLoanApprovedTimelineCopy,
  formatRelationshipTierChangedCustomerCopy,
  normalizeLoanFundedTitle,
  resolveAltaCardTierUpgradeFromRow,
  type TimelineRowForEnrichment,
} from "@/lib/bank/relationship-timeline-historical";
import {
  polishCustomerTimelineCopy,
  resolveCustomerTimelineCopy,
} from "@/lib/bank/relationship-timeline-customer-copy";
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

export function resolveEnrichedCustomerTimelineCopy(
  row: TimelineRowForEnrichment,
  ctx: EnrichmentContext,
  scope: EnrichmentScope,
): { title: string; description: string | null } {
  const business = scope === "business";
  let copy: { title: string; description: string | null };

  switch (row.eventType) {
    case "ALTA_CARD_OPENED": {
      if (row.relatedEntityId) {
        const openingTier = ctx.openingTiersByCardId.get(row.relatedEntityId);
        if (openingTier) {
          copy = formatAltaCardOpenedCustomerCopy(openingTier, { business });
          break;
        }
      }
      copy = resolveCustomerTimelineCopy(row, scope);
      break;
    }
    case "ALTA_CARD_TIER_CHANGED": {
      const audit = findTierAuditForRow(row, ctx.tierAudits);
      copy = resolveAltaCardTierUpgradeFromRow(
        row,
        audit?.metadata as Record<string, unknown> | null,
        { business },
      );
      break;
    }
    case "LOAN_FUNDED": {
      copy = formatLoanApprovedTimelineCopy(undefined, { business });
      break;
    }
    case "RELATIONSHIP_TIER_CHANGED": {
      const tierLabels = business ? COMPANY_RELATIONSHIP_TIER_LABELS : RELATIONSHIP_TIER_LABELS;
      const newTier = extractNewRelationshipTier(row, tierLabels);
      copy = newTier
        ? formatRelationshipTierChangedCustomerCopy(null, newTier, tierLabels, { business })
        : resolveCustomerTimelineCopy(row, scope);
      break;
    }
    default:
      copy = resolveCustomerTimelineCopy(row, scope);
  }

  return polishCustomerTimelineCopy(row, scope, copy);
}

function mapPersonalTimelineRow(row: {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: Date;
  relatedEntityId: string | null;
  metadata: unknown;
}): TimelineRowForEnrichment & { id: string } {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
    relatedEntityId: row.relatedEntityId,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

/** Rewrite stored customer-visible timeline rows with premium copy. */
export async function refreshStoredPersonalTimelineCopy(userId: string): Promise<number> {
  const rows = await prisma.relationshipTimelineEvent.findMany({
    where: { userId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  const visible = rows
    .filter((row) => CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES.has(row.eventType as never))
    .map(mapPersonalTimelineRow);
  if (visible.length === 0) return 0;

  const ctx = await loadCustomerTimelineEnrichmentContext(visible);
  let updated = 0;

  for (const row of visible) {
    const copy = resolveEnrichedCustomerTimelineCopy(row, ctx, "personal");
    if (copy.title !== row.title || copy.description !== row.description) {
      await prisma.relationshipTimelineEvent.update({
        where: { id: row.id },
        data: { title: copy.title, description: copy.description },
      });
      updated += 1;
    }
  }

  return updated;
}

/** Rewrite stored customer-visible company timeline rows with premium copy. */
export async function refreshStoredCompanyTimelineCopy(companyId: string): Promise<number> {
  const rows = await prisma.companyRelationshipTimelineEvent.findMany({
    where: { companyId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  const visible = rows
    .filter((row) => isCustomerVisibleCompanyTimelineEvent({ eventType: row.eventType as never }))
    .map((row) => ({
      id: row.id,
      eventType: row.eventType,
      title: row.title,
      description: row.description,
      occurredAt: row.occurredAt.toISOString(),
      relatedEntityId: row.relatedEntityId,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    }));
  if (visible.length === 0) return 0;

  const ctx = await loadCustomerTimelineEnrichmentContext(visible);
  let updated = 0;

  for (const row of visible) {
    const copy = resolveEnrichedCustomerTimelineCopy(row, ctx, "business");
    if (copy.title !== row.title || copy.description !== row.description) {
      await prisma.companyRelationshipTimelineEvent.update({
        where: { id: row.id },
        data: { title: copy.title, description: copy.description },
      });
      updated += 1;
    }
  }

  return updated;
}

export async function enrichPersonalCustomerTimeline(
  rows: Array<TimelineRowForEnrichment & { id: string }>,
): Promise<CustomerRelationshipTimelineEntry[]> {
  const ctx = await loadCustomerTimelineEnrichmentContext(rows);
  return rows.map((row) => {
    const copy = resolveEnrichedCustomerTimelineCopy(row, ctx, "personal");
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
    const copy = resolveEnrichedCustomerTimelineCopy(row, ctx, "business");
    return { ...row, title: copy.title, description: copy.description };
  });
}
