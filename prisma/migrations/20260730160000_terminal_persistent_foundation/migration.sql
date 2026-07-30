-- Terminal persistent foundation: cash, ledger, positions, orders, fills, activity, watchlists.
-- Forward-only. Preserves existing TerminalPortfolio and UserTerminalSettings rows.
-- Backfill: existing portfolios receive a zero cash account; no fabricated history.

-- CreateEnum
CREATE TYPE "TerminalCashCurrency" AS ENUM ('FLORIN');

-- CreateEnum
CREATE TYPE "TerminalCashLedgerEntryKind" AS ENUM (
  'CASH_DEPOSIT',
  'CASH_WITHDRAWAL',
  'BUY_FILL',
  'SELL_FILL',
  'DIVIDEND',
  'TRADING_FEE',
  'ADJUSTMENT',
  'REALIZED_GAIN_LOSS',
  'RESERVE',
  'RELEASE_RESERVE'
);

-- CreateEnum
CREATE TYPE "TerminalCashLedgerEntryStatus" AS ENUM ('POSTED', 'PENDING', 'VOIDED');

-- CreateEnum
CREATE TYPE "TerminalOrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TerminalOrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "TerminalOrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED', 'REJECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TerminalOrderSource" AS ENUM ('TERMINAL', 'INTERNAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TerminalPortfolioActivityKind" AS ENUM (
  'CASH_DEPOSIT',
  'CASH_WITHDRAWAL',
  'BUY_FILL',
  'SELL_FILL',
  'DIVIDEND',
  'TRADING_FEE',
  'ADJUSTMENT',
  'REALIZED_GAIN_LOSS'
);

-- CreateTable
CREATE TABLE "TerminalPortfolioCashAccount" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "availableCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reservedCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" "TerminalCashCurrency" NOT NULL DEFAULT 'FLORIN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalPortfolioCashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalCashLedgerEntry" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "availableCashAfter" DECIMAL(18,2) NOT NULL,
    "reservedCashAfter" DECIMAL(18,2) NOT NULL,
    "kind" "TerminalCashLedgerEntryKind" NOT NULL,
    "status" "TerminalCashLedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
    "description" TEXT NOT NULL,
    "externalReference" TEXT,
    "idempotencyKey" TEXT,
    "relatedOrderId" TEXT,
    "actorUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalCashLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalPosition" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "realizedGainLoss" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalOrder" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TerminalOrderSide" NOT NULL,
    "orderType" "TerminalOrderType" NOT NULL,
    "status" "TerminalOrderStatus" NOT NULL,
    "quantity" DECIMAL(28,8) NOT NULL,
    "filledQuantity" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "limitPrice" DECIMAL(18,6),
    "averageFillPrice" DECIMAL(18,6),
    "estimatedValue" DECIMAL(18,2),
    "externalTseOrderId" TEXT,
    "clientKey" TEXT,
    "rejectReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "source" "TerminalOrderSource" NOT NULL DEFAULT 'TERMINAL',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TerminalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalOrderFill" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" DECIMAL(28,8) NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "externalFillId" TEXT,
    "idempotencyKey" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalOrderFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalPortfolioActivity" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "kind" "TerminalPortfolioActivityKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "symbol" TEXT,
    "quantity" DECIMAL(28,8),
    "price" DECIMAL(18,6),
    "orderId" TEXT,
    "description" TEXT NOT NULL,
    "cashAfter" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalPortfolioActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Watchlist',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalWatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalWatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TerminalPortfolioCashAccount_portfolioId_key" ON "TerminalPortfolioCashAccount"("portfolioId");

-- CreateIndex
CREATE INDEX "TerminalCashLedgerEntry_portfolioId_createdAt_idx" ON "TerminalCashLedgerEntry"("portfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalCashLedgerEntry_cashAccountId_createdAt_idx" ON "TerminalCashLedgerEntry"("cashAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalCashLedgerEntry_relatedOrderId_idx" ON "TerminalCashLedgerEntry"("relatedOrderId");

-- CreateIndex
CREATE INDEX "TerminalCashLedgerEntry_externalReference_idx" ON "TerminalCashLedgerEntry"("externalReference");

-- CreateIndex
CREATE INDEX "TerminalCashLedgerEntry_kind_createdAt_idx" ON "TerminalCashLedgerEntry"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalCashLedgerEntry_portfolioId_idempotencyKey_key" ON "TerminalCashLedgerEntry"("portfolioId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TerminalPosition_symbol_idx" ON "TerminalPosition"("symbol");

-- CreateIndex
CREATE INDEX "TerminalPosition_portfolioId_updatedAt_idx" ON "TerminalPosition"("portfolioId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalPosition_portfolioId_symbol_key" ON "TerminalPosition"("portfolioId", "symbol");

-- CreateIndex
CREATE INDEX "TerminalOrder_portfolioId_status_submittedAt_idx" ON "TerminalOrder"("portfolioId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "TerminalOrder_symbol_submittedAt_idx" ON "TerminalOrder"("symbol", "submittedAt");

-- CreateIndex
CREATE INDEX "TerminalOrder_externalTseOrderId_idx" ON "TerminalOrder"("externalTseOrderId");

-- CreateIndex
CREATE INDEX "TerminalOrder_createdByUserId_submittedAt_idx" ON "TerminalOrder"("createdByUserId", "submittedAt");

-- CreateIndex
CREATE INDEX "TerminalOrder_status_updatedAt_idx" ON "TerminalOrder"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalOrder_portfolioId_clientKey_key" ON "TerminalOrder"("portfolioId", "clientKey");

-- CreateIndex
CREATE INDEX "TerminalOrderFill_orderId_executedAt_idx" ON "TerminalOrderFill"("orderId", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalOrderFill_orderId_idempotencyKey_key" ON "TerminalOrderFill"("orderId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalOrderFill_externalFillId_key" ON "TerminalOrderFill"("externalFillId");

-- CreateIndex
CREATE INDEX "TerminalPortfolioActivity_portfolioId_occurredAt_idx" ON "TerminalPortfolioActivity"("portfolioId", "occurredAt");

-- CreateIndex
CREATE INDEX "TerminalPortfolioActivity_orderId_idx" ON "TerminalPortfolioActivity"("orderId");

-- CreateIndex
CREATE INDEX "TerminalPortfolioActivity_kind_occurredAt_idx" ON "TerminalPortfolioActivity"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "TerminalPortfolioActivity_symbol_occurredAt_idx" ON "TerminalPortfolioActivity"("symbol", "occurredAt");

-- CreateIndex
CREATE INDEX "TerminalWatchlist_userId_isDefault_idx" ON "TerminalWatchlist"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalWatchlist_userId_name_key" ON "TerminalWatchlist"("userId", "name");

-- CreateIndex
CREATE INDEX "TerminalWatchlistItem_symbol_idx" ON "TerminalWatchlistItem"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalWatchlistItem_watchlistId_symbol_key" ON "TerminalWatchlistItem"("watchlistId", "symbol");

-- AddForeignKey
ALTER TABLE "TerminalPortfolioCashAccount" ADD CONSTRAINT "TerminalPortfolioCashAccount_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalCashLedgerEntry" ADD CONSTRAINT "TerminalCashLedgerEntry_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalCashLedgerEntry" ADD CONSTRAINT "TerminalCashLedgerEntry_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "TerminalPortfolioCashAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalCashLedgerEntry" ADD CONSTRAINT "TerminalCashLedgerEntry_relatedOrderId_fkey" FOREIGN KEY ("relatedOrderId") REFERENCES "TerminalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalCashLedgerEntry" ADD CONSTRAINT "TerminalCashLedgerEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPosition" ADD CONSTRAINT "TerminalPosition_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalOrder" ADD CONSTRAINT "TerminalOrder_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalOrder" ADD CONSTRAINT "TerminalOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalOrderFill" ADD CONSTRAINT "TerminalOrderFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TerminalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPortfolioActivity" ADD CONSTRAINT "TerminalPortfolioActivity_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPortfolioActivity" ADD CONSTRAINT "TerminalPortfolioActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TerminalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalWatchlist" ADD CONSTRAINT "TerminalWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalWatchlistItem" ADD CONSTRAINT "TerminalWatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "TerminalWatchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotent backfill: zero cash accounts for existing portfolios missing one.
-- No fabricated activity, positions, orders, or watchlist symbols.
INSERT INTO "TerminalPortfolioCashAccount" ("id", "portfolioId", "availableCash", "reservedCash", "currency", "version", "createdAt", "updatedAt")
SELECT
  ('tcash_' || md5(random()::text || clock_timestamp()::text || p."id")),
  p."id",
  0,
  0,
  'FLORIN',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TerminalPortfolio" p
WHERE NOT EXISTS (
  SELECT 1 FROM "TerminalPortfolioCashAccount" c WHERE c."portfolioId" = p."id"
);

-- Deterministic default repair for personal portfolios:
-- Keep the oldest ACTIVE personal portfolio as the sole default when multiple defaults exist,
-- or promote the oldest ACTIVE personal portfolio when none is marked default.
WITH ranked AS (
  SELECT
    id,
    "ownerUserId",
    ROW_NUMBER() OVER (
      PARTITION BY "ownerUserId"
      ORDER BY "isDefault" DESC, "createdAt" ASC, id ASC
    ) AS rn
  FROM "TerminalPortfolio"
  WHERE "ownerType" = 'PERSONAL'
    AND "ownerUserId" IS NOT NULL
    AND "status" = 'ACTIVE'
)
UPDATE "TerminalPortfolio" p
SET "isDefault" = (ranked.rn = 1),
    "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE p.id = ranked.id
  AND p."isDefault" IS DISTINCT FROM (ranked.rn = 1);

-- Clear default flag on archived portfolios.
UPDATE "TerminalPortfolio"
SET "isDefault" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'ARCHIVED'
  AND "isDefault" = true;

-- Clear last-selected pointers that reference archived or inaccessible portfolios for the owner.
UPDATE "UserTerminalSettings" s
SET "lastSelectedPortfolioId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "lastSelectedPortfolioId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "TerminalPortfolio" p
    WHERE p.id = s."lastSelectedPortfolioId"
      AND p."status" = 'ACTIVE'
      AND (
        (p."ownerType" = 'PERSONAL' AND p."ownerUserId" = s."userId")
        OR p."ownerType" = 'COMPANY'
      )
  );
