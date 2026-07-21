-- Sprint 4F: staff control plane, network mode, returns, risk, alerts, worker lock

DO $$ BEGIN
  CREATE TYPE "NccStaffRole" AS ENUM (
    'VIEWER',
    'AUDITOR',
    'COMPLIANCE_ANALYST',
    'SETTLEMENT_OPERATOR',
    'LIQUIDITY_OPERATOR',
    'SENIOR_APPROVER',
    'NCC_ADMINISTRATOR',
    'EMERGENCY_ADMINISTRATOR'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccStaffMembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccNetworkSettlementMode" AS ENUM (
    'ACTIVE',
    'PAUSE_NEW_SETTLEMENTS',
    'EMERGENCY_STOP'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccTransferReturnStatus" AS ENUM (
    'REQUESTED',
    'PENDING_RECEIVING_INSTITUTION',
    'APPROVED',
    'REJECTED',
    'FUNDS_UNAVAILABLE',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'MANUAL_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccEmergencySuspensionStatus" AS ENUM ('ACTIVE', 'RESUMED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccRiskDecisionOutcome" AS ENUM (
    'ALLOW',
    'REJECT',
    'MANUAL_REVIEW',
    'COMPLIANCE_HOLD',
    'OVERRIDE_ALLOW'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccOperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NccOperationalAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_STAFF_MEMBERSHIP';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_NETWORK_CONTROL';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_TRANSFER_RETURN';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_EMERGENCY_SUSPENSION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_RISK_POLICY';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_RISK_DECISION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_OPERATIONAL_ALERT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'NCC_WORKER_LOCK';

CREATE TABLE IF NOT EXISTS "NccStaffMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "NccStaffRole" NOT NULL,
  "status" "NccStaffMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedByUserId" TEXT,
  "revokedByUserId" TEXT,
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "NccStaffMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccStaffMembership_userId_key" ON "NccStaffMembership"("userId");
CREATE INDEX IF NOT EXISTS "NccStaffMembership_status_role_idx" ON "NccStaffMembership"("status", "role");

CREATE TABLE IF NOT EXISTS "NccNetworkControl" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "mode" "NccNetworkSettlementMode" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "updatedByUserId" TEXT,
  "pendingResumeRequestedByUserId" TEXT,
  "pendingResumeReason" TEXT,
  "pendingResumeApprovedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NccNetworkControl_pkey" PRIMARY KEY ("id")
);

INSERT INTO "NccNetworkControl" ("id", "mode")
VALUES ('default', 'ACTIVE')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "NccTransferReturn" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "originalInstructionId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'FLR',
  "reason" TEXT NOT NULL,
  "status" "NccTransferReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "idempotencyKey" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "requestedByCredentialId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewNote" TEXT,
  "receivingInstitutionApprovedByUserId" TEXT,
  "receivingInstitutionApprovedAt" TIMESTAMP(3),
  "executionApprovedByUserId" TEXT,
  "returnInstructionId" TEXT,
  "failureCode" TEXT,
  "failureReason" TEXT,
  "legacyReversalRequestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "NccTransferReturn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccTransferReturn_publicReference_key" ON "NccTransferReturn"("publicReference");
CREATE UNIQUE INDEX IF NOT EXISTS "NccTransferReturn_idempotencyKey_key" ON "NccTransferReturn"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "NccTransferReturn_legacyReversalRequestId_key" ON "NccTransferReturn"("legacyReversalRequestId");
CREATE INDEX IF NOT EXISTS "NccTransferReturn_institutionId_status_idx" ON "NccTransferReturn"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "NccTransferReturn_originalInstructionId_idx" ON "NccTransferReturn"("originalInstructionId");
CREATE INDEX IF NOT EXISTS "NccTransferReturn_status_createdAt_idx" ON "NccTransferReturn"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "NccEmergencySuspension" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "NccEmergencySuspensionStatus" NOT NULL DEFAULT 'ACTIVE',
  "suspendedByUserId" TEXT NOT NULL,
  "resumedByUserId" TEXT,
  "resumeReason" TEXT,
  "affectedSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumedAt" TIMESTAMP(3),
  CONSTRAINT "NccEmergencySuspension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccEmergencySuspension_institutionId_status_idx" ON "NccEmergencySuspension"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "NccEmergencySuspension_status_createdAt_idx" ON "NccEmergencySuspension"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "NccInstitutionRiskPolicy" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "maxTransferAmount" DECIMAL(18,2),
  "dailyAmountLimit" DECIMAL(18,2),
  "dailyTransactionCountLimit" INTEGER,
  "manualReviewThreshold" DECIMAL(18,2),
  "probationMaxTransferAmount" DECIMAL(18,2),
  "probationDailyAmountLimit" DECIMAL(18,2),
  "probationDailyTxnLimit" INTEGER,
  "emergencyZeroLimit" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NccInstitutionRiskPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccInstitutionRiskPolicy_institutionId_enabled_idx" ON "NccInstitutionRiskPolicy"("institutionId", "enabled");
CREATE INDEX IF NOT EXISTS "NccInstitutionRiskPolicy_institutionId_effectiveFrom_idx" ON "NccInstitutionRiskPolicy"("institutionId", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "NccRiskDecision" (
  "id" TEXT NOT NULL,
  "settlementInstructionId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "outcome" "NccRiskDecisionOutcome" NOT NULL,
  "reasonCode" TEXT,
  "reason" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "policySnapshot" JSONB,
  "overriddenByUserId" TEXT,
  "overrideReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NccRiskDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccRiskDecision_settlementInstructionId_key" ON "NccRiskDecision"("settlementInstructionId");
CREATE INDEX IF NOT EXISTS "NccRiskDecision_institutionId_createdAt_idx" ON "NccRiskDecision"("institutionId", "createdAt");
CREATE INDEX IF NOT EXISTS "NccRiskDecision_outcome_createdAt_idx" ON "NccRiskDecision"("outcome", "createdAt");

CREATE TABLE IF NOT EXISTS "NccDailyRiskUsage" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "usageDate" DATE NOT NULL,
  "amountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "transactionCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NccDailyRiskUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccDailyRiskUsage_institutionId_usageDate_key" ON "NccDailyRiskUsage"("institutionId", "usageDate");
CREATE INDEX IF NOT EXISTS "NccDailyRiskUsage_usageDate_idx" ON "NccDailyRiskUsage"("usageDate");

CREATE TABLE IF NOT EXISTS "NccOperationalAlert" (
  "id" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "severity" "NccOperationalAlertSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "NccOperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "entityType" TEXT,
  "entityId" TEXT,
  "assignedToUserId" TEXT,
  "acknowledgedByUserId" TEXT,
  "resolvedByUserId" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "NccOperationalAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NccOperationalAlert_status_severity_idx" ON "NccOperationalAlert"("status", "severity");
CREATE INDEX IF NOT EXISTS "NccOperationalAlert_alertKey_status_idx" ON "NccOperationalAlert"("alertKey", "status");
CREATE INDEX IF NOT EXISTS "NccOperationalAlert_createdAt_idx" ON "NccOperationalAlert"("createdAt");

CREATE TABLE IF NOT EXISTS "NccWorkerLock" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "lockedBy" TEXT NOT NULL,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NccWorkerLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NccWorkerLock_jobKey_key" ON "NccWorkerLock"("jobKey");
CREATE INDEX IF NOT EXISTS "NccWorkerLock_lockedUntil_idx" ON "NccWorkerLock"("lockedUntil");

-- FKs (idempotent via DO blocks)
DO $$ BEGIN
  ALTER TABLE "NccStaffMembership" ADD CONSTRAINT "NccStaffMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccStaffMembership" ADD CONSTRAINT "NccStaffMembership_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccStaffMembership" ADD CONSTRAINT "NccStaffMembership_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccNetworkControl" ADD CONSTRAINT "NccNetworkControl_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccNetworkControl" ADD CONSTRAINT "NccNetworkControl_pendingResumeRequestedByUserId_fkey"
    FOREIGN KEY ("pendingResumeRequestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccNetworkControl" ADD CONSTRAINT "NccNetworkControl_pendingResumeApprovedByUserId_fkey"
    FOREIGN KEY ("pendingResumeApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccTransferReturn" ADD CONSTRAINT "NccTransferReturn_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccTransferReturn" ADD CONSTRAINT "NccTransferReturn_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccTransferReturn" ADD CONSTRAINT "NccTransferReturn_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccTransferReturn" ADD CONSTRAINT "NccTransferReturn_executionApprovedByUserId_fkey"
    FOREIGN KEY ("executionApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccEmergencySuspension" ADD CONSTRAINT "NccEmergencySuspension_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccEmergencySuspension" ADD CONSTRAINT "NccEmergencySuspension_suspendedByUserId_fkey"
    FOREIGN KEY ("suspendedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccEmergencySuspension" ADD CONSTRAINT "NccEmergencySuspension_resumedByUserId_fkey"
    FOREIGN KEY ("resumedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccInstitutionRiskPolicy" ADD CONSTRAINT "NccInstitutionRiskPolicy_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccInstitutionRiskPolicy" ADD CONSTRAINT "NccInstitutionRiskPolicy_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccRiskDecision" ADD CONSTRAINT "NccRiskDecision_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccRiskDecision" ADD CONSTRAINT "NccRiskDecision_overriddenByUserId_fkey"
    FOREIGN KEY ("overriddenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccDailyRiskUsage" ADD CONSTRAINT "NccDailyRiskUsage_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NccOperationalAlert" ADD CONSTRAINT "NccOperationalAlert_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccOperationalAlert" ADD CONSTRAINT "NccOperationalAlert_acknowledgedByUserId_fkey"
    FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "NccOperationalAlert" ADD CONSTRAINT "NccOperationalAlert_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Migrate pending ledger-only reversal requests into transfer-return workflow
INSERT INTO "NccTransferReturn" (
  "id", "publicReference", "originalInstructionId", "institutionId", "amount", "currency",
  "reason", "status", "idempotencyKey", "requestedByUserId", "requestedByCredentialId",
  "legacyReversalRequestId", "createdAt", "updatedAt"
)
SELECT
  'ret_' || r."id",
  'NRT-' || UPPER(SUBSTRING(MD5(r."id") FROM 1 FOR 12)),
  r."settlementInstructionId",
  r."institutionId",
  COALESCE(si."amount", 0),
  COALESCE(si."currency", 'FLR'),
  r."reason",
  'REQUESTED',
  'legacy-reversal:' || r."id",
  r."requestedByUserId",
  r."requestedByCredentialId",
  r."id",
  r."createdAt",
  r."updatedAt"
FROM "NccSettlementReversalRequest" r
LEFT JOIN "SettlementInstruction" si ON si."id" = r."settlementInstructionId"
WHERE r."status" = 'PENDING_REVIEW'
  AND NOT EXISTS (
    SELECT 1 FROM "NccTransferReturn" t WHERE t."legacyReversalRequestId" = r."id"
  );
