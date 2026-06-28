import type { CompanyProductHoldings, CompanyRelationshipTierCode } from "@/lib/bank/company-relationship-intelligence-types";
import {
  COMPANY_RELATIONSHIP_SCORE_MAX,
  COMPANY_RELATIONSHIP_TIER_LABELS,
  COMPANY_RELATIONSHIP_TIER_THRESHOLDS,
} from "@/lib/bank/company-relationship-intelligence-config";
import type { RelationshipProductsHeld, RelationshipTierCode } from "@/lib/bank/relationship-intelligence-types";
import {
  RELATIONSHIP_SCORE_MAX,
  RELATIONSHIP_TIER_LABELS,
  RELATIONSHIP_TIER_THRESHOLDS,
} from "@/lib/bank/relationship-intelligence-config";

export type CustomerRelationshipProgress = {
  currentTierLabel: string;
  nextTierLabel: string | null;
  /** 0–100 progress toward the next tier; 100 at the highest tier. */
  progressPercent: number;
};

const TIER_LADDER: Exclude<RelationshipTierCode, "PRIVATE_CLIENT">[] = [
  "NEW",
  "STANDARD",
  "PREFERRED",
  "PREMIER",
  "PRIVATE_ELIGIBLE",
];

function tierFloor(tier: RelationshipTierCode): number {
  if (tier === "NEW") return 0;
  if (tier === "PRIVATE_CLIENT") return RELATIONSHIP_SCORE_MAX;
  return RELATIONSHIP_TIER_THRESHOLDS[tier];
}

/** Derives customer-facing tier progress without exposing the numeric score. */
export function computeCustomerRelationshipProgress(
  relationshipScore: number,
  relationshipTier: RelationshipTierCode,
): CustomerRelationshipProgress {
  const currentTierLabel = RELATIONSHIP_TIER_LABELS[relationshipTier];

  if (relationshipTier === "PRIVATE_CLIENT") {
    return { currentTierLabel, nextTierLabel: null, progressPercent: 100 };
  }

  const tierIndex = TIER_LADDER.indexOf(relationshipTier);
  const floor = tierFloor(relationshipTier);
  const nextTier = TIER_LADDER[tierIndex + 1];

  if (!nextTier) {
    const ceiling = RELATIONSHIP_SCORE_MAX;
    const span = ceiling - floor;
    const progressPercent =
      span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)));
    return {
      currentTierLabel,
      nextTierLabel: RELATIONSHIP_TIER_LABELS.PRIVATE_CLIENT,
      progressPercent,
    };
  }

  const ceiling = RELATIONSHIP_TIER_THRESHOLDS[nextTier];
  const span = ceiling - floor;
  const progressPercent =
    span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)));

  return {
    currentTierLabel,
    nextTierLabel: RELATIONSHIP_TIER_LABELS[nextTier],
    progressPercent,
  };
}

export function formatMembershipDuration(relationshipSince: string | Date): string {
  const start = relationshipSince instanceof Date ? relationshipSince : new Date(relationshipSince);
  if (Number.isNaN(start.getTime())) return "";

  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000));
  if (days === 0) return "Member since today";
  if (days === 1) return "Member for 1 day";
  if (days < 60) return `Member for ${days} days`;

  const months = Math.floor(days / 30);
  if (months < 24) return months === 1 ? "Member for 1 month" : `Member for ${months} months`;

  const years = Math.floor(days / 365);
  return years === 1 ? "Member for 1 year" : `Member for ${years} years`;
}

export function customerProductLabels(products: RelationshipProductsHeld): string[] {
  const labels: string[] = [];
  if (products.activeBankAccounts > 0) labels.push("Banking");
  if (products.activeAltaCards > 0) labels.push("Alta Card");
  if (products.activeLoans > 0) labels.push("Lending");
  if (products.businessCompanies > 0) labels.push("Business Banking");
  if (products.isPrivateClient) labels.push("Alta Private");
  return labels;
}

const COMPANY_TIER_LADDER: CompanyRelationshipTierCode[] = [
  "NEW",
  "STANDARD",
  "PREFERRED",
  "PREMIER",
  "COMMERCIAL_ELIGIBLE",
];

function companyTierFloor(tier: CompanyRelationshipTierCode): number {
  if (tier === "NEW") return 0;
  return COMPANY_RELATIONSHIP_TIER_THRESHOLDS[tier];
}

/** Derives customer-facing company tier progress without exposing the numeric score. */
export function computeCompanyRelationshipProgress(
  relationshipScore: number,
  relationshipTier: CompanyRelationshipTierCode,
): CustomerRelationshipProgress {
  const currentTierLabel = COMPANY_RELATIONSHIP_TIER_LABELS[relationshipTier];
  const tierIndex = COMPANY_TIER_LADDER.indexOf(relationshipTier);
  const floor = companyTierFloor(relationshipTier);
  const nextTier = COMPANY_TIER_LADDER[tierIndex + 1];

  if (!nextTier) {
    return { currentTierLabel, nextTierLabel: null, progressPercent: 100 };
  }

  const ceiling = COMPANY_RELATIONSHIP_TIER_THRESHOLDS[nextTier];
  const span = ceiling - floor;
  const progressPercent =
    span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)));

  return {
    currentTierLabel,
    nextTierLabel: COMPANY_RELATIONSHIP_TIER_LABELS[nextTier],
    progressPercent,
  };
}

export function companyProductLabels(holdings: CompanyProductHoldings): string[] {
  const labels: string[] = [];
  if (holdings.activeBusinessAccounts > 0) labels.push("Business Banking");
  if (holdings.activeBusinessCards > 0) labels.push("Alta Card");
  if (holdings.activeBusinessLoans > 0) labels.push("Lending");
  return labels;
}

export function formatCompanyRelationshipDuration(relationshipSince: string | Date): string {
  const duration = formatMembershipDuration(relationshipSince);
  return duration.replace(/^Member/, "Relationship");
}
