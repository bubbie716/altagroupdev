-- Sprint 4B: participant application workflow + CERTIFICATION institution status.

-- AlterEnum FinancialInstitutionStatus: add CERTIFICATION
ALTER TYPE "FinancialInstitutionStatus" ADD VALUE IF NOT EXISTS 'CERTIFICATION';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NccParticipantApplicationStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'INFORMATION_REQUIRED',
    'TECHNICAL_REVIEW',
    'APPROVED_FOR_TEST',
    'CERTIFICATION',
    'APPROVED_FOR_LIVE',
    'REJECTED',
    'WITHDRAWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum AuditEntityType
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_PARTICIPANT_APPLICATION';

CREATE TABLE IF NOT EXISTS "NccParticipantApplication" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "status" "NccParticipantApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantUserId" TEXT NOT NULL,
    "institutionId" TEXT,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "institutionType" "FinancialInstitutionType" NOT NULL,
    "countryJurisdiction" TEXT NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "regulatoryAuthority" TEXT NOT NULL,
    "licenseOrRegistrationNumber" TEXT NOT NULL,
    "primaryContactName" TEXT NOT NULL,
    "primaryContactEmail" TEXT NOT NULL,
    "primaryContactPhone" TEXT,
    "complianceContactName" TEXT NOT NULL,
    "complianceContactEmail" TEXT NOT NULL,
    "technicalContactName" TEXT NOT NULL,
    "technicalContactEmail" TEXT NOT NULL,
    "settlementOpsContactName" TEXT NOT NULL,
    "settlementOpsContactEmail" TEXT NOT NULL,
    "expectedTransactionVolume" TEXT,
    "expectedPeakRate" TEXT,
    "expectedLiquidityRequirement" TEXT,
    "accountIdentifierFormat" JSONB NOT NULL,
    "intendedConnectionMethod" TEXT,
    "applicantNotes" TEXT,
    "requiredDocuments" JSONB,
    "informationRequestNote" TEXT,
    "applicantResponseNote" TEXT,
    "rejectionReason" TEXT,
    "testCredentialId" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NccParticipantApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccParticipantApplication_publicReference_key"
  ON "NccParticipantApplication"("publicReference");
CREATE INDEX IF NOT EXISTS "NccParticipantApplication_applicantUserId_status_idx"
  ON "NccParticipantApplication"("applicantUserId", "status");
CREATE INDEX IF NOT EXISTS "NccParticipantApplication_status_createdAt_idx"
  ON "NccParticipantApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "NccParticipantApplication_institutionId_idx"
  ON "NccParticipantApplication"("institutionId");

CREATE TABLE IF NOT EXISTS "NccParticipantApplicationTransition" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "NccParticipantApplicationStatus" NOT NULL,
    "toStatus" "NccParticipantApplicationStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NccParticipantApplicationTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccParticipantApplicationTransition_applicationId_createdAt_idx"
  ON "NccParticipantApplicationTransition"("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "NccParticipantApplicationTransition_actorUserId_idx"
  ON "NccParticipantApplicationTransition"("actorUserId");

CREATE TABLE IF NOT EXISTS "NccParticipantApplicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NccParticipantApplicationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccParticipantApplicationNote_applicationId_createdAt_idx"
  ON "NccParticipantApplicationNote"("applicationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplication"
    ADD CONSTRAINT "NccParticipantApplication_applicantUserId_fkey"
    FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplication"
    ADD CONSTRAINT "NccParticipantApplication_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplicationTransition"
    ADD CONSTRAINT "NccParticipantApplicationTransition_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "NccParticipantApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplicationTransition"
    ADD CONSTRAINT "NccParticipantApplicationTransition_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplicationNote"
    ADD CONSTRAINT "NccParticipantApplicationNote_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "NccParticipantApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantApplicationNote"
    ADD CONSTRAINT "NccParticipantApplicationNote_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
