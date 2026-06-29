import type { RelationshipTimelineEventTypeCode } from "@/lib/bank/relationship-intelligence-types";
import { formatAltaCardTierUpgradeDescription } from "@/lib/bank/alta-card-types";

export function customerAltaCardTierUpgradeDescription(row: {
  description: string | null;
  metadata: Record<string, unknown> | null;
}): string | null {
  const meta = row.metadata;
  const previousTier =
    typeof meta?.previousTier === "string"
      ? meta.previousTier
      : typeof meta?.oldTier === "string"
        ? meta.oldTier
        : typeof meta?.oldValue === "string"
          ? meta.oldValue
          : null;
  const newTier =
    typeof meta?.newTier === "string"
      ? meta.newTier
      : typeof meta?.newValue === "string"
        ? meta.newValue
        : null;
  const formatted = formatAltaCardTierUpgradeDescription(previousTier, newTier);
  if (formatted) return formatted;
  if (row.description && /previous|previously|upgraded from/i.test(row.description)) {
    return row.description;
  }
  const previousOnly = row.description?.match(/^Previous tier:\s*(.+?)\.?$/i);
  if (previousOnly) {
    return `Previously ${previousOnly[1].trim()}.`;
  }
  return row.description;
}

export function resolveAltaCardTierUpgradeDescription(
  row: {
    description: string | null;
    metadata: Record<string, unknown> | null;
  },
  auditMetadata?: Record<string, unknown> | null,
): string | null {
  const fromRow = customerAltaCardTierUpgradeDescription(row);
  if (fromRow && /from|Previously/i.test(fromRow)) return fromRow;

  const audit = auditMetadata ?? null;
  const previousTier =
    typeof audit?.previousTier === "string"
      ? audit.previousTier
      : typeof audit?.oldValue === "string"
        ? audit.oldValue
        : null;
  const newTier = typeof audit?.newTier === "string" ? audit.newTier : null;
  const fromAudit = formatAltaCardTierUpgradeDescription(previousTier, newTier);
  if (fromAudit) return fromAudit;

  return fromRow;
}

export function timelineEventTypeLabel(type: RelationshipTimelineEventTypeCode): string {
  const labels: Record<RelationshipTimelineEventTypeCode, string> = {
    RELATIONSHIP_STARTED: "Relationship Established",
    BANK_ACCOUNT_OPENED: "Bank Account Opened",
    BUSINESS_ACCOUNT_OPENED: "Business Account Opened",
    DEPOSIT_MILESTONE: "Deposit Milestone",
    WITHDRAWAL_MILESTONE: "Withdrawal Milestone",
    ALTA_PAY_MILESTONE: "Alta Pay Milestone",
    ALTA_CARD_OPENED: "Alta Card Opened",
    ALTA_CARD_TIER_CHANGED: "Alta Card Upgraded",
    ALTA_CARD_LIMIT_CHANGED: "Alta Card Limit Updated",
    ALTA_CARD_PAID_ON_TIME: "Alta Card Payment Received",
    ALTA_CARD_DELINQUENT: "Alta Card Past Due",
    LOAN_APPLICATION_SUBMITTED: "Loan Application Submitted",
    LOAN_ACCEPTED: "Loan Application Approved",
    LOAN_DENIED: "Loan Application Denied",
    LOAN_FUNDED: "Loan Approved",
    LOAN_PAYMENT_MADE: "Loan Payment Received",
    LOAN_PAID_OFF: "Loan Fully Repaid",
    PRIVATE_BANKING_ELIGIBLE: "Private Banking Invitation",
    PRIVATE_BANKING_CLIENT: "Alta Private Activated",
    RELATIONSHIP_SCORE_CHANGED: "Relationship Score Updated",
    RELATIONSHIP_TIER_CHANGED: "Relationship Tier Upgraded",
    MANUAL_NOTE: "Relationship Note",
  };
  return labels[type];
}

export type TimelineEntityLink = {
  to: string;
  params?: Record<string, string>;
  label: string;
};

export function timelineEntityLink(
  relatedEntityType: string | null,
  relatedEntityId: string | null,
): TimelineEntityLink | null {
  if (!relatedEntityType || !relatedEntityId) return null;
  switch (relatedEntityType) {
    case "BANK_ACCOUNT":
      return {
        to: "/internal/bank/accounts/$accountId",
        params: { accountId: relatedEntityId },
        label: "View account",
      };
    case "ALTA_CARD":
      return {
        to: "/internal/alta-card/$cardId",
        params: { cardId: relatedEntityId },
        label: "View card",
      };
    case "LOAN":
      return {
        to: "/internal/lending/loans/$loanId",
        params: { loanId: relatedEntityId },
        label: "View loan",
      };
    case "LOAN_APPLICATION":
      return {
        to: "/internal/lending/applications/$applicationId/thread",
        params: { applicationId: relatedEntityId },
        label: "View application",
      };
    case "USER":
      return {
        to: "/internal/users/$userId",
        params: { userId: relatedEntityId },
        label: "View user",
      };
    default:
      return null;
  }
}

function parseFlorinAmountFromCopy(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d{2})?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Extract milestone threshold from metadata or title for stable timeline ordering. */
export function extractTimelineMilestoneThreshold(row: {
  eventType: RelationshipTimelineEventTypeCode;
  title: string;
  metadata: Record<string, unknown> | null;
}): number | null {
  const meta = row.metadata;
  if (typeof meta?.threshold === "number" && Number.isFinite(meta.threshold)) {
    return meta.threshold;
  }

  if (
    row.eventType === "DEPOSIT_MILESTONE" ||
    row.eventType === "WITHDRAWAL_MILESTONE" ||
    row.eventType === "ALTA_PAY_MILESTONE"
  ) {
    return parseFlorinAmountFromCopy(row.title);
  }

  return null;
}

type TimelineSortRow = {
  occurredAt: string;
  createdAt?: string;
  eventType: RelationshipTimelineEventTypeCode;
  title: string;
  metadata?: Record<string, unknown> | null;
};

/** Newest first; tie-break same-day milestones by threshold (highest first). */
export function sortTimelineEventsNewestFirst<T extends TimelineSortRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.occurredAt).getTime();
    const bTime = new Date(b.occurredAt).getTime();
    if (bTime !== aTime) return bTime - aTime;

    const aThreshold = extractTimelineMilestoneThreshold({
      eventType: a.eventType,
      title: a.title,
      metadata: a.metadata ?? null,
    });
    const bThreshold = extractTimelineMilestoneThreshold({
      eventType: b.eventType,
      title: b.title,
      metadata: b.metadata ?? null,
    });
    if (aThreshold != null && bThreshold != null && bThreshold !== aThreshold) {
      return bThreshold - aThreshold;
    }

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bCreated !== aCreated) return bCreated - aCreated;

    return 0;
  });
}
