-- Sprint 4E: liquidity operations, settlement thresholds, regulatory documents

DO $$ BEGIN
  CREATE TYPE "NccLiquidityOperationType" AS ENUM (
    'FUNDING',
    'WITHDRAWAL',
    'AUTHORIZED_CORRECTION',
    'OPENING_BALANCE_AUTHORIZATION'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccLiquidityOperationStatus" AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'APPLIED',
    'REJECTED',
    'CANCELLED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccLegacyFloatReviewStatus" AS ENUM (
    'NONE',
    'REQUIRES_REVIEW',
    'AUTHORIZED',
    'CORRECTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccParticipantDocumentStatus" AS ENUM (
    'UPLOADED',
    'PENDING_SCAN',
    'UNDER_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'REPLACED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "SettlementAccount"
  ADD COLUMN IF NOT EXISTS "lowLiquidityThreshold" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "legacyFloatReviewStatus" "NccLegacyFloatReviewStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "frozenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozenReason" TEXT;

CREATE TABLE IF NOT EXISTS "NccLiquidityOperation" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "settlementAccountId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'FLR',
  "amount" DECIMAL(18,2) NOT NULL,
  "operationType" "NccLiquidityOperationType" NOT NULL,
  "externalReference" TEXT,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "NccLiquidityOperationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "balanceBeforeLedger" DECIMAL(18,2),
  "balanceBeforeAvailable" DECIMAL(18,2),
  "balanceAfterLedger" DECIMAL(18,2),
  "balanceAfterAvailable" DECIMAL(18,2),
  "failureCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "NccLiquidityOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccLiquidityOperation_idempotencyKey_key"
  ON "NccLiquidityOperation"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "NccLiquidityOperation_institutionId_status_idx"
  ON "NccLiquidityOperation"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "NccLiquidityOperation_settlementAccountId_createdAt_idx"
  ON "NccLiquidityOperation"("settlementAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "NccLiquidityOperation_status_createdAt_idx"
  ON "NccLiquidityOperation"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "NccLiquidityOperation" ADD CONSTRAINT "NccLiquidityOperation_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccLiquidityOperation" ADD CONSTRAINT "NccLiquidityOperation_settlementAccountId_fkey"
    FOREIGN KEY ("settlementAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccLiquidityOperation" ADD CONSTRAINT "NccLiquidityOperation_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccLiquidityOperation" ADD CONSTRAINT "NccLiquidityOperation_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "NccParticipantDocument" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "institutionId" TEXT,
  "documentType" TEXT NOT NULL,
  "status" "NccParticipantDocumentStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "storageKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewNote" TEXT,
  "expiresAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "NccParticipantDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccParticipantDocument_applicationId_documentType_idx"
  ON "NccParticipantDocument"("applicationId", "documentType");
CREATE INDEX IF NOT EXISTS "NccParticipantDocument_institutionId_status_idx"
  ON "NccParticipantDocument"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "NccParticipantDocument_status_idx"
  ON "NccParticipantDocument"("status");

DO $$ BEGIN
  ALTER TABLE "NccParticipantDocument" ADD CONSTRAINT "NccParticipantDocument_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "NccParticipantApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantDocument" ADD CONSTRAINT "NccParticipantDocument_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantDocument" ADD CONSTRAINT "NccParticipantDocument_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccParticipantDocument" ADD CONSTRAINT "NccParticipantDocument_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Audit entity types for liquidity ops + regulatory documents
DO $$ BEGIN
  ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_PARTICIPANT_DOCUMENT';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_LIQUIDITY_OPERATION';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Mark existing exact 1B create-time float accounts for review (does not alter balances).
UPDATE "SettlementAccount"
SET "legacyFloatReviewStatus" = 'REQUIRES_REVIEW'
WHERE "ledgerBalance" = 1000000000
  AND "availableBalance" = 1000000000
  AND "legacyFloatReviewStatus" = 'NONE';
