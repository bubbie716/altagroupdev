import type {
  RelationshipRecommendationStatus as DbRecommendationStatus,
  RelationshipRecommendationType as DbRecommendationType,
  Prisma,
} from "@prisma/client";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency, formatAltaCardRate } from "@/lib/bank/alta-card-types";
import { toAltaCardTierCode } from "@/server/alta-card-mapper";
import {
  ALTA_CARD_TIER_RANK,
  BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME,
  CUSTOMER_OPPORTUNITY_COPY,
  RECOMMENDATION_TYPE_LABELS,
  computeLoanPreApprovalConfidence,
  computePrivateBankingInviteConfidence,
  computeRecommendedCreditLimit,
  computeRecommendedInterestRate,
  qualifiesForLoanPreApproval,
  qualifiesForPrivateBankingInvite,
  recommendedAltaCardTierFromRelationship,
  tierLabel,
  type RecommendationReasonPayload,
} from "@/lib/bank/relationship-recommendation-config";
import { displayRelationshipTierLabel } from "@/lib/bank/relationship-terminology";
import type {
  CustomerRelationshipOpportunity,
  RelationshipProfileRow,
  RelationshipRecommendationReason,
  RelationshipRecommendationRow,
  RelationshipRecommendationStatusCode,
  RelationshipRecommendationTypeCode,
} from "@/lib/bank/relationship-intelligence-types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireAuth } from "@/server/auth.service";
import { requireOperator } from "@/server/permissions.service";
import {
  calculateRelationshipProfile,
  getRelationshipProfile,
  refreshRelationshipProfile,
} from "@/server/relationship-intelligence.service";

type DraftRecommendation = {
  recommendationType: RelationshipRecommendationTypeCode;
  title: string;
  summary: string;
  recommendedProduct?: string;
  recommendedTier?: AltaCardTierCode;
  recommendedLimit?: number;
  recommendedRate?: number;
  confidenceScore: number;
  reasons: RecommendationReasonPayload;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function typeToCode(type: DbRecommendationType): RelationshipRecommendationTypeCode {
  return type as RelationshipRecommendationTypeCode;
}

function typeToDb(type: RelationshipRecommendationTypeCode): DbRecommendationType {
  return type as DbRecommendationType;
}

function statusToCode(status: DbRecommendationStatus): RelationshipRecommendationStatusCode {
  return status as RelationshipRecommendationStatusCode;
}

function parseReasons(value: Prisma.JsonValue): RelationshipRecommendationReason {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { bullets: [] };
  }
  const record = value as Record<string, unknown>;
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.filter((item): item is string => typeof item === "string")
    : [];
  const actionPath =
    record.actionPath && typeof record.actionPath === "object" && !Array.isArray(record.actionPath)
      ? (record.actionPath as RelationshipRecommendationReason["actionPath"])
      : undefined;
  return { bullets, actionPath };
}

function mapRecommendationRow(row: {
  id: string;
  userId: string;
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
}): RelationshipRecommendationRow {
  return {
    id: row.id,
    userId: row.userId,
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

async function resolveAuditActorId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

function factorCount(profile: Awaited<ReturnType<typeof calculateRelationshipProfile>>, key: string): number {
  const factor = profile.factors.find((f) => f.key === key);
  if (!factor) return 0;
  const parsed = Number.parseInt(factor.value, 10);
  return Number.isFinite(parsed) ? parsed : factor.impact < 0 ? 1 : 0;
}

async function resolvePrimaryAltaCard(userId: string) {
  return prisma.altaCard.findFirst({
    where: {
      ownerUserId: userId,
      status: { in: ["ACTIVE", "FROZEN", "DELINQUENT"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      tier: true,
      creditLimit: true,
      interestRate: true,
    },
  });
}

function buildAltaCardActionPath(
  cardId: string,
  recommendationId: string,
  values: { tier?: AltaCardTierCode; limit?: number; rate?: number },
): RecommendationReasonPayload["actionPath"] {
  return {
    to: "/internal/alta-card/$cardId",
    params: { cardId },
    search: {
      recommendationId,
      ...(values.tier ? { suggestedTier: values.tier } : {}),
      ...(values.limit != null ? { suggestedLimit: values.limit } : {}),
      ...(values.rate != null ? { suggestedRate: values.rate } : {}),
    },
  };
}

function buildDraftRecommendations(input: {
  profile: Awaited<ReturnType<typeof calculateRelationshipProfile>>;
  primaryCard: Awaited<ReturnType<typeof resolvePrimaryAltaCard>>;
  userId: string;
}): DraftRecommendation[] {
  const { profile, primaryCard, userId } = input;
  const recommendedTier = recommendedAltaCardTierFromRelationship(
    profile.relationshipTier,
    profile.privateBankingClient,
  );
  const recommendedLimit = computeRecommendedCreditLimit({
    recommendedTier,
    totalBankAssets: profile.totalBankAssets,
    relationshipScore: profile.relationshipScore,
    currentCreditExposure: profile.currentCreditExposure,
  });
  const recommendedRate = computeRecommendedInterestRate({
    recommendedTier,
    relationshipScore: profile.relationshipScore,
    isPrivateClient: profile.privateBankingClient,
  });

  const hasBusinessAccounts = profile.productsHeld.businessCompanies > 0;
  const drafts: DraftRecommendation[] = [];

  const currentTier = primaryCard ? toAltaCardTierCode(primaryCard.tier) : null;
  const currentLimit = primaryCard ? decimalToNumber(primaryCard.creditLimit) : null;
  const currentRate = primaryCard ? decimalToNumber(primaryCard.interestRate) : null;

  const tierUpgradeNeeded =
    !currentTier || ALTA_CARD_TIER_RANK[recommendedTier] > ALTA_CARD_TIER_RANK[currentTier];
  if (tierUpgradeNeeded) {
    const confidence = Math.min(
      95,
      55 +
        Math.floor(profile.relationshipScore / 20) +
        (profile.privateBankingClient ? 15 : 0),
    );
    drafts.push({
      recommendationType: "ALTA_CARD_TIER",
      title: `Recommend ${tierLabel(recommendedTier)} tier`,
      summary: currentTier
        ? `Relationship profile supports upgrading from ${tierLabel(currentTier)} to ${tierLabel(recommendedTier)}. Admin review required.`
        : `Relationship profile supports ${tierLabel(recommendedTier)} for a new Alta Card relationship.`,
      recommendedProduct: "ALTA_CARD",
      recommendedTier,
      confidenceScore: confidence,
      reasons: {
        bullets: [
          `Relationship tier: ${displayRelationshipTierLabel(profile.relationshipTier, profile.relationshipScore)}`,
          `Relationship score: ${profile.relationshipScore}`,
          `Total Alta assets: ${formatAltaCardCurrency(profile.totalAltaAssets)}`,
          profile.privateBankingClient
            ? "Alta Private member — Gold Card available by request"
            : "Tier mapped from relationship standing",
        ],
        actionPath: primaryCard
          ? buildAltaCardActionPath(primaryCard.id, "pending", { tier: recommendedTier })
          : {
              to: "/internal/alta-card/applications",
              search: { suggestedUserId: userId, suggestedTier: recommendedTier },
            },
      },
    });
  }

  const limitIncreaseNeeded =
    !currentLimit || recommendedLimit > currentLimit * 1.05;
  if (limitIncreaseNeeded && (primaryCard || profile.productsHeld.activeAltaCards === 0)) {
    const confidence = Math.min(
      92,
      50 +
        Math.floor(profile.relationshipScore / 18) +
        (profile.lifetimeCardPayments > 5_000 ? 10 : 0) -
        (profile.currentCreditExposure > profile.totalBankAssets * 0.5 ? 15 : 0),
    );
    if (confidence >= 45) {
      drafts.push({
        recommendationType: "ALTA_CARD_LIMIT",
        title: `Recommend ${formatAltaCardCurrency(recommendedLimit)} credit limit`,
        summary: currentLimit
          ? `Suggested limit increase from ${formatAltaCardCurrency(currentLimit)} based on assets, score, and exposure.`
          : `Suggested initial limit of ${formatAltaCardCurrency(recommendedLimit)} based on relationship profile.`,
        recommendedProduct: "ALTA_CARD",
        recommendedTier,
        recommendedLimit,
        confidenceScore: confidence,
        reasons: {
          bullets: [
            `Total bank assets: ${formatAltaCardCurrency(profile.totalBankAssets)}`,
            `Current credit exposure: ${formatAltaCardCurrency(profile.currentCreditExposure)}`,
            `Lifetime card payments: ${formatAltaCardCurrency(profile.lifetimeCardPayments)}`,
            `Relationship score: ${profile.relationshipScore}`,
          ],
          actionPath: primaryCard
            ? buildAltaCardActionPath(primaryCard.id, "pending", {
                tier: recommendedTier,
                limit: recommendedLimit,
              })
            : {
                to: "/internal/alta-card/applications",
                search: { suggestedUserId: userId, suggestedLimit: recommendedLimit },
              },
        },
      });
    }
  }

  const rateReductionNeeded =
    !currentRate || recommendedRate < currentRate - 0.25;
  if (rateReductionNeeded) {
    const confidence = Math.min(
      90,
      48 + Math.floor(profile.relationshipScore / 16) + (profile.privateBankingClient ? 12 : 0),
    );
    drafts.push({
      recommendationType: "ALTA_CARD_RATE",
      title: `Recommend ${formatAltaCardRate(recommendedRate)} APR`,
      summary: currentRate
        ? `Suggested rate improvement from ${formatAltaCardRate(currentRate)} based on relationship pricing.`
        : `Suggested introductory rate of ${formatAltaCardRate(recommendedRate)} from relationship profile.`,
      recommendedProduct: "ALTA_CARD",
      recommendedTier,
      recommendedRate,
      confidenceScore: confidence,
      reasons: {
        bullets: [
          `Relationship score: ${profile.relationshipScore}`,
          profile.privateBankingClient
            ? "Alta Private member — negotiable relationship pricing"
            : "Score-based relationship pricing discount applied",
          `Recommended tier context: ${tierLabel(recommendedTier)}`,
        ],
        actionPath: primaryCard
          ? buildAltaCardActionPath(primaryCard.id, "pending", {
              tier: recommendedTier,
              rate: recommendedRate,
            })
          : {
              to: "/internal/alta-card/applications",
              search: { suggestedUserId: userId, suggestedRate: recommendedRate },
            },
      },
    });
  }

  const delinquentCards = factorCount(profile, "delinquent_cards");
  const defaultedLoans = factorCount(profile, "defaulted_loans");
  const overdueInstallments = factorCount(profile, "overdue_installments");

  const loanQualifies = qualifiesForLoanPreApproval({
    relationshipScore: profile.relationshipScore,
    totalAltaAssets: profile.totalAltaAssets,
    lifetimeDeposits: profile.lifetimeDeposits,
    delinquentCards,
    defaultedLoans,
  });

  if (loanQualifies) {
    const confidence = computeLoanPreApprovalConfidence({
      relationshipScore: profile.relationshipScore,
      totalAltaAssets: profile.totalAltaAssets,
      lifetimeDeposits: profile.lifetimeDeposits,
      delinquentCards,
      defaultedLoans,
      overdueInstallments,
      paidOffLoans: profile.productsHeld.paidOffLoans,
    });
    drafts.push({
      recommendationType: "LOAN_PRE_APPROVAL",
      title: "Loan pre-approval review recommended",
      summary:
        "Relationship profile indicates the customer may qualify for preferred lending review. Underwriting approval still required.",
      recommendedProduct: "LOAN",
      confidenceScore: confidence,
      reasons: {
        bullets: [
          `Relationship score: ${profile.relationshipScore}`,
          `Total Alta assets: ${formatAltaCardCurrency(profile.totalAltaAssets)}`,
          `Lifetime deposits: ${formatAltaCardCurrency(profile.lifetimeDeposits)}`,
          profile.productsHeld.paidOffLoans > 0
            ? `${profile.productsHeld.paidOffLoans} paid-off loan(s) on file`
            : "Active banking relationship with sufficient activity",
        ],
        actionPath: {
          to: "/internal/lending",
          search: { preApprovalUserId: userId },
        },
      },
    });
  }

  if (
    qualifiesForPrivateBankingInvite({
      privateBankingEligible: profile.privateBankingEligible,
      privateBankingClient: profile.privateBankingClient,
      relationshipScore: profile.relationshipScore,
      totalAltaAssets: profile.totalAltaAssets,
      hasBusinessAccounts,
      lifetimeAltaPayVolume: profile.lifetimeAltaPayVolume,
    })
  ) {
    const confidence = computePrivateBankingInviteConfidence({
      relationshipScore: profile.relationshipScore,
      totalAltaAssets: profile.totalAltaAssets,
      privateBankingEligible: profile.privateBankingEligible,
      hasBusinessAccounts,
      lifetimeAltaPayVolume: profile.lifetimeAltaPayVolume,
    });
    drafts.push({
      recommendationType: "PRIVATE_BANKING_INVITE",
      title: "Private banking invitation recommended",
      summary:
        "Customer meets relationship thresholds for Alta Private review. Enrollment requires explicit admin approval.",
      recommendedProduct: "PRIVATE_BANKING",
      confidenceScore: confidence,
      reasons: {
        bullets: [
          profile.privateBankingEligible
            ? "Marked private banking eligible on relationship profile"
            : "High relationship score and asset threshold met",
          `Total Alta assets: ${formatAltaCardCurrency(profile.totalAltaAssets)}`,
          hasBusinessAccounts
            ? `Business relationship with Alta Pay volume ${formatAltaCardCurrency(profile.lifetimeAltaPayVolume)}`
            : "Personal relationship strength supports private review",
        ],
        actionPath: {
          to: "/internal/users/$userId",
          params: { userId },
          search: { privateReview: true },
        },
      },
    });
  }

  if (profile.productsHeld.activeAltaCards === 0 && profile.relationshipScore >= 400) {
    drafts.push({
      recommendationType: "PRODUCT_OPPORTUNITY",
      title: "Alta Card opportunity",
      summary: "Customer has banking relationship strength but no active Alta Card.",
      recommendedProduct: "ALTA_CARD",
      recommendedTier,
      confidenceScore: Math.min(85, 40 + Math.floor(profile.relationshipScore / 12)),
      reasons: {
        bullets: [
          `Relationship score: ${profile.relationshipScore}`,
          `Suggested starting tier: ${tierLabel(recommendedTier)}`,
          "No active Alta Card on file",
        ],
        actionPath: {
          to: "/internal/alta-card/applications",
          search: { suggestedUserId: userId },
        },
      },
    });
  }

  if (
    hasBusinessAccounts &&
    profile.lifetimeAltaPayVolume >= BUSINESS_ALTA_PAY_OPPORTUNITY_VOLUME &&
    profile.productsHeld.activeLoans === 0
  ) {
    drafts.push({
      recommendationType: "PRODUCT_OPPORTUNITY",
      title: "Business lending opportunity",
      summary: "Verified business activity with Alta Pay volume may support a lending conversation.",
      recommendedProduct: "BUSINESS_LOAN",
      confidenceScore: Math.min(80, 45 + Math.floor(profile.lifetimeAltaPayVolume / 10_000)),
      reasons: {
        bullets: [
          `${profile.productsHeld.businessCompanies} business relationship(s)`,
          `Alta Pay volume: ${formatAltaCardCurrency(profile.lifetimeAltaPayVolume)}`,
          "No active loans — expansion opportunity",
        ],
        actionPath: {
          to: "/internal/lending",
          search: { preApprovalUserId: userId },
        },
      },
    });
  }

  return drafts;
}

export async function generateRelationshipRecommendations(
  userId: string,
  actorUserId?: string,
  options?: { profileRow?: RelationshipProfileRow },
): Promise<RelationshipRecommendationRow[]> {
  let profileRow = options?.profileRow ?? (await getRelationshipProfile(userId));
  if (!profileRow) {
    profileRow = await refreshRelationshipProfile(userId, actorUserId, { skipRecommendations: true });
  }

  const calculated = await calculateRelationshipProfile(userId);
  const primaryCard = await resolvePrimaryAltaCard(userId);
  const drafts = buildDraftRecommendations({ profile: calculated, primaryCard, userId });

  const draftTypes = drafts.map((draft) => typeToDb(draft.recommendationType));
  if (draftTypes.length > 0) {
    await prisma.relationshipRecommendation.updateMany({
      where: {
        userId,
        status: "ACTIVE",
        recommendationType: { in: draftTypes },
      },
      data: { status: "EXPIRED" },
    });
  }

  const created: RelationshipRecommendationRow[] = [];

  for (const draft of drafts) {
    const row = await prisma.relationshipRecommendation.create({
      data: {
        userId,
        profileId: profileRow.id,
        recommendationType: typeToDb(draft.recommendationType),
        status: "ACTIVE",
        title: draft.title,
        summary: draft.summary,
        recommendedProduct: draft.recommendedProduct ?? null,
        recommendedTier: draft.recommendedTier ?? null,
        recommendedLimit: draft.recommendedLimit ?? null,
        recommendedRate: draft.recommendedRate ?? null,
        confidenceScore: draft.confidenceScore,
        reasons: {
          ...draft.reasons,
          actionPath: draft.reasons.actionPath
            ? {
                ...draft.reasons.actionPath,
                search: {
                  ...draft.reasons.actionPath.search,
                  recommendationId: "pending",
                },
              }
            : undefined,
        },
      },
    });

    const actionPath = draft.reasons.actionPath;
    const updatedReasons = actionPath
      ? {
          ...draft.reasons,
          actionPath: {
            ...actionPath,
            search: { ...actionPath.search, recommendationId: row.id },
          },
        }
      : draft.reasons;

    const finalRow =
      actionPath != null
        ? await prisma.relationshipRecommendation.update({
            where: { id: row.id },
            data: { reasons: updatedReasons },
          })
        : row;

    created.push(mapRecommendationRow(finalRow));
  }

  const actor = await resolveAuditActorId(actorUserId);
  await writeAuditLog({
    actorUserId: actor,
    targetUserId: userId,
    action: "RELATIONSHIP_RECOMMENDATIONS_GENERATED",
    entityType: "USER",
    entityId: profileRow.id,
    description: `Generated ${created.length} relationship recommendation(s)`,
    metadata: {
      userId,
      profileId: profileRow.id,
      count: created.length,
      types: created.map((r) => r.recommendationType),
      actorUserId: actorUserId ?? actor,
    },
  });

  return created;
}

export async function getRelationshipRecommendations(
  userId: string,
  options?: { status?: RelationshipRecommendationStatusCode | "ALL"; operatorOnly?: boolean },
): Promise<RelationshipRecommendationRow[]> {
  if (options?.operatorOnly !== false) {
    await requireOperator();
  } else {
    const auth = await requireAuth();
    if (auth.id !== userId) await requireOperator();
  }

  const where: Prisma.RelationshipRecommendationWhereInput = { userId };
  if (options?.status && options.status !== "ALL") {
    where.status = options.status as DbRecommendationStatus;
  }

  const rows = await prisma.relationshipRecommendation.findMany({
    where,
    orderBy: [{ status: "asc" }, { confidenceScore: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(mapRecommendationRow);
}

export async function getCustomerRelationshipOpportunities(
  userId: string,
): Promise<CustomerRelationshipOpportunity[]> {
  const auth = await requireAuth();
  if (auth.id !== userId) await requireOperator();

  const rows = await prisma.relationshipRecommendation.findMany({
    where: {
      userId,
      status: "ACTIVE",
      recommendationType: {
        in: [
          "ALTA_CARD_TIER",
          "ALTA_CARD_LIMIT",
          "ALTA_CARD_RATE",
          "LOAN_PRE_APPROVAL",
          "PRIVATE_BANKING_INVITE",
          "PRODUCT_OPPORTUNITY",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const opportunities: CustomerRelationshipOpportunity[] = [];

  for (const row of rows) {
    const type = typeToCode(row.recommendationType);
    if (seen.has(type)) continue;
    seen.add(type);
    opportunities.push({
      id: row.id,
      recommendationType: type,
      message: CUSTOMER_OPPORTUNITY_COPY[type] ?? row.title,
    });
  }

  return opportunities;
}

async function loadRecommendationForAction(id: string, actorUserId: string) {
  await requireOperator();
  const row = await prisma.relationshipRecommendation.findUnique({ where: { id } });
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export async function dismissRelationshipRecommendation(
  id: string,
  actorUserId: string,
): Promise<RelationshipRecommendationRow> {
  const row = await loadRecommendationForAction(id, actorUserId);
  if (row.status === "DISMISSED") return mapRecommendationRow(row);

  const updated = await prisma.relationshipRecommendation.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      reviewedByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    targetUserId: row.userId,
    action: "RELATIONSHIP_RECOMMENDATION_DISMISSED",
    entityType: "USER",
    entityId: row.id,
    description: `Dismissed ${RECOMMENDATION_TYPE_LABELS[typeToCode(row.recommendationType)]} recommendation`,
    metadata: {
      recommendationId: id,
      userId: row.userId,
      recommendationType: row.recommendationType,
      actorUserId,
    },
  });

  return mapRecommendationRow(updated);
}

export async function markRecommendationReviewed(
  id: string,
  actorUserId: string,
): Promise<RelationshipRecommendationRow> {
  const row = await loadRecommendationForAction(id, actorUserId);
  if (row.status === "REVIEWED" || row.status === "ACCEPTED" || row.status === "DISMISSED") {
    return mapRecommendationRow(row);
  }

  const updated = await prisma.relationshipRecommendation.update({
    where: { id },
    data: {
      status: "REVIEWED",
      reviewedByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    targetUserId: row.userId,
    action: "RELATIONSHIP_RECOMMENDATION_REVIEWED",
    entityType: "USER",
    entityId: row.id,
    description: `Reviewed ${RECOMMENDATION_TYPE_LABELS[typeToCode(row.recommendationType)]} recommendation`,
    metadata: {
      recommendationId: id,
      userId: row.userId,
      recommendationType: row.recommendationType,
      actorUserId,
    },
  });

  return mapRecommendationRow(updated);
}

export async function acceptRelationshipRecommendation(
  id: string,
  actorUserId: string,
): Promise<RelationshipRecommendationRow> {
  const row = await loadRecommendationForAction(id, actorUserId);

  const updated = await prisma.relationshipRecommendation.update({
    where: { id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      reviewedByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    targetUserId: row.userId,
    action: "RELATIONSHIP_RECOMMENDATION_ACCEPTED",
    entityType: "USER",
    entityId: row.id,
    description: `Accepted ${RECOMMENDATION_TYPE_LABELS[typeToCode(row.recommendationType)]} recommendation (admin follow-up required)`,
    metadata: {
      recommendationId: id,
      userId: row.userId,
      recommendationType: row.recommendationType,
      actionPath: parseReasons(row.reasons).actionPath ?? null,
      actorUserId,
    },
  });

  return mapRecommendationRow(updated);
}

export async function refreshRecommendationsForAllProfiles(actorUserId?: string): Promise<{
  processed: number;
  generated: number;
  failed: number;
}> {
  const profiles = await prisma.relationshipProfile.findMany({ select: { userId: true } });
  let generated = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      const rows = await generateRelationshipRecommendations(profile.userId, actorUserId);
      generated += rows.length;
    } catch {
      failed += 1;
    }
  }

  return { processed: profiles.length, generated, failed };
}
