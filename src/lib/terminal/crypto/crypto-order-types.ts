/**
 * Typed customer-safe crypto order errors, preview/submit I/O, and impact thresholds.
 * Authoritative financial values are decimal strings — never JS numbers.
 */

import type { CryptoAssetSymbol } from "./crypto-symbols";

export const CRYPTO_QUOTE_TTL_MS = 15_000;
export const CRYPTO_PRICE_IMPACT_WARN_PERCENT = "5";
export const CRYPTO_PRICE_IMPACT_CONFIRM_PERCENT = "10";
/** Absolute ceiling — impact strictly above this rejects preview/submit. */
export const CRYPTO_PRICE_IMPACT_LIMIT_PERCENT = "15";

/** Customer-facing impact copy — no exact percentages or post-trade prices. */
export const CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE =
  "This order may noticeably move the market. Review your order before continuing.";
export const CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE =
  "This order is large relative to current market activity and may significantly affect its execution.";
export const CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE =
  "This order is too large for current market conditions. Enter a smaller amount and try again.";
export const CRYPTO_CUSTOMER_IMPACT_ACK_LABEL =
  "I understand this order may significantly affect its own execution.";
export const CRYPTO_CUSTOMER_IMPACT_ACK_HINT =
  "Submit stays disabled until you acknowledge this order.";
export const CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE =
  "Your final quantity or proceeds may change if the market moves before execution.";
export const CRYPTO_CUSTOMER_REQUOTE_MESSAGE =
  "The market changed. Review the updated estimate before submitting again.";

export const CRYPTO_ORDER_RATE_LIMIT_PER_MIN = 30;

/** Phase 3 closed the crypto disclosure TODO via CRYPTO scope + AT-LEGAL-006. */

export type CryptoOrderErrorCode =
  | "CRYPTO_UNAVAILABLE"
  | "ASSET_DRAFT"
  | "ASSET_HALTED"
  | "REDEMPTION_ONLY"
  | "ASSET_CLOSED"
  | "PORTFOLIO_ARCHIVED"
  | "PORTFOLIO_RESTRICTED"
  | "WALLET_FROZEN"
  | "WALLET_CLOSED"
  | "INSUFFICIENT_CASH"
  | "INSUFFICIENT_HOLDINGS"
  | "SUPPLY_EXHAUSTED"
  | "RESERVE_INSUFFICIENT"
  | "QUOTE_EXPIRED"
  | "REQUOTE_REQUIRED"
  | "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED"
  | "PRICE_IMPACT_LIMIT_EXCEEDED"
  | "IDEMPOTENCY_CONFLICT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "CONSENT_REQUIRED"
  | "INTERNAL_FAILURE";

export class CryptoOrderError extends Error {
  readonly code: CryptoOrderErrorCode;
  readonly customerMessage: string;
  readonly details?: Record<string, string>;
  readonly preview?: CryptoOrderPreviewResult;

  constructor(
    code: CryptoOrderErrorCode,
    customerMessage: string,
    details?: Record<string, string>,
    preview?: CryptoOrderPreviewResult,
  ) {
    super(code);
    this.name = "CryptoOrderError";
    this.code = code;
    this.customerMessage = customerMessage;
    this.details = details;
    this.preview = preview;
  }
}

export type CryptoOrderSide = "BUY" | "SELL";

/** Buy and sell: gross florins. Sell may alternatively send coin quantity (legacy / scheduled). Never both. */
export type CryptoOrderPreviewInput = {
  portfolioId: string;
  symbol: string;
  side: CryptoOrderSide;
  /** Required for BUY; preferred for SELL — decimal string florins. */
  grossFlorins?: string;
  /** Optional for SELL — decimal string coin quantity when not sizing in florins. */
  quantity?: string;
};

export type CryptoOrderSubmitInput = CryptoOrderPreviewInput & {
  clientKey: string;
  expectedMarketStateVersion: number;
  quoteExpiresAt: string;
  quoteFingerprint: string;
  acceptHighPriceImpact?: boolean;
};

export type CryptoOrderWarningCode = "HIGH_PRICE_IMPACT" | "NEAR_SUPPLY_LIMIT" | "LARGE_ORDER";

export type CryptoOrderPreviewResult = {
  portfolioId: string;
  symbol: CryptoAssetSymbol | string;
  assetDisplayName: string;
  side: CryptoOrderSide;
  submittedGrossFlorins: string | null;
  submittedQuantity: string | null;
  estimatedExecutedQuantity: string;
  grossTradeValue: string;
  totalFee: string;
  revenueAllocation: string;
  stabilizationAllocation: string;
  netReserveDelta: string;
  priceBefore: string;
  priceAfter: string;
  averageExecutionPrice: string;
  priceImpactPercent: string;
  estimatedTerminalCashAfter: string;
  estimatedWalletBalanceAfter: string;
  currentWalletBalance: string;
  currentTerminalCash: string;
  warnings: Array<{ code: CryptoOrderWarningCode; message: string }>;
  requiresHighImpactConfirmation: boolean;
  marketStateVersion: number;
  quoteExpiresAt: string;
  quoteFingerprint: string;
  walletPublicId: string | null;
};

export type CryptoOrderFillResult = {
  ok: true;
  orderId: string;
  settlementId: string;
  symbol: string;
  side: CryptoOrderSide;
  executedQuantity: string;
  grossTradeValue: string;
  totalFee: string;
  revenueAllocation: string;
  stabilizationAllocation: string;
  netReserveDelta: string;
  priceBefore: string;
  priceAfter: string;
  averageExecutionPrice: string;
  priceImpactPercent: string;
  customerCashDelta: string;
  realizedGainLoss: string | null;
  resultingTerminalCash: string;
  resultingWalletBalance: string;
  walletPublicId: string;
  marketStateVersion: number;
  filledAt: string;
  replayed: boolean;
};

export function customerMessageForCode(code: CryptoOrderErrorCode): string {
  switch (code) {
    case "CRYPTO_UNAVAILABLE":
      return "Alta crypto trading is not available right now.";
    case "ASSET_DRAFT":
      return "This asset is not available for trading yet.";
    case "ASSET_HALTED":
      return "Trading in this asset is temporarily halted.";
    case "REDEMPTION_ONLY":
      return "This asset is redemption-only. New purchases are not allowed.";
    case "ASSET_CLOSED":
      return "This asset is closed and cannot be traded.";
    case "PORTFOLIO_ARCHIVED":
      return "Archived portfolios cannot place crypto orders.";
    case "PORTFOLIO_RESTRICTED":
      return "You are not authorized to trade this portfolio.";
    case "WALLET_FROZEN":
      return "This crypto wallet is frozen and cannot trade.";
    case "WALLET_CLOSED":
      return "This crypto wallet is closed and cannot trade.";
    case "INSUFFICIENT_CASH":
      return "Insufficient Terminal cash for this purchase.";
    case "INSUFFICIENT_HOLDINGS":
      return "Insufficient coin holdings for this sale.";
    case "SUPPLY_EXHAUSTED":
      return "There is not enough treasury inventory to fill this order.";
    case "RESERVE_INSUFFICIENT":
      return "This redemption cannot be completed against the protected reserve.";
    case "QUOTE_EXPIRED":
      return "Your review estimate expired. Review the updated estimate before submitting again.";
    case "REQUOTE_REQUIRED":
      return CRYPTO_CUSTOMER_REQUOTE_MESSAGE;
    case "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED":
      return CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE;
    case "PRICE_IMPACT_LIMIT_EXCEEDED":
      return CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE;
    case "IDEMPOTENCY_CONFLICT":
      return "This order key was already used with different details.";
    case "VALIDATION_FAILED":
      return "Check your order details and try again.";
    case "RATE_LIMITED":
      return "Too many crypto orders. Please wait a moment and try again.";
    case "FORBIDDEN":
      return "Not authorized.";
    case "CONSENT_REQUIRED":
      return "Terminal product consent is required before placing orders.";
    case "INTERNAL_FAILURE":
    default:
      return "This order could not be completed. No fees were charged.";
  }
}
