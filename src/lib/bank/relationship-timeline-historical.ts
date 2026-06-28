import { florin } from "@/lib/bank/api";
import {
  altaCardTierLabel,
  formatAltaCardTierUpgradeDescription,
  type AltaCardTierCode,
} from "@/lib/bank/alta-card-types";
import { formatAltaCardOpenedTimelineCopy } from "@/lib/bank/alta-card-timeline.helpers";

export type TimelineCopy = {
  title: string;
  description: string | null;
};

export type TimelineRowForEnrichment = {
  id?: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
};

function altaCardTierShortLabel(tier: string): string {
  return altaCardTierLabel(tier).replace(/^Alta\s+/i, "");
}

export function extractTierPairFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { previousTier: string | null; newTier: string | null } {
  if (!metadata) return { previousTier: null, newTier: null };
  const previousTier =
    typeof metadata.previousTier === "string"
      ? metadata.previousTier
      : typeof metadata.oldTier === "string"
        ? metadata.oldTier
        : typeof metadata.oldValue === "string"
          ? metadata.oldValue
          : null;
  const newTier =
    typeof metadata.newTier === "string"
      ? metadata.newTier
      : typeof metadata.newValue === "string"
        ? metadata.newValue
        : null;
  return { previousTier, newTier };
}

export function formatAltaCardTierUpgradeTimelineCopy(
  previousTier: string | null | undefined,
  newTier: string | null | undefined,
  options?: { business?: boolean },
): TimelineCopy {
  const prefix = options?.business ? "Business Alta Card" : "Alta Card";
  const newShort = newTier ? altaCardTierShortLabel(newTier) : null;
  const prevLabel = previousTier ? altaCardTierLabel(previousTier) : null;
  return {
    title: newShort ? `${prefix} tier upgraded to ${newShort}` : `${prefix} tier upgraded`,
    description: prevLabel ? `Previously ${prevLabel}.` : null,
  };
}

export function formatAltaCardOpenedCustomerCopy(
  openingTier: AltaCardTierCode,
  options?: { business?: boolean },
): TimelineCopy {
  return formatAltaCardOpenedTimelineCopy(openingTier, options);
}

export function formatLoanApprovedTimelineCopy(
  principalAmount: number,
  options?: { business?: boolean },
): TimelineCopy {
  return {
    title: options?.business
      ? `Business loan approved (${florin(principalAmount)})`
      : `Loan approved (${florin(principalAmount)})`,
    description: null,
  };
}

export function formatRelationshipTierChangedCustomerCopy(
  previousTier: string | null,
  newTier: string,
  tierLabels: Record<string, string>,
  options?: { business?: boolean },
): TimelineCopy {
  const prefix = options?.business ? "Company relationship tier" : "Relationship tier";
  const newLabel = tierLabels[newTier] ?? newTier;
  const prevLabel = previousTier ? (tierLabels[previousTier] ?? previousTier) : null;
  return {
    title: `${prefix} upgraded to ${newLabel}`,
    description: prevLabel ? `Previously ${prevLabel}.` : null,
  };
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

export function extractNewRelationshipTier(
  row: TimelineRowForEnrichment,
  tierLabels: Record<string, string>,
): string | null {
  const fromMeta = extractTierPairFromMetadata(row.metadata);
  if (fromMeta.newTier) return fromMeta.newTier;
  for (const [code, label] of Object.entries(tierLabels)) {
    if (row.title.includes(label)) return code;
  }
  const toMatch = row.title.match(/(?:upgraded|changed) to\s+(.+?)$/i);
  if (toMatch) return toMatch[1].trim();
  return null;
}

export function resolveAltaCardTierUpgradeFromRow(
  row: TimelineRowForEnrichment,
  auditMetadata?: Record<string, unknown> | null,
  options?: { business?: boolean },
): TimelineCopy {
  const fromRow = extractTierPairFromMetadata(row.metadata);
  const fromAudit = extractTierPairFromMetadata(auditMetadata);
  const previousTier = fromRow.previousTier ?? fromAudit.previousTier;
  const newTier = fromRow.newTier ?? fromAudit.newTier;

  if (previousTier || newTier) {
    return formatAltaCardTierUpgradeTimelineCopy(previousTier, newTier, options);
  }

  return {
    title: row.title.replace(/tier changed to/i, "tier upgraded to"),
    description: row.description,
  };
}

export function normalizeLoanFundedTitle(title: string, options?: { business?: boolean }): string {
  if (options?.business) {
    return title.replace(/^Business loan funded/i, "Business loan approved");
  }
  return title.replace(/^Loan funded/i, "Loan approved");
}
