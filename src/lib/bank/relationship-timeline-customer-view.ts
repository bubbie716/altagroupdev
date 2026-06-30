import type { RelationshipTimelineEventTypeCode } from "@/lib/bank/relationship-intelligence-types";
import { sortTimelineEventsNewestFirst } from "@/lib/bank/relationship-timeline-display";

/** Internal tiers that have dedicated program events — not shown as relationship tier changes. */
const PROGRAM_TIER_CODES = new Set([
  "PRIVATE_ELIGIBLE",
  "PRIVATE_CLIENT",
  "COMMERCIAL_ELIGIBLE",
]);

export type CustomerTimelineRow = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
  createdAt?: string;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function tierPairFromMetadata(meta: Record<string, unknown> | null | undefined): {
  oldTier: string | null;
  newTier: string | null;
} {
  if (!meta) return { oldTier: null, newTier: null };
  const oldTier =
    typeof meta.oldTier === "string"
      ? meta.oldTier
      : typeof meta.previousTier === "string"
        ? meta.previousTier
        : null;
  const newTier = typeof meta.newTier === "string" ? meta.newTier : null;
  return { oldTier, newTier };
}

function normalizeDedupeKey(row: CustomerTimelineRow): string | null {
  const meta = row.metadata;
  const stored = typeof meta?.dedupeKey === "string" ? meta.dedupeKey : null;
  if (stored?.startsWith("audit:relationship-tier:")) {
    const { oldTier, newTier } = tierPairFromMetadata(meta);
    if (oldTier && newTier) return `tier:${oldTier}->${newTier}`;
  }
  return stored;
}

/** Stable key for collapsing duplicate rows that describe the same customer moment. */
export function customerTimelineSemanticKey(row: CustomerTimelineRow): string {
  const normalized = normalizeDedupeKey(row);
  if (normalized?.startsWith("loan:funded:") || normalized?.startsWith("loan:paidoff:")) {
    return normalized;
  }

  if (row.eventType === "LOAN_FUNDED" && row.relatedEntityId) {
    return `loan:funded:${row.relatedEntityId}`;
  }
  if (row.eventType === "LOAN_PAID_OFF" && row.relatedEntityId) {
    return `loan:paidoff:${row.relatedEntityId}`;
  }

  if (normalized) return normalized;

  const meta = row.metadata;
  const { oldTier, newTier } = tierPairFromMetadata(meta ?? null);

  if (row.eventType === "RELATIONSHIP_TIER_CHANGED") {
    if (oldTier && newTier) return `tier:${oldTier}->${newTier}`;
    if (newTier) return `tier:->${newTier}`;
  }

  if (
    row.eventType === "DEPOSIT_MILESTONE" ||
    row.eventType === "WITHDRAWAL_MILESTONE" ||
    row.eventType === "ALTA_PAY_MILESTONE"
  ) {
    const kind =
      typeof meta?.milestoneKind === "string" ? meta.milestoneKind : row.eventType;
    const threshold = meta?.threshold;
    if (typeof threshold === "number") return `milestone:${kind}:${threshold}`;
  }

  if (row.relatedEntityId) {
    return `${row.eventType}:${row.relatedEntityId}`;
  }

  const day = row.occurredAt.slice(0, 10);
  return `${row.eventType}:${row.title}:${day}`;
}

export function shouldIncludeCustomerTimelineRow(row: CustomerTimelineRow): boolean {
  if (row.eventType !== "RELATIONSHIP_TIER_CHANGED") return true;

  const { newTier } = tierPairFromMetadata(row.metadata ?? null);
  if (!newTier || newTier === "NEW") return false;
  if (PROGRAM_TIER_CODES.has(newTier)) return false;

  return true;
}

function duplicateRowRank(row: CustomerTimelineRow): number {
  const dedupeKey = normalizeDedupeKey(row) ?? row.metadata?.dedupeKey;
  if (typeof dedupeKey === "string") {
    if (dedupeKey.startsWith("tier:")) return 3;
    if (dedupeKey.startsWith("milestone:")) return 3;
    if (dedupeKey.startsWith("private:") || dedupeKey.startsWith("commercial:")) return 3;
    if (dedupeKey.startsWith("audit:")) return 1;
  }

  switch (row.eventType as RelationshipTimelineEventTypeCode) {
    case "PRIVATE_BANKING_CLIENT":
    case "PRIVATE_BANKING_ELIGIBLE":
    case "ALTA_PRIVATE_INVITED":
    case "COMMERCIAL_BANKING_ELIGIBLE":
      return 4;
    case "RELATIONSHIP_TIER_CHANGED":
      return 2;
    default:
      return 2;
  }
}

function pickPreferredDuplicate(current: CustomerTimelineRow, candidate: CustomerTimelineRow): CustomerTimelineRow {
  const rankDiff = duplicateRowRank(candidate) - duplicateRowRank(current);
  if (rankDiff !== 0) return rankDiff > 0 ? candidate : current;

  const candidateTime = new Date(candidate.occurredAt).getTime();
  const currentTime = new Date(current.occurredAt).getTime();
  if (candidateTime !== currentTime) {
    return candidateTime < currentTime ? candidate : current;
  }

  const candidateCreated = candidate.createdAt ? new Date(candidate.createdAt).getTime() : 0;
  const currentCreated = current.createdAt ? new Date(current.createdAt).getTime() : 0;
  return candidateCreated < currentCreated ? candidate : current;
}

/** Remove redundant rows and keep the best representative per semantic moment. */
export function dedupeCustomerTimelineRows<T extends CustomerTimelineRow>(rows: T[]): T[] {
  const included = rows.filter(shouldIncludeCustomerTimelineRow);
  const bestByKey = new Map<string, T>();

  for (const row of included) {
    const key = customerTimelineSemanticKey(row);
    const existing = bestByKey.get(key);
    bestByKey.set(key, existing ? pickPreferredDuplicate(existing, row) : row);
  }

  const deduped = [...bestByKey.values()];
  return sortTimelineEventsNewestFirst(
    deduped.map((row) => ({
      ...row,
      eventType: row.eventType as RelationshipTimelineEventTypeCode,
    })),
  ) as T[];
}

export function customerTimelineRowIdsToRemove<T extends CustomerTimelineRow>(rows: T[]): string[] {
  const included = rows.filter(shouldIncludeCustomerTimelineRow);
  const bestByKey = new Map<string, T>();

  for (const row of included) {
    const key = customerTimelineSemanticKey(row);
    const existing = bestByKey.get(key);
    bestByKey.set(key, existing ? pickPreferredDuplicate(existing, row) : row);
  }

  const keepIds = new Set([...bestByKey.values()].map((row) => row.id));
  return rows.filter((row) => !keepIds.has(row.id)).map((row) => row.id);
}
