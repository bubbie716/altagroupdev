/** Relationship Intelligence directory helpers (Phase 8). */

import type {
  RelationshipIntelligenceDashboard,
  RelationshipTierCode,
} from "@/lib/bank/relationship-intelligence-types";
import { displayRelationshipTierLabelFromCode } from "@/lib/bank/relationship-terminology";

export const RELATIONSHIP_LIST_PAGE_SIZE = 25;

export type RelationshipDirectoryRow = {
  userId: string;
  label: string;
  tier: RelationshipTierCode;
  score: number;
  recentChange: string | null;
  scoreDelta: number | null;
  lastCalculatedAt: string | null;
  needsAttention: boolean;
  attentionDetail: string | null;
};

/** Score decrease already recorded by the relationship snapshot system. */
export function relationshipHasScoreDrop(
  change: RelationshipIntelligenceDashboard["recentlyChanged"][number],
): boolean {
  return change.newScore < change.oldScore;
}

export function formatRelationshipScoreChange(
  change: Pick<
    RelationshipIntelligenceDashboard["recentlyChanged"][number],
    "oldScore" | "newScore"
  > | null,
): string | null {
  if (!change) return null;
  const delta = change.newScore - change.oldScore;
  if (delta === 0) return null;
  const sign = delta > 0 ? "+" : "";
  return `${change.oldScore} → ${change.newScore} (${sign}${delta})`;
}

export function buildRelationshipDirectoryRows(
  data: RelationshipIntelligenceDashboard,
): RelationshipDirectoryRow[] {
  const changeByUser = new Map(
    data.recentlyChanged.map((c) => [c.userId, c] as const),
  );
  const fromTop = data.topByAssets.map((row) => {
    const change = changeByUser.get(row.userId) ?? null;
    const drop = change ? relationshipHasScoreDrop(change) : false;
    return {
      userId: row.userId,
      label: row.discordUsername,
      tier: row.relationshipTier,
      score: row.relationshipScore,
      recentChange: formatRelationshipScoreChange(change),
      scoreDelta: change ? change.newScore - change.oldScore : null,
      lastCalculatedAt: row.lastCalculatedAt ?? change?.calculatedAt ?? null,
      needsAttention: drop,
      attentionDetail: drop ? "Significant score drop" : null,
    } satisfies RelationshipDirectoryRow;
  });

  // Include score-drop profiles that are not in the top-assets slice.
  const seen = new Set(fromTop.map((r) => r.userId));
  for (const change of data.recentlyChanged) {
    if (seen.has(change.userId) || !relationshipHasScoreDrop(change)) continue;
    fromTop.push({
      userId: change.userId,
      label: change.discordUsername,
      tier: change.newTier,
      score: change.newScore,
      recentChange: formatRelationshipScoreChange(change),
      scoreDelta: change.newScore - change.oldScore,
      lastCalculatedAt: change.calculatedAt,
      needsAttention: true,
      attentionDetail: "Significant score drop",
    });
  }

  return fromTop.sort((a, b) => {
    const aAtt = a.needsAttention ? 0 : 1;
    const bAtt = b.needsAttention ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    return b.score - a.score;
  });
}

export function relationshipTierFilterOptions(
  rows: RelationshipDirectoryRow[],
): Array<{ value: RelationshipTierCode; label: string }> {
  const tiers = [...new Set(rows.map((r) => r.tier))];
  return tiers
    .sort()
    .map((value) => ({ value, label: displayRelationshipTierLabelFromCode(value) }));
}
