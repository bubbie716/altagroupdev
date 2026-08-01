/**
 * Read-only crypto order preview. Never creates wallets or mutates balances.
 */
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import {
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
  resolveSellQuantityFromGrossFlorins,
} from "./crypto-pricing";
import { d, serializeCryptoMoney, serializeCryptoPrice, serializeCryptoQuantity } from "./crypto-decimal";
import { assertAssetAllowsSide, assertWalletCanTrade } from "./crypto-lifecycle";
import {
  CryptoOrderError,
  customerMessageForCode,
  type CryptoOrderPreviewInput,
  type CryptoOrderPreviewResult,
} from "./crypto-order-types";
import { mapCryptoPricingError } from "./crypto-pricing-error-map";
import { parseCryptoOrderPreviewInput } from "./crypto-order-validation";
import {
  buildQuoteExpiry,
  createQuoteFingerprint,
  isCryptoQuoteSecretConfigured,
} from "./crypto-quote-token";
import { buildPriceImpactWarnings } from "./crypto-settlement-math";

export async function previewTerminalCryptoOrder(
  user: AltaUser,
  input: CryptoOrderPreviewInput,
): Promise<CryptoOrderPreviewResult> {
  const parsed = parseCryptoOrderPreviewInput(input);

  const {
    getTerminalPortfolioForUser,
    assertCanTradePortfolio,
  } = await import("@/lib/terminal/terminal-portfolio.service");

  const portfolio = await getTerminalPortfolioForUser(user, parsed.portfolioId);
  if (!portfolio) {
    throw new CryptoOrderError("FORBIDDEN", customerMessageForCode("FORBIDDEN"));
  }
  if (portfolio.status !== "active") {
    throw new CryptoOrderError("PORTFOLIO_ARCHIVED", customerMessageForCode("PORTFOLIO_ARCHIVED"));
  }
  try {
    assertCanTradePortfolio(user, portfolio);
  } catch {
    throw new CryptoOrderError("PORTFOLIO_RESTRICTED", customerMessageForCode("PORTFOLIO_RESTRICTED"));
  }

  const asset = await prisma.terminalCryptoAsset.findUnique({
    where: { symbol: parsed.symbol },
    include: { marketState: true },
  });
  if (!asset || !asset.marketState) {
    throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
  }
  if (!isCryptoQuoteSecretConfigured()) {
    throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
  }

  try {
    assertAssetAllowsSide(asset.status, parsed.side);
  } catch (error) {
    mapCryptoPricingError(error);
  }

  const wallet = await prisma.terminalCryptoWallet.findUnique({
    where: { portfolioId: portfolio.id },
    include: {
      balances: { where: { assetId: asset.id } },
    },
  });
  try {
    assertWalletCanTrade(wallet?.status);
  } catch (error) {
    mapCryptoPricingError(error);
  }

  const cashAccount = await prisma.terminalPortfolioCashAccount.findUnique({
    where: { portfolioId: portfolio.id },
  });
  const availableCash = d(cashAccount?.availableCash?.toString() ?? "0");
  const walletQty = d(wallet?.balances[0]?.availableQuantity?.toString() ?? "0");

  const market = {
    symbol: asset.symbol as "NPFC" | "NVA" | "VLT",
    treasuryInventory: asset.marketState.treasuryInventory.toString(),
    circulatingSupply: asset.marketState.circulatingSupply.toString(),
    protectedReserve: asset.marketState.protectedReserve.toString(),
    stabilizationFund: asset.marketState.stabilizationFund.toString(),
    walletAvailable: walletQty.toFixed(8),
  };

  // Launch symbols use typed pricing; test fixtures with other symbols must match kind via engine configs — only NPFC/NVA/VLT are supported by the pure engine.
  if (asset.symbol !== "NPFC" && asset.symbol !== "NVA" && asset.symbol !== "VLT") {
    // For isolated ACTIVE test assets, quote using asset row parameters through bonding/stable paths by symbol kind.
    throw new CryptoOrderError(
      "CRYPTO_UNAVAILABLE",
      "Only NPFC, NVA, and VLT are supported by the pricing engine in Phase 2.",
    );
  }

  let quote;
  try {
    if (parsed.side === "BUY") {
      quote =
        asset.kind === "STABLE"
          ? quoteNpfcPurchase({ market: { ...market, symbol: "NPFC" }, grossFlorins: parsed.grossFlorins! })
          : quoteBondingCurveBuy({
              market: { ...market, symbol: asset.symbol as "NVA" | "VLT" },
              grossFlorins: parsed.grossFlorins!,
            });
      if (availableCash.lessThan(d(parsed.grossFlorins!))) {
        throw new CryptoOrderError("INSUFFICIENT_CASH", customerMessageForCode("INSUFFICIENT_CASH"));
      }
    } else {
      if (!wallet || walletQty.lessThanOrEqualTo(0)) {
        throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
      }
      const sellQuantity =
        parsed.quantity ??
        resolveSellQuantityFromGrossFlorins({
          market: { ...market, symbol: asset.symbol as "NPFC" | "NVA" | "VLT" },
          grossFlorins: parsed.grossFlorins!,
        }).toFixed(8);
      quote =
        asset.kind === "STABLE"
          ? quoteNpfcRedemption({
              market: { ...market, symbol: "NPFC" },
              quantity: sellQuantity,
            })
          : quoteBondingCurveSell({
              market: { ...market, symbol: asset.symbol as "NVA" | "VLT" },
              quantity: sellQuantity,
            });
    }
  } catch (error) {
    mapCryptoPricingError(error);
  }

  const impact =
    "priceImpactPercent" in quote ? quote.priceImpactPercent : d("0");
  const { warnings, requiresHighImpactConfirmation, exceedsHardLimit } =
    buildPriceImpactWarnings(impact);
  if (exceedsHardLimit) {
    throw new CryptoOrderError(
      "PRICE_IMPACT_LIMIT_EXCEEDED",
      customerMessageForCode("PRICE_IMPACT_LIMIT_EXCEEDED"),
      { priceImpactPercent: impact.abs().toFixed(4) },
    );
  }

  const grossTradeValue =
    parsed.side === "BUY"
      ? d(parsed.grossFlorins!)
      : "grossRedemption" in quote
        ? quote.grossRedemption
        : quote.fees.grossValue;

  const customerCashDelta =
    parsed.side === "BUY" ? grossTradeValue.neg() : "customerPayout" in quote ? quote.customerPayout : quote.fees.netValue;

  const estimatedTerminalCashAfter = availableCash.plus(customerCashDelta);
  const estimatedWalletBalanceAfter =
    parsed.side === "BUY"
      ? walletQty.plus(quote.executedQuantity)
      : walletQty.minus(quote.executedQuantity);

  const quoteExpiresAt = buildQuoteExpiry();
  const quoteFingerprint = createQuoteFingerprint({
    portfolioId: portfolio.id,
    symbol: asset.symbol,
    side: parsed.side,
    grossFlorins: parsed.grossFlorins,
    quantity: parsed.quantity,
    marketStateVersion: asset.marketState.version,
    quoteExpiresAt: quoteExpiresAt.toISOString(),
  });

  return {
    portfolioId: portfolio.id,
    symbol: asset.symbol,
    assetDisplayName: asset.displayName,
    side: parsed.side,
    submittedGrossFlorins: parsed.grossFlorins,
    submittedQuantity: parsed.quantity,
    estimatedExecutedQuantity: serializeCryptoQuantity(quote.executedQuantity),
    grossTradeValue: serializeCryptoMoney(grossTradeValue),
    totalFee: serializeCryptoMoney(quote.fees.totalFee),
    revenueAllocation: serializeCryptoMoney(quote.fees.revenueAllocation),
    stabilizationAllocation: serializeCryptoMoney(quote.fees.stabilizationAllocation),
    netReserveDelta: serializeCryptoMoney(
      parsed.side === "BUY"
        ? "netReserveContribution" in quote
          ? quote.netReserveContribution
          : quote.fees.netValue
        : "netReserveRedemption" in quote
          ? quote.netReserveRedemption.neg()
          : quote.fees.netValue.neg(),
    ),
    priceBefore: serializeCryptoPrice(quote.priceBefore)!,
    priceAfter: serializeCryptoPrice(quote.priceAfter)!,
    averageExecutionPrice: serializeCryptoPrice(quote.averageExecutionPrice)!,
    priceImpactPercent: impact.toFixed(8),
    estimatedTerminalCashAfter: serializeCryptoMoney(estimatedTerminalCashAfter),
    estimatedWalletBalanceAfter: serializeCryptoQuantity(estimatedWalletBalanceAfter),
    currentWalletBalance: serializeCryptoQuantity(walletQty),
    currentTerminalCash: serializeCryptoMoney(availableCash),
    warnings,
    requiresHighImpactConfirmation,
    marketStateVersion: asset.marketState.version,
    quoteExpiresAt: quoteExpiresAt.toISOString(),
    quoteFingerprint,
    walletPublicId: wallet?.publicWalletId ?? null,
  };
}
