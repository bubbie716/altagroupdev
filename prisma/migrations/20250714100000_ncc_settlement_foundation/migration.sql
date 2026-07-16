-- NCC Sprint 1: Core Settlement Foundation
-- Evolves FinancialInstitution / RoutingNumber and adds settlement ledger models.

-- Enum extensions (Postgres requires ADD VALUE outside some older txn edge cases; Prisma wraps migrations)
ALTER TYPE "FinancialInstitutionType" ADD VALUE 'EXCHANGE';
ALTER TYPE "FinancialInstitutionType" ADD VALUE 'BROKERAGE';
ALTER TYPE "FinancialInstitutionType" ADD VALUE 'PAYMENT_PROVIDER';
ALTER TYPE "FinancialInstitutionType" ADD VALUE 'CLEARING_PARTICIPANT';

ALTER TYPE "FinancialInstitutionStatus" ADD VALUE 'APPLICANT';
ALTER TYPE "FinancialInstitutionStatus" ADD VALUE 'RESTRICTED';
ALTER TYPE "FinancialInstitutionStatus" ADD VALUE 'TERMINATED';

ALTER TYPE "RoutingNumberStatus" ADD VALUE 'RESERVED';
ALTER TYPE "RoutingNumberStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "RoutingNumberStatus" ADD VALUE 'RETIRED';

ALTER TYPE "AuditEntityType" ADD VALUE 'FINANCIAL_INSTITUTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'ROUTING_NUMBER';
ALTER TYPE "AuditEntityType" ADD VALUE 'SETTLEMENT_ACCOUNT';
ALTER TYPE "AuditEntityType" ADD VALUE 'SETTLEMENT_INSTRUCTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'SETTLEMENT_ENTRY';
ALTER TYPE "AuditEntityType" ADD VALUE 'INSTITUTION_MEMBER';

CREATE TYPE "InstitutionMemberRole" AS ENUM (
  'INSTITUTION_OWNER',
  'INSTITUTION_ADMIN',
  'SETTLEMENT_MANAGER',
  'SETTLEMENT_OPERATOR',
  'AUDITOR',
  'VIEWER'
);

CREATE TYPE "InstitutionMemberStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TYPE "SettlementAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

CREATE TYPE "SettlementInstructionStatus" AS ENUM (
  'CREATED',
  'SUBMITTED',
  'VALIDATING',
  'QUEUED',
  'SETTLING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
  'REVERSED'
);

CREATE TYPE "SettlementEntryType" AS ENUM (
  'DEBIT',
  'CREDIT',
  'REVERSAL_DEBIT',
  'REVERSAL_CREDIT',
  'ADJUSTMENT'
);

-- Evolve FinancialInstitution
ALTER TABLE "FinancialInstitution" RENAME COLUMN "name" TO "legalName";
ALTER TABLE "FinancialInstitution" RENAME COLUMN "shortName" TO "displayName";

ALTER TABLE "FinancialInstitution"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "primaryContactUserId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "terminatedAt" TIMESTAMP(3);

UPDATE "FinancialInstitution"
SET
  "slug" = CASE
    WHEN "id" = 'inst-alta-bank' THEN 'alta-bank'
    ELSE lower(regexp_replace(coalesce("displayName", "legalName", "id"), '[^a-zA-Z0-9]+', '-', 'g'))
  END,
  "approvedAt" = CASE WHEN "status" = 'ACTIVE' THEN "createdAt" ELSE NULL END
WHERE "slug" IS NULL;

ALTER TABLE "FinancialInstitution" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "FinancialInstitution_slug_key" ON "FinancialInstitution"("slug");
CREATE INDEX "FinancialInstitution_institutionType_idx" ON "FinancialInstitution"("institutionType");

ALTER TABLE "FinancialInstitution"
  ADD CONSTRAINT "FinancialInstitution_primaryContactUserId_fkey"
  FOREIGN KEY ("primaryContactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Evolve RoutingNumber
ALTER TABLE "RoutingNumber" RENAME COLUMN "financialInstitutionId" TO "institutionId";
ALTER TABLE "RoutingNumber"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);

UPDATE "RoutingNumber"
SET
  "isPrimary" = true,
  "activatedAt" = "createdAt"
WHERE "routingNumber" = '011000001';

DROP INDEX IF EXISTS "RoutingNumber_financialInstitutionId_idx";
CREATE INDEX "RoutingNumber_institutionId_idx" ON "RoutingNumber"("institutionId");
CREATE INDEX "RoutingNumber_institutionId_isPrimary_idx" ON "RoutingNumber"("institutionId", "isPrimary");

-- Institution membership
CREATE TABLE "InstitutionMember" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "InstitutionMemberRole" NOT NULL,
  "status" "InstitutionMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "InstitutionMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionMember_institutionId_userId_key" ON "InstitutionMember"("institutionId", "userId");
CREATE INDEX "InstitutionMember_userId_status_idx" ON "InstitutionMember"("userId", "status");
CREATE INDEX "InstitutionMember_institutionId_status_idx" ON "InstitutionMember"("institutionId", "status");
CREATE INDEX "InstitutionMember_role_idx" ON "InstitutionMember"("role");

ALTER TABLE "InstitutionMember"
  ADD CONSTRAINT "InstitutionMember_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionMember"
  ADD CONSTRAINT "InstitutionMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionMember"
  ADD CONSTRAINT "InstitutionMember_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Settlement account
CREATE TABLE "SettlementAccount" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'FLR',
  "ledgerBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "SettlementAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementAccount_institutionId_currency_key" ON "SettlementAccount"("institutionId", "currency");
CREATE INDEX "SettlementAccount_status_idx" ON "SettlementAccount"("status");

ALTER TABLE "SettlementAccount"
  ADD CONSTRAINT "SettlementAccount_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Settlement instruction
CREATE TABLE "SettlementInstruction" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sendingInstitutionId" TEXT NOT NULL,
  "receivingInstitutionId" TEXT NOT NULL,
  "sendingRoutingNumberId" TEXT NOT NULL,
  "receivingRoutingNumberId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'FLR',
  "amount" DECIMAL(18,2) NOT NULL,
  "purpose" TEXT,
  "externalReference" TEXT,
  "status" "SettlementInstructionStatus" NOT NULL DEFAULT 'CREATED',
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureReason" TEXT,
  "requestHash" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementInstruction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementInstruction_publicReference_key" ON "SettlementInstruction"("publicReference");
CREATE UNIQUE INDEX "SettlementInstruction_sendingInstitutionId_idempotencyKey_key"
  ON "SettlementInstruction"("sendingInstitutionId", "idempotencyKey");
CREATE INDEX "SettlementInstruction_status_idx" ON "SettlementInstruction"("status");
CREATE INDEX "SettlementInstruction_sendingInstitutionId_createdAt_idx"
  ON "SettlementInstruction"("sendingInstitutionId", "createdAt");
CREATE INDEX "SettlementInstruction_receivingInstitutionId_createdAt_idx"
  ON "SettlementInstruction"("receivingInstitutionId", "createdAt");
CREATE INDEX "SettlementInstruction_externalReference_idx" ON "SettlementInstruction"("externalReference");
CREATE INDEX "SettlementInstruction_publicReference_idx" ON "SettlementInstruction"("publicReference");
CREATE INDEX "SettlementInstruction_submittedByUserId_idx" ON "SettlementInstruction"("submittedByUserId");

ALTER TABLE "SettlementInstruction"
  ADD CONSTRAINT "SettlementInstruction_sendingInstitutionId_fkey"
  FOREIGN KEY ("sendingInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementInstruction"
  ADD CONSTRAINT "SettlementInstruction_receivingInstitutionId_fkey"
  FOREIGN KEY ("receivingInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementInstruction"
  ADD CONSTRAINT "SettlementInstruction_sendingRoutingNumberId_fkey"
  FOREIGN KEY ("sendingRoutingNumberId") REFERENCES "RoutingNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementInstruction"
  ADD CONSTRAINT "SettlementInstruction_receivingRoutingNumberId_fkey"
  FOREIGN KEY ("receivingRoutingNumberId") REFERENCES "RoutingNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementInstruction"
  ADD CONSTRAINT "SettlementInstruction_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Settlement entry (append-only ledger)
CREATE TABLE "SettlementEntry" (
  "id" TEXT NOT NULL,
  "settlementInstructionId" TEXT NOT NULL,
  "settlementAccountId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "entryType" "SettlementEntryType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "balanceBefore" DECIMAL(18,2) NOT NULL,
  "balanceAfter" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementEntry_settlementInstructionId_idx" ON "SettlementEntry"("settlementInstructionId");
CREATE INDEX "SettlementEntry_settlementAccountId_idx" ON "SettlementEntry"("settlementAccountId");
CREATE INDEX "SettlementEntry_institutionId_createdAt_idx" ON "SettlementEntry"("institutionId", "createdAt");

ALTER TABLE "SettlementEntry"
  ADD CONSTRAINT "SettlementEntry_settlementInstructionId_fkey"
  FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementEntry"
  ADD CONSTRAINT "SettlementEntry_settlementAccountId_fkey"
  FOREIGN KEY ("settlementAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementEntry"
  ADD CONSTRAINT "SettlementEntry_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Settlement reversal linkage
CREATE TABLE "SettlementReversal" (
  "id" TEXT NOT NULL,
  "originalInstructionId" TEXT NOT NULL,
  "reversalInstructionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "SettlementReversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementReversal_originalInstructionId_key" ON "SettlementReversal"("originalInstructionId");
CREATE UNIQUE INDEX "SettlementReversal_reversalInstructionId_key" ON "SettlementReversal"("reversalInstructionId");
CREATE INDEX "SettlementReversal_actorUserId_idx" ON "SettlementReversal"("actorUserId");
CREATE INDEX "SettlementReversal_createdAt_idx" ON "SettlementReversal"("createdAt");

ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_originalInstructionId_fkey"
  FOREIGN KEY ("originalInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_reversalInstructionId_fkey"
  FOREIGN KEY ("reversalInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReversal"
  ADD CONSTRAINT "SettlementReversal_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed NCC participant flag + settlement account for Alta Bank
UPDATE "FinancialInstitution"
SET "isNCCParticipant" = true, "status" = 'ACTIVE', "approvedAt" = coalesce("approvedAt", "createdAt")
WHERE "id" = 'inst-alta-bank';

INSERT INTO "SettlementAccount" ("id", "institutionId", "currency", "ledgerBalance", "availableBalance", "status", "updatedAt")
VALUES ('sa-alta-bank-flr', 'inst-alta-bank', 'FLR', 0, 0, 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT ("institutionId", "currency") DO NOTHING;
