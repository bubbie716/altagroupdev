import type {
  CompanyRelationshipIntelligencePanelData,
  CompanyRelationshipRecommendationRow,
} from "@/lib/bank/company-relationship-intelligence-types";
import type { CompanyRelationshipIntegrationBundle } from "@/lib/internal/company-relationship-integration.types";
import { COMPANY_CONTEXT_RECOMMENDATION_TYPES } from "@/lib/bank/company-relationship-integration-config";
import type { RelationshipIntegrationContext } from "@/lib/bank/relationship-integration-config";
import type {
  PreApprovalReadiness,
  PreApprovalReadinessStatus,
  RecommendationPrefill,
} from "@/lib/bank/relationship-intelligence-types";
import {
  qualifiesForBusinessLoanOpportunity,
} from "@/lib/bank/company-relationship-recommendation-config";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireOperator } from "@/server/permissions.service";
import { toAltaCardTierCode } from "@/server/alta-card-mapper";
import {
  calculateCompanyRelationshipProfile,
  getCompanyRelationshipProfile,
} from "@/server/company-relationship-intelligence.service";
import { getCompanyRelationshipRecommendations } from "@/server/company-relationship-recommendation.service";

function filterRecommendationsForContext(
  recommendations: CompanyRelationshipRecommendationRow[],
  context: RelationshipIntegrationContext,
): CompanyRelationshipRecommendationRow[] {
  const allowed = new Set(COMPANY_CONTEXT_RECOMMENDATION_TYPES[context]);
  return recommendations.filter(
    (row) => row.status === "ACTIVE" && allowed.has(row.recommendationType),
  );
}

export async function getCompanyRelationshipIntelligencePanel(
  companyId: string,
): Promise<CompanyRelationshipIntelligencePanelData> {
  await requireOperator();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("NOT_FOUND");

  const stored = await getCompanyRelationshipProfile(companyId);
  let calculated: Awaited<ReturnType<typeof calculateCompanyRelationshipProfile>>;
  try {
    calculated = await calculateCompanyRelationshipProfile(companyId);
  } catch {
    throw new Error("NOT_FOUND");
  }
  const source = calculated;

  const [delinquentCards, defaultedLoans, overdueInstallments, primaryCard] = await Promise.all([
    prisma.altaCard.count({
      where: { companyId, status: "DELINQUENT" },
    }),
    prisma.loan.count({
      where: { companyId, status: "DEFAULTED" },
    }),
    prisma.loanPaymentScheduleItem.count({
      where: {
        status: "OVERDUE",
        loan: { companyId },
      },
    }),
    prisma.altaCard.findFirst({
      where: { companyId, status: { notIn: ["CLOSED", "EXPIRED"] } },
      orderBy: { createdAt: "asc" },
      select: { status: true, tier: true },
    }),
  ]);

  return {
    companyId: company.id,
    companyName: company.name,
    hasPersistedProfile: stored != null,
    relationshipSince: source.relationshipSince,
    relationshipScore: source.relationshipScore,
    relationshipTier: source.relationshipTier,
    commercialBankingEligible: source.commercialBankingEligible,
    totalBusinessAssets: source.totalBusinessAssets,
    lifetimeDeposits: source.lifetimeDeposits,
    lifetimeWithdrawals: source.lifetimeWithdrawals,
    lifetimeAltaPayVolume: source.lifetimeAltaPayVolume,
    lifetimeLoanPayments: source.lifetimeLoanPayments,
    lifetimeCardPayments: source.lifetimeCardPayments,
    activeLoanBalance: source.activeLoanBalance,
    activeCardBalance: source.activeCardBalance,
    currentCreditExposure: source.currentCreditExposure,
    productHoldings: source.productHoldings,
    lendingSignals: {
      delinquentCardCount: delinquentCards,
      defaultedLoanCount: defaultedLoans,
      overdueInstallmentCount: overdueInstallments,
      altaCardStatus: primaryCard?.status.toLowerCase() ?? null,
      altaCardTier: primaryCard ? toAltaCardTierCode(primaryCard.tier) : null,
    },
    lastCalculatedAt: stored?.lastCalculatedAt ?? new Date().toISOString(),
  };
}

export async function getCompanyPreApprovalReadiness(companyId: string): Promise<PreApprovalReadiness> {
  await requireOperator();
  const calculated = await calculateCompanyRelationshipProfile(companyId);

  const delinquentCards = calculated.factors.some((f) => f.key === "delinquent_cards" && f.impact < 0)
    ? 1
    : 0;
  const defaultedLoans = calculated.factors.some((f) => f.key === "defaulted_loans" && f.impact < 0)
    ? 1
    : 0;

  const eligible = qualifiesForBusinessLoanOpportunity(calculated);

  const reasons: string[] = [];
  const blockers: string[] = [];

  if (calculated.relationshipScore >= 400) {
    reasons.push(`Company relationship score ${calculated.relationshipScore} supports business lending review.`);
  } else {
    blockers.push("Company relationship score below preferred business lending threshold.");
  }
  if (calculated.productHoldings.activeBusinessAccounts > 0) {
    reasons.push("Active business bank account on file.");
  } else {
    blockers.push("No active business bank account.");
  }
  if (calculated.lifetimeDeposits >= 10_000) {
    reasons.push("Business deposit activity recorded.");
  }
  if (calculated.productHoldings.paidOffBusinessLoans > 0) {
    reasons.push(`${calculated.productHoldings.paidOffBusinessLoans} paid-off business loan(s) on file.`);
  }
  if (delinquentCards > 0) blockers.push("Delinquent business Alta Card on file.");
  if (defaultedLoans > 0) blockers.push("Defaulted business loan on file.");

  let readinessStatus: PreApprovalReadinessStatus = "NOT_ELIGIBLE";
  if (eligible && blockers.length === 0) readinessStatus = "ELIGIBLE";
  else if (reasons.length > 0 && blockers.length === 0) readinessStatus = "NEEDS_REVIEW";
  else if (reasons.length > 0 && blockers.length > 0) readinessStatus = "NEEDS_REVIEW";

  return {
    eligible,
    readinessStatus,
    reasons,
    blockers,
    suggestedProducts: eligible
      ? ["Business credit line review", "Commercial banking review"]
      : ["Future business pre-approval products not yet available"],
  };
}

export async function getCompanyRecommendationsForContext(
  companyId: string,
  context: RelationshipIntegrationContext,
): Promise<CompanyRelationshipRecommendationRow[]> {
  await requireOperator();
  const recommendations = await getCompanyRelationshipRecommendations(companyId, { status: "ACTIVE" });
  return filterRecommendationsForContext(recommendations, context);
}

export async function recordCompanyPreApprovalReadinessViewed(
  companyId: string,
  actorUserId: string,
  context: RelationshipIntegrationContext,
): Promise<PreApprovalReadiness> {
  await requireOperator();
  const readiness = await getCompanyPreApprovalReadiness(companyId);
  await writeAuditLog({
    actorUserId,
    targetCompanyId: companyId,
    action: "COMPANY_RELATIONSHIP_PREAPPROVAL_READINESS_VIEWED",
    entityType: "COMPANY",
    entityId: companyId,
    description: "Company pre-approval readiness reviewed",
    metadata: {
      companyId,
      context,
      readinessStatus: readiness.readinessStatus,
      eligible: readiness.eligible,
      actorUserId,
    },
  });
  return readiness;
}

export async function useCompanyRelationshipRecommendation(
  recommendationId: string,
  actorUserId: string,
  context: RelationshipIntegrationContext,
): Promise<RecommendationPrefill> {
  await requireOperator();

  const row = await prisma.companyRelationshipRecommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!row) throw new Error("NOT_FOUND");

  const reasons =
    row.reasons && typeof row.reasons === "object" && !Array.isArray(row.reasons)
      ? ((row.reasons as Record<string, unknown>).bullets as string[] | undefined) ?? []
      : [];

  await writeAuditLog({
    actorUserId,
    targetCompanyId: row.companyId,
    action: "COMPANY_RELATIONSHIP_RECOMMENDATION_USED",
    entityType: "COMPANY",
    entityId: row.id,
    description: `Used company relationship recommendation in ${context}`,
    metadata: {
      companyId: row.companyId,
      recommendationId: row.id,
      recommendationType: row.recommendationType,
      context,
      actorUserId,
      suggestedTier: row.recommendedTier,
      suggestedLimit: row.recommendedLimit?.toString() ?? null,
      suggestedRate: row.recommendedRate?.toString() ?? null,
    },
  });

  const { markCompanyRecommendationReviewed } = await import(
    "@/server/company-relationship-recommendation.service"
  );
  await markCompanyRecommendationReviewed(recommendationId, actorUserId);

  return {
    recommendationId: row.id,
    recommendationType: row.recommendationType as RecommendationPrefill["recommendationType"],
    suggestedTier: row.recommendedTier ?? undefined,
    suggestedLimit: row.recommendedLimit != null ? Number(row.recommendedLimit.toString()) : undefined,
    suggestedRate: row.recommendedRate != null ? Number(row.recommendedRate.toString()) : undefined,
    confidenceScore: row.confidenceScore,
    reasons,
  };
}

export async function getCompanyRelationshipIntegrationBundle(
  companyId: string,
  context: RelationshipIntegrationContext,
): Promise<CompanyRelationshipIntegrationBundle> {
  const [panel, recommendations] = await Promise.all([
    getCompanyRelationshipIntelligencePanel(companyId),
    getCompanyRecommendationsForContext(companyId, context),
  ]);
  const preApprovalReadiness =
    context === "LENDING" || context === "CUSTOMER_PROFILE"
      ? await getCompanyPreApprovalReadiness(companyId)
      : null;
  return { panel, recommendations, preApprovalReadiness };
}

export async function getResolvedRelationshipIntegration(input: {
  userId: string;
  companyId?: string | null;
  context: RelationshipIntegrationContext;
}): Promise<
  | { scope: "personal"; bundle: Awaited<ReturnType<typeof import("@/server/relationship-intelligence-integration.service").getRelationshipIntegrationBundle>> }
  | { scope: "company"; bundle: CompanyRelationshipIntegrationBundle }
> {
  if (input.companyId) {
    return {
      scope: "company",
      bundle: await getCompanyRelationshipIntegrationBundle(input.companyId, input.context),
    };
  }
  const { getRelationshipIntegrationBundle } = await import(
    "@/server/relationship-intelligence-integration.service"
  );
  return {
    scope: "personal",
    bundle: await getRelationshipIntegrationBundle(input.userId, input.context),
  };
}
