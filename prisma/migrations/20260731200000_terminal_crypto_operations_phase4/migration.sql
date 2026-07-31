-- Phase 4: Alta Terminal fictional crypto operations foundations.
-- Forward-only. Does not activate DRAFT assets or mutate balances.

-- Market ledger kinds for contributions / revenue accounting
ALTER TYPE "TerminalCryptoMarketLedgerKind" ADD VALUE IF NOT EXISTS 'EXTERNAL_PROTECTED_CONTRIBUTION';
ALTER TYPE "TerminalCryptoMarketLedgerKind" ADD VALUE IF NOT EXISTS 'EXTERNAL_STABILIZATION_CONTRIBUTION';
ALTER TYPE "TerminalCryptoMarketLedgerKind" ADD VALUE IF NOT EXISTS 'REVENUE_SWEEP';
ALTER TYPE "TerminalCryptoMarketLedgerKind" ADD VALUE IF NOT EXISTS 'REVENUE_TO_STABILIZATION';

-- Audit entity types for crypto ops
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_ASSET';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_RECONCILIATION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_REVENUE_SWEEP';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_CONTRIBUTION';

-- Lifecycle optimistic concurrency on assets
ALTER TABLE "TerminalCryptoAsset"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- Reconciliation / contribution enums
CREATE TYPE "TerminalCryptoReconciliationRunStatus" AS ENUM (
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL'
);

CREATE TYPE "TerminalCryptoReconciliationIssueSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'CRITICAL'
);

CREATE TYPE "TerminalCryptoReconciliationIssueStatus" AS ENUM (
  'OPEN',
  'RESOLVED'
);

CREATE TYPE "TerminalCryptoExternalContributionKind" AS ENUM (
  'PROTECTED_RESERVE',
  'STABILIZATION_FUND',
  'REVENUE_TO_STABILIZATION'
);

-- Immutable asset status-change history
CREATE TABLE "TerminalCryptoAssetStatusChange" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "fromStatus" "TerminalCryptoAssetStatus" NOT NULL,
  "toStatus" "TerminalCryptoAssetStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoAssetStatusChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalCryptoAssetStatusChange_assetId_idempotencyKey_key"
  ON "TerminalCryptoAssetStatusChange"("assetId", "idempotencyKey");
CREATE INDEX "TerminalCryptoAssetStatusChange_assetId_createdAt_idx"
  ON "TerminalCryptoAssetStatusChange"("assetId", "createdAt");
CREATE INDEX "TerminalCryptoAssetStatusChange_actorUserId_createdAt_idx"
  ON "TerminalCryptoAssetStatusChange"("actorUserId", "createdAt");
CREATE INDEX "TerminalCryptoAssetStatusChange_toStatus_createdAt_idx"
  ON "TerminalCryptoAssetStatusChange"("toStatus", "createdAt");

ALTER TABLE "TerminalCryptoAssetStatusChange"
  ADD CONSTRAINT "TerminalCryptoAssetStatusChange_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Reconciliation runs
CREATE TABLE "TerminalCryptoReconciliationRun" (
  "id" TEXT NOT NULL,
  "status" "TerminalCryptoReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "checksPerformed" INTEGER NOT NULL DEFAULT 0,
  "criticalCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "infoCount" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL DEFAULT '',
  "actorUserId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'system',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TerminalCryptoReconciliationRun_status_startedAt_idx"
  ON "TerminalCryptoReconciliationRun"("status", "startedAt");
CREATE INDEX "TerminalCryptoReconciliationRun_startedAt_idx"
  ON "TerminalCryptoReconciliationRun"("startedAt");
CREATE INDEX "TerminalCryptoReconciliationRun_actorUserId_startedAt_idx"
  ON "TerminalCryptoReconciliationRun"("actorUserId", "startedAt");

-- Reconciliation issues
CREATE TABLE "TerminalCryptoReconciliationIssue" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "assetId" TEXT,
  "portfolioId" TEXT,
  "orderId" TEXT,
  "settlementId" TEXT,
  "walletId" TEXT,
  "checkKey" TEXT NOT NULL,
  "severity" "TerminalCryptoReconciliationIssueSeverity" NOT NULL,
  "summary" TEXT NOT NULL,
  "technicalDetails" TEXT,
  "status" "TerminalCryptoReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
  "fingerprint" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TerminalCryptoReconciliationIssue_runId_severity_idx"
  ON "TerminalCryptoReconciliationIssue"("runId", "severity");
CREATE INDEX "TerminalCryptoReconciliationIssue_assetId_status_idx"
  ON "TerminalCryptoReconciliationIssue"("assetId", "status");
CREATE INDEX "TerminalCryptoReconciliationIssue_status_severity_createdAt_idx"
  ON "TerminalCryptoReconciliationIssue"("status", "severity", "createdAt");
CREATE INDEX "TerminalCryptoReconciliationIssue_fingerprint_idx"
  ON "TerminalCryptoReconciliationIssue"("fingerprint");
CREATE INDEX "TerminalCryptoReconciliationIssue_checkKey_status_idx"
  ON "TerminalCryptoReconciliationIssue"("checkKey", "status");

-- Deduplicate OPEN issues by fingerprint (resolved issues may share fingerprints).
CREATE UNIQUE INDEX "TerminalCryptoReconciliationIssue_open_fingerprint_key"
  ON "TerminalCryptoReconciliationIssue"("fingerprint")
  WHERE "status" = 'OPEN';

ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD CONSTRAINT "TerminalCryptoReconciliationIssue_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "TerminalCryptoReconciliationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD CONSTRAINT "TerminalCryptoReconciliationIssue_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Revenue sweeps
CREATE TABLE "TerminalCryptoRevenueSweep" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "amount" DECIMAL(28,12) NOT NULL,
  "destinationPortfolioId" TEXT NOT NULL,
  "cashLedgerEntryId" TEXT,
  "marketLedgerEntryKey" TEXT,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "accruedRevenueBefore" DECIMAL(28,12) NOT NULL,
  "accruedRevenueAfter" DECIMAL(28,12) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoRevenueSweep_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoRevenueSweep_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "TerminalCryptoRevenueSweep_idempotencyKey_key"
  ON "TerminalCryptoRevenueSweep"("idempotencyKey");
CREATE INDEX "TerminalCryptoRevenueSweep_assetId_createdAt_idx"
  ON "TerminalCryptoRevenueSweep"("assetId", "createdAt");
CREATE INDEX "TerminalCryptoRevenueSweep_destinationPortfolioId_createdAt_idx"
  ON "TerminalCryptoRevenueSweep"("destinationPortfolioId", "createdAt");
CREATE INDEX "TerminalCryptoRevenueSweep_actorUserId_createdAt_idx"
  ON "TerminalCryptoRevenueSweep"("actorUserId", "createdAt");

ALTER TABLE "TerminalCryptoRevenueSweep"
  ADD CONSTRAINT "TerminalCryptoRevenueSweep_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- External contributions / reclassifications
CREATE TABLE "TerminalCryptoExternalContribution" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "kind" "TerminalCryptoExternalContributionKind" NOT NULL,
  "amount" DECIMAL(28,12) NOT NULL,
  "externalReference" TEXT,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoExternalContribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoExternalContribution_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "TerminalCryptoExternalContribution_idempotencyKey_key"
  ON "TerminalCryptoExternalContribution"("idempotencyKey");
CREATE INDEX "TerminalCryptoExternalContribution_assetId_createdAt_idx"
  ON "TerminalCryptoExternalContribution"("assetId", "createdAt");
CREATE INDEX "TerminalCryptoExternalContribution_kind_createdAt_idx"
  ON "TerminalCryptoExternalContribution"("kind", "createdAt");
CREATE INDEX "TerminalCryptoExternalContribution_actorUserId_createdAt_idx"
  ON "TerminalCryptoExternalContribution"("actorUserId", "createdAt");

ALTER TABLE "TerminalCryptoExternalContribution"
  ADD CONSTRAINT "TerminalCryptoExternalContribution_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
