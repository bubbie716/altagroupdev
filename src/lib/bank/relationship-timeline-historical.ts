import { type AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { formatAltaCardOpenedTimelineCopy } from "@/lib/bank/alta-card-timeline.helpers";
import {
  extractTierPairFromMetadata,
  formatAltaCardLimitIncreasedCopy,
  formatAltaCardRateReducedCopy,
  formatAltaCardUpgradedCopy,
  formatLoanApprovedCopy,
  formatRelationshipTierOutcomeCopy,
  polishCustomerTimelineCopy,
  type CustomerTimelineScope,
  type TimelineCopy,
  type TimelineRowForEnrichment,
} from "@/lib/bank/relationship-timeline-customer-copy";

export type { TimelineCopy, TimelineRowForEnrichment } from "@/lib/bank/relationship-timeline-customer-copy";
export {
  extractNewRelationshipTier,
  extractTierPairFromMetadata,
} from "@/lib/bank/relationship-timeline-customer-copy";

export function formatAltaCardTierUpgradeTimelineCopy(
  _previousTier: string | null | undefined,
  newTier: string | null | undefined,
  options?: { business?: boolean },
): TimelineCopy {
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return formatAltaCardUpgradedCopy(newTier, scope);
}

export function formatAltaCardLimitIncreaseTimelineCopy(
  previousLimit: number | null | undefined,
  newLimit: number | null | undefined,
  options?: { business?: boolean },
): TimelineCopy {
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return formatAltaCardLimitIncreasedCopy(previousLimit, newLimit, scope);
}

export function formatAltaCardRateReductionTimelineCopy(
  previousRate: number | null | undefined,
  newRate: number | null | undefined,
  options?: { business?: boolean },
): TimelineCopy {
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return formatAltaCardRateReducedCopy(previousRate, newRate, scope);
}

export function formatAltaCardOpenedCustomerCopy(
  openingTier: AltaCardTierCode,
  options?: { business?: boolean },
): TimelineCopy {
  return formatAltaCardOpenedTimelineCopy(openingTier, options);
}

export function formatLoanApprovedTimelineCopy(
  _principalAmount?: number,
  options?: { business?: boolean },
): TimelineCopy {
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return formatLoanApprovedCopy(scope);
}

export function formatRelationshipTierChangedCustomerCopy(
  _previousTier: string | null,
  newTier: string,
  tierLabels: Record<string, string>,
  options?: { business?: boolean },
): TimelineCopy {
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return formatRelationshipTierOutcomeCopy(newTier, tierLabels, scope);
}

export function extractPreviousRelationshipTier(row: TimelineRowForEnrichment): string | null {
  const fromMeta = extractTierPairFromMetadata(row.metadata);
  if (fromMeta.previousTier) return fromMeta.previousTier;
  if (row.description && /previously/i.test(row.description)) {
    const match = row.description.match(/Previously\s+(.+?)\.?$/i);
    if (match) return match[1].trim();
  }
  const legacy = row.description?.match(/Previous tier:\s*(.+?)\.?$/i);
  if (legacy) return legacy[1].trim();
  const upgradedFrom = row.description?.match(/Upgraded from\s+(.+?)\s+to/i);
  if (upgradedFrom) return upgradedFrom[1].trim();
  return null;
}

export function resolveAltaCardTierUpgradeFromRow(
  row: TimelineRowForEnrichment,
  auditMetadata?: Record<string, unknown> | null,
  options?: { business?: boolean },
): TimelineCopy {
  const fromRow = extractTierPairFromMetadata(row.metadata);
  const fromAudit = extractTierPairFromMetadata(auditMetadata);
  const newTier = fromRow.newTier ?? fromAudit.newTier;
  const scope: CustomerTimelineScope = options?.business ? "business" : "personal";
  return polishCustomerTimelineCopy(row, scope, formatAltaCardUpgradedCopy(newTier, scope));
}

export function normalizeLoanFundedTitle(title: string, options?: { business?: boolean }): string {
  if (options?.business) {
    return title.replace(/^Business loan (funded|approved)(.*)$/i, "Business Loan Approved");
  }
  return title.replace(/^Loan (funded|approved)(.*)$/i, "Loan Approved");
}
