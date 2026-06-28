-- CreateEnum
CREATE TYPE "CompanyRelationshipTier" AS ENUM ('NEW', 'STANDARD', 'PREFERRED', 'PREMIER', 'COMMERCIAL_ELIGIBLE');

-- CreateEnum
CREATE TYPE "CompanyRelationshipRecommendationType" AS ENUM ('BUSINESS_ALTA_CARD_LIMIT', 'BUSINESS_ALTA_CARD_RATE', 'BUSINESS_LOAN_OPPORTUNITY', 'TREASURY_PRODUCT_OPPORTUNITY', 'COMMERCIAL_BANKING_ELIGIBILITY');

-- CreateEnum
CREATE TYPE "CompanyRelationshipTimelineEventType" AS ENUM ('RELATIONSHIP_STARTED', 'BUSINESS_ACCOUNT_OPENED', 'DEPOSIT_MILESTONE', 'WITHDRAWAL_MILESTONE', 'ALTA_PAY_MILESTONE', 'ALTA_CARD_OPENED', 'ALTA_CARD_TIER_CHANGED', 'ALTA_CARD_LIMIT_CHANGED', 'LOAN_APPLICATION_SUBMITTED', 'LOAN_FUNDED', 'LOAN_PAID_OFF', 'LOAN_PAYMENT_MADE', 'COMMERCIAL_BANKING_ELIGIBLE', 'RELATIONSHIP_SCORE_CHANGED', 'RELATIONSHIP_TIER_CHANGED', 'MANUAL_NOTE');

-- CreateTable
CREATE TABLE "CompanyRelationshipProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "relationshipSince" TIMESTAMP(3) NOT NULL,
    "relationshipScore" INTEGER NOT NULL DEFAULT 0,
    "relationshipTier" "CompanyRelationshipTier" NOT NULL DEFAULT 'NEW',
    "commercialBankingEligible" BOOLEAN NOT NULL DEFAULT false,
    "totalBusinessAssets" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeDeposits" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeWithdrawals" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeInterestEarned" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeInterestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeAltaPayVolume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeLoanPayments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeCardPayments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activeLoanBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activeCardBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentCreditExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activeBusinessAccounts" INTEGER NOT NULL DEFAULT 0,
    "activeBusinessLoans" INTEGER NOT NULL DEFAULT 0,
    "activeBusinessCards" INTEGER NOT NULL DEFAULT 0,
    "paidOffBusinessLoans" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRelationshipProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRelationshipProfileSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "relationshipScore" INTEGER NOT NULL,
    "relationshipTier" "CompanyRelationshipTier" NOT NULL,
    "totalBusinessAssets" DECIMAL(18,2) NOT NULL,
    "currentCreditExposure" DECIMAL(18,2) NOT NULL,
    "commercialBankingEligible" BOOLEAN NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CompanyRelationshipProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRelationshipRecommendation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "recommendationType" "CompanyRelationshipRecommendationType" NOT NULL,
    "status" "RelationshipRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedProduct" TEXT,
    "recommendedTier" TEXT,
    "recommendedLimit" DECIMAL(18,2),
    "recommendedRate" DECIMAL(10,6),
    "confidenceScore" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "CompanyRelationshipRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRelationshipTimelineEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileId" TEXT,
    "eventType" "CompanyRelationshipTimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyRelationshipTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRelationshipProfile_companyId_key" ON "CompanyRelationshipProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfile_relationshipTier_idx" ON "CompanyRelationshipProfile"("relationshipTier");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfile_relationshipScore_idx" ON "CompanyRelationshipProfile"("relationshipScore");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfile_commercialBankingEligible_idx" ON "CompanyRelationshipProfile"("commercialBankingEligible");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfile_totalBusinessAssets_idx" ON "CompanyRelationshipProfile"("totalBusinessAssets");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfile_lastCalculatedAt_idx" ON "CompanyRelationshipProfile"("lastCalculatedAt");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfileSnapshot_companyId_calculatedAt_idx" ON "CompanyRelationshipProfileSnapshot"("companyId", "calculatedAt");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfileSnapshot_profileId_idx" ON "CompanyRelationshipProfileSnapshot"("profileId");

-- CreateIndex
CREATE INDEX "CompanyRelationshipProfileSnapshot_relationshipTier_idx" ON "CompanyRelationshipProfileSnapshot"("relationshipTier");

-- CreateIndex
CREATE INDEX "CompanyRelationshipRecommendation_companyId_status_idx" ON "CompanyRelationshipRecommendation"("companyId", "status");

-- CreateIndex
CREATE INDEX "CompanyRelationshipRecommendation_profileId_idx" ON "CompanyRelationshipRecommendation"("profileId");

-- CreateIndex
CREATE INDEX "CompanyRelationshipRecommendation_recommendationType_idx" ON "CompanyRelationshipRecommendation"("recommendationType");

-- CreateIndex
CREATE INDEX "CompanyRelationshipRecommendation_createdAt_idx" ON "CompanyRelationshipRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyRelationshipTimelineEvent_companyId_occurredAt_idx" ON "CompanyRelationshipTimelineEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "CompanyRelationshipTimelineEvent_profileId_idx" ON "CompanyRelationshipTimelineEvent"("profileId");

-- CreateIndex
CREATE INDEX "CompanyRelationshipTimelineEvent_eventType_idx" ON "CompanyRelationshipTimelineEvent"("eventType");

-- CreateIndex
CREATE INDEX "CompanyRelationshipTimelineEvent_relatedEntityType_relatedEntityId_idx" ON "CompanyRelationshipTimelineEvent"("relatedEntityType", "relatedEntityId");

-- AddForeignKey
ALTER TABLE "CompanyRelationshipProfile" ADD CONSTRAINT "CompanyRelationshipProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipProfileSnapshot" ADD CONSTRAINT "CompanyRelationshipProfileSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipProfileSnapshot" ADD CONSTRAINT "CompanyRelationshipProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyRelationshipProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipRecommendation" ADD CONSTRAINT "CompanyRelationshipRecommendation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipRecommendation" ADD CONSTRAINT "CompanyRelationshipRecommendation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyRelationshipProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipRecommendation" ADD CONSTRAINT "CompanyRelationshipRecommendation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipTimelineEvent" ADD CONSTRAINT "CompanyRelationshipTimelineEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationshipTimelineEvent" ADD CONSTRAINT "CompanyRelationshipTimelineEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyRelationshipProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
