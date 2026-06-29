import type { RelationshipTierCode } from "@/lib/bank/relationship-intelligence-types";
import { RELATIONSHIP_TIER_THRESHOLDS } from "@/lib/bank/relationship-intelligence-config";

/** Customer-facing relationship tiers — Alta Private is not included. */
export type DisplayRelationshipTierCode = "STANDARD" | "PREFERRED" | "PREMIER";

export const DISPLAY_RELATIONSHIP_TIER_LABELS: Record<DisplayRelationshipTierCode, string> = {
  STANDARD: "Standard",
  PREFERRED: "Preferred",
  PREMIER: "Premier",
};

const DISPLAY_TIER_LADDER: DisplayRelationshipTierCode[] = ["STANDARD", "PREFERRED", "PREMIER"];

export function isAltaPrivateProgramTier(tier: RelationshipTierCode): boolean {
  return tier === "PRIVATE_CLIENT" || tier === "PRIVATE_ELIGIBLE";
}

/** Derive the published relationship tier from score (ignores Alta Private membership). */
export function displayRelationshipTierFromScore(
  relationshipScore: number,
): DisplayRelationshipTierCode {
  if (relationshipScore >= RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return "PREMIER";
  if (relationshipScore >= RELATIONSHIP_TIER_THRESHOLDS.PREFERRED) return "PREFERRED";
  return "STANDARD";
}

export function displayRelationshipTierCode(
  storedTier: RelationshipTierCode,
  relationshipScore: number,
): DisplayRelationshipTierCode {
  if (isAltaPrivateProgramTier(storedTier) || storedTier === "NEW") {
    return displayRelationshipTierFromScore(relationshipScore);
  }
  if (storedTier === "STANDARD" || storedTier === "PREFERRED" || storedTier === "PREMIER") {
    return storedTier;
  }
  return displayRelationshipTierFromScore(relationshipScore);
}

export function displayRelationshipTierLabel(
  storedTier: RelationshipTierCode,
  relationshipScore: number,
): string {
  return DISPLAY_RELATIONSHIP_TIER_LABELS[
    displayRelationshipTierCode(storedTier, relationshipScore)
  ];
}

/** Map stored tier codes to display labels when score is unavailable (operator sidebars). */
export function displayRelationshipTierLabelFromCode(tier: string): string {
  if (tier === "PRIVATE_CLIENT" || tier === "PRIVATE_ELIGIBLE") {
    return DISPLAY_RELATIONSHIP_TIER_LABELS.PREMIER;
  }
  if (tier === "NEW") return DISPLAY_RELATIONSHIP_TIER_LABELS.STANDARD;
  if (tier === "STANDARD" || tier === "PREFERRED" || tier === "PREMIER") {
    return DISPLAY_RELATIONSHIP_TIER_LABELS[tier];
  }
  return tier;
}

export function altaPrivateStatusLabel(
  privateBankingClient: boolean,
  privateBankingEligible: boolean,
): string {
  if (privateBankingClient) return "Active";
  if (privateBankingEligible) return "Eligible";
  return "Not a Member";
}

export function altaPrivateMembershipLabel(privateBankingClient: boolean): string | null {
  return privateBankingClient ? "Alta Private Member" : null;
}

export function computeDisplayRelationshipProgress(
  relationshipScore: number,
  storedTier: RelationshipTierCode,
): {
  currentTierLabel: string;
  nextTierLabel: string | null;
  progressPercent: number;
} {
  const currentCode = displayRelationshipTierCode(storedTier, relationshipScore);
  const currentTierLabel = DISPLAY_RELATIONSHIP_TIER_LABELS[currentCode];
  const tierIndex = DISPLAY_TIER_LADDER.indexOf(currentCode);
  const nextCode = DISPLAY_TIER_LADDER[tierIndex + 1];

  if (!nextCode) {
    const floor = RELATIONSHIP_TIER_THRESHOLDS.PREMIER;
    const ceiling = RELATIONSHIP_TIER_THRESHOLDS.PRIVATE_ELIGIBLE;
    const span = ceiling - floor;
    const progressPercent =
      span <= 0
        ? 100
        : Math.min(
            100,
            Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)),
          );
    return { currentTierLabel, nextTierLabel: null, progressPercent };
  }

  const floor =
    currentCode === "STANDARD" ? 0 : RELATIONSHIP_TIER_THRESHOLDS[currentCode];
  const ceiling = RELATIONSHIP_TIER_THRESHOLDS[nextCode];
  const span = ceiling - floor;
  const progressPercent =
    span <= 0
      ? 100
      : Math.min(100, Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)));

  return {
    currentTierLabel,
    nextTierLabel: DISPLAY_RELATIONSHIP_TIER_LABELS[nextCode],
    progressPercent,
  };
}
