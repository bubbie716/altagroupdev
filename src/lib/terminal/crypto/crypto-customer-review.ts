/**
 * Customer-facing crypto order review / receipt presentation helpers.
 * Browser-safe: no Prisma / crypto-decimal. Exact impact math stays server-side.
 */

import {
  formatCryptoDisplayPriceFromRaw,
  formatCryptoMoney,
  formatCryptoQuantityDisplay,
} from "@/lib/terminal/crypto/crypto-format";
import {
  CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE,
  CRYPTO_CUSTOMER_IMPACT_ACK_HINT,
  CRYPTO_CUSTOMER_IMPACT_ACK_LABEL,
  CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE,
  CRYPTO_CUSTOMER_REQUOTE_MESSAGE,
  type CryptoOrderFillResult,
  type CryptoOrderPreviewResult,
  type CryptoOrderSide,
} from "@/lib/terminal/crypto/crypto-order-types";

export {
  CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE,
  CRYPTO_CUSTOMER_IMPACT_ACK_HINT,
  CRYPTO_CUSTOMER_IMPACT_ACK_LABEL,
  CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE,
  CRYPTO_CUSTOMER_REQUOTE_MESSAGE,
};

export type CryptoCustomerReviewRow = {
  label: string;
  value: string;
  mono?: boolean;
  /** Full unmodified value for clipboard when `value` is shortened. */
  copyValue?: string;
};

/** Subtract florin money strings (2 dp) without floating-point math. */
export function subtractCryptoMoneyStrings(left: string, right: string): string {
  const toCents = (raw: string): bigint => {
    const trimmed = String(raw).trim();
    const neg = trimmed.startsWith("-");
    const body = neg ? trimmed.slice(1) : trimmed;
    const [wholePart, fracPart = ""] = body.split(".");
    const whole = BigInt(wholePart || "0");
    const frac = BigInt((fracPart + "00").slice(0, 2).padEnd(2, "0"));
    const cents = whole * 100n + frac;
    return neg ? -cents : cents;
  };
  const cents = toCents(left) - toCents(right);
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

export function customerImpactWarningMessage(input: {
  requiresAcknowledgement: boolean;
  exceedsHardLimit?: boolean;
}): string {
  if (input.exceedsHardLimit) return CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE;
  if (input.requiresAcknowledgement) return CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE;
  return CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE;
}

export function cryptoCustomerOrderTypeLabel(side: CryptoOrderSide): string {
  return side === "BUY" ? "Market buy" : "Market sell";
}

export const CRYPTO_FILLED_ORDER_TITLE = "Order filled";

/** Headline under the success icon — quantity uses customer display formatting. */
export function cryptoFilledOrderSubtitle(
  receipt: Pick<CryptoOrderFillResult, "side" | "executedQuantity" | "symbol">,
): string {
  const qty = formatCryptoQuantityDisplay(receipt.executedQuantity, receipt.symbol);
  return receipt.side === "BUY" ? `Bought ${qty}` : `Sold ${qty}`;
}

/**
 * Shorten a long order id for receipt display.
 * Full id is preserved in `copyValue` / storage — never mutated here.
 */
export function shortenCryptoOrderReference(orderId: string): string {
  const id = String(orderId ?? "").trim();
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-5)}`;
}

/**
 * Build the simplified pre-submit review rows for a crypto order.
 * Omits current/avg/post price, impact %, curve, and reserve details.
 */
export function buildCryptoCustomerReviewRows(
  side: CryptoOrderSide,
  preview: Pick<
    CryptoOrderPreviewResult,
    | "symbol"
    | "estimatedExecutedQuantity"
    | "grossTradeValue"
    | "totalFee"
    | "estimatedTerminalCashAfter"
    | "estimatedWalletBalanceAfter"
    | "currentTerminalCash"
  >,
): CryptoCustomerReviewRow[] {
  const symbol = preview.symbol;
  if (side === "BUY") {
    return [
      { label: "Order type", value: cryptoCustomerOrderTypeLabel("BUY") },
      { label: "Order amount", value: formatCryptoMoney(preview.grossTradeValue) },
      {
        label: "Estimated quantity",
        value: formatCryptoQuantityDisplay(preview.estimatedExecutedQuantity, symbol),
      },
      { label: "Fee", value: formatCryptoMoney(preview.totalFee) },
      {
        label: "Estimated cash remaining",
        value: formatCryptoMoney(preview.estimatedTerminalCashAfter),
      },
    ];
  }

  const proceeds = subtractCryptoMoneyStrings(
    preview.estimatedTerminalCashAfter,
    preview.currentTerminalCash,
  );
  return [
    { label: "Order type", value: cryptoCustomerOrderTypeLabel("SELL") },
    {
      label: "Quantity being sold",
      value: formatCryptoQuantityDisplay(preview.estimatedExecutedQuantity, symbol),
    },
    { label: "Estimated proceeds", value: formatCryptoMoney(proceeds) },
    { label: "Fee", value: formatCryptoMoney(preview.totalFee) },
    {
      label: "Estimated wallet balance remaining",
      value: formatCryptoQuantityDisplay(preview.estimatedWalletBalanceAfter, symbol),
    },
  ];
}

/**
 * Post-fill receipt rows — concise customer brokerage summary.
 * Status is communicated by the success icon + "Order filled" heading (not a row).
 */
export function buildCryptoCustomerReceiptRows(
  receipt: CryptoOrderFillResult,
  portfolioLabel?: string | null,
): CryptoCustomerReviewRow[] {
  const symbol = String(receipt.symbol).toUpperCase();
  return [
    { label: "Portfolio", value: portfolioLabel ?? "—" },
    {
      label: receipt.side === "BUY" ? "Order amount" : "Gross proceeds",
      value: formatCryptoMoney(
        receipt.side === "BUY"
          ? receipt.grossTradeValue
          : receipt.customerCashDelta.replace(/^-/, ""),
      ),
    },
    { label: "Fee", value: formatCryptoMoney(receipt.totalFee) },
    {
      label: "Average price",
      value: formatCryptoDisplayPriceFromRaw(receipt.averageExecutionPrice, receipt.symbol),
    },
    { label: "Cash remaining", value: formatCryptoMoney(receipt.resultingTerminalCash) },
    {
      label: `${symbol} balance`,
      value: formatCryptoQuantityDisplay(receipt.resultingWalletBalance, receipt.symbol),
    },
    {
      label: "Completed",
      value: new Date(receipt.filledAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    },
    {
      label: "Reference",
      value: shortenCryptoOrderReference(receipt.orderId),
      copyValue: receipt.orderId,
      mono: true,
    },
  ];
}

/** Labels that must never appear in the customer review summary. */
export const CRYPTO_CUSTOMER_REVIEW_FORBIDDEN_LABELS = [
  "Price after",
  "Market impact",
  "Current price",
  "Estimated average price",
  "Average execution",
  "Avg execution",
  "Cash after",
  "Wallet after",
  "Curve rate",
  "Protected reserve",
  "Circulating supply",
] as const;

/** Labels that must never appear in the customer filled-order receipt. */
export const CRYPTO_CUSTOMER_RECEIPT_FORBIDDEN_LABELS = [
  "Order status",
  "Filled quantity",
  "Actual average execution price",
  "Remaining cash",
  "Remaining wallet balance",
  "Gross amount",
  "Order reference",
  "Price after",
  "Market impact",
  "Curve rate",
] as const;
