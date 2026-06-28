-- Relationship Intelligence V1

CREATE TYPE "RelationshipTier" AS ENUM (
  'NEW',
  'STANDARD',
  'PREFERRED',
  'PREMIER',
  'PRIVATE_ELIGIBLE',
  'PRIVATE_CLIENT'
);

CREATE TABLE "RelationshipProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "relationshipSince" TIMESTAMP(3) NOT NULL,
  "relationshipScore" INTEGER NOT NULL DEFAULT 0,
  "relationshipTier" "RelationshipTier" NOT NULL DEFAULT 'NEW',
  "privateBankingEligible" BOOLEAN NOT NULL DEFAULT false,
  "privateBankingClient" BOOLEAN NOT NULL DEFAULT false,
  "totalBankAssets" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalInvestments" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAltaAssets" DECIMAL(18,2) NOT NULL DEFAULT 0,
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
  "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RelationshipProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelationshipProfileSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "relationshipScore" INTEGER NOT NULL,
  "relationshipTier" "RelationshipTier" NOT NULL,
  "totalBankAssets" DECIMAL(18,2) NOT NULL,
  "totalAltaAssets" DECIMAL(18,2) NOT NULL,
  "currentCreditExposure" DECIMAL(18,2) NOT NULL,
  "privateBankingEligible" BOOLEAN NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "RelationshipProfileSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelationshipProfile_userId_key" ON "RelationshipProfile"("userId");
CREATE INDEX "RelationshipProfile_relationshipTier_idx" ON "RelationshipProfile"("relationshipTier");
CREATE INDEX "RelationshipProfile_relationshipScore_idx" ON "RelationshipProfile"("relationshipScore");
CREATE INDEX "RelationshipProfile_privateBankingEligible_idx" ON "RelationshipProfile"("privateBankingEligible");
CREATE INDEX "RelationshipProfile_totalAltaAssets_idx" ON "RelationshipProfile"("totalAltaAssets");
CREATE INDEX "RelationshipProfile_lastCalculatedAt_idx" ON "RelationshipProfile"("lastCalculatedAt");

CREATE INDEX "RelationshipProfileSnapshot_userId_calculatedAt_idx" ON "RelationshipProfileSnapshot"("userId", "calculatedAt");
CREATE INDEX "RelationshipProfileSnapshot_profileId_idx" ON "RelationshipProfileSnapshot"("profileId");
CREATE INDEX "RelationshipProfileSnapshot_relationshipTier_idx" ON "RelationshipProfileSnapshot"("relationshipTier");

ALTER TABLE "RelationshipProfile" ADD CONSTRAINT "RelationshipProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipProfileSnapshot" ADD CONSTRAINT "RelationshipProfileSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipProfileSnapshot" ADD CONSTRAINT "RelationshipProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RelationshipProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
