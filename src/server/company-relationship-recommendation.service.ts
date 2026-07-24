import type {
  CompanyRelationshipRecommendationType as DbRecommendationType,
  RelationshipRecommendationStatus as DbRecommendationStatus,
  Prisma,
} from "@prisma/client";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency, formatAltaCardRate } from "@/lib/bank/alta-card-types";
import { toAltaCardTierCode } from "@/server/alta-card-mapper";
import {
  BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME,
  COMPANY_CUSTOMER_OPPORTUNITY_COPY,
  COMPANY_RECOMMENDATION_TYPE_LABELS,
  computeBusinessLoanOpportunityConfidence,
  computeCommercialBankingInviteConfidence,
  computeRecommendedBusinessCreditLimit,
  computeRecommendedBusinessInterestRate,
  qualifiesForBusinessLoanOpportunity,
  qualifiesForCommercialBankingInvite,
  type CompanyRecommendationReasonPayload,
} from "@/lib/bank/company-relationship-recommendation-config";
import type {
  CompanyCustomerOpportunity,
  CompanyRelationshipProfileRow,
  CompanyRelationshipRecommendationRow,
  CompanyRelationshipRecommendationStatusCode,
  CompanyRelationshipRecommendationTypeCode,
} from "@/lib/bank/company-relationship-intelligence-types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireOperator } from "@/server/permissions.service";
import {
  calculateCompanyRelationshipProfile,
  getCompanyRelationshipProfile,
  refreshCompanyRelationshipProfile,
} from "@/server/company-relationship-intelligence.service";

type DraftRecommendation = {
  recommendationType: CompanyRelationshipRecommendationTypeCode;
  title: string;
  summary: string;
  recommendedProduct?: string;
  recommendedTier?: AltaCardTierCode;
  recommendedLimit?: number;
  recommendedRate?: number;
  confidenceScore: number;
  reasons: CompanyRecommendationReasonPayload;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function typeToCode(type: DbRecommendationType): CompanyRelationshipRecommendationTypeCode {
  return type as CompanyRelationshipRecommendationTypeCode;
}

function typeToDb(type: CompanyRelationshipRecommendationTypeCode): DbRecommendationType {
  return type as DbRecommendationType;
}

function statusToCode(status: DbRecommendationStatus): CompanyRelationshipRecommendationStatusCode {
  return status as CompanyRelationshipRecommendationStatusCode;
}

function parseReasons(value: Prisma.JsonValue): CompanyRecommendationReasonPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { bullets: [] };
  const record = value as Record<string, unknown>;
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.filter((item): item is string => typeof item === "string")
    : [];
  const actionPath =
    record.actionPath && typeof record.actionPath === "object" && !Array.isArray(record.actionPath)
      ? (record.actionPath as CompanyRecommendationReasonPayload["actionPath"])
      : undefined;
  return { bullets, actionPath };
}

function mapRecommendationRow(row: {
  id: string;
  companyId: string;
  profileId: string;
  recommendationType: DbRecommendationType;
  status: DbRecommendationStatus;
  title: string;
  summary: string;
  recommendedProduct: string | null;
  recommendedTier: string | null;
  recommendedLimit: Prisma.Decimal | null;
  recommendedRate: Prisma.Decimal | null;
  confidenceScore: number;
  reasons: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  dismissedAt: Date | null;
  acceptedAt: Date | null;
  reviewedByUserId: string | null;
}): CompanyRelationshipRecommendationRow {
  return {
    id: row.id,
    companyId: row.companyId,
    profileId: row.profileId,
    recommendationType: typeToCode(row.recommendationType),
    status: statusToCode(row.status),
    title: row.title,
    summary: row.summary,
    recommendedProduct: row.recommendedProduct,
    recommendedTier: row.recommendedTier,
    recommendedLimit: row.recommendedLimit != null ? decimalToNumber(row.recommendedLimit) : null,
    recommendedRate: row.recommendedRate != null ? decimalToNumber(row.recommendedRate) : null,
    confidenceScore: row.confidenceScore,
    reasons: parseReasons(row.reasons),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    reviewedByUserId: row.reviewedByUserId,
  };
}

async function resolvePrimaryBusinessCard(companyId: string) {
  return prisma.altaCard.findFirst({
    where: { companyId, cardType: "BUSINESS", status: { notIn: ["CLOSED", "EXPIRED"] } },
    orderBy: { createdAt: "asc" },
  });
}

function buildCompanyRecommendationDrafts(
  companyId: string,
  profile: Awaited<ReturnType<typeof calculateCompanyRelationshipProfile>>,
  businessCard: Awaited<ReturnType<typeof resolvePrimaryBusinessCard>>,
): DraftRecommendation[] {
  const drafts: DraftRecommendation[] = [];

  if (businessCard) {
    const currentLimit = decimalToNumber(businessCard.creditLimit);
    const suggestedLimit = computeRecommendedBusinessCreditLimit(profile, currentLimit);
    if (suggestedLimit > currentLimit) {
      drafts.push({
        recommendationType: "BUSINESS_ALTA_CARD_LIMIT",
        title: "Higher business Alta Card limit",
        summary: `Suggested limit ${formatAltaCardCurrency(suggestedLimit)} based on business assets and relationship score.`,
        recommendedProduct: "Business Alta Card",
        recommendedLimit: suggestedLimit,
        confidenceScore: Math.min(70 + Math.floor(profile.relationshipScore / 20), 95),
        reasons: {
          bullets: [
            `Total business assets: ${formatAltaCardCurrency(profile.totalBusinessAssets)}`,
            `Current limit: ${formatAltaCardCurrency(currentLimit)}`,
            `Relationship score: ${profile.relationshipScore}`,
          ],
          actionPath: {
            label: "Review business card",
            href: `/bank/alta-card/business/${companyId}`,
          },
        },
      });
    }

    const currentRate = decimalToNumber(businessCard.interestRate);
    const suggestedRate = computeRecommendedBusinessInterestRate(profile);
    if (suggestedRate < currentRate) {
      drafts.push({
        recommendationType: "BUSINESS_ALTA_CARD_RATE",
        title: "Lower business card rate",
        summary: `Suggested rate ${formatAltaCardRate(suggestedRate)} based on company relationship strength.`,
        recommendedProduct: "Business Alta Card",
        recommendedRate: suggestedRate,
        confidenceScore: Math.min(60 + Math.floor(profile.relationshipScore / 25), 90),
        reasons: {
          bullets: [
            `Current rate: ${formatAltaCardRate(currentRate)}`,
            `Suggested rate: ${formatAltaCardRate(suggestedRate)}`,
            `On-time business card payment history considered`,
          ],
        },
      });
    }
  }

  if (qualifiesForBusinessLoanOpportunity(profile)) {
    drafts.push({
      recommendationType: "BUSINESS_LOAN_OPPORTUNITY",
      title: "Business lending opportunity",
      summary: "Company relationship profile supports a business lending review.",
      recommendedProduct: "Business credit line",
      confidenceScore: computeBusinessLoanOpportunityConfidence(profile),
      reasons: {
        bullets: [
          `Relationship score: ${profile.relationshipScore}`,
          `Lifetime deposits: ${formatAltaCardCurrency(profile.lifetimeDeposits)}`,
          profile.productHoldings.paidOffBusinessLoans > 0
            ? `${profile.productHoldings.paidOffBusinessLoans} paid-off business loan(s)`
            : "Active business banking relationship",
        ],
        actionPath: { label: "Lending review", href: "/internal/lending" },
      },
    });
  }

  if (profile.lifetimeAltaPayVolume >= BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME) {
    drafts.push({
      recommendationType: "TREASURY_PRODUCT_OPPORTUNITY",
      title: "Treasury products (future)",
      summary: "Strong Alta Pay volume may qualify for treasury products when available.",
      recommendedProduct: "Treasury",
      confidenceScore: 55,
      reasons: {
        bullets: [
          `Alta Pay volume: ${formatAltaCardCurrency(profile.lifetimeAltaPayVolume)}`,
          "Treasury products are not yet available — placeholder recommendation",
        ],
      },
    });
  }

  if (qualifiesForCommercialBankingInvite(profile)) {
    drafts.push({
      recommendationType: "COMMERCIAL_BANKING_ELIGIBILITY",
      title: "Commercial banking eligibility",
      summary: "Company meets Alta Commercial Banking eligibility thresholds.",
      recommendedProduct: "Commercial Banking",
      confidenceScore: computeCommercialBankingInviteConfidence(profile),
      reasons: {
        bullets: [
          `Total business assets: ${formatAltaCardCurrency(profile.totalBusinessAssets)}`,
          `Relationship score: ${profile.relationshipScore}`,
          "Enrollment requires Alta review — not automatic",
        ],
        actionPath: {
          label: "Company relationship profile",
          href: `/internal/companies/${companyId}`,
        },
      },
    });
  }

  return drafts;
}

async function resolveAuditActorId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

export async function generateCompanyRelationshipRecommendations(
  companyId: string,
  actorUserId?: string,
  options?: { allowSystemRefresh?: boolean; profileRow?: CompanyRelationshipProfileRow },
): Promise<CompanyRelationshipRecommendationRow[]> {
  if (!options?.allowSystemRefresh) {
    await requireOperator();
  }

  let profileRow = options?.profileRow ?? (await getCompanyRelationshipProfile(companyId));
  if (!profileRow) {
    profileRow = await refreshCompanyRelationshipProfile(companyId, actorUserId, {
      allowSystemRefresh: options?.allowSystemRefresh,
      skipRecommendations: true,
    });
  }

  const calculated = await calculateCompanyRelationshipProfile(companyId);
  const businessCard = await resolvePrimaryBusinessCard(companyId);
  const drafts = buildCompanyRecommendationDrafts(companyId, calculated, businessCard);

  const draftTypes = drafts.map((draft) => typeToDb(draft.recommendationType));
  if (draftTypes.length > 0) {
    await prisma.companyRelationshipRecommendation.updateMany({
      where: {
        companyId,
        status: "ACTIVE",
        recommendationType: { in: draftTypes },
      },
      data: { status: "EXPIRED", updatedAt: new Date() },
    });
  }

  const created = await Promise.all(
    drafts.map((draft) =>
      prisma.companyRelationshipRecommendation.create({
        data: {
          companyId,
          profileId: profileRow!.id,
          recommendationType: typeToDb(draft.recommendationType),
          title: draft.title,
          summary: draft.summary,
          recommendedProduct: draft.recommendedProduct ?? null,
          recommendedTier: draft.recommendedTier ?? null,
          recommendedLimit: draft.recommendedLimit ?? null,
          recommendedRate: draft.recommendedRate ?? null,
          confidenceScore: draft.confidenceScore,
          reasons: draft.reasons as Prisma.InputJsonValue,
        },
      }),
    ),
  );

  await writeAuditLog({
    actorUserId: await resolveAuditActorId(actorUserId),
    targetCompanyId: companyId,
    action: "COMPANY_RELATIONSHIP_RECOMMENDATIONS_GENERATED",
    entityType: "COMPANY",
    entityId: profileRow.id,
    description: `Generated ${created.length} company recommendations`,
    metadata: { companyId, count: created.length },
  });

  return created.map(mapRecommendationRow);
}

export async function getCompanyRelationshipRecommendations(
  companyId: string,
  options?: { status?: "ACTIVE" | "ALL" },
): Promise<CompanyRelationshipRecommendationRow[]> {
  await requireOperator();
  const rows = await prisma.companyRelationshipRecommendation.findMany({
    where: {
      companyId,
      ...(options?.status === "ACTIVE" ? { status: "ACTIVE" } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapRecommendationRow);
}

export async function getCustomerCompanyRelationshipOpportunities(
  companyId: string,
): Promise<CompanyCustomerOpportunity[]> {
  const rows = await prisma.companyRelationshipRecommendation.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { confidenceScore: "desc" },
    take: 3,
  });

  const opportunities: CompanyCustomerOpportunity[] = [];
  for (const row of rows) {
    if (row.recommendationType === "COMMERCIAL_BANKING_ELIGIBILITY") {
      opportunities.push({
        title: "Commercial Banking",
        message: COMPANY_CUSTOMER_OPPORTUNITY_COPY.commercialReview,
      });
    } else if (row.recommendationType === "BUSINESS_LOAN_OPPORTUNITY") {
      opportunities.push({
        title: "Business lending",
        message: COMPANY_CUSTOMER_OPPORTUNITY_COPY.businessLending,
      });
    } else if (row.recommendationType === "TREASURY_PRODUCT_OPPORTUNITY") {
      opportunities.push({
        title: "Treasury",
        message: COMPANY_CUSTOMER_OPPORTUNITY_COPY.altaPayGrowth,
      });
    }
  }
  return opportunities;
}

export async function dismissCompanyRelationshipRecommendation(
  recommendationId: string,
  actorUserId: string,
): Promise<CompanyRelationshipRecommendationRow> {
  await requireOperator();
  const updated = await prisma.companyRelationshipRecommendation.update({
    where: { id: recommendationId },
    data: { status: "DISMISSED", dismissedAt: new Date(), reviewedByUserId: actorUserId },
  });
  await writeAuditLog({
    actorUserId,
    targetCompanyId: updated.companyId,
    action: "COMPANY_RELATIONSHIP_RECOMMENDATION_DISMISSED",
    entityType: "COMPANY",
    entityId: updated.id,
    description: "Company recommendation dismissed",
    metadata: { companyId: updated.companyId, recommendationId },
  });
  return mapRecommendationRow(updated);
}

export async function markCompanyRecommendationReviewed(
  recommendationId: string,
  actorUserId: string,
): Promise<CompanyRelationshipRecommendationRow> {
  await requireOperator();
  const updated = await prisma.companyRelationshipRecommendation.update({
    where: { id: recommendationId },
    data: { status: "REVIEWED", reviewedByUserId: actorUserId },
  });
  await writeAuditLog({
    actorUserId,
    targetCompanyId: updated.companyId,
    action: "COMPANY_RELATIONSHIP_RECOMMENDATION_REVIEWED",
    entityType: "COMPANY",
    entityId: updated.id,
    description: "Company recommendation reviewed",
    metadata: { companyId: updated.companyId, recommendationId },
  });
  return mapRecommendationRow(updated);
}

export async function acceptCompanyRelationshipRecommendation(
  recommendationId: string,
  actorUserId: string,
): Promise<CompanyRelationshipRecommendationRow> {
  await requireOperator();
  const updated = await prisma.companyRelationshipRecommendation.update({
    where: { id: recommendationId },
    data: { status: "ACCEPTED", acceptedAt: new Date(), reviewedByUserId: actorUserId },
  });
  await writeAuditLog({
    actorUserId,
    targetCompanyId: updated.companyId,
    action: "COMPANY_RELATIONSHIP_RECOMMENDATION_ACCEPTED",
    entityType: "COMPANY",
    entityId: updated.id,
    description: "Company recommendation accepted — manual follow-up required",
    metadata: { companyId: updated.companyId, recommendationId },
  });
  return mapRecommendationRow(updated);
}

export async function refreshCompanyRecommendationsForAllProfiles(actorUserId?: string): Promise<{
  processed: number;
  generated: number;
  failed: number;
}> {
  const profiles = await prisma.companyRelationshipProfile.findMany({ select: { companyId: true } });
  let generated = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      const rows = await generateCompanyRelationshipRecommendations(profile.companyId, actorUserId, {
        allowSystemRefresh: true,
      });
      generated += rows.length;
    } catch {
      failed += 1;
    }
  }

  return { processed: profiles.length, generated, failed };
}

export { COMPANY_RECOMMENDATION_TYPE_LABELS };
