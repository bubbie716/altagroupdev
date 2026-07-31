-- Alta Terminal fictional cryptocurrency market foundation (Phase 1).
-- Florin-denominated Minecraft roleplay economy only — no real-world crypto/blockchain.
-- Seeds NPFC/NVA/VLT in DRAFT (non-tradable). Does not activate trading or mutate live balances.
-- Forward-only. Extends shared TerminalOrder with instrument/venue; raises shared price precision.

-- Crypto-specific enums (instrument/venue enums created in scheduled-trades migration).
CREATE TYPE "TerminalCryptoAssetKind" AS ENUM ('STABLE', 'BONDING_CURVE');
CREATE TYPE "TerminalCryptoAssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HALTED', 'REDEMPTION_ONLY', 'CLOSED');
CREATE TYPE "TerminalCryptoWalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "TerminalCryptoMarketLedgerKind" AS ENUM (
  'BUY_SETTLEMENT',
  'SELL_SETTLEMENT',
  'MINT',
  'BURN',
  'STABILIZATION_ACCRUAL',
  'REVENUE_ACCRUAL',
  'ADJUSTMENT',
  'CORRECTION_REVERSAL'
);
CREATE TYPE "TerminalCryptoMarketLedgerAccount" AS ENUM (
  'TREASURY_INVENTORY',
  'CIRCULATING_SUPPLY',
  'PROTECTED_RESERVE',
  'STABILIZATION_FUND'
);
CREATE TYPE "TerminalCryptoCandleInterval" AS ENUM ('M1', 'M5', 'M15', 'H1', 'H4', 'D1');

-- Extend shared Terminal orders for unified STOCK|CRYPTO / TSE|ALTA_CRYPTO execution.
ALTER TABLE "TerminalOrder"
  ADD COLUMN "instrumentKind" "TerminalInstrumentKind" NOT NULL DEFAULT 'STOCK',
  ADD COLUMN "executionVenue" "TerminalExecutionVenue" NOT NULL DEFAULT 'TSE';

CREATE INDEX "TerminalOrder_instrumentKind_executionVenue_submittedAt_idx"
  ON "TerminalOrder"("instrumentKind", "executionVenue", "submittedAt");

-- Raise shared price precision for crypto marginal prices without invalidating stock data.
ALTER TABLE "TerminalOrder"
  ALTER COLUMN "limitPrice" TYPE DECIMAL(28,12),
  ALTER COLUMN "averageFillPrice" TYPE DECIMAL(28,12);

ALTER TABLE "TerminalOrderFill"
  ALTER COLUMN "price" TYPE DECIMAL(28,12);

ALTER TABLE "TerminalPortfolioActivity"
  ALTER COLUMN "price" TYPE DECIMAL(28,12);

-- Crypto asset configuration
CREATE TABLE "TerminalCryptoAsset" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "TerminalCryptoAssetKind" NOT NULL,
  "status" "TerminalCryptoAssetStatus" NOT NULL DEFAULT 'DRAFT',
  "maxSupply" DECIMAL(28,8),
  "pegOrStartingPrice" DECIMAL(28,12) NOT NULL,
  "curveRate" DECIMAL(36,18),
  "quantityPrecision" INTEGER NOT NULL DEFAULT 8,
  "displayPrecision" INTEGER NOT NULL DEFAULT 8,
  "totalFeeBps" INTEGER NOT NULL,
  "revenueFeeBps" INTEGER NOT NULL,
  "stabilizationFeeBps" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoAsset_fee_split_reconciles"
    CHECK ("revenueFeeBps" + "stabilizationFeeBps" = "totalFeeBps"),
  CONSTRAINT "TerminalCryptoAsset_fee_nonnegative"
    CHECK ("totalFeeBps" >= 0 AND "revenueFeeBps" >= 0 AND "stabilizationFeeBps" >= 0),
  CONSTRAINT "TerminalCryptoAsset_precision_positive"
    CHECK ("quantityPrecision" >= 0 AND "displayPrecision" >= 0),
  CONSTRAINT "TerminalCryptoAsset_starting_price_positive"
    CHECK ("pegOrStartingPrice" > 0),
  CONSTRAINT "TerminalCryptoAsset_curve_rate_rules"
    CHECK (
      ("kind" = 'STABLE' AND "curveRate" IS NULL AND "maxSupply" IS NULL)
      OR ("kind" = 'BONDING_CURVE' AND "curveRate" IS NOT NULL AND "curveRate" > 0 AND "maxSupply" IS NOT NULL AND "maxSupply" > 0)
    )
);

CREATE UNIQUE INDEX "TerminalCryptoAsset_symbol_key" ON "TerminalCryptoAsset"("symbol");
CREATE INDEX "TerminalCryptoAsset_status_idx" ON "TerminalCryptoAsset"("status");
CREATE INDEX "TerminalCryptoAsset_kind_status_idx" ON "TerminalCryptoAsset"("kind", "status");

-- Portfolio custodial wallet (internal ledger only)
CREATE TABLE "TerminalCryptoWallet" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "publicWalletId" TEXT NOT NULL,
  "status" "TerminalCryptoWalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalCryptoWallet_portfolioId_key" ON "TerminalCryptoWallet"("portfolioId");
CREATE UNIQUE INDEX "TerminalCryptoWallet_publicWalletId_key" ON "TerminalCryptoWallet"("publicWalletId");
CREATE INDEX "TerminalCryptoWallet_status_idx" ON "TerminalCryptoWallet"("status");
CREATE INDEX "TerminalCryptoWallet_publicWalletId_idx" ON "TerminalCryptoWallet"("publicWalletId");

ALTER TABLE "TerminalCryptoWallet"
  ADD CONSTRAINT "TerminalCryptoWallet_portfolioId_fkey"
  FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Authoritative wallet balances (never store crypto in TerminalPosition)
CREATE TABLE "TerminalCryptoWalletBalance" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "availableQuantity" DECIMAL(28,8) NOT NULL DEFAULT 0,
  "reservedQuantity" DECIMAL(28,8) NOT NULL DEFAULT 0,
  "averageCost" DECIMAL(28,12) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoWalletBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoWalletBalance_available_nonnegative" CHECK ("availableQuantity" >= 0),
  CONSTRAINT "TerminalCryptoWalletBalance_reserved_nonnegative" CHECK ("reservedQuantity" >= 0)
);

CREATE UNIQUE INDEX "TerminalCryptoWalletBalance_walletId_assetId_key"
  ON "TerminalCryptoWalletBalance"("walletId", "assetId");
CREATE INDEX "TerminalCryptoWalletBalance_assetId_idx" ON "TerminalCryptoWalletBalance"("assetId");
CREATE INDEX "TerminalCryptoWalletBalance_walletId_updatedAt_idx"
  ON "TerminalCryptoWalletBalance"("walletId", "updatedAt");

ALTER TABLE "TerminalCryptoWalletBalance"
  ADD CONSTRAINT "TerminalCryptoWalletBalance_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "TerminalCryptoWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoWalletBalance"
  ADD CONSTRAINT "TerminalCryptoWalletBalance_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authoritative market state
CREATE TABLE "TerminalCryptoMarketState" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "treasuryInventory" DECIMAL(28,8) NOT NULL DEFAULT 0,
  "circulatingSupply" DECIMAL(28,8) NOT NULL DEFAULT 0,
  "protectedReserve" DECIMAL(28,12) NOT NULL DEFAULT 0,
  "stabilizationFund" DECIMAL(28,12) NOT NULL DEFAULT 0,
  "currentMarginalPrice" DECIMAL(28,12) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoMarketState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoMarketState_treasury_nonnegative" CHECK ("treasuryInventory" >= 0),
  CONSTRAINT "TerminalCryptoMarketState_circulating_nonnegative" CHECK ("circulatingSupply" >= 0),
  CONSTRAINT "TerminalCryptoMarketState_reserve_nonnegative" CHECK ("protectedReserve" >= 0),
  CONSTRAINT "TerminalCryptoMarketState_stabilization_nonnegative" CHECK ("stabilizationFund" >= 0),
  CONSTRAINT "TerminalCryptoMarketState_price_positive" CHECK ("currentMarginalPrice" > 0)
);

CREATE UNIQUE INDEX "TerminalCryptoMarketState_assetId_key" ON "TerminalCryptoMarketState"("assetId");
CREATE INDEX "TerminalCryptoMarketState_updatedAt_idx" ON "TerminalCryptoMarketState"("updatedAt");

ALTER TABLE "TerminalCryptoMarketState"
  ADD CONSTRAINT "TerminalCryptoMarketState_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Crypto order settlement (1:1 with TerminalOrder)
CREATE TABLE "TerminalCryptoOrderSettlement" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "priceBefore" DECIMAL(28,12) NOT NULL,
  "priceAfter" DECIMAL(28,12) NOT NULL,
  "averageExecutionPrice" DECIMAL(28,12) NOT NULL,
  "grossValue" DECIMAL(28,12) NOT NULL,
  "totalFee" DECIMAL(28,12) NOT NULL,
  "revenueAllocation" DECIMAL(28,12) NOT NULL,
  "stabilizationAllocation" DECIMAL(28,12) NOT NULL,
  "netReserveDelta" DECIMAL(28,12) NOT NULL,
  "executedQuantity" DECIMAL(28,8) NOT NULL,
  "treasuryInventoryBefore" DECIMAL(28,8) NOT NULL,
  "treasuryInventoryAfter" DECIMAL(28,8) NOT NULL,
  "circulatingSupplyBefore" DECIMAL(28,8) NOT NULL,
  "circulatingSupplyAfter" DECIMAL(28,8) NOT NULL,
  "protectedReserveBefore" DECIMAL(28,12) NOT NULL,
  "protectedReserveAfter" DECIMAL(28,12) NOT NULL,
  "roundingDust" DECIMAL(28,12) NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT,
  "externalReference" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoOrderSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoOrderSettlement_quantity_positive" CHECK ("executedQuantity" > 0),
  CONSTRAINT "TerminalCryptoOrderSettlement_fee_split"
    CHECK ("revenueAllocation" + "stabilizationAllocation" = "totalFee")
);

CREATE UNIQUE INDEX "TerminalCryptoOrderSettlement_orderId_key" ON "TerminalCryptoOrderSettlement"("orderId");
CREATE UNIQUE INDEX "TerminalCryptoOrderSettlement_walletId_idempotencyKey_key"
  ON "TerminalCryptoOrderSettlement"("walletId", "idempotencyKey");
CREATE INDEX "TerminalCryptoOrderSettlement_assetId_executedAt_idx"
  ON "TerminalCryptoOrderSettlement"("assetId", "executedAt");
CREATE INDEX "TerminalCryptoOrderSettlement_walletId_executedAt_idx"
  ON "TerminalCryptoOrderSettlement"("walletId", "executedAt");
CREATE INDEX "TerminalCryptoOrderSettlement_executedAt_idx" ON "TerminalCryptoOrderSettlement"("executedAt");
CREATE INDEX "TerminalCryptoOrderSettlement_externalReference_idx"
  ON "TerminalCryptoOrderSettlement"("externalReference");

ALTER TABLE "TerminalCryptoOrderSettlement"
  ADD CONSTRAINT "TerminalCryptoOrderSettlement_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "TerminalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoOrderSettlement"
  ADD CONSTRAINT "TerminalCryptoOrderSettlement_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoOrderSettlement"
  ADD CONSTRAINT "TerminalCryptoOrderSettlement_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "TerminalCryptoWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutable market ledger
CREATE TABLE "TerminalCryptoMarketLedgerEntry" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "settlementId" TEXT,
  "kind" "TerminalCryptoMarketLedgerKind" NOT NULL,
  "account" "TerminalCryptoMarketLedgerAccount" NOT NULL,
  "delta" DECIMAL(28,12) NOT NULL,
  "balanceAfter" DECIMAL(28,12) NOT NULL,
  "idempotencyKey" TEXT,
  "externalReference" TEXT,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'system',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TerminalCryptoMarketLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalCryptoMarketLedgerEntry_assetId_idempotencyKey_key"
  ON "TerminalCryptoMarketLedgerEntry"("assetId", "idempotencyKey");
CREATE INDEX "TerminalCryptoMarketLedgerEntry_assetId_createdAt_idx"
  ON "TerminalCryptoMarketLedgerEntry"("assetId", "createdAt");
CREATE INDEX "TerminalCryptoMarketLedgerEntry_settlementId_idx"
  ON "TerminalCryptoMarketLedgerEntry"("settlementId");
CREATE INDEX "TerminalCryptoMarketLedgerEntry_account_createdAt_idx"
  ON "TerminalCryptoMarketLedgerEntry"("account", "createdAt");
CREATE INDEX "TerminalCryptoMarketLedgerEntry_kind_createdAt_idx"
  ON "TerminalCryptoMarketLedgerEntry"("kind", "createdAt");
CREATE INDEX "TerminalCryptoMarketLedgerEntry_externalReference_idx"
  ON "TerminalCryptoMarketLedgerEntry"("externalReference");

ALTER TABLE "TerminalCryptoMarketLedgerEntry"
  ADD CONSTRAINT "TerminalCryptoMarketLedgerEntry_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalCryptoMarketLedgerEntry"
  ADD CONSTRAINT "TerminalCryptoMarketLedgerEntry_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "TerminalCryptoOrderSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Price candles
CREATE TABLE "TerminalCryptoPriceCandle" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "interval" "TerminalCryptoCandleInterval" NOT NULL,
  "intervalStart" TIMESTAMP(3) NOT NULL,
  "open" DECIMAL(28,12) NOT NULL,
  "high" DECIMAL(28,12) NOT NULL,
  "low" DECIMAL(28,12) NOT NULL,
  "close" DECIMAL(28,12) NOT NULL,
  "tradedQuantity" DECIMAL(28,8) NOT NULL DEFAULT 0,
  "florinVolume" DECIMAL(28,12) NOT NULL DEFAULT 0,
  "tradeCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TerminalCryptoPriceCandle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerminalCryptoPriceCandle_ohlc_ordered"
    CHECK ("low" <= "open" AND "low" <= "close" AND "high" >= "open" AND "high" >= "close"),
  CONSTRAINT "TerminalCryptoPriceCandle_volume_nonnegative"
    CHECK ("tradedQuantity" >= 0 AND "florinVolume" >= 0 AND "tradeCount" >= 0)
);

CREATE UNIQUE INDEX "TerminalCryptoPriceCandle_assetId_interval_intervalStart_key"
  ON "TerminalCryptoPriceCandle"("assetId", "interval", "intervalStart");
CREATE INDEX "TerminalCryptoPriceCandle_assetId_interval_intervalStart_idx"
  ON "TerminalCryptoPriceCandle"("assetId", "interval", "intervalStart");
CREATE INDEX "TerminalCryptoPriceCandle_intervalStart_idx" ON "TerminalCryptoPriceCandle"("intervalStart");

ALTER TABLE "TerminalCryptoPriceCandle"
  ADD CONSTRAINT "TerminalCryptoPriceCandle_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TerminalCryptoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deterministic idempotent seed: three launch assets in DRAFT (non-public / non-tradable).
-- Curve rates derived from ƒ100 gross launch calibration (1% fee → ƒ99 net):
--   NVA: P0=5, +0.25% → k = (5*0.0125 + 0.5*0.0125^2)/99
--   VLT: P0=0.1, +2.5% → k = (0.1*0.0025 + 0.5*0.0025^2)/99
INSERT INTO "TerminalCryptoAsset" (
  "id", "symbol", "displayName", "kind", "status", "maxSupply", "pegOrStartingPrice", "curveRate",
  "quantityPrecision", "displayPrecision", "totalFeeBps", "revenueFeeBps", "stabilizationFeeBps",
  "createdAt", "updatedAt"
) VALUES
  (
    'tca_npfc', 'NPFC', 'Newport Florin Coin', 'STABLE', 'DRAFT', NULL, 1.000000000000,
    NULL, 8, 8, 10, 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tca_nva', 'NVA', 'Nova Coin', 'BONDING_CURVE', 'DRAFT', 1000000.00000000, 5.000000000000,
    0.000632102272727273, 8, 8, 100, 75, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tca_vlt', 'VLT', 'Volt Coin', 'BONDING_CURVE', 'DRAFT', 10000000.00000000, 0.100000000000,
    0.000002556818181818, 8, 8, 100, 75, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TerminalCryptoMarketState" (
  "id", "assetId", "treasuryInventory", "circulatingSupply", "protectedReserve", "stabilizationFund",
  "currentMarginalPrice", "version", "createdAt", "updatedAt"
) VALUES
  (
    'tcms_npfc', 'tca_npfc', 0, 0, 0, 0, 1.000000000000, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tcms_nva', 'tca_nva', 1000000.00000000, 0, 0, 0, 5.000000000000, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tcms_vlt', 'tca_vlt', 10000000.00000000, 0, 0, 0, 0.100000000000, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
