import type { CompanyProductHoldings, CompanyRelationshipTierCode } from "@/lib/bank/company-relationship-intelligence-types";
import {
  COMPANY_RELATIONSHIP_TIER_LABELS,
  COMPANY_RELATIONSHIP_TIER_THRESHOLDS,
} from "@/lib/bank/company-relationship-intelligence-config";
import type { RelationshipProductsHeld, RelationshipTierCode } from "@/lib/bank/relationship-intelligence-types";
import {
  computeDisplayRelationshipProgress,
  displayRelationshipTierLabel,
} from "@/lib/bank/relationship-terminology";

export type CustomerRelationshipProgress = {
  currentTierLabel: string;
  nextTierLabel: string | null;
  /** 0–100 progress toward the next tier; 100 at the highest tier. */
  progressPercent: number;
};

/** Derives customer-facing tier progress without exposing the numeric score. */
export function computeCustomerRelationshipProgress(
  relationshipScore: number,
  relationshipTier: RelationshipTierCode,
): CustomerRelationshipProgress {
  return computeDisplayRelationshipProgress(relationshipScore, relationshipTier);
}

export { displayRelationshipTierLabel };

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

const COMPANY_DISPLAY_TIER_LADDER = ["STANDARD", "PREFERRED", "PREMIER"] as const;

function companyDisplayTierFromScore(score: number): (typeof COMPANY_DISPLAY_TIER_LADDER)[number] {
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREMIER) return "PREMIER";
  if (score >= COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREFERRED) return "PREFERRED";
  return "STANDARD";
}

/** Derives customer-facing company tier progress without exposing the numeric score. */
export function computeCompanyRelationshipProgress(
  relationshipScore: number,
  relationshipTier: CompanyRelationshipTierCode,
): CustomerRelationshipProgress {
  const currentCode =
    relationshipTier === "COMMERCIAL_ELIGIBLE" || relationshipTier === "NEW"
      ? companyDisplayTierFromScore(relationshipScore)
      : relationshipTier === "STANDARD" ||
          relationshipTier === "PREFERRED" ||
          relationshipTier === "PREMIER"
        ? relationshipTier
        : companyDisplayTierFromScore(relationshipScore);
  const currentTierLabel = COMPANY_RELATIONSHIP_TIER_LABELS[currentCode];
  const tierIndex = COMPANY_DISPLAY_TIER_LADDER.indexOf(currentCode);
  const nextCode = COMPANY_DISPLAY_TIER_LADDER[tierIndex + 1];

  if (!nextCode) {
    const floor = COMPANY_RELATIONSHIP_TIER_THRESHOLDS.PREMIER;
    const ceiling = COMPANY_RELATIONSHIP_TIER_THRESHOLDS.COMMERCIAL_ELIGIBLE;
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
    currentCode === "STANDARD" ? 0 : COMPANY_RELATIONSHIP_TIER_THRESHOLDS[currentCode];
  const ceiling = COMPANY_RELATIONSHIP_TIER_THRESHOLDS[nextCode];
  const span = ceiling - floor;
  const progressPercent =
    span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((relationshipScore - floor) / span) * 100)));

  return {
    currentTierLabel,
    nextTierLabel: COMPANY_RELATIONSHIP_TIER_LABELS[nextCode],
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

export function commercialBankingStatusLabel(eligible: boolean): string {
  return eligible ? "Eligible" : "Not Eligible";
}
