-- Unified onboarding Phase 1: core eligibility/legal consent + LegalAcceptance.
-- Forward-only. Does not backfill Minecraft verification or legal acceptances.
-- Existing users remain valid rows with null onboarding/legal timestamps.

CREATE TYPE "LegalAcceptanceType" AS ENUM ('AGREED', 'ACKNOWLEDGED', 'CONSENTED');

CREATE TYPE "LegalConsentScope" AS ENUM ('CORE', 'BANK', 'TERMINAL', 'ALTA_CARD', 'LENDING', 'COMMERCIAL');

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'LEGAL_ACCEPTANCE';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ONBOARDING';

ALTER TABLE "User"
  ADD COLUMN "minecraftUuid" TEXT,
  ADD COLUMN "minecraftVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "eligibilityConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "coreOnboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_minecraftUuid_key" ON "User"("minecraftUuid");
CREATE INDEX "User_coreOnboardingCompletedAt_idx" ON "User"("coreOnboardingCompletedAt");
CREATE INDEX "User_minecraftVerifiedAt_idx" ON "User"("minecraftVerifiedAt");

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "acceptanceType" "LegalAcceptanceType" NOT NULL,
    "consentScope" "LegalConsentScope" NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalAcceptance_userId_documentId_documentVersion_acceptanceType_key"
  ON "LegalAcceptance"("userId", "documentId", "documentVersion", "acceptanceType");

CREATE INDEX "LegalAcceptance_userId_idx" ON "LegalAcceptance"("userId");
CREATE INDEX "LegalAcceptance_documentId_idx" ON "LegalAcceptance"("documentId");
CREATE INDEX "LegalAcceptance_consentScope_idx" ON "LegalAcceptance"("consentScope");
CREATE INDEX "LegalAcceptance_acceptedAt_idx" ON "LegalAcceptance"("acceptedAt");
CREATE INDEX "LegalAcceptance_userId_consentScope_idx" ON "LegalAcceptance"("userId", "consentScope");
CREATE INDEX "LegalAcceptance_userId_documentId_idx" ON "LegalAcceptance"("userId", "documentId");

ALTER TABLE "LegalAcceptance"
  ADD CONSTRAINT "LegalAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
