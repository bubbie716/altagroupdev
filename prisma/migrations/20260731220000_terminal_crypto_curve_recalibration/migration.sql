-- Recalibrate NVA / VLT bonding-curve rates for lower prelaunch volatility.
-- Authoritative rates match deriveBondingCurveRate in crypto-constants.ts:
--   NVA: ≈ +0.10% per ƒ100 gross from launch
--   VLT: ≈ +0.25% per ƒ100 gross from launch
-- NPFC unchanged.
--
-- This migration is NONDESTRUCTIVE: it updates curveRate on asset rows only.
-- It does NOT rewrite historical settlements or circulating supply.
-- After applying in a disposable prelaunch environment that already has
-- crypto trade history, operators must run the guarded reset command:
--   CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET=YES npx tsx scripts/reset-terminal-crypto-prelaunch.ts --apply
-- Production must never run that reset.

UPDATE "TerminalCryptoAsset"
SET
  "curveRate" = 0.000252651515151515,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "symbol" = 'NVA'
  AND "kind" = 'BONDING_CURVE'
  AND (
    "curveRate" IS DISTINCT FROM 0.000252651515151515
  );

UPDATE "TerminalCryptoAsset"
SET
  "curveRate" = 0.000000252840909091,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "symbol" = 'VLT'
  AND "kind" = 'BONDING_CURVE'
  AND (
    "curveRate" IS DISTINCT FROM 0.000000252840909091
  );

-- Keep zero-circulation launch prices aligned with peg/start (no trade history).
UPDATE "TerminalCryptoMarketState" AS ms
SET
  "currentMarginalPrice" = a."pegOrStartingPrice",
  "version" = ms."version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "TerminalCryptoAsset" AS a
WHERE ms."assetId" = a."id"
  AND a."symbol" IN ('NVA', 'VLT')
  AND ms."circulatingSupply" = 0
  AND ms."currentMarginalPrice" IS DISTINCT FROM a."pegOrStartingPrice";
