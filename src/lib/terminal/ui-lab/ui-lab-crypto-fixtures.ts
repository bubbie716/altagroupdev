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
import { marginalPrice, reserveLiability } from "@/lib/terminal/crypto/crypto-curve-math";
import {
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
  launchMarketSnapshot,
  resolveSellQuantityFromGrossFlorins,
} from "@/lib/terminal/crypto/crypto-pricing";
import type { CryptoQuote } from "@/lib/terminal/crypto/crypto-pricing-types";
import {
  CryptoOrderError,
  customerMessageForCode,
  type CryptoOrderFillResult,
  type CryptoOrderPreviewInput,
  type CryptoOrderPreviewResult,
  type CryptoOrderSubmitInput,
} from "@/lib/terminal/crypto/crypto-order-types";
import {
  logUnexpectedCryptoOrderFailure,
  mapCryptoPricingError,
} from "@/lib/terminal/crypto/crypto-pricing-error-map";
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
import {
  getUiLabDemonstrationClient,
} from "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client";
import {
  presentCryptoAssetStatus,
} from "@/lib/terminal/crypto/crypto-status-presentation";

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

/** Demo wallet holdings — markets are seeded to the same circulating supply. */
const DEMO_WALLET_QUANTITIES: Record<CryptoAssetSymbol, string> = {
  NPFC: "25.00000000",
  NVA: "4.00000000",
  VLT: "50.00000000",
};

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

/** Launch markets with circulating supply / reserve matching demo wallet holdings. */
function seedDemoMarkets(): Record<CryptoAssetSymbol, InMemoryMarketState> {
  const markets = launchMarkets();
  for (const symbol of LAUNCH_ASSET_SYMBOLS) {
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    const circ = d(DEMO_WALLET_QUANTITIES[symbol]);
    if (cfg.kind === "STABLE") {
      markets[symbol] = {
        ...markets[symbol],
        circulatingSupply: serializeCryptoQuantity(circ),
        protectedReserve: circ.mul(cfg.pegOrStartingPrice).toFixed(12),
      };
      continue;
    }
    const liability = reserveLiability({
      startingPrice: cfg.pegOrStartingPrice,
      curveRate: cfg.curveRate!,
      circulatingSupply: circ,
    });
    markets[symbol] = {
      ...markets[symbol],
      circulatingSupply: serializeCryptoQuantity(circ),
      treasuryInventory: serializeCryptoQuantity(cfg.maxSupply!.minus(circ)),
      protectedReserve: liability.toFixed(12),
    };
  }
  return markets;
}

function applyQuoteToMarket(market: InMemoryMarketState, quote: CryptoQuote) {
  market.circulatingSupply = serializeCryptoQuantity(quote.circulatingSupplyAfter);
  market.protectedReserve = quote.protectedReserveAfter.toFixed(12);
  if ("treasuryInventoryAfter" in quote) {
    market.treasuryInventory = serializeCryptoQuantity(quote.treasuryInventoryAfter);
  }
  market.stabilizationFund = d(market.stabilizationFund)
    .plus(quote.fees.stabilizationAllocation)
    .toFixed(12);
}

function toUiLabFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, string>;
  preview?: CryptoOrderPreviewResult;
} {
  if (!(error instanceof CryptoOrderError)) {
    try {
      mapCryptoPricingError(error);
    } catch (mapped) {
      if (mapped instanceof CryptoOrderError) {
        return {
          ok: false,
          code: mapped.code,
          message: mapped.customerMessage,
          details: mapped.details,
          preview: mapped.preview,
        };
      }
    }
    logUnexpectedCryptoOrderFailure("uiLabCrypto", error);
    return {
      ok: false,
      code: "INTERNAL_FAILURE",
      message: customerMessageForCode("INTERNAL_FAILURE"),
    };
  }
  return {
    ok: false,
    code: error.code,
    message: error.customerMessage,
    details: error.details,
    preview: error.preview,
  };
}

function getStore(userKey = "default"): UiLabCryptoStore {
  assertUiLab();
  let store = stores.get(userKey);
  if (!store) {
    store = {
      markets: seedDemoMarkets(),
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

/**
 * Resolve terminal cash for crypto preview from the same demonstration ledger
 * that powers ticket buying power. Never invents an unconditional ƒ10,000.00.
 */
function resolveUiLabTerminalCashFlorins(portfolioId: string, userKey: string): string | null {
  try {
    const client = getUiLabDemonstrationClient(userKey);
    const cash = client.getAvailableCash(portfolioId);
    if (cash == null) return null;
    return cash.toFixed(2);
  } catch {
    return null;
  }
}

function syncUiLabDemonstrationCash(portfolioId: string, userKey: string, cashFlorins: string) {
  try {
    getUiLabDemonstrationClient(userKey).setAvailableCash(portfolioId, Number(cashFlorins));
  } catch {
    // Portfolio may be fixture-only in unit tests.
  }
}

function seedWallet(
  store: UiLabCryptoStore,
  portfolioId: string,
  userKey: string,
): InMemoryWallet {
  const existing = store.wallets.get(portfolioId);
  if (existing) return existing;
  const cashFlorins = resolveUiLabTerminalCashFlorins(portfolioId, userKey);
  if (cashFlorins == null) {
    // Honest empty cash when no demonstration portfolio ledger exists.
    const wallet: InMemoryWallet = {
      publicWalletId: generateTerminalCryptoPublicWalletId(),
      status: "ACTIVE",
      cashFlorins: "0.00",
      quantities: { ...DEMO_WALLET_QUANTITIES },
    };
    store.wallets.set(portfolioId, wallet);
    return wallet;
  }
  const wallet: InMemoryWallet = {
    publicWalletId: generateTerminalCryptoPublicWalletId(),
    status: "ACTIVE",
    cashFlorins,
    quantities: { ...DEMO_WALLET_QUANTITIES },
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
  const presented = presentCryptoAssetStatus({
    status: market.status,
    surface: "customer",
    uiLab: true,
  });

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
      canBuy: presented.canBuy,
      canSell: presented.canSell,
    },
    statusLabel: presented.statusLabel,
    tradingContextLabel: presented.tradingContextLabel,
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
      dayChange: null,
      dayChangePercent: null,
      hasWallet: false,
    };
  }

  const wallet =
    scenario === "frozen_wallet"
      ? { ...seedWallet(store, input.portfolioId, userKey), status: "FROZEN" as const }
      : seedWallet(store, input.portfolioId, userKey);

  const markets = applyScenarioToMarkets(store.markets, scenario);
  // Demo average costs differ from the live mark so Total return ≠ Day change.
  const DEMO_AVERAGE_COST: Record<CryptoAssetSymbol, string> = {
    NPFC: "1.00000000",
    NVA: "4.75000000",
    VLT: "0.11000000",
  };
  // Match listVisibleCryptoAssets demo day moves (NPFC has no 24h history).
  const DEMO_UNIT_DAY_CHANGE: Record<CryptoAssetSymbol, string | null> = {
    NPFC: null,
    NVA: "0.01",
    VLT: "-0.002",
  };
  let total = d("0");
  let totalDayChange = d("0");
  let hasDayChange = false;
  const balances = LAUNCH_ASSET_SYMBOLS.map((symbol) => {
    const qty = d(wallet.quantities[symbol] ?? "0");
    const price = d(currentMarginalPrice(markets[symbol]));
    const avgCost = d(DEMO_AVERAGE_COST[symbol]);
    const marked = qty.mul(price);
    const costBasis = qty.mul(avgCost);
    const ret = marked.minus(costBasis);
    total = total.plus(marked);
    const unitDay = DEMO_UNIT_DAY_CHANGE[symbol];
    if (qty.greaterThan(0) && unitDay != null) {
      hasDayChange = true;
      totalDayChange = totalDayChange.plus(qty.mul(d(unitDay)));
    }
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    return {
      symbol,
      displayName: cfg.displayName,
      quantity: serializeCryptoQuantity(qty),
      averageCost: serializeCryptoPrice(avgCost),
      currentPrice: serializeCryptoPrice(price),
      markedValue: serializeCryptoMoney(marked),
      totalReturn: serializeCryptoMoney(ret),
      totalReturnPercent: costBasis.greaterThan(0)
        ? ret.div(costBasis).mul(100).toFixed(2)
        : "0.00",
    };
  }).filter((b) => d(b.quantity).greaterThan(0));

  let dayChange: string | null = null;
  let dayChangePercent: string | null = null;
  if (hasDayChange) {
    dayChange = serializeCryptoMoney(totalDayChange);
    const prior = total.minus(totalDayChange);
    dayChangePercent = prior.abs().greaterThan(d("0.005"))
      ? totalDayChange.div(prior.abs()).mul(100).toFixed(2)
      : "0.00";
  }

  return {
    portfolioId: input.portfolioId,
    walletPublicId: wallet.publicWalletId,
    walletStatus: wallet.status,
    balances,
    totalMarkedValue: serializeCryptoMoney(total),
    dayChange,
    dayChangePercent,
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
          ? { ...seedWallet(store, parsed.portfolioId, userKey), status: "FROZEN" as const }
          : seedWallet(store, parsed.portfolioId, userKey);

    if (wallet?.status === "FROZEN") {
      throw new CryptoOrderError("WALLET_FROZEN", customerMessageForCode("WALLET_FROZEN"));
    }

    const walletQty = wallet?.quantities[symbol] ?? "0";
    // Prefer live demonstration ledger cash so preview matches ticket buying power.
    const ledgerCash = resolveUiLabTerminalCashFlorins(parsed.portfolioId, userKey);
    const availableCash = d(ledgerCash ?? wallet?.cashFlorins ?? "0.00");
    if (wallet && ledgerCash != null) {
      wallet.cashFlorins = ledgerCash;
    }

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
      const sellQuantity =
        parsed.quantity ??
        resolveSellQuantityFromGrossFlorins({
          market: snap,
          grossFlorins: parsed.grossFlorins!,
        }).toFixed(8);
      quote =
        cfg.kind === "STABLE"
          ? quoteNpfcRedemption({ market: { ...snap, symbol: "NPFC" }, quantity: sellQuantity })
          : quoteBondingCurveSell({ market: snap, quantity: sellQuantity });
    }

    const impact = "priceImpactPercent" in quote ? quote.priceImpactPercent : d("0");
    let { warnings, requiresHighImpactConfirmation, exceedsHardLimit } =
      buildPriceImpactWarnings(impact);

    if (scenario === "high_impact_warn") {
      requiresHighImpactConfirmation = false;
      exceedsHardLimit = false;
      if (!warnings.some((w) => w.code === "HIGH_PRICE_IMPACT")) {
        warnings = [
          {
            code: "HIGH_PRICE_IMPACT",
            message:
              "This order may noticeably move the market. Review your order before continuing.",
          },
          ...warnings,
        ];
      }
    }
    if (scenario === "high_impact_confirm" || scenario === "scheduled_price_impact_skip") {
      requiresHighImpactConfirmation = true;
      exceedsHardLimit = false;
      if (!warnings.some((w) => w.code === "HIGH_PRICE_IMPACT")) {
        warnings = [
          {
            code: "HIGH_PRICE_IMPACT",
            message:
              "This order is large relative to current market activity and may significantly affect its execution.",
          },
          ...warnings,
        ];
      }
    }
    if (exceedsHardLimit) {
      throw new CryptoOrderError(
        "PRICE_IMPACT_LIMIT_EXCEEDED",
        customerMessageForCode("PRICE_IMPACT_LIMIT_EXCEEDED"),
        { priceImpactPercent: impact.abs().toFixed(4) },
      );
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
    return toUiLabFailure(error);
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
      wallet = seedWallet(store, parsed.portfolioId, userKey);
      wallet.quantities = {};
    }

    if (wallet.status === "FROZEN") {
      throw new CryptoOrderError("WALLET_FROZEN", customerMessageForCode("WALLET_FROZEN"));
    }

    const symbol = parsed.symbol as CryptoAssetSymbol;
    const market = store.markets[symbol];
    const cfg = CRYPTO_ASSET_CONFIGS[symbol];
    const walletQty = wallet.quantities[symbol] ?? "0";
    const snap = marketSnapshotInput(market, walletQty);
    const fillQuote: CryptoQuote =
      parsed.side === "BUY"
        ? cfg.kind === "STABLE"
          ? quoteNpfcPurchase({ market: { ...snap, symbol: "NPFC" }, grossFlorins: parsed.grossFlorins! })
          : quoteBondingCurveBuy({ market: snap, grossFlorins: parsed.grossFlorins! })
        : cfg.kind === "STABLE"
          ? quoteNpfcRedemption({
              market: { ...snap, symbol: "NPFC" },
              quantity:
                parsed.quantity ??
                resolveSellQuantityFromGrossFlorins({
                  market: snap,
                  grossFlorins: parsed.grossFlorins!,
                }).toFixed(8),
            })
          : quoteBondingCurveSell({
              market: snap,
              quantity:
                parsed.quantity ??
                resolveSellQuantityFromGrossFlorins({
                  market: snap,
                  grossFlorins: parsed.grossFlorins!,
                }).toFixed(8),
            });
    applyQuoteToMarket(market, fillQuote);
    market.version += 1;

    const qty = d(preview.estimatedExecutedQuantity);
    const prevQty = d(walletQty);
    if (parsed.side === "BUY") {
      wallet.quantities[symbol] = serializeCryptoQuantity(prevQty.plus(qty));
      wallet.cashFlorins = preview.estimatedTerminalCashAfter;
    } else {
      wallet.quantities[symbol] = serializeCryptoQuantity(prevQty.minus(qty));
      wallet.cashFlorins = preview.estimatedTerminalCashAfter;
    }
    syncUiLabDemonstrationCash(parsed.portfolioId, userKey, wallet.cashFlorins);

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
    return toUiLabFailure(error);
  }
}

/** Reset in-memory UI Lab crypto state (tests). */
export function resetUiLabCryptoFixturesForTests() {
  stores.clear();
  scenarioOverrides.clear();
}
