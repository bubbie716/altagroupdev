/**
 * UI Lab ONLY — in-memory Alta Terminal crypto market fixtures.
 * Demonstration data; never writes PostgreSQL. Gated by isUiLabMode() callers.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import {
  CRYPTO_ASSET_CONFIGS,
  LAUNCH_ASSET_SYMBOLS,
  type CryptoAssetSymbol,
} from "@/lib/terminal/crypto/crypto-constants";
import { d, serializeCryptoMoney, serializeCryptoPrice, serializeCryptoQuantity } from "@/lib/terminal/crypto/crypto-decimal";
import { marginalPrice } from "@/lib/terminal/crypto/crypto-curve-math";
import {
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
  launchMarketSnapshot,
} from "@/lib/terminal/crypto/crypto-pricing";
import {
  CryptoOrderError,
  customerMessageForCode,
  type CryptoOrderFillResult,
  type CryptoOrderPreviewInput,
  type CryptoOrderPreviewResult,
  type CryptoOrderSubmitInput,
} from "@/lib/terminal/crypto/crypto-order-types";
import { parseCryptoOrderPreviewInput, parseCryptoOrderSubmitInput } from "@/lib/terminal/crypto/crypto-order-validation";
import {
  buildQuoteExpiry,
  createQuoteFingerprint,
  isQuoteExpired,
  verifyQuoteFingerprint,
} from "@/lib/terminal/crypto/crypto-quote-token";
import { buildPriceImpactWarnings } from "@/lib/terminal/crypto/crypto-settlement-math";
import { generateTerminalCryptoPublicWalletId } from "@/lib/terminal/crypto/crypto-wallet-id";
import type {
  CryptoAssetDetail,
  CryptoChartRange,
  CryptoMarketAssetSummary,
  CryptoPortfolioSummary,
  CryptoPriceHistoryPoint,
  CryptoPriceHistoryResult,
} from "@/lib/terminal/crypto/crypto-market-read.service";

export const UI_LAB_CRYPTO_SCENARIO_SESSION_KEY = "alta.terminal.crypto.uiLabScenario";

export type UiLabCryptoScenario =
  | "default"
  | "no_wallet"
  | "existing_wallet"
  | "success_first_wallet"
  | "high_impact_warn"
  | "high_impact_confirm"
  | "insufficient_cash"
  | "insufficient_holdings"
  | "quote_expired"
  | "frozen_wallet"
  | "halted"
  | "redemption_only"
  | "server_failure"
  | "consent_required"
  | "scheduled_success"
  | "scheduled_price_impact_skip";

const DEMONSTRATION_LABEL = "Demonstration data";

type InMemoryMarketState = {
  symbol: CryptoAssetSymbol;
  status: "ACTIVE" | "HALTED" | "REDEMPTION_ONLY";
  treasuryInventory: string;
  circulatingSupply: string;
  protectedReserve: string;
  stabilizationFund: string;
  version: number;
};

type InMemoryWallet = {
  publicWalletId: string;
  status: "ACTIVE" | "FROZEN";
  cashFlorins: string;
  quantities: Partial<Record<CryptoAssetSymbol, string>>;
};

type UiLabCryptoStore = {
  markets: Record<CryptoAssetSymbol, InMemoryMarketState>;
  wallets: Map<string, InMemoryWallet>;
  orderSeq: number;
};

const stores = new Map<string, UiLabCryptoStore>();
const scenarioOverrides = new Map<string, UiLabCryptoScenario>();

function assertUiLab() {
  if (!isUiLabMode()) {
    throw new Error("UI Lab crypto fixtures are only available in UI Lab mode");
  }
}

function launchMarkets(): Record<CryptoAssetSymbol, InMemoryMarketState> {
  const markets = {} as Record<CryptoAssetSymbol, InMemoryMarketState>;
  for (const symbol of LAUNCH_ASSET_SYMBOLS) {
    const snap = launchMarketSnapshot(symbol);
    markets[symbol] = {
      symbol,
      status: "ACTIVE",
      treasuryInventory: String(snap.treasuryInventory),
      circulatingSupply: String(snap.circulatingSupply),
      protectedReserve: String(snap.protectedReserve),
      stabilizationFund: String(snap.stabilizationFund ?? "0"),
      version: 1,
    };
  }
  return markets;
}

function getStore(userKey = "default"): UiLabCryptoStore {
  assertUiLab();
  let store = stores.get(userKey);
  if (!store) {
    store = {
      markets: launchMarkets(),
      wallets: new Map(),
      orderSeq: 1000,
    };
    stores.set(userKey, store);
  }
  return store;
}

export function setUiLabCryptoScenario(userKey: string, scenario: UiLabCryptoScenario | null) {
  assertUiLab();
  if (scenario && scenario !== "default") {
    scenarioOverrides.set(userKey, scenario);
  } else {
    scenarioOverrides.delete(userKey);
  }
}

export function resolveUiLabCryptoScenario(
  userKey = "default",
  queryScenario?: string | null,
): UiLabCryptoScenario {
  assertUiLab();
  if (queryScenario?.trim()) {
    return queryScenario.trim() as UiLabCryptoScenario;
  }
  return scenarioOverrides.get(userKey) ?? "default";
}

function currentMarginalPrice(market: InMemoryMarketState): string {
  const cfg = CRYPTO_ASSET_CONFIGS[market.symbol];
  if (cfg.kind === "STABLE") {
    return serializeCryptoPrice(cfg.pegOrStartingPrice);
  }
  return serializeCryptoPrice(
    marginalPrice({
      startingPrice: cfg.pegOrStartingPrice,
      curveRate: cfg.curveRate!,
      circulatingSupply: market.circulatingSupply,
    }),
  );
}

function seedWallet(store: UiLabCryptoStore, portfolioId: string): InMemoryWallet {
  const existing = store.wallets.get(portfolioId);
  if (existing) return existing;
  const wallet: InMemoryWallet = {
    publicWalletId: generateTerminalCryptoPublicWalletId(),
    status: "ACTIVE",
    cashFlorins: "10000.00",
    quantities: {
      NPFC: "25.00000000",
      NVA: "4.00000000",
      VLT: "50.00000000",
    },
  };
  store.wallets.set(portfolioId, wallet);
  return wallet;
}

function applyScenarioToMarkets(
  markets: Record<CryptoAssetSymbol, InMemoryMarketState>,
  scenario: UiLabCryptoScenario,
): Record<CryptoAssetSymbol, InMemoryMarketState> {
  const next = { ...markets };
  if (scenario === "halted") {
    next.NVA = { ...next.NVA, status: "HALTED" };
  }
  if (scenario === "redemption_only") {
    next.VLT = { ...next.VLT, status: "REDEMPTION_ONLY" };
  }
  return next;
}

function toAssetSummary(market: InMemoryMarketState): CryptoMarketAssetSummary {
  const cfg = CRYPTO_ASSET_CONFIGS[market.symbol];
  const price = currentMarginalPrice(market);
  const canTrade = market.status === "ACTIVE";
  const canSell = market.status === "ACTIVE" || market.status === "REDEMPTION_ONLY";

  return {
    symbol: market.symbol,
    displayName: cfg.displayName,
    kind: cfg.kind,
    status: market.status,
    currentPrice: price,
    dayChange: market.symbol === "NPFC" ? null : market.symbol === "NVA" ? "0.01" : "-0.002",
    dayChangePercent: market.symbol === "NPFC" ? null : market.symbol === "NVA" ? "0.20" : "-1.96",
    noTradesYet: market.symbol === "NPFC",
    tradingCapabilities: {
      canBuy: canTrade,
      canSell,
    },
    statusLabel:
      market.status === "ACTIVE"
        ? "Active"
        : market.status === "HALTED"
          ? "Trading halted"
          : "Redemption only",
    tradingContextLabel:
      market.status === "ACTIVE"
        ? "Crypto · 24/7"
        : market.status === "HALTED"
          ? "Trading temporarily halted"
          : "Purchases disabled — redemptions only",
  };
}

export function listUiLabCryptoAssets(opts?: {
  userKey?: string;
  scenario?: string | null;
}): CryptoMarketAssetSummary[] {
  const userKey = opts?.userKey ?? "default";
  const scenario = resolveUiLabCryptoScenario(userKey, opts?.scenario);
  const store = getStore(userKey);
  const markets = applyScenarioToMarkets(store.markets, scenario);
  return LAUNCH_ASSET_SYMBOLS.map((symbol) => toAssetSummary(markets[symbol]));
}

export function getUiLabCryptoDetail(input: {
  symbol: string;
  userKey?: string;
  scenario?: string | null;
}): CryptoAssetDetail | null {
  const symbol = input.symbol.trim().toUpperCase() as CryptoAssetSymbol;
  if (!LAUNCH_ASSET_SYMBOLS.includes(symbol)) return null;

  const userKey = input.userKey ?? "default";
  const scenario = resolveUiLabCryptoScenario(userKey, input.scenario);
  const store = getStore(userKey);
  const markets = applyScenarioToMarkets(store.markets, scenario);
  const market = markets[symbol];
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];
  const summary = toAssetSummary(market);

  return {
    ...summary,
    description: `${cfg.displayName} (${DEMONSTRATION_LABEL}). Fictional florin-denominated Minecraft economy instrument with no real-world value.`,
    feeDisclosure:
      symbol === "NPFC"
        ? "0.10% conversion fee (demonstration)."
        : "1.00% fee on trades (demonstration).",
    quantityPrecision: cfg.quantityPrecision,
    displayPrecision: cfg.displayPrecision,
    marketStateVersion: market.version,
  };
}

export function getUiLabCryptoHistory(input: {
  symbol: string;
  range: CryptoChartRange;
}): CryptoPriceHistoryResult {
  const symbol = input.symbol.trim().toUpperCase() as CryptoAssetSymbol;
  if (!LAUNCH_ASSET_SYMBOLS.includes(symbol)) {
    return { points: [], limitedHistory: true, noTradesYet: true };
  }

  const now = Date.now();
  const hour = 3_600_000;
  const day = 86_400_000;
  const cfg = CRYPTO_ASSET_CONFIGS[symbol];

  if (symbol === "NPFC") {
    const points = [
      { t: now - day, price: serializeCryptoPrice("1") },
      { t: now, price: serializeCryptoPrice("1") },
    ];
    return { points, limitedHistory: true, noTradesYet: true };
  }

  const rangeMs =
    input.range === "1D"
      ? day
      : input.range === "1W"
        ? 7 * day
        : input.range === "1M"
          ? 30 * day
          : input.range === "3M"
            ? 90 * day
            : input.range === "1Y"
              ? 365 * day
              : 180 * day; // ALL demo window

  // Dense enough for drag-to-measure custom timeframes on every preset range.
  const stepMs = input.range === "1D" ? hour : input.range === "1W" ? 6 * hour : day;
  const startPrice = symbol === "NVA" ? 5.0 : 0.102;
  const endPrice = symbol === "NVA" ? 5.01 : 0.1;
  const steps = Math.max(2, Math.floor(rangeMs / stepMs));
  const points: CryptoPriceHistoryPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = now - rangeMs + i * stepMs;
    const progress = i / steps;
    // Mild path so sub-cent moves remain visible on NVA/VLT.
    const wobble = Math.sin(progress * Math.PI * 4) * (symbol === "NVA" ? 0.004 : 0.0015);
    const price = startPrice + (endPrice - startPrice) * progress + wobble;
    points.push({ t, price: serializeCryptoPrice(price.toFixed(8)) });
  }
  // Ensure the series lands on the live mark.
  points[points.length - 1] = {
    t: now,
    price: serializeCryptoPrice(endPrice.toFixed(8)),
  };

  void cfg;
  return {
    points,
    limitedHistory: points.length <= 2,
    noTradesYet: false,
  };
}

export function getUiLabPortfolioCrypto(input: {
  portfolioId: string;
  userKey?: string;
  scenario?: string | null;
}): CryptoPortfolioSummary {
  const userKey = input.userKey ?? "default";
  const scenario = resolveUiLabCryptoScenario(userKey, input.scenario);
  const store = getStore(userKey);

  if (scenario === "no_wallet" || scenario === "success_first_wallet") {
    return {
      portfolioId: input.portfolioId,
      walletPublicId: null,
      walletStatus: null,
      balances: [],
      totalMarkedValue: serializeCryptoMoney("0"),
      hasWallet: false,
    };
  }

  const wallet =
    scenario === "frozen_wallet"
      ? { ...seedWallet(store, input.portfolioId), status: "FROZEN" as const }
      : seedWallet(store, input.portfolioId);

  const markets = applyScenarioToMarkets(store.markets, scenario);
  let total = d("0");
  const balances = LAUNCH_ASSET_SYMBOLS.map((symbol) => {
    const qty = d(wallet.quantities[symbol] ?? "0");
    const price = d(currentMarginalPrice(markets[symbol]));
    const marked = qty.mul(price);
    total = total.plus(marked);
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    return {
      symbol,
      displayName: cfg.displayName,
      quantity: serializeCryptoQuantity(qty),
      averageCost: serializeCryptoPrice(price),
      currentPrice: serializeCryptoPrice(price),
      markedValue: serializeCryptoMoney(marked),
      totalReturn: serializeCryptoMoney("0"),
      totalReturnPercent: "0.00",
    };
  }).filter((b) => d(b.quantity).greaterThan(0));

  return {
    portfolioId: input.portfolioId,
    walletPublicId: wallet.publicWalletId,
    walletStatus: wallet.status,
    balances,
    totalMarkedValue: serializeCryptoMoney(total),
    hasWallet: true,
  };
}

function marketSnapshotInput(market: InMemoryMarketState, walletQty: string) {
  return {
    symbol: market.symbol,
    treasuryInventory: market.treasuryInventory,
    circulatingSupply: market.circulatingSupply,
    protectedReserve: market.protectedReserve,
    stabilizationFund: market.stabilizationFund,
    walletAvailable: walletQty,
  };
}

export function previewUiLabCryptoOrder(
  input: CryptoOrderPreviewInput,
  opts?: { userKey?: string; scenario?: string | null },
):
  | { ok: true; preview: CryptoOrderPreviewResult }
  | { ok: false; code: string; message: string; details?: Record<string, string> } {
  try {
    assertUiLab();
    const parsed = parseCryptoOrderPreviewInput(input);
    const userKey = opts?.userKey ?? "default";
    const scenario = resolveUiLabCryptoScenario(userKey, opts?.scenario);
    const store = getStore(userKey);
    const markets = applyScenarioToMarkets(store.markets, scenario);
    const symbol = parsed.symbol as CryptoAssetSymbol;

    if (!LAUNCH_ASSET_SYMBOLS.includes(symbol)) {
      throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
    }

    const market = markets[symbol];
    if (market.status === "HALTED") {
      throw new CryptoOrderError("ASSET_HALTED", customerMessageForCode("ASSET_HALTED"));
    }
    if (market.status === "REDEMPTION_ONLY" && parsed.side === "BUY") {
      throw new CryptoOrderError("REDEMPTION_ONLY", customerMessageForCode("REDEMPTION_ONLY"));
    }

    const wallet =
      scenario === "no_wallet" || scenario === "success_first_wallet"
        ? null
        : scenario === "frozen_wallet"
          ? { ...seedWallet(store, parsed.portfolioId), status: "FROZEN" as const }
          : seedWallet(store, parsed.portfolioId);

    if (wallet?.status === "FROZEN") {
      throw new CryptoOrderError("WALLET_FROZEN", customerMessageForCode("WALLET_FROZEN"));
    }

    const walletQty = wallet?.quantities[symbol] ?? "0";
    const availableCash = d(wallet?.cashFlorins ?? "10000.00");

    if (scenario === "insufficient_cash" && parsed.side === "BUY") {
      throw new CryptoOrderError("INSUFFICIENT_CASH", customerMessageForCode("INSUFFICIENT_CASH"));
    }
    if (scenario === "insufficient_holdings" && parsed.side === "SELL") {
      throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
    }

    const snap = marketSnapshotInput(market, walletQty);
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];

    let quote;
    if (parsed.side === "BUY") {
      quote =
        cfg.kind === "STABLE"
          ? quoteNpfcPurchase({ market: { ...snap, symbol: "NPFC" }, grossFlorins: parsed.grossFlorins! })
          : quoteBondingCurveBuy({ market: snap, grossFlorins: parsed.grossFlorins! });
      if (availableCash.lessThan(d(parsed.grossFlorins!))) {
        throw new CryptoOrderError("INSUFFICIENT_CASH", customerMessageForCode("INSUFFICIENT_CASH"));
      }
    } else {
      if (!wallet || d(walletQty).lessThanOrEqualTo(0)) {
        throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
      }
      quote =
        cfg.kind === "STABLE"
          ? quoteNpfcRedemption({ market: { ...snap, symbol: "NPFC" }, quantity: parsed.quantity! })
          : quoteBondingCurveSell({ market: snap, quantity: parsed.quantity! });
    }

    const impact = "priceImpactPercent" in quote ? quote.priceImpactPercent : d("0");
    let { warnings, requiresHighImpactConfirmation } = buildPriceImpactWarnings(impact);

    if (scenario === "high_impact_warn") {
      requiresHighImpactConfirmation = false;
      if (!warnings.some((w) => w.code === "HIGH_PRICE_IMPACT")) {
        warnings = [
          {
            code: "HIGH_PRICE_IMPACT",
            message:
              "Demonstration: estimated price impact is about 5%. Large trades can move bonding-curve prices.",
          },
          ...warnings,
        ];
      }
    }
    if (scenario === "high_impact_confirm" || scenario === "scheduled_price_impact_skip") {
      requiresHighImpactConfirmation = true;
      if (!warnings.some((w) => w.code === "HIGH_PRICE_IMPACT")) {
        warnings = [
          {
            code: "HIGH_PRICE_IMPACT",
            message:
              "Demonstration: estimated price impact is about 10% or greater. Confirm before submitting.",
          },
          ...warnings,
        ];
      }
    }
    if (scenario === "consent_required") {
      // Preview remains available; submit path asserts CRYPTO consent.
    }

    const grossTradeValue =
      parsed.side === "BUY"
        ? d(parsed.grossFlorins!)
        : "grossRedemption" in quote
          ? quote.grossRedemption
          : quote.fees.grossValue;

    const customerCashDelta =
      parsed.side === "BUY"
        ? grossTradeValue.neg()
        : "customerPayout" in quote
          ? quote.customerPayout
          : quote.fees.netValue;

    const quoteExpiresAt = buildQuoteExpiry();
    const quoteFingerprint = createQuoteFingerprint({
      portfolioId: parsed.portfolioId,
      symbol,
      side: parsed.side,
      grossFlorins: parsed.grossFlorins,
      quantity: parsed.quantity,
      marketStateVersion: market.version,
      quoteExpiresAt: quoteExpiresAt.toISOString(),
    });

    const preview: CryptoOrderPreviewResult = {
      portfolioId: parsed.portfolioId,
      symbol,
      assetDisplayName: cfg.displayName,
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
      estimatedTerminalCashAfter: serializeCryptoMoney(availableCash.plus(customerCashDelta)),
      estimatedWalletBalanceAfter: serializeCryptoQuantity(
        parsed.side === "BUY" ? d(walletQty).plus(quote.executedQuantity) : d(walletQty).minus(quote.executedQuantity),
      ),
      currentWalletBalance: serializeCryptoQuantity(walletQty),
      currentTerminalCash: serializeCryptoMoney(availableCash),
      warnings,
      requiresHighImpactConfirmation:
        scenario === "high_impact_confirm" || scenario === "scheduled_price_impact_skip"
          ? true
          : requiresHighImpactConfirmation,
      marketStateVersion: market.version,
      quoteExpiresAt: quoteExpiresAt.toISOString(),
      quoteFingerprint,
      walletPublicId: wallet?.publicWalletId ?? null,
    };

    return { ok: true, preview };
  } catch (error) {
    if (error instanceof CryptoOrderError) {
      return {
        ok: false,
        code: error.code,
        message: error.customerMessage,
        details: error.details,
      };
    }
    return {
      ok: false,
      code: "INTERNAL_FAILURE",
      message: customerMessageForCode("INTERNAL_FAILURE"),
    };
  }
}

export function submitUiLabCryptoOrder(
  input: CryptoOrderSubmitInput,
  opts?: { userKey?: string; scenario?: string | null },
):
  | CryptoOrderFillResult
  | { ok: false; code: string; message: string; details?: Record<string, string>; preview?: CryptoOrderPreviewResult } {
  try {
    assertUiLab();
    const parsed = parseCryptoOrderSubmitInput(input);
    const userKey = opts?.userKey ?? "default";
    const scenario = resolveUiLabCryptoScenario(userKey, opts?.scenario);

    if (scenario === "server_failure") {
      throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
    }
    if (scenario === "quote_expired") {
      throw new CryptoOrderError("QUOTE_EXPIRED", customerMessageForCode("QUOTE_EXPIRED"));
    }

    const previewResult = previewUiLabCryptoOrder(input, opts);
    if (!previewResult.ok) {
      return previewResult;
    }
    const preview = previewResult.preview;

    if (
      (scenario === "high_impact_confirm" || scenario === "scheduled_price_impact_skip") &&
      preview.requiresHighImpactConfirmation &&
      !parsed.acceptHighPriceImpact
    ) {
      throw new CryptoOrderError(
        "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED",
        customerMessageForCode("HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED"),
        undefined,
        preview,
      );
    }

    if (isQuoteExpired(parsed.quoteExpiresAt)) {
      throw new CryptoOrderError("QUOTE_EXPIRED", customerMessageForCode("QUOTE_EXPIRED"), undefined, preview);
    }

    const fingerprintOk = verifyQuoteFingerprint(
      {
        portfolioId: parsed.portfolioId,
        symbol: parsed.symbol,
        side: parsed.side,
        grossFlorins: parsed.grossFlorins,
        quantity: parsed.quantity,
        marketStateVersion: parsed.expectedMarketStateVersion,
        quoteExpiresAt: parsed.quoteExpiresAt,
      },
      parsed.quoteFingerprint,
    );
    if (!fingerprintOk || parsed.expectedMarketStateVersion !== preview.marketStateVersion) {
      throw new CryptoOrderError("REQUOTE_REQUIRED", customerMessageForCode("REQUOTE_REQUIRED"), undefined, preview);
    }

    const store = getStore(userKey);
    let wallet = store.wallets.get(parsed.portfolioId);
    const isFirstWallet = !wallet;
    if (!wallet) {
      wallet = {
        publicWalletId: generateTerminalCryptoPublicWalletId(),
        status: "ACTIVE",
        cashFlorins: "10000.00",
        quantities: {},
      };
      store.wallets.set(parsed.portfolioId, wallet);
    }

    if (wallet.status === "FROZEN") {
      throw new CryptoOrderError("WALLET_FROZEN", customerMessageForCode("WALLET_FROZEN"));
    }

    const symbol = parsed.symbol as CryptoAssetSymbol;
    const market = store.markets[symbol];
    market.version += 1;

    const qty = d(preview.estimatedExecutedQuantity);
    const prevQty = d(wallet.quantities[symbol] ?? "0");
    if (parsed.side === "BUY") {
      wallet.quantities[symbol] = serializeCryptoQuantity(prevQty.plus(qty));
      wallet.cashFlorins = preview.estimatedTerminalCashAfter;
    } else {
      wallet.quantities[symbol] = serializeCryptoQuantity(prevQty.minus(qty));
      wallet.cashFlorins = preview.estimatedTerminalCashAfter;
    }

    store.orderSeq += 1;
    const filledAt = new Date().toISOString();

    const fill: CryptoOrderFillResult = {
      ok: true,
      orderId: `lab-crypto-order-${store.orderSeq}`,
      settlementId: `lab-crypto-settlement-${store.orderSeq}`,
      symbol,
      side: parsed.side,
      executedQuantity: preview.estimatedExecutedQuantity,
      grossTradeValue: preview.grossTradeValue,
      totalFee: preview.totalFee,
      revenueAllocation: preview.revenueAllocation,
      stabilizationAllocation: preview.stabilizationAllocation,
      netReserveDelta: preview.netReserveDelta,
      priceBefore: preview.priceBefore,
      priceAfter: preview.priceAfter,
      averageExecutionPrice: preview.averageExecutionPrice,
      priceImpactPercent: preview.priceImpactPercent,
      customerCashDelta:
        parsed.side === "BUY"
          ? serializeCryptoMoney(d(preview.grossTradeValue).neg())
          : serializeCryptoMoney(d(preview.estimatedTerminalCashAfter).minus(d(preview.currentTerminalCash))),
      realizedGainLoss: parsed.side === "SELL" ? serializeCryptoMoney("0.50") : null,
      resultingTerminalCash: preview.estimatedTerminalCashAfter,
      resultingWalletBalance: preview.estimatedWalletBalanceAfter,
      walletPublicId: wallet.publicWalletId,
      marketStateVersion: market.version,
      filledAt,
      replayed: false,
    };

    void isFirstWallet;
    void scenario;
    return fill;
  } catch (error) {
    if (error instanceof CryptoOrderError) {
      return {
        ok: false,
        code: error.code,
        message: error.customerMessage,
        details: error.details,
        preview: error.preview,
      };
    }
    return {
      ok: false,
      code: "INTERNAL_FAILURE",
      message: customerMessageForCode("INTERNAL_FAILURE"),
    };
  }
}

/** Reset in-memory UI Lab crypto state (tests). */
export function resetUiLabCryptoFixturesForTests() {
  stores.clear();
  scenarioOverrides.clear();
}
