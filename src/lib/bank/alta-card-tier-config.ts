import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";

export type AltaCardTierConfig = {
  code: AltaCardTierCode;
  label: string;
  description: string;
  defaultCreditLimit: number | null;
  defaultInterestRateApr: number | null;
  isPrivateOnly: boolean;
  sortOrder: number;
};

/** Centralized Alta Card tier defaults — recommendations only; actual terms live on the card. */
export const ALTA_CARD_TIER_CONFIG: Record<AltaCardTierCode, AltaCardTierConfig> = {
  white: {
    code: "white",
    label: "Alta White",
    description: "Entry card · lowest limits · highest standard rate",
    defaultCreditLimit: 5_000,
    defaultInterestRateApr: 24.99,
    isPrivateOnly: false,
    sortOrder: 1,
  },
  navy: {
    code: "navy",
    label: "Alta Navy",
    description: "Standard relationship card · medium limits · better rate",
    defaultCreditLimit: 15_000,
    defaultInterestRateApr: 19.99,
    isPrivateOnly: false,
    sortOrder: 2,
  },
  black: {
    code: "black",
    label: "Alta Black",
    description: "Premium public card · higher limits · best public rate",
    defaultCreditLimit: 50_000,
    defaultInterestRateApr: 15.99,
    isPrivateOnly: false,
    sortOrder: 3,
  },
  gold: {
    code: "gold",
    label: "Alta Gold",
    description: "Private banking · negotiable limit and rate · Alta Private",
    defaultCreditLimit: null,
    defaultInterestRateApr: null,
    isPrivateOnly: true,
    sortOrder: 4,
  },
};

export const ALTA_CARD_TIER_ORDER: AltaCardTierCode[] = (
  Object.values(ALTA_CARD_TIER_CONFIG) as AltaCardTierConfig[]
)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((t) => t.code);

export function getTierDefaultLimit(tier: AltaCardTierCode): number | null {
  return ALTA_CARD_TIER_CONFIG[tier].defaultCreditLimit;
}

export function getTierDefaultRate(tier: AltaCardTierCode): number | null {
  return ALTA_CARD_TIER_CONFIG[tier].defaultInterestRateApr;
}

export function getTierBenefitsSummary(tier: AltaCardTierCode): string {
  return ALTA_CARD_TIER_CONFIG[tier].description;
}
