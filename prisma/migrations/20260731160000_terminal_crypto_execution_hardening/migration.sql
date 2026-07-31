-- Phase 2 corrective hardening for Alta Terminal fictional crypto settlement.
-- Forward-only. Does not edit Phase 1 migration. Does not activate DRAFT assets.

-- Accrued Terminal revenue on market state
ALTER TABLE "TerminalCryptoMarketState"
  ADD COLUMN "accruedRevenue" DECIMAL(28,12) NOT NULL DEFAULT 0;

ALTER TABLE "TerminalCryptoMarketState"
  ADD CONSTRAINT "TerminalCryptoMarketState_accrued_revenue_nonnegative"
  CHECK ("accruedRevenue" >= 0);

-- Realized gain/loss on wallet balances
ALTER TABLE "TerminalCryptoWalletBalance"
  ADD COLUMN "realizedGainLoss" DECIMAL(28,12) NOT NULL DEFAULT 0;

-- Market ledger account: Terminal revenue
ALTER TYPE "TerminalCryptoMarketLedgerAccount" ADD VALUE IF NOT EXISTS 'TERMINAL_REVENUE';

-- Wallet holding ledger enums
CREATE TYPE "TerminalCryptoWalletLedgerKind" AS ENUM (
  'BUY_CREDIT',
  'SELL_DEBIT',
  'ADJUSTMENT',
  'CORRECTION_REVERSAL'
);
CREATE TYPE "TerminalCryptoWalletLedgerAccount" AS ENUM ('AVAILABLE', 'RESERVED');
CREATE TYPE "TerminalCryptoWalletLedgerUnit" AS ENUM ('COIN', 'FLORIN');

-- Replace market-ledger idempotency uniqueness with per-entry entryKey
-- so one settlement can post multiple account deltas without conflicts.
DROP INDEX IF EXISTS "TerminalCryptoMarketLedgerEntry_assetId_idempotencyKey_key";

ALTER TABLE "TerminalCryptoMarketLedgerEntry"
  ADD COLUMN "entryKey" TEXT;

-- Backfill any existing rows (Phase 1 seed has none expected) then enforce NOT NULL UNIQUE.
UPDATE "TerminalCryptoMarketLedgerEntry"
SET "entryKey" = 'legacy:' || "id"
WHERE "entryKey" IS NULL;

ALTER TABLE "TerminalCryptoMarketLedgerEntry"
  ALTER COLUMN "entryKey" SET NOT NULL;

CREATE UNIQUE INDEX "TerminalCryptoMarketLedgerEntry_entryKey_key"
  ON "TerminalCryptoMarketLedgerEntry"("entryKey");

ALTER TABLE "TerminalCryptoMarketLedgerEntry"
  DROP COLUMN IF EXISTS "idempotencyKey";

-- Settlement concurrency / accounting fields
ALTER TABLE "TerminalCryptoOrderSettlement"
  ADD COLUMN "customerCashDelta" DECIMAL(28,12),
  ADD COLUMN "realizedGainLoss" DECIMAL(28,12),
  ADD COLUMN "marketStateVersion" INTEGER,
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "quoteFingerprint" TEXT;

-- Backfill required columns for any pre-existing settlement rows (none expected in Phase 1).
UPDATE "TerminalCryptoOrderSettlement"
SET
  "customerCashDelta" = COALESCE("customerCashDelta", 0),
  "marketStateVersion" = COALESCE("marketStateVersion", 0),
  "requestHash" = COALESCE("requestHash", 'legacy:' || "id")
WHERE "customerCashDelta" IS NULL
   OR "marketStateVersion" IS NULL
   OR "requestHash" IS NULL;

ALTER TABLE "TerminalCryptoOrderSettlement"
  ALTER COLUMN "customerCashDelta" SET NOT NULL,
  ALTER COLUMN "marketStateVersion" SET NOT NULL,
  ALTER COLUMN "requestHash" SET NOT NULL;

CREATE INDEX "TerminalCryptoOrderSettlement_requestHash_idx"
  ON "TerminalCryptoOrderSettlement"("requestHash");

-- Wallet holding ledger
CREATE TABLE "TerminalCryptoWalletLedgerEntry" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "balanceId" TEXT,
  "assetId" TEXT NOT NULL,
  "settlementId" TEXT,
  "kind" "TerminalCryptoWalletLedgerKind" NOT NULL,
  "account" "TerminalCryptoWalletLedgerAccount" NOT NULL,
  "unit" "TerminalCryptoWalletLedgerUnit" NOT NULL DEFAULT 'COIN',
  "delta" DECIMAL(28,12) NOT NULL,
  "balanceAfter" DECIMAL(28,12) NOT NULL,
  "entryKey" TEXT NOT NULL,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'system',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoWalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalCryptoWalletLedgerEntry_entryKey_key"
  ON "TerminalCryptoWalletLedgerEntry"("entryKey");
CREATE INDEX "TerminalCryptoWalletLedgerEntry_walletId_createdAt_idx"
  ON "TerminalCryptoWalletLedgerEntry"("walletId", "createdAt");
CREATE INDEX "TerminalCryptoWalletLedgerEntry_assetId_createdAt_idx"
  ON "TerminalCryptoWalletLedgerEntry"("assetId", "createdAt");
CREATE INDEX "TerminalCryptoWalletLedgerEntry_settlementId_idx"
  ON "TerminalCryptoWalletLedgerEntry"("settlementId");
CREATE INDEX "TerminalCryptoWalletLedgerEntry_balanceId_createdAt_idx"
  ON "TerminalCryptoWalletLedgerEntry"("balanceId", "createdAt");

ALTER TABLE "TerminalCryptoWalletLedgerEntry"
  ADD CONSTRAINT "TerminalCryptoWalletLedgerEntry_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "TerminalCryptoWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoWalletLedgerEntry"
  ADD CONSTRAINT "TerminalCryptoWalletLedgerEntry_balanceId_fkey"
  FOREIGN KEY ("balanceId") REFERENCES "TerminalCryptoWalletBalance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoWalletLedgerEntry"
  ADD CONSTRAINT "TerminalCryptoWalletLedgerEntry_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "TerminalCryptoOrderSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification + audit entity extensions
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_ORDER_FILLED';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CRYPTO_ORDER';
