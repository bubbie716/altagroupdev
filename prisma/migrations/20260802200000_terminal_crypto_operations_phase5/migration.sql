-- Phase 5: Alta Terminal crypto operations & admin controls foundations.
-- Forward-only. Does not activate assets, mutate balances, or rewrite historical trades.

-- Audit entity types for config + recon issue operator actions
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_CONFIG';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_RECON_ISSUE';

-- Reconciliation issue review metadata (first/last seen + operator resolution)
ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT;
ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
ALTER TABLE "TerminalCryptoReconciliationIssue"
  ADD COLUMN IF NOT EXISTS "resolutionSource" TEXT;

CREATE INDEX IF NOT EXISTS "TerminalCryptoReconciliationIssue_lastSeenAt_idx"
  ON "TerminalCryptoReconciliationIssue"("lastSeenAt");

-- Backfill lastSeenAt from updatedAt for existing rows
UPDATE "TerminalCryptoReconciliationIssue"
SET "lastSeenAt" = COALESCE("updatedAt", "createdAt")
WHERE "lastSeenAt" IS NULL OR "lastSeenAt" < "createdAt";

-- Append-only fee/curve configuration version history (future orders only)
CREATE TABLE IF NOT EXISTS "TerminalCryptoAssetConfigChange" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "configVersion" INTEGER NOT NULL,
  "previousTotalFeeBps" INTEGER NOT NULL,
  "previousRevenueFeeBps" INTEGER NOT NULL,
  "previousStabilizationFeeBps" INTEGER NOT NULL,
  "previousCurveRate" DECIMAL(36,18),
  "previousPegOrStartingPrice" DECIMAL(28,12) NOT NULL,
  "nextTotalFeeBps" INTEGER NOT NULL,
  "nextRevenueFeeBps" INTEGER NOT NULL,
  "nextStabilizationFeeBps" INTEGER NOT NULL,
  "nextCurveRate" DECIMAL(36,18),
  "nextPegOrStartingPrice" DECIMAL(28,12) NOT NULL,
  "changeSummary" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "expectedAssetVersion" INTEGER NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoAssetConfigChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TerminalCryptoAssetConfigChange_assetId_idempotencyKey_key"
  ON "TerminalCryptoAssetConfigChange"("assetId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "TerminalCryptoAssetConfigChange_assetId_configVersion_key"
  ON "TerminalCryptoAssetConfigChange"("assetId", "configVersion");
CREATE INDEX IF NOT EXISTS "TerminalCryptoAssetConfigChange_assetId_createdAt_idx"
  ON "TerminalCryptoAssetConfigChange"("assetId", "createdAt");
CREATE INDEX IF NOT EXISTS "TerminalCryptoAssetConfigChange_actorUserId_createdAt_idx"
  ON "TerminalCryptoAssetConfigChange"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "TerminalCryptoAssetConfigChange_effectiveAt_idx"
  ON "TerminalCryptoAssetConfigChange"("effectiveAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TerminalCryptoAssetConfigChange_assetId_fkey'
  ) THEN
    ALTER TABLE "TerminalCryptoAssetConfigChange"
      ADD CONSTRAINT "TerminalCryptoAssetConfigChange_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
