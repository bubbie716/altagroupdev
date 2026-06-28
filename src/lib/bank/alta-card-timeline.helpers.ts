import { ALTA_CARD_TIER_LABELS, type AltaCardTierCode } from "@/lib/bank/alta-card-types";

export function altaCardTierCodeFromDb(value: string): AltaCardTierCode {
  return value.toLowerCase() as AltaCardTierCode;
}

/** Opening tier — not the card's current tier after later upgrades. */
export function resolveAltaCardOpeningTierCode(input: {
  currentTier: string;
  approvedTier?: string | null;
  requestedTier?: string | null;
  firstTierChangePreviousTier?: string | null;
}): AltaCardTierCode {
  if (input.firstTierChangePreviousTier) {
    return altaCardTierCodeFromDb(input.firstTierChangePreviousTier);
  }
  if (input.approvedTier) return altaCardTierCodeFromDb(input.approvedTier);
  if (input.requestedTier) return altaCardTierCodeFromDb(input.requestedTier);
  return altaCardTierCodeFromDb(input.currentTier);
}

export function formatAltaCardOpenedTimelineCopy(
  tier: AltaCardTierCode,
  options?: { business?: boolean },
): { title: string; description: string } {
  const label = ALTA_CARD_TIER_LABELS[tier];
  if (options?.business) {
    return {
      title: `Business Alta Card opened (${label})`,
      description: `Business Alta Card opened on ${label} tier.`,
    };
  }
  return {
    title: `Alta Card opened (${label})`,
    description: `Alta Card account opened on ${label} tier.`,
  };
}

export function firstTierChangePreviousTier(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  if (typeof metadata.previousTier === "string") return metadata.previousTier;
  if (typeof metadata.oldValue === "string") return metadata.oldValue;
  return null;
}
