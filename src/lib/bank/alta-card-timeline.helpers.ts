import { type AltaCardTierCode } from "@/lib/bank/alta-card-types";

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
  _tier: AltaCardTierCode,
  options?: { business?: boolean },
): { title: string; description: string } {
  if (options?.business) {
    return {
      title: "Business Alta Card Opened",
      description: "Your business Alta Card is now active.",
    };
  }
  return {
    title: "Alta Card Opened",
    description: "Your Alta Card is now active.",
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
