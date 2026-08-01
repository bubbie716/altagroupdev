/**
 * Alta Terminal fictional cryptocurrency market — Phase 1 foundation + Phase 2 execution.
 * Pure pricing math has no Prisma I/O; preview/execution services are separate.
 */

export {
  CRYPTO_ASSET_CONFIGS,
  CRYPTO_LAUNCH_GROSS,
  BONDING_CURVE_TOTAL_FEE_BPS,
  BONDING_CURVE_REVENUE_FEE_BPS,
  BONDING_CURVE_STABILIZATION_FEE_BPS,
  NPFC_CONVERSION_FEE_BPS,
  NVA_CURVE_RATE,
  VLT_CURVE_RATE,
  NVA_TARGET_IMPACT_PERCENT,
  VLT_TARGET_IMPACT_PERCENT,
  LAUNCH_ASSET_SYMBOLS,
  deriveBondingCurveRate,
  curveRateSeedString,
  curveRatesMatch,
  type CryptoAssetSymbol,
  type CryptoAssetConfig,
} from "./crypto-constants";

export {
  CRYPTO_QUANTITY_DP,
  CRYPTO_PRICE_DP,
  CRYPTO_CURVE_CALC_DP,
  CRYPTO_MONEY_DP,
  CRYPTO_MIN_ORDER_GROSS,
  d,
  roundDownQuantity,
  roundDownMoney,
  roundPrice,
  serializeCryptoQuantity,
  serializeCryptoPrice,
  serializeCryptoMoney,
  type CryptoDecimal,
  type CryptoDecimalInput,
} from "./crypto-decimal";

export {
  marginalPrice,
  reserveLiability,
  curveIntegralValue,
  quantityFromNetBuy,
  quantityFromGrossSell,
  netFromSellQuantity,
  averageExecutionPrice,
} from "./crypto-curve-math";

export {
  calculateFeeBreakdown,
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
  resolveSellQuantityFromGrossFlorins,
  launchMarketSnapshot,
} from "./crypto-pricing";

export {
  CryptoPricingError,
  type CryptoPricingErrorCode,
  type FeeBreakdown,
  type MarketSnapshotInput,
  type BondingCurveBuyQuote,
  type BondingCurveSellQuote,
  type NpfcPurchaseQuote,
  type NpfcRedemptionQuote,
  type CryptoQuote,
  type CryptoQuoteInvariants,
} from "./crypto-pricing-types";

export {
  generateTerminalCryptoPublicWalletId,
  isTerminalCryptoPublicWalletId,
} from "./crypto-wallet-id";

export {
  ensureTerminalCryptoLaunchAssetsSeeded,
  getTerminalCryptoLaunchSeedDocuments,
  type TerminalCryptoSeedResult,
} from "./crypto-assets.seed";

export {
  CRYPTO_QUOTE_TTL_MS,
  CRYPTO_PRICE_IMPACT_WARN_PERCENT,
  CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT,
  CRYPTO_PRICE_IMPACT_LIMIT_PERCENT,
  CRYPTO_ORDER_RATE_LIMIT_PER_MIN,
  CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE,
  CRYPTO_CUSTOMER_REQUOTE_MESSAGE,
  CryptoOrderError,
  customerMessageForCode,
  type CryptoOrderErrorCode,
  type CryptoOrderSide,
  type CryptoOrderPreviewInput,
  type CryptoOrderSubmitInput,
  type CryptoOrderPreviewResult,
  type CryptoOrderFillResult,
} from "./crypto-order-types";

export {
  buildCryptoCustomerReviewRows,
  buildCryptoCustomerReceiptRows,
  cryptoCustomerOrderTypeLabel,
  customerImpactWarningMessage,
  CRYPTO_CUSTOMER_REVIEW_FORBIDDEN_LABELS,
} from "./crypto-customer-review";

export {
  parseCryptoOrderPreviewInput,
  parseCryptoOrderSubmitInput,
} from "./crypto-order-validation";

export {
  createQuoteFingerprint,
  verifyQuoteFingerprint,
  stableSha256,
  stableStringify,
  buildQuoteExpiry,
  isQuoteExpired,
  resolveCryptoQuoteSecret,
  isCryptoQuoteSecretConfigured,
} from "./crypto-quote-token";

export { assertAssetAllowsSide, assertWalletCanTrade } from "./crypto-lifecycle";

export {
  CryptoOpsError,
  cryptoOpsCustomerMessage,
  type CryptoOpsErrorCode,
} from "./crypto-ops-errors";

export {
  resolveLifecycleTransition,
  isLifecycleTransitionAllowed,
  transitionRequiresCorporateAdmin,
  assertActorMayPerformLifecycleTransition,
  transitionCryptoAssetStatus,
  listAllowedLifecycleTransitions,
  type CryptoLifecycleStatus,
  type CryptoLifecycleTransition,
  type TransitionCryptoAssetStatusInput,
  type TransitionCryptoAssetStatusResult,
} from "./crypto-lifecycle.service";

export {
  evaluateActivationReadiness,
  finalizeReadiness,
  type ActivationReadinessItem,
  type ActivationReadinessResult,
} from "./crypto-activation-readiness.service";

export {
  fingerprintIssue,
  checkAssetMarketInvariants,
  runCryptoReconciliation,
  type ReconCheckKey,
  type ReconIssueDraft,
  type RunCryptoReconciliationResult,
} from "./crypto-reconciliation.service";

export {
  resolveRevenueSweepDestinationPortfolioId,
  validateRevenueSweepDestination,
  sweepCryptoRevenue,
  type SweepCryptoRevenueInput,
  type SweepCryptoRevenueResult,
} from "./crypto-revenue-sweep.service";

export {
  recordCryptoExternalContribution,
  type CryptoContributionKind,
  type RecordCryptoContributionInput,
  type RecordCryptoContributionResult,
} from "./crypto-contribution.service";

export {
  getCryptoOpsAssetOverview,
  getCryptoOpsDeskSummary,
  getCryptoOpsAssetWorkspace,
  loadCryptoOpsRecentActivity,
  plainOpsStatusLabel,
  type CryptoOpsAssetOverview,
  type CryptoOpsDeskSummary,
  type CryptoOpsAssetWorkspace,
  type CryptoOpsActivityEvent,
} from "./crypto-ops-read.service";

export {
  rollupCryptoCandles,
  floorToIntervalStart,
  type CandleRollupResult,
} from "./crypto-candle-rollup.service";

export {
  computeWeightedAverageCost,
  computeRealizedGainLoss,
  buildPriceImpactWarnings,
  m1CandleIntervalStart,
} from "./crypto-settlement-math";

export { previewTerminalCryptoOrder } from "./terminal-crypto-preview.service";
export { submitTerminalCryptoOrder } from "./terminal-crypto-execution.service";

export {
  mergeCryptoIntoPortfolioHistory,
  cryptoMarkedValueAt,
  quantityHeldAt,
  resolveCryptoUnitPriceAt,
  slicePortfolioHistoryForRange,
  portfolioHistoryRangeSinceMs,
  type CryptoHistoryFill,
  type CryptoCandleClose,
  type CryptoAssetPricePolicy,
  type MergeCryptoPortfolioHistoryInput,
  type MergeCryptoPortfolioHistoryResult,
} from "./crypto-portfolio-history";

export {
  enrichPortfolioSnapshotWithCryptoHistory,
  buildPortfolioHistorySeriesByRange,
  loadPortfolioCryptoHistoryFills,
  loadCashLedgerHistorySeries,
} from "./crypto-portfolio-history.service";

export type {
  CryptoChartRange,
  CryptoTradingCapabilities,
  CryptoMarketAssetSummary,
  CryptoAssetDetail,
  CryptoPriceHistoryPoint,
  CryptoPriceHistoryResult,
  CryptoPortfolioBalance,
  CryptoPortfolioSummary,
  CryptoOrderSummary,
} from "./crypto-market-read.service";

export {
  isCryptoSymbolVisible,
  tradingCapabilitiesForStatus,
} from "./crypto-market-read.service";
