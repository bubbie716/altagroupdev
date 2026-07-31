/**
 * Typed inputs/outputs and domain errors for the pure crypto pricing engine.
 */

import type { CryptoDecimal } from "./crypto-decimal";
import type { CryptoAssetSymbol } from "./crypto-constants";

export type CryptoPricingErrorCode =
  | "INVALID_INPUT"
  | "BELOW_MINIMUM_ORDER"
  | "INSUFFICIENT_TREASURY"
  | "INSUFFICIENT_WALLET_HOLDINGS"
  | "INSUFFICIENT_PROTECTED_RESERVE"
  | "EXCEEDS_MAX_SUPPLY"
  | "INVARIANT_VIOLATION"
  | "ASSET_KIND_MISMATCH";

export class CryptoPricingError extends Error {
  readonly code: CryptoPricingErrorCode;
  readonly details?: Record<string, string>;

  constructor(code: CryptoPricingErrorCode, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "CryptoPricingError";
    this.code = code;
    this.details = details;
  }
}

export type FeeBreakdown = {
  grossValue: CryptoDecimal;
  totalFee: CryptoDecimal;
  revenueAllocation: CryptoDecimal;
  stabilizationAllocation: CryptoDecimal;
  netValue: CryptoDecimal;
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
};

export type MarketSnapshotInput = {
  symbol: CryptoAssetSymbol;
  treasuryInventory: CryptoDecimal | string;
  circulatingSupply: CryptoDecimal | string;
  protectedReserve: CryptoDecimal | string;
  stabilizationFund?: CryptoDecimal | string;
  /** Optional wallet available balance (required for sells / redemptions that check holdings). */
  walletAvailable?: CryptoDecimal | string;
};

export type CryptoQuoteInvariants = {
  reserveSolvent: boolean;
  supplyConserved: boolean;
  noNegativeBalances: boolean;
  feeSplitReconciles: boolean;
  priceMonotonicOk: boolean;
};

export type BondingCurveBuyQuote = {
  kind: "BONDING_CURVE_BUY";
  symbol: CryptoAssetSymbol;
  fees: FeeBreakdown;
  executedQuantity: CryptoDecimal;
  priceBefore: CryptoDecimal;
  priceAfter: CryptoDecimal;
  averageExecutionPrice: CryptoDecimal;
  priceImpactPercent: CryptoDecimal;
  reserveLiabilityBefore: CryptoDecimal;
  reserveLiabilityAfter: CryptoDecimal;
  netReserveContribution: CryptoDecimal;
  roundingDust: CryptoDecimal;
  treasuryInventoryBefore: CryptoDecimal;
  treasuryInventoryAfter: CryptoDecimal;
  circulatingSupplyBefore: CryptoDecimal;
  circulatingSupplyAfter: CryptoDecimal;
  protectedReserveBefore: CryptoDecimal;
  protectedReserveAfter: CryptoDecimal;
  invariants: CryptoQuoteInvariants;
};

export type BondingCurveSellQuote = {
  kind: "BONDING_CURVE_SELL";
  symbol: CryptoAssetSymbol;
  fees: FeeBreakdown;
  /** Gross curve redemption before fees. */
  grossRedemption: CryptoDecimal;
  /** Customer florin payout after fees, floored to money precision. */
  customerPayout: CryptoDecimal;
  executedQuantity: CryptoDecimal;
  priceBefore: CryptoDecimal;
  priceAfter: CryptoDecimal;
  averageExecutionPrice: CryptoDecimal;
  priceImpactPercent: CryptoDecimal;
  reserveLiabilityBefore: CryptoDecimal;
  reserveLiabilityAfter: CryptoDecimal;
  netReserveRedemption: CryptoDecimal;
  roundingDust: CryptoDecimal;
  treasuryInventoryBefore: CryptoDecimal;
  treasuryInventoryAfter: CryptoDecimal;
  circulatingSupplyBefore: CryptoDecimal;
  circulatingSupplyAfter: CryptoDecimal;
  protectedReserveBefore: CryptoDecimal;
  protectedReserveAfter: CryptoDecimal;
  invariants: CryptoQuoteInvariants;
};

export type NpfcPurchaseQuote = {
  kind: "NPFC_PURCHASE";
  symbol: "NPFC";
  fees: FeeBreakdown;
  executedQuantity: CryptoDecimal;
  pegPrice: CryptoDecimal;
  priceBefore: CryptoDecimal;
  priceAfter: CryptoDecimal;
  averageExecutionPrice: CryptoDecimal;
  priceImpactPercent: CryptoDecimal;
  netReserveContribution: CryptoDecimal;
  roundingDust: CryptoDecimal;
  circulatingSupplyBefore: CryptoDecimal;
  circulatingSupplyAfter: CryptoDecimal;
  protectedReserveBefore: CryptoDecimal;
  protectedReserveAfter: CryptoDecimal;
  invariants: CryptoQuoteInvariants;
};

export type NpfcRedemptionQuote = {
  kind: "NPFC_REDEMPTION";
  symbol: "NPFC";
  fees: FeeBreakdown;
  executedQuantity: CryptoDecimal;
  pegPrice: CryptoDecimal;
  priceBefore: CryptoDecimal;
  priceAfter: CryptoDecimal;
  averageExecutionPrice: CryptoDecimal;
  priceImpactPercent: CryptoDecimal;
  /** Gross florin obligation before fee. */
  grossRedemption: CryptoDecimal;
  customerPayout: CryptoDecimal;
  netReserveRedemption: CryptoDecimal;
  roundingDust: CryptoDecimal;
  circulatingSupplyBefore: CryptoDecimal;
  circulatingSupplyAfter: CryptoDecimal;
  protectedReserveBefore: CryptoDecimal;
  protectedReserveAfter: CryptoDecimal;
  invariants: CryptoQuoteInvariants;
};

export type CryptoQuote =
  | BondingCurveBuyQuote
  | BondingCurveSellQuote
  | NpfcPurchaseQuote
  | NpfcRedemptionQuote;
