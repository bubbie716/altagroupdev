import {
  CRYPTO_ASSET_CONFIGS,
  type CryptoAssetSymbol,
} from "./crypto-constants";
import {
  CRYPTO_MIN_ORDER_GROSS,
  d,
  isNonNegative,
  isPositive,
  roundDownMoney,
  roundDownQuantity,
  type CryptoDecimal,
  type CryptoDecimalInput,
} from "./crypto-decimal";
import {
  averageExecutionPrice,
  marginalPrice,
  netFromSellQuantity,
  quantityFromNetBuy,
  reserveLiability,
} from "./crypto-curve-math";
import {
  CryptoPricingError,
  type BondingCurveBuyQuote,
  type BondingCurveSellQuote,
  type CryptoQuoteInvariants,
  type FeeBreakdown,
  type MarketSnapshotInput,
  type NpfcPurchaseQuote,
  type NpfcRedemptionQuote,
} from "./crypto-pricing-types";

function requirePositive(label: string, value: CryptoDecimalInput): CryptoDecimal {
  const v = d(value);
  if (!isPositive(v)) {
    throw new CryptoPricingError("INVALID_INPUT", `${label} must be positive`, {
      [label]: v.toFixed(),
    });
  }
  return v;
}

function requireNonNegative(label: string, value: CryptoDecimalInput): CryptoDecimal {
  const v = d(value);
  if (!isNonNegative(v)) {
    throw new CryptoPricingError("INVALID_INPUT", `${label} must be non-negative`, {
      [label]: v.toFixed(),
    });
  }
  return v;
}

export function calculateFeeBreakdown(input: {
  grossValue: CryptoDecimalInput;
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
}): FeeBreakdown {
  const grossValue = requireNonNegative("grossValue", input.grossValue);
  if (input.revenueFeeBps + input.stabilizationFeeBps !== input.totalFeeBps) {
    throw new CryptoPricingError(
      "INVARIANT_VIOLATION",
      "Fee allocation basis points must sum to totalFeeBps",
      {
        totalFeeBps: String(input.totalFeeBps),
        revenueFeeBps: String(input.revenueFeeBps),
        stabilizationFeeBps: String(input.stabilizationFeeBps),
      },
    );
  }
  const totalFee = grossValue.mul(input.totalFeeBps).div(10_000);
  const revenueAllocation = grossValue.mul(input.revenueFeeBps).div(10_000);
  // Exact remainder so fee split always reconciles under Decimal division.
  const stabilizationAllocation = totalFee.minus(revenueAllocation);
  if (!revenueAllocation.plus(stabilizationAllocation).equals(totalFee)) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Fee split does not reconcile to total fee");
  }
  // Guard that remainder matches the configured stabilization bps within dust for well-formed configs.
  const expectedStab = grossValue.mul(input.stabilizationFeeBps).div(10_000);
  if (stabilizationAllocation.minus(expectedStab).abs().greaterThan(d("0.000000000001"))) {
    throw new CryptoPricingError(
      "INVARIANT_VIOLATION",
      "Stabilization fee allocation diverged from configured basis points",
      {
        stabilizationAllocation: stabilizationAllocation.toFixed(),
        expected: expectedStab.toFixed(),
      },
    );
  }
  return {
    grossValue,
    totalFee,
    revenueAllocation,
    stabilizationAllocation,
    netValue: grossValue.minus(totalFee),
    totalFeeBps: input.totalFeeBps,
    revenueFeeBps: input.revenueFeeBps,
    stabilizationFeeBps: input.stabilizationFeeBps,
  };
}

function assertMinGross(gross: CryptoDecimal): void {
  if (gross.lessThan(d(CRYPTO_MIN_ORDER_GROSS))) {
    throw new CryptoPricingError(
      "BELOW_MINIMUM_ORDER",
      `Minimum customer order value is ƒ${CRYPTO_MIN_ORDER_GROSS}`,
      { gross: gross.toFixed(2) },
    );
  }
}

function bondingConfig(symbol: CryptoAssetSymbol) {
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  if (cfg.kind !== "BONDING_CURVE" || cfg.curveRate == null || cfg.maxSupply == null) {
    throw new CryptoPricingError("ASSET_KIND_MISMATCH", `${symbol} is not a bonding-curve asset`);
  }
  return cfg;
}

function buildInvariants(input: {
  feeSplitReconciles: boolean;
  reserveAfter: CryptoDecimal;
  liabilityAfter: CryptoDecimal;
  treasuryAfter: CryptoDecimal;
  circulatingAfter: CryptoDecimal;
  maxSupply: CryptoDecimal | null;
  stabilizationAfter: CryptoDecimal;
  priceBefore: CryptoDecimal;
  priceAfter: CryptoDecimal;
  side: "BUY" | "SELL";
}): CryptoQuoteInvariants {
  const reserveSolvent = input.reserveAfter.greaterThanOrEqualTo(input.liabilityAfter);
  const supplyConserved =
    input.maxSupply == null
      ? true
      : input.treasuryAfter.plus(input.circulatingAfter).equals(input.maxSupply);
  const noNegativeBalances =
    isNonNegative(input.reserveAfter) &&
    isNonNegative(input.treasuryAfter) &&
    isNonNegative(input.circulatingAfter) &&
    isNonNegative(input.stabilizationAfter);
  const priceMonotonicOk =
    input.side === "BUY"
      ? input.priceAfter.greaterThanOrEqualTo(input.priceBefore)
      : input.priceAfter.lessThanOrEqualTo(input.priceBefore);
  return {
    reserveSolvent,
    supplyConserved,
    noNegativeBalances,
    feeSplitReconciles: input.feeSplitReconciles,
    priceMonotonicOk,
  };
}

function assertInvariants(invariants: CryptoQuoteInvariants): void {
  if (!invariants.feeSplitReconciles) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Fee split failed");
  }
  if (!invariants.reserveSolvent) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Reserve dropped below curve liability");
  }
  if (!invariants.supplyConserved) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Treasury + circulating supply must equal max supply");
  }
  if (!invariants.noNegativeBalances) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Negative market balance detected");
  }
  if (!invariants.priceMonotonicOk) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Price moved the wrong direction for trade side");
  }
}

/**
 * Bonding-curve market buy quote from gross florin spend (customer pays gross; fee taken off top).
 * Coins move treasury → circulation. Quantity is floored to coin precision; unpaid net dust stays protected.
 */
export function quoteBondingCurveBuy(input: {
  market: MarketSnapshotInput;
  grossFlorins: CryptoDecimalInput;
}): BondingCurveBuyQuote {
  const symbol = input.market.symbol;
  const cfg = bondingConfig(symbol);
  const gross = requirePositive("grossFlorins", input.grossFlorins);
  assertMinGross(gross);

  const treasuryBefore = requireNonNegative("treasuryInventory", input.market.treasuryInventory);
  const circulatingBefore = requireNonNegative("circulatingSupply", input.market.circulatingSupply);
  const reserveBefore = requireNonNegative("protectedReserve", input.market.protectedReserve);
  const stabilizationBefore = requireNonNegative(
    "stabilizationFund",
    input.market.stabilizationFund ?? "0",
  );

  const fees = calculateFeeBreakdown({
    grossValue: gross,
    totalFeeBps: cfg.totalFeeBps,
    revenueFeeBps: cfg.revenueFeeBps,
    stabilizationFeeBps: cfg.stabilizationFeeBps,
  });

  const priceBefore = marginalPrice({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
  });
  const liabilityBefore = reserveLiability({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
  });

  const idealQty = quantityFromNetBuy({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
    netFlorins: fees.netValue,
  });
  const executedQuantity = roundDownQuantity(idealQty, cfg.quantityPrecision);
  if (!executedQuantity.greaterThan(0)) {
    throw new CryptoPricingError("INVALID_INPUT", "Executed quantity rounds down to zero");
  }
  if (executedQuantity.greaterThan(treasuryBefore)) {
    throw new CryptoPricingError("INSUFFICIENT_TREASURY", "Buy exceeds treasury inventory", {
      requested: executedQuantity.toFixed(8),
      treasury: treasuryBefore.toFixed(8),
    });
  }

  const circulatingAfter = circulatingBefore.plus(executedQuantity);
  if (circulatingAfter.greaterThan(cfg.maxSupply!)) {
    throw new CryptoPricingError("EXCEEDS_MAX_SUPPLY", "Buy would exceed maximum supply");
  }

  const liabilityAfter = reserveLiability({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingAfter,
  });
  const netReserveContribution = liabilityAfter.minus(liabilityBefore);
  const roundingDust = fees.netValue.minus(netReserveContribution);
  if (roundingDust.lessThan(0)) {
    throw new CryptoPricingError(
      "INVARIANT_VIOLATION",
      "Rounded buy quantity requires more net florins than available",
    );
  }

  // Dust remains protected in the reserve (overcollateralization vs pure liability).
  const protectedReserveAfter = reserveBefore.plus(fees.netValue);
  const treasuryAfter = treasuryBefore.minus(executedQuantity);
  const stabilizationAfter = stabilizationBefore.plus(fees.stabilizationAllocation);
  const priceAfter = marginalPrice({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingAfter,
  });
  const avg = averageExecutionPrice(netReserveContribution, executedQuantity);
  const priceImpactPercent = priceBefore.greaterThan(0)
    ? priceAfter.minus(priceBefore).div(priceBefore).mul(100)
    : d("0");

  const invariants = buildInvariants({
    feeSplitReconciles: fees.revenueAllocation.plus(fees.stabilizationAllocation).equals(fees.totalFee),
    reserveAfter: protectedReserveAfter,
    liabilityAfter,
    treasuryAfter,
    circulatingAfter,
    maxSupply: cfg.maxSupply,
    stabilizationAfter,
    priceBefore,
    priceAfter,
    side: "BUY",
  });
  assertInvariants(invariants);

  return {
    kind: "BONDING_CURVE_BUY",
    symbol,
    fees,
    executedQuantity,
    priceBefore,
    priceAfter,
    averageExecutionPrice: avg,
    priceImpactPercent,
    reserveLiabilityBefore: liabilityBefore,
    reserveLiabilityAfter: liabilityAfter,
    netReserveContribution,
    roundingDust,
    treasuryInventoryBefore: treasuryBefore,
    treasuryInventoryAfter: treasuryAfter,
    circulatingSupplyBefore: circulatingBefore,
    circulatingSupplyAfter: circulatingAfter,
    protectedReserveBefore: reserveBefore,
    protectedReserveAfter,
    invariants,
  };
}

/**
 * Bonding-curve market sell quote from coin quantity.
 * Coins move circulation → treasury. Customer payout never exceeds available redemption (floored).
 */
export function quoteBondingCurveSell(input: {
  market: MarketSnapshotInput;
  quantity: CryptoDecimalInput;
}): BondingCurveSellQuote {
  const symbol = input.market.symbol;
  const cfg = bondingConfig(symbol);
  const executedQuantity = roundDownQuantity(
    requirePositive("quantity", input.quantity),
    cfg.quantityPrecision,
  );
  if (!executedQuantity.greaterThan(0)) {
    throw new CryptoPricingError("INVALID_INPUT", "Sell quantity rounds down to zero");
  }

  const treasuryBefore = requireNonNegative("treasuryInventory", input.market.treasuryInventory);
  const circulatingBefore = requireNonNegative("circulatingSupply", input.market.circulatingSupply);
  const reserveBefore = requireNonNegative("protectedReserve", input.market.protectedReserve);
  const stabilizationBefore = requireNonNegative(
    "stabilizationFund",
    input.market.stabilizationFund ?? "0",
  );
  const walletAvailable = requireNonNegative(
    "walletAvailable",
    input.market.walletAvailable ?? executedQuantity,
  );

  if (executedQuantity.greaterThan(walletAvailable)) {
    throw new CryptoPricingError("INSUFFICIENT_WALLET_HOLDINGS", "Sell exceeds wallet holdings", {
      requested: executedQuantity.toFixed(8),
      available: walletAvailable.toFixed(8),
    });
  }
  if (executedQuantity.greaterThan(circulatingBefore)) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Sell exceeds circulating supply");
  }

  const priceBefore = marginalPrice({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
  });
  const liabilityBefore = reserveLiability({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
  });

  const grossRedemption = netFromSellQuantity({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingBefore,
    quantity: executedQuantity,
  });

  // Minimum order applies to gross redemption value for sells.
  assertMinGross(grossRedemption);

  const fees = calculateFeeBreakdown({
    grossValue: grossRedemption,
    totalFeeBps: cfg.totalFeeBps,
    revenueFeeBps: cfg.revenueFeeBps,
    stabilizationFeeBps: cfg.stabilizationFeeBps,
  });

  const customerPayout = roundDownMoney(fees.netValue);
  const roundingDust = fees.netValue.minus(customerPayout);
  if (roundingDust.lessThan(0)) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Customer payout exceeds net redemption");
  }

  const circulatingAfter = circulatingBefore.minus(executedQuantity);
  const treasuryAfter = treasuryBefore.plus(executedQuantity);
  const liabilityAfter = reserveLiability({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingAfter,
  });
  const netReserveRedemption = liabilityBefore.minus(liabilityAfter);
  // Pull gross redemption from reserve; fee leaves revenue/stabilization; dust stays protected.
  const protectedReserveAfter = reserveBefore.minus(grossRedemption).plus(roundingDust);
  if (protectedReserveAfter.lessThan(liabilityAfter)) {
    throw new CryptoPricingError(
      "INSUFFICIENT_PROTECTED_RESERVE",
      "Sell would leave reserve below curve liability",
    );
  }
  if (protectedReserveAfter.lessThan(0)) {
    throw new CryptoPricingError("INSUFFICIENT_PROTECTED_RESERVE", "Sell exceeds protected reserve");
  }

  const stabilizationAfter = stabilizationBefore.plus(fees.stabilizationAllocation);
  const priceAfter = marginalPrice({
    startingPrice: cfg.pegOrStartingPrice,
    curveRate: cfg.curveRate!,
    circulatingSupply: circulatingAfter,
  });
  const avg = averageExecutionPrice(grossRedemption, executedQuantity);
  const priceImpactPercent = priceBefore.greaterThan(0)
    ? priceAfter.minus(priceBefore).div(priceBefore).mul(100)
    : d("0");

  const invariants = buildInvariants({
    feeSplitReconciles: fees.revenueAllocation.plus(fees.stabilizationAllocation).equals(fees.totalFee),
    reserveAfter: protectedReserveAfter,
    liabilityAfter,
    treasuryAfter,
    circulatingAfter,
    maxSupply: cfg.maxSupply,
    stabilizationAfter,
    priceBefore,
    priceAfter,
    side: "SELL",
  });
  assertInvariants(invariants);

  return {
    kind: "BONDING_CURVE_SELL",
    symbol,
    fees,
    grossRedemption,
    customerPayout,
    executedQuantity,
    priceBefore,
    priceAfter,
    averageExecutionPrice: avg,
    priceImpactPercent,
    reserveLiabilityBefore: liabilityBefore,
    reserveLiabilityAfter: liabilityAfter,
    netReserveRedemption,
    roundingDust,
    treasuryInventoryBefore: treasuryBefore,
    treasuryInventoryAfter: treasuryAfter,
    circulatingSupplyBefore: circulatingBefore,
    circulatingSupplyAfter: circulatingAfter,
    protectedReserveBefore: reserveBefore,
    protectedReserveAfter,
    invariants,
  };
}

/** NPFC purchase: mint against exact ƒ1.00 peg. Fee is 0.10% of gross; net florins back minted coins 1:1. */
export function quoteNpfcPurchase(input: {
  market: MarketSnapshotInput;
  grossFlorins: CryptoDecimalInput;
}): NpfcPurchaseQuote {
  if (input.market.symbol !== "NPFC") {
    throw new CryptoPricingError("ASSET_KIND_MISMATCH", "NPFC purchase requires NPFC market");
  }
  const cfg = CRYPTO_ASSET_CONFIGS.NPFC;
  const gross = requirePositive("grossFlorins", input.grossFlorins);
  assertMinGross(gross);
  const circulatingBefore = requireNonNegative("circulatingSupply", input.market.circulatingSupply);
  const reserveBefore = requireNonNegative("protectedReserve", input.market.protectedReserve);

  const fees = calculateFeeBreakdown({
    grossValue: gross,
    totalFeeBps: cfg.totalFeeBps,
    revenueFeeBps: cfg.revenueFeeBps,
    stabilizationFeeBps: cfg.stabilizationFeeBps,
  });

  const peg = cfg.pegOrStartingPrice;
  const idealQty = fees.netValue.div(peg);
  const executedQuantity = roundDownQuantity(idealQty, cfg.quantityPrecision);
  if (!executedQuantity.greaterThan(0)) {
    throw new CryptoPricingError("INVALID_INPUT", "NPFC purchase quantity rounds down to zero");
  }
  const netReserveContribution = executedQuantity.mul(peg);
  const roundingDust = fees.netValue.minus(netReserveContribution);
  if (roundingDust.lessThan(0)) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "NPFC mint exceeds net florins");
  }

  const circulatingAfter = circulatingBefore.plus(executedQuantity);
  const protectedReserveAfter = reserveBefore.plus(fees.netValue);
  // Solvency: minted supply ≤ reserve (peg 1:1), dust keeps reserve ≥ circulating.
  if (protectedReserveAfter.lessThan(circulatingAfter.mul(peg))) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "NPFC reserve would be undercollateralized");
  }

  const invariants: CryptoQuoteInvariants = {
    reserveSolvent: protectedReserveAfter.greaterThanOrEqualTo(circulatingAfter.mul(peg)),
    supplyConserved: true,
    noNegativeBalances: isNonNegative(protectedReserveAfter) && isNonNegative(circulatingAfter),
    feeSplitReconciles: fees.revenueAllocation.plus(fees.stabilizationAllocation).equals(fees.totalFee),
    priceMonotonicOk: true,
  };
  assertInvariants(invariants);

  return {
    kind: "NPFC_PURCHASE",
    symbol: "NPFC",
    fees,
    executedQuantity,
    pegPrice: peg,
    priceBefore: peg,
    priceAfter: peg,
    averageExecutionPrice: peg,
    priceImpactPercent: d("0"),
    netReserveContribution,
    roundingDust,
    circulatingSupplyBefore: circulatingBefore,
    circulatingSupplyAfter: circulatingAfter,
    protectedReserveBefore: reserveBefore,
    protectedReserveAfter,
    invariants,
  };
}

/** NPFC redemption: burn coins for florins at ƒ1.00 peg, minus 0.10% fee. */
export function quoteNpfcRedemption(input: {
  market: MarketSnapshotInput;
  quantity: CryptoDecimalInput;
}): NpfcRedemptionQuote {
  if (input.market.symbol !== "NPFC") {
    throw new CryptoPricingError("ASSET_KIND_MISMATCH", "NPFC redemption requires NPFC market");
  }
  const cfg = CRYPTO_ASSET_CONFIGS.NPFC;
  const executedQuantity = roundDownQuantity(
    requirePositive("quantity", input.quantity),
    cfg.quantityPrecision,
  );
  if (!executedQuantity.greaterThan(0)) {
    throw new CryptoPricingError("INVALID_INPUT", "NPFC redemption quantity rounds down to zero");
  }

  const circulatingBefore = requireNonNegative("circulatingSupply", input.market.circulatingSupply);
  const reserveBefore = requireNonNegative("protectedReserve", input.market.protectedReserve);
  const walletAvailable = requireNonNegative(
    "walletAvailable",
    input.market.walletAvailable ?? executedQuantity,
  );

  if (executedQuantity.greaterThan(walletAvailable)) {
    throw new CryptoPricingError("INSUFFICIENT_WALLET_HOLDINGS", "Redemption exceeds wallet holdings");
  }
  if (executedQuantity.greaterThan(circulatingBefore)) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "Redemption exceeds circulating NPFC supply");
  }

  const peg = cfg.pegOrStartingPrice;
  const grossRedemption = executedQuantity.mul(peg);
  assertMinGross(grossRedemption);

  if (grossRedemption.greaterThan(reserveBefore)) {
    throw new CryptoPricingError(
      "INSUFFICIENT_PROTECTED_RESERVE",
      "Redemption exceeds protected florin reserve",
    );
  }

  const fees = calculateFeeBreakdown({
    grossValue: grossRedemption,
    totalFeeBps: cfg.totalFeeBps,
    revenueFeeBps: cfg.revenueFeeBps,
    stabilizationFeeBps: cfg.stabilizationFeeBps,
  });

  const customerPayout = roundDownMoney(fees.netValue);
  const roundingDust = fees.netValue.minus(customerPayout);
  const circulatingAfter = circulatingBefore.minus(executedQuantity);
  // Pull gross from reserve; fee to revenue; dust stays protected.
  const protectedReserveAfter = reserveBefore.minus(grossRedemption).plus(roundingDust);

  if (protectedReserveAfter.lessThan(circulatingAfter.mul(peg))) {
    throw new CryptoPricingError("INVARIANT_VIOLATION", "NPFC reserve would be undercollateralized");
  }
  if (protectedReserveAfter.lessThan(0)) {
    throw new CryptoPricingError("INSUFFICIENT_PROTECTED_RESERVE", "NPFC reserve would go negative");
  }

  const invariants: CryptoQuoteInvariants = {
    reserveSolvent: protectedReserveAfter.greaterThanOrEqualTo(circulatingAfter.mul(peg)),
    supplyConserved: true,
    noNegativeBalances: isNonNegative(protectedReserveAfter) && isNonNegative(circulatingAfter),
    feeSplitReconciles: fees.revenueAllocation.plus(fees.stabilizationAllocation).equals(fees.totalFee),
    priceMonotonicOk: true,
  };
  assertInvariants(invariants);

  return {
    kind: "NPFC_REDEMPTION",
    symbol: "NPFC",
    fees,
    executedQuantity,
    pegPrice: peg,
    priceBefore: peg,
    priceAfter: peg,
    averageExecutionPrice: peg,
    priceImpactPercent: d("0"),
    grossRedemption,
    customerPayout,
    netReserveRedemption: grossRedemption,
    roundingDust,
    circulatingSupplyBefore: circulatingBefore,
    circulatingSupplyAfter: circulatingAfter,
    protectedReserveBefore: reserveBefore,
    protectedReserveAfter,
    invariants,
  };
}

export function launchMarketSnapshot(symbol: CryptoAssetSymbol): MarketSnapshotInput {
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  return {
    symbol,
    treasuryInventory: cfg.maxSupply?.toFixed(8) ?? "0",
    circulatingSupply: "0",
    protectedReserve: "0",
    stabilizationFund: "0",
    walletAvailable: "0",
  };
}
