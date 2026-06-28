-- Relationship Intelligence V2 — Recommendations

CREATE TYPE "RelationshipRecommendationType" AS ENUM (
  'ALTA_CARD_TIER',
  'ALTA_CARD_LIMIT',
  'ALTA_CARD_RATE',
  'LOAN_PRE_APPROVAL',
  'PRIVATE_BANKING_INVITE',
  'PRODUCT_OPPORTUNITY'
);

CREATE TYPE "RelationshipRecommendationStatus" AS ENUM (
  'ACTIVE',
  'REVIEWED',
  'DISMISSED',
  'ACCEPTED',
  'EXPIRED'
);

CREATE TABLE "RelationshipRecommendation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "recommendationType" "RelationshipRecommendationType" NOT NULL,
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

  CONSTRAINT "RelationshipRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RelationshipRecommendation_userId_status_idx" ON "RelationshipRecommendation"("userId", "status");
CREATE INDEX "RelationshipRecommendation_profileId_idx" ON "RelationshipRecommendation"("profileId");
CREATE INDEX "RelationshipRecommendation_recommendationType_idx" ON "RelationshipRecommendation"("recommendationType");
CREATE INDEX "RelationshipRecommendation_createdAt_idx" ON "RelationshipRecommendation"("createdAt");

ALTER TABLE "RelationshipRecommendation" ADD CONSTRAINT "RelationshipRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipRecommendation" ADD CONSTRAINT "RelationshipRecommendation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RelationshipProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipRecommendation" ADD CONSTRAINT "RelationshipRecommendation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
