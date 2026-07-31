/**
 * Idempotent seed helpers for NPFC / NVA / VLT.
 * Assets remain DRAFT (non-public / non-tradable) in Phase 1.
 *
 * Prefer the SQL migration seed for fresh environments; this module lets app code
 * upsert the same deterministic rows without re-deriving curve constants manually.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CRYPTO_ASSET_CONFIGS,
  LAUNCH_ASSET_SYMBOLS,
  curveRateSeedString,
  type CryptoAssetSymbol,
} from "./crypto-constants";

export type TerminalCryptoSeedResult = {
  symbol: CryptoAssetSymbol;
  assetId: string;
  marketStateId: string;
  status: "DRAFT";
  created: boolean;
};

/**
 * Ensure launch assets + market state exist with DRAFT status.
 * Does not activate assets, mutate balances, or expose them publicly.
 */
export async function ensureTerminalCryptoLaunchAssetsSeeded(
  db: Pick<PrismaClient, "terminalCryptoAsset" | "terminalCryptoMarketState">,
): Promise<TerminalCryptoSeedResult[]> {
  const results: TerminalCryptoSeedResult[] = [];

  for (const symbol of LAUNCH_ASSET_SYMBOLS) {
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    const existing = await db.terminalCryptoAsset.findUnique({ where: { symbol } });
    if (existing) {
      if (existing.status !== "DRAFT" && existing.status !== "ACTIVE" && existing.status !== "HALTED") {
        // Preserve non-draft lifecycle if a later phase already progressed the asset.
      }
      results.push({
        symbol,
        assetId: existing.id,
        marketStateId: cfg.seedMarketStateId,
        status: "DRAFT",
        created: false,
      });
      continue;
    }

    await db.terminalCryptoAsset.create({
      data: {
        id: cfg.seedAssetId,
        symbol: cfg.symbol,
        displayName: cfg.displayName,
        kind: cfg.kind,
        status: "DRAFT",
        maxSupply: cfg.maxSupply,
        pegOrStartingPrice: cfg.pegOrStartingPrice,
        curveRate: cfg.curveRate,
        quantityPrecision: cfg.quantityPrecision,
        displayPrecision: cfg.displayPrecision,
        totalFeeBps: cfg.totalFeeBps,
        revenueFeeBps: cfg.revenueFeeBps,
        stabilizationFeeBps: cfg.stabilizationFeeBps,
        marketState: {
          create: {
            id: cfg.seedMarketStateId,
            treasuryInventory: cfg.maxSupply ?? 0,
            circulatingSupply: 0,
            protectedReserve: 0,
            stabilizationFund: 0,
            accruedRevenue: 0,
            currentMarginalPrice: cfg.pegOrStartingPrice,
            version: 0,
          },
        },
      },
    });

    results.push({
      symbol,
      assetId: cfg.seedAssetId,
      marketStateId: cfg.seedMarketStateId,
      status: "DRAFT",
      created: true,
    });
  }

  return results;
}

/** Documented seed payload for migrations / audits (no DB access). */
export function getTerminalCryptoLaunchSeedDocuments() {
  return LAUNCH_ASSET_SYMBOLS.map((symbol) => {
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    return {
      assetId: cfg.seedAssetId,
      marketStateId: cfg.seedMarketStateId,
      symbol: cfg.symbol,
      displayName: cfg.displayName,
      kind: cfg.kind,
      status: cfg.phase1Status,
      maxSupply: cfg.maxSupply?.toFixed(8) ?? null,
      pegOrStartingPrice: cfg.pegOrStartingPrice.toFixed(12),
      curveRate: cfg.curveRate ? curveRateSeedString(cfg.curveRate) : null,
      totalFeeBps: cfg.totalFeeBps,
      revenueFeeBps: cfg.revenueFeeBps,
      stabilizationFeeBps: cfg.stabilizationFeeBps,
      treasuryInventory: cfg.maxSupply?.toFixed(8) ?? "0.00000000",
      circulatingSupply: "0.00000000",
      protectedReserve: "0.000000000000",
      currentMarginalPrice: cfg.pegOrStartingPrice.toFixed(12),
    };
  });
}
