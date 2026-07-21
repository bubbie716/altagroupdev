-- Sprint 4C: external connector, account directory, certification

DO $$ BEGIN
  CREATE TYPE "NccConnectorMode" AS ENUM ('API', 'DIRECTORY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccConnectorStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccConnectorCertificationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccDirectoryVersionStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'ACTIVE', 'SUPERSEDED', 'ROLLED_BACK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccDirectoryEntryStatus" AS ENUM ('ACTIVE', 'CLOSED', 'FROZEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccCertificationRunStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccCertificationCheckStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'SKIP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "NccParticipantConnector" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "mode" "NccConnectorMode" NOT NULL DEFAULT 'API',
    "baseUrl" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'HMAC_SHA256',
    "authSecretEncrypted" TEXT,
    "timeoutMs" INT NOT NULL DEFAULT 5000,
    "supportedCurrency" TEXT NOT NULL DEFAULT 'FLR',
    "status" "NccConnectorStatus" NOT NULL DEFAULT 'DRAFT',
    "certificationStatus" "NccConnectorCertificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "lastSuccessfulCheckAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "configuredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NccParticipantConnector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccParticipantConnector_institutionId_key" ON "NccParticipantConnector"("institutionId");
CREATE INDEX IF NOT EXISTS "NccParticipantConnector_status_idx" ON "NccParticipantConnector"("status");
CREATE INDEX IF NOT EXISTS "NccParticipantConnector_certificationStatus_idx" ON "NccParticipantConnector"("certificationStatus");

CREATE TABLE IF NOT EXISTS "NccAccountDirectoryVersion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "versionNumber" INT NOT NULL,
    "status" "NccDirectoryVersionStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT,
    "rowCounts" JSONB,
    "uploadedByUserId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NccAccountDirectoryVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccAccountDirectoryVersion_institutionId_currency_versionNumber_key"
  ON "NccAccountDirectoryVersion"("institutionId", "currency", "versionNumber");
CREATE INDEX IF NOT EXISTS "NccAccountDirectoryVersion_institutionId_currency_status_idx"
  ON "NccAccountDirectoryVersion"("institutionId", "currency", "status");

CREATE TABLE IF NOT EXISTS "NccAccountDirectoryEntry" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountIdentifier" TEXT NOT NULL,
    "participantAccountReference" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "status" "NccDirectoryEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "canDebit" BOOLEAN NOT NULL DEFAULT true,
    "canCredit" BOOLEAN NOT NULL DEFAULT true,
    "beneficiaryLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NccAccountDirectoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccAccountDirectoryEntry_versionId_accountIdentifier_key"
  ON "NccAccountDirectoryEntry"("versionId", "accountIdentifier");
CREATE INDEX IF NOT EXISTS "NccAccountDirectoryEntry_institutionId_accountIdentifier_idx"
  ON "NccAccountDirectoryEntry"("institutionId", "accountIdentifier");
CREATE INDEX IF NOT EXISTS "NccAccountDirectoryEntry_versionId_status_idx"
  ON "NccAccountDirectoryEntry"("versionId", "status");

CREATE TABLE IF NOT EXISTS "NccCertificationRun" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "status" "NccCertificationRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NccCertificationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccCertificationRun_institutionId_status_idx" ON "NccCertificationRun"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "NccCertificationRun_status_createdAt_idx" ON "NccCertificationRun"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "NccCertificationCheck" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "status" "NccCertificationCheckStatus" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NccCertificationCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccCertificationCheck_runId_checkKey_key" ON "NccCertificationCheck"("runId", "checkKey");
CREATE INDEX IF NOT EXISTS "NccCertificationCheck_runId_status_idx" ON "NccCertificationCheck"("runId", "status");

DO $$ BEGIN
  ALTER TABLE "NccParticipantConnector" ADD CONSTRAINT "NccParticipantConnector_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccAccountDirectoryVersion" ADD CONSTRAINT "NccAccountDirectoryVersion_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccAccountDirectoryEntry" ADD CONSTRAINT "NccAccountDirectoryEntry_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "NccAccountDirectoryVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccAccountDirectoryEntry" ADD CONSTRAINT "NccAccountDirectoryEntry_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccCertificationRun" ADD CONSTRAINT "NccCertificationRun_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccCertificationCheck" ADD CONSTRAINT "NccCertificationCheck_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "NccCertificationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
