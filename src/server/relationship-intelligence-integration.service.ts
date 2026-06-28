import type {
  LendingIntelligenceSignals,
  PreApprovalReadiness,
  PreApprovalReadinessStatus,
  ProductHoldingsDetail,
  RecommendationPrefill,
  RelationshipIntegrationContext,
  RelationshipIntelligencePanelData,
  RelationshipRecommendationRow,
  RelationshipRecommendationTypeCode,
} from "@/lib/bank/relationship-intelligence-types";
import {
  CONTEXT_RECOMMENDATION_TYPES,
} from "@/lib/bank/relationship-integration-config";
import {
  qualifiesForLoanPreApproval,
} from "@/lib/bank/relationship-recommendation-config";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireOperator } from "@/server/permissions.service";
import { toAltaCardTierCode } from "@/server/alta-card-mapper";
import {
  calculateRelationshipProfile,
  getRelationshipProfile,
} from "@/server/relationship-intelligence.service";
import { getRelationshipRecommendations } from "@/server/relationship-intelligence-recommendation.service";

function filterRecommendationsForContext(
  recommendations: RelationshipRecommendationRow[],
  context: RelationshipIntegrationContext,
): RelationshipRecommendationRow[] {
  const allowed = new Set(CONTEXT_RECOMMENDATION_TYPES[context]);
  return recommendations.filter(
    (row) => row.status === "ACTIVE" && allowed.has(row.recommendationType),
  );
}

async function buildProductHoldingsDetail(
  userId: string,
  productsHeld: RelationshipIntelligencePanelData["productsHeld"],
): Promise<ProductHoldingsDetail> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    include: { company: { select: { verificationStatus: true } } },
  });
  const companyIds = memberships.map((m) => m.companyId);

  const [bankAccounts, cards] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        OR: [
          { userId, companyId: null },
          ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
        ],
      },
      select: { status: true },
    }),
    prisma.altaCard.findMany({
      where: {
        OR: [{ ownerUserId: userId }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
      },
      select: { status: true, tier: true, cardType: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const primaryCard = cards.find((c) => c.status !== "CLOSED") ?? cards[0] ?? null;
  const businessCards = cards.filter((c) => c.cardType === "BUSINESS").length;

  return {
    bankAccountsTotal: bankAccounts.length,
    bankAccountsActive: bankAccounts.filter((a) => a.status === "ACTIVE").length,
    altaCardStatus: primaryCard?.status.toLowerCase() ?? null,
    altaCardTier: primaryCard ? toAltaCardTierCode(primaryCard.tier) : null,
    altaCardCount: cards.filter((c) => c.status !== "CLOSED" && c.status !== "EXPIRED").length,
    businessCardCount: businessCards,
    activeLoans: productsHeld.activeLoans,
    paidOffLoans: productsHeld.paidOffLoans,
    companyMemberships: memberships.length,
    verifiedCompanies: memberships.filter((m) => m.company.verificationStatus === "VERIFIED").length,
    isPrivateClient: productsHeld.isPrivateClient,
    exchangePlaceholder: true,
    terminalPlaceholder: true,
  };
}

async function buildLendingSignals(
  userId: string,
  calculated: Awaited<ReturnType<typeof calculateRelationshipProfile>>,
): Promise<LendingIntelligenceSignals> {
  const companyIds = (
    await prisma.companyMembership.findMany({ where: { userId }, select: { companyId: true } })
  ).map((m) => m.companyId);

  const [delinquentCards, defaultedLoans, overdueInstallments, primaryCard] = await Promise.all([
    prisma.altaCard.count({
      where: {
        status: "DELINQUENT",
        OR: [{ ownerUserId: userId }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
      },
    }),
    prisma.loan.count({
      where: {
        status: "DEFAULTED",
        OR: [{ borrowerUserId: userId }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
      },
    }),
    prisma.loanPaymentScheduleItem.count({
      where: {
        status: "OVERDUE",
        loan: {
          OR: [{ borrowerUserId: userId }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
        },
      },
    }),
    prisma.altaCard.findFirst({
      where: { ownerUserId: userId, status: { notIn: ["CLOSED", "EXPIRED"] } },
      orderBy: { createdAt: "asc" },
      select: { status: true, tier: true },
    }),
  ]);

  const delinquentFactor = calculated.factors.find((f) => f.key === "delinquent_cards");
  const defaultedFactor = calculated.factors.find((f) => f.key === "defaulted_loans");

  return {
    delinquentCardCount: delinquentCards || (delinquentFactor && delinquentFactor.impact < 0 ? 1 : 0),
    defaultedLoanCount: defaultedLoans || (defaultedFactor && defaultedFactor.impact < 0 ? 1 : 0),
    overdueInstallmentCount: overdueInstallments,
    altaCardStatus: primaryCard?.status.toLowerCase() ?? null,
    altaCardTier: primaryCard ? toAltaCardTierCode(primaryCard.tier) : null,
  };
}

export async function getRelationshipIntelligencePanel(
  userId: string,
): Promise<RelationshipIntelligencePanelData> {
  await requireOperator();

  const stored = await getRelationshipProfile(userId);
  const calculated = await calculateRelationshipProfile(userId);
  const source = calculated;

  const [productHoldings, lendingSignals] = await Promise.all([
    buildProductHoldingsDetail(userId, source.productsHeld),
    buildLendingSignals(userId, calculated),
  ]);

  return {
    userId,
    hasPersistedProfile: stored != null,
    relationshipSince: source.relationshipSince,
    relationshipScore: source.relationshipScore,
    relationshipTier: source.relationshipTier,
    privateBankingEligible: source.privateBankingEligible,
    privateBankingClient: source.privateBankingClient,
    totalBankAssets: source.totalBankAssets,
    totalAltaAssets: source.totalAltaAssets,
    totalInvestments: source.totalInvestments,
    lifetimeDeposits: source.lifetimeDeposits,
    lifetimeWithdrawals: source.lifetimeWithdrawals,
    lifetimeInterestPaid: source.lifetimeInterestPaid,
    lifetimeAltaPayVolume: source.lifetimeAltaPayVolume,
    lifetimeLoanPayments: source.lifetimeLoanPayments,
    lifetimeCardPayments: source.lifetimeCardPayments,
    activeLoanBalance: source.activeLoanBalance,
    activeCardBalance: source.activeCardBalance,
    currentCreditExposure: source.currentCreditExposure,
    productsHeld: source.productsHeld,
    productHoldings,
    lendingSignals,
    lastCalculatedAt: stored?.lastCalculatedAt ?? new Date().toISOString(),
  };
}

export async function getProductHoldingsSummary(userId: string): Promise<ProductHoldingsDetail> {
  await requireOperator();
  const panel = await getRelationshipIntelligencePanel(userId);
  return panel.productHoldings;
}

export async function getRecommendationsForContext(
  userId: string,
  context: RelationshipIntegrationContext,
): Promise<RelationshipRecommendationRow[]> {
  await requireOperator();
  const recommendations = await getRelationshipRecommendations(userId, { status: "ACTIVE" });
  return filterRecommendationsForContext(recommendations, context);
}

export async function getPreApprovalReadiness(userId: string): Promise<PreApprovalReadiness> {
  await requireOperator();
  const calculated = await calculateRelationshipProfile(userId);

  const delinquentCards = calculated.factors.some((f) => f.key === "delinquent_cards" && f.impact < 0)
    ? 1
    : 0;
  const defaultedLoans = calculated.factors.some((f) => f.key === "defaulted_loans" && f.impact < 0)
    ? 1
    : 0;

  const eligible = qualifiesForLoanPreApproval({
    relationshipScore: calculated.relationshipScore,
    totalAltaAssets: calculated.totalAltaAssets,
    lifetimeDeposits: calculated.lifetimeDeposits,
    delinquentCards,
    defaultedLoans,
  });

  const reasons: string[] = [];
  const blockers: string[] = [];

  if (calculated.relationshipScore >= 500) {
    reasons.push(`Relationship score ${calculated.relationshipScore} supports lending review.`);
  } else {
    blockers.push("Relationship score below preferred lending review threshold.");
  }
  if (calculated.totalAltaAssets >= 50_000) {
    reasons.push("Total Alta assets support relationship-based lending review.");
  }
  if (calculated.lifetimeDeposits >= 10_000) {
    reasons.push("Lifetime deposit activity recorded.");
  }
  if (calculated.productsHeld.paidOffLoans > 0) {
    reasons.push(`${calculated.productsHeld.paidOffLoans} paid-off loan(s) on file.`);
  }
  if (delinquentCards > 0) blockers.push("Delinquent Alta Card on file.");
  if (defaultedLoans > 0) blockers.push("Defaulted loan on file.");

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
      ? ["Personal term loan review", "Business credit line review"]
      : ["Future pre-approval products not yet available"],
  };
}

export async function recordPreApprovalReadinessViewed(
  userId: string,
  actorUserId: string,
  context: RelationshipIntegrationContext,
): Promise<PreApprovalReadiness> {
  await requireOperator();
  const readiness = await getPreApprovalReadiness(userId);
  await writeAuditLog({
    actorUserId,
    targetUserId: userId,
    action: "RELATIONSHIP_PREAPPROVAL_READINESS_VIEWED",
    entityType: "USER",
    entityId: userId,
    description: "Pre-approval readiness reviewed",
    metadata: {
      userId,
      context,
      readinessStatus: readiness.readinessStatus,
      eligible: readiness.eligible,
      actorUserId,
    },
  });
  return readiness;
}

export async function useRelationshipRecommendation(
  recommendationId: string,
  actorUserId: string,
  context: RelationshipIntegrationContext,
): Promise<RecommendationPrefill> {
  await requireOperator();

  const row = await prisma.relationshipRecommendation.findUnique({ where: { id: recommendationId } });
  if (!row) throw new Error("NOT_FOUND");

  const reasons =
    row.reasons && typeof row.reasons === "object" && !Array.isArray(row.reasons)
      ? ((row.reasons as Record<string, unknown>).bullets as string[] | undefined) ?? []
      : [];

  await writeAuditLog({
    actorUserId,
    targetUserId: row.userId,
    action: "RELATIONSHIP_RECOMMENDATION_USED",
    entityType: "USER",
    entityId: row.id,
    description: `Used relationship recommendation in ${context}`,
    metadata: {
      userId: row.userId,
      recommendationId: row.id,
      recommendationType: row.recommendationType,
      context,
      actorUserId,
      suggestedTier: row.recommendedTier,
      suggestedLimit: row.recommendedLimit?.toString() ?? null,
      suggestedRate: row.recommendedRate?.toString() ?? null,
    },
  });

  const { markRecommendationReviewed } = await import(
    "@/server/relationship-intelligence-recommendation.service"
  );
  await markRecommendationReviewed(recommendationId, actorUserId);

  return {
    recommendationId: row.id,
    recommendationType: row.recommendationType as RelationshipRecommendationTypeCode,
    suggestedTier: row.recommendedTier ?? undefined,
    suggestedLimit: row.recommendedLimit != null ? Number(row.recommendedLimit.toString()) : undefined,
    suggestedRate: row.recommendedRate != null ? Number(row.recommendedRate.toString()) : undefined,
    confidenceScore: row.confidenceScore,
    reasons,
  };
}

export async function getRelationshipIntegrationBundle(
  userId: string,
  context: RelationshipIntegrationContext,
): Promise<{
  panel: RelationshipIntelligencePanelData;
  recommendations: RelationshipRecommendationRow[];
  preApprovalReadiness: PreApprovalReadiness | null;
}> {
  const [panel, recommendations] = await Promise.all([
    getRelationshipIntelligencePanel(userId),
    getRecommendationsForContext(userId, context),
  ]);
  const preApprovalReadiness =
    context === "LENDING" || context === "CUSTOMER_PROFILE"
      ? await getPreApprovalReadiness(userId)
      : null;
  return { panel, recommendations, preApprovalReadiness };
}
