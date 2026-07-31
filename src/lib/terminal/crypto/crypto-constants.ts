/**
 * Launch asset constants and derived bonding-curve rates for Alta Terminal crypto.
 *
 * Curve model (NVA / VLT):
 *   P(q) = P0 + k q
 *   L(q) = P0 q + ½ k q²   (required protected reserve liability)
 *
 * Calibration (approved product decision):
 *   Gross launch purchase G = ƒ100
 *   Total fee = 1.00% → net to curve N = ƒ99
 *   At q₀ = 0, choose k so marginal price rises by the target impact:
 *     P₁ = P0 · (1 + impact)
 *     ΔP = P₁ − P0
 *     From L(Δq) = N and P(Δq) = P₁:
 *       k = (P0 · ΔP + ½ ΔP²) / N
 *
 * Rates are derived at module load via Decimal math — never hand-picked approximations.
 */

import { Prisma } from "@prisma/client";
import { d, type CryptoDecimal } from "./crypto-decimal";

const Decimal = Prisma.Decimal;

export const CRYPTO_LAUNCH_GROSS = d("100");
export const BONDING_CURVE_TOTAL_FEE_BPS = 100;
export const BONDING_CURVE_REVENUE_FEE_BPS = 75;
export const BONDING_CURVE_STABILIZATION_FEE_BPS = 25;
export const NPFC_CONVERSION_FEE_BPS = 10;

export type CryptoAssetSymbol = "NPFC" | "NVA" | "VLT";

export type CryptoAssetConfig = {
  symbol: CryptoAssetSymbol;
  displayName: string;
  kind: "STABLE" | "BONDING_CURVE";
  /** Seed / lifecycle status for Phase 1 — must remain DRAFT until later phases activate. */
  phase1Status: "DRAFT";
  maxSupply: CryptoDecimal | null;
  pegOrStartingPrice: CryptoDecimal;
  curveRate: CryptoDecimal | null;
  quantityPrecision: number;
  displayPrecision: number;
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
  /** Fixed seed primary keys for idempotent SQL/app seeding. */
  seedAssetId: string;
  seedMarketStateId: string;
};

/**
 * Derive linear bonding-curve rate k from launch gross spend and target price impact.
 * Proves the calibration mathematically; callers should assert the resulting impact in tests.
 */
export function deriveBondingCurveRate(input: {
  startingPrice: CryptoDecimal | string;
  /** Percent impact, e.g. 0.25 for +0.25%. */
  targetImpactPercent: CryptoDecimal | string;
  grossFlorins?: CryptoDecimal | string;
  totalFeeBps?: number;
}): CryptoDecimal {
  const p0 = d(input.startingPrice);
  const impact = d(input.targetImpactPercent).div(100);
  const gross = d(input.grossFlorins ?? CRYPTO_LAUNCH_GROSS);
  const feeBps = input.totalFeeBps ?? BONDING_CURVE_TOTAL_FEE_BPS;
  const net = gross.minus(gross.mul(feeBps).div(10_000));
  if (!p0.greaterThan(0) || !net.greaterThan(0) || !impact.greaterThan(0)) {
    throw new Error("Invalid bonding-curve calibration inputs");
  }
  const p1 = p0.mul(d("1").plus(impact));
  const deltaP = p1.minus(p0);
  // k = (P0·ΔP + ½·ΔP²) / N
  return p0.mul(deltaP).plus(deltaP.mul(deltaP).mul("0.5")).div(net);
}

export const NVA_CURVE_RATE = deriveBondingCurveRate({
  startingPrice: "5",
  targetImpactPercent: "0.25",
});

export const VLT_CURVE_RATE = deriveBondingCurveRate({
  startingPrice: "0.1",
  targetImpactPercent: "2.5",
});

export const CRYPTO_ASSET_CONFIGS: Record<CryptoAssetSymbol, CryptoAssetConfig> = {
  NPFC: {
    symbol: "NPFC",
    displayName: "Newport Florin Coin",
    kind: "STABLE",
    phase1Status: "DRAFT",
    maxSupply: null,
    pegOrStartingPrice: d("1"),
    curveRate: null,
    quantityPrecision: 8,
    displayPrecision: 8,
    totalFeeBps: NPFC_CONVERSION_FEE_BPS,
    revenueFeeBps: NPFC_CONVERSION_FEE_BPS,
    stabilizationFeeBps: 0,
    seedAssetId: "tca_npfc",
    seedMarketStateId: "tcms_npfc",
  },
  NVA: {
    symbol: "NVA",
    displayName: "Nova Coin",
    kind: "BONDING_CURVE",
    phase1Status: "DRAFT",
    maxSupply: d("1000000"),
    pegOrStartingPrice: d("5"),
    curveRate: NVA_CURVE_RATE,
    quantityPrecision: 8,
    displayPrecision: 8,
    totalFeeBps: BONDING_CURVE_TOTAL_FEE_BPS,
    revenueFeeBps: BONDING_CURVE_REVENUE_FEE_BPS,
    stabilizationFeeBps: BONDING_CURVE_STABILIZATION_FEE_BPS,
    seedAssetId: "tca_nva",
    seedMarketStateId: "tcms_nva",
  },
  VLT: {
    symbol: "VLT",
    displayName: "Volt Coin",
    kind: "BONDING_CURVE",
    phase1Status: "DRAFT",
    maxSupply: d("10000000"),
    pegOrStartingPrice: d("0.1"),
    curveRate: VLT_CURVE_RATE,
    quantityPrecision: 8,
    displayPrecision: 8,
    totalFeeBps: BONDING_CURVE_TOTAL_FEE_BPS,
    revenueFeeBps: BONDING_CURVE_REVENUE_FEE_BPS,
    stabilizationFeeBps: BONDING_CURVE_STABILIZATION_FEE_BPS,
    seedAssetId: "tca_vlt",
    seedMarketStateId: "tcms_vlt",
  },
};

/** High-precision string forms for SQL seed / docs (18 dp curve rate). */
export function curveRateSeedString(rate: CryptoDecimal): string {
  return rate.toDecimalPlaces(18, Decimal.ROUND_HALF_UP).toFixed(18);
}

export const LAUNCH_ASSET_SYMBOLS: CryptoAssetSymbol[] = ["NPFC", "NVA", "VLT"];
