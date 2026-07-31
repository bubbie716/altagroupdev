-- Alta Terminal fictional crypto customer UI foundation (Phase 3).
-- Progressive CRYPTO consent scope, scheduled-trade crypto sizing, failure categories.
-- Forward-only. Does not activate DRAFT assets or mutate live balances.

ALTER TYPE "LegalConsentScope" ADD VALUE IF NOT EXISTS 'CRYPTO';

CREATE TYPE "TerminalScheduledTradeSizingMode" AS ENUM ('QUANTITY', 'FLORIN_AMOUNT');

ALTER TABLE "TerminalScheduledTradeInstruction"
  ADD COLUMN "sizingMode" "TerminalScheduledTradeSizingMode" NOT NULL DEFAULT 'QUANTITY';

ALTER TABLE "TerminalScheduledTradeInstruction"
  ADD COLUMN "florinAmount" DECIMAL(18, 2);

ALTER TABLE "TerminalScheduledTradeInstruction"
  ADD COLUMN "maxPriceImpactPercent" DECIMAL(8, 4) NOT NULL DEFAULT 10;

ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'CRYPTO_UNAVAILABLE';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'ASSET_HALTED';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'REDEMPTION_ONLY';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'PRICE_IMPACT_TOO_HIGH';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'CRYPTO_CONSENT_REQUIRED';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'WALLET_FROZEN';
ALTER TYPE "TerminalScheduledTradeFailureCategory" ADD VALUE IF NOT EXISTS 'REQUOTE_REQUIRED';
