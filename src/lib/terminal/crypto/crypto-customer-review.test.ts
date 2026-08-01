import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildCryptoCustomerReceiptRows,
  buildCryptoCustomerReviewRows,
  CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE,
  CRYPTO_CUSTOMER_IMPACT_ACK_LABEL,
  CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE,
  CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE,
  CRYPTO_CUSTOMER_RECEIPT_FORBIDDEN_LABELS,
  CRYPTO_CUSTOMER_REVIEW_FORBIDDEN_LABELS,
  CRYPTO_CUSTOMER_REQUOTE_MESSAGE,
  CRYPTO_FILLED_ORDER_TITLE,
  cryptoCustomerOrderTypeLabel,
  cryptoFilledOrderSubtitle,
  customerImpactWarningMessage,
  shortenCryptoOrderReference,
  subtractCryptoMoneyStrings,
} from "./crypto-customer-review";
import { formatCryptoQuantityDisplay } from "./crypto-format";
import { buildPriceImpactWarnings } from "./crypto-settlement-math";
import { customerMessageForCode, type CryptoOrderFillResult } from "./crypto-order-types";
import { resolveCryptoImpactAckState } from "./crypto-impact-ack";

const previewBase = {
  symbol: "VLT",
  estimatedExecutedQuantity: "100.00000000",
  grossTradeValue: "100.00",
  totalFee: "1.00",
  estimatedTerminalCashAfter: "9900.00",
  estimatedWalletBalanceAfter: "150.00000000",
  currentTerminalCash: "10000.00",
};

const buyFill: CryptoOrderFillResult = {
  ok: true,
  orderId: "cms9rfbbs0013ukeh4r9ksi4zs",
  settlementId: "set_demo",
  symbol: "VLT",
  side: "BUY",
  executedQuantity: "18949.82982958",
  grossTradeValue: "800.00",
  totalFee: "8.00",
  revenueAllocation: "6.00",
  stabilizationAllocation: "2.00",
  netReserveDelta: "792.00",
  priceBefore: "0.10000000",
  priceAfter: "0.10198284",
  averageExecutionPrice: "0.10099142",
  priceImpactPercent: "1.98284000",
  customerCashDelta: "-800.00",
  realizedGainLoss: null,
  resultingTerminalCash: "2044.34",
  resultingWalletBalance: "18949.82982958",
  walletPublicId: "acw_demo",
  marketStateVersion: 1,
  filledAt: "2026-07-31T18:00:00.000Z",
  replayed: false,
};

const sellFill: CryptoOrderFillResult = {
  ...buyFill,
  orderId: "cms9sellorderref001si4zs",
  side: "SELL",
  executedQuantity: "1250.00000000",
  customerCashDelta: "123.45",
  resultingTerminalCash: "2167.79",
  resultingWalletBalance: "17699.82982958",
};

describe("crypto customer review presentation", () => {
  it("buy summary is a clean brokerage review without pricing-model fields", () => {
    const rows = buildCryptoCustomerReviewRows("BUY", previewBase);
    const labels = rows.map((r) => r.label);
    assert.deepEqual(labels, [
      "Order type",
      "Order amount",
      "Estimated quantity",
      "Fee",
      "Estimated cash remaining",
    ]);
    assert.equal(rows[0]!.value, "Market buy");
    assert.equal(cryptoCustomerOrderTypeLabel("BUY"), "Market buy");
    for (const forbidden of CRYPTO_CUSTOMER_REVIEW_FORBIDDEN_LABELS) {
      assert.equal(labels.includes(forbidden), false);
    }
    assert.equal(labels.includes("Estimated average price"), false);
    assert.equal(labels.includes("Current price"), false);
    assert.match(CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE, /may change if the market moves/);
  });

  it("sell summary uses sell-specific estimated fields", () => {
    const rows = buildCryptoCustomerReviewRows("SELL", {
      ...previewBase,
      estimatedTerminalCashAfter: "10099.00",
      estimatedWalletBalanceAfter: "50.00000000",
    });
    const labels = rows.map((r) => r.label);
    assert.deepEqual(labels, [
      "Order type",
      "Quantity being sold",
      "Estimated proceeds",
      "Fee",
      "Estimated wallet balance remaining",
    ]);
    assert.equal(rows[0]!.value, "Market sell");
    assert.equal(subtractCryptoMoneyStrings("10099.00", "10000.00"), "99.00");
    assert.match(rows.find((r) => r.label === "Estimated proceeds")!.value, /99/);
    assert.equal(labels.includes("Estimated average price"), false);
  });
});

describe("crypto filled-order receipt presentation", () => {
  it("buy heading and subtitle", () => {
    assert.equal(CRYPTO_FILLED_ORDER_TITLE, "Order filled");
    assert.equal(
      cryptoFilledOrderSubtitle(buyFill),
      `Bought ${formatCryptoQuantityDisplay(buyFill.executedQuantity, "VLT")}`,
    );
    assert.match(cryptoFilledOrderSubtitle(buyFill), /^Bought /);
    assert.match(cryptoFilledOrderSubtitle(buyFill), /VLT$/);
  });

  it("sell heading and subtitle", () => {
    assert.equal(CRYPTO_FILLED_ORDER_TITLE, "Order filled");
    assert.match(cryptoFilledOrderSubtitle(sellFill), /^Sold /);
    assert.match(cryptoFilledOrderSubtitle(sellFill), /1,250/);
    assert.match(cryptoFilledOrderSubtitle(sellFill), /VLT$/);
  });

  it("formats quantities with thousands separators and trimmed precision", () => {
    const qty = formatCryptoQuantityDisplay("18949.82982958", "VLT");
    assert.match(qty, /18,949/);
    assert.doesNotMatch(qty, /18949\.829829580+/);
    assert.doesNotMatch(qty, /e[+-]?\d+/i);
    assert.equal(formatCryptoQuantityDisplay("1250.00000000", "VLT"), "1,250 VLT");
    assert.equal(formatCryptoQuantityDisplay("-0.00000000", "VLT"), "0 VLT");
    assert.equal(formatCryptoQuantityDisplay("-0", "NVA"), "0 NVA");
  });

  it("does not use excessive decimal precision beyond asset display precision", () => {
    const qty = formatCryptoQuantityDisplay("4.50000000123456789", "NVA");
    const frac = qty.split(" ")[0]!.split(".")[1] ?? "";
    assert.ok(frac.length <= 8);
  });

  it("removes redundant status row and uses concise buy/sell labels", () => {
    const buyRows = buildCryptoCustomerReceiptRows(buyFill, "Core Portfolio");
    const buyLabels = buyRows.map((r) => r.label);
    assert.deepEqual(buyLabels, [
      "Portfolio",
      "Order amount",
      "Fee",
      "Average price",
      "Cash remaining",
      "VLT balance",
      "Completed",
      "Reference",
    ]);
    for (const forbidden of CRYPTO_CUSTOMER_RECEIPT_FORBIDDEN_LABELS) {
      assert.equal(buyLabels.includes(forbidden), false, forbidden);
    }
    assert.equal(buyLabels.includes("Order status"), false);
    assert.equal(buyLabels.includes("Filled quantity"), false);

    const sellRows = buildCryptoCustomerReceiptRows(sellFill, "Core Portfolio");
    const sellLabels = sellRows.map((r) => r.label);
    assert.ok(sellLabels.includes("Gross proceeds"));
    assert.equal(sellLabels.includes("Order amount"), false);
    assert.ok(sellLabels.includes("VLT balance"));
  });

  it("shortens the reference while preserving the full id for copy", () => {
    const rows = buildCryptoCustomerReceiptRows(buyFill, "Core Portfolio");
    const ref = rows.find((r) => r.label === "Reference");
    assert.ok(ref);
    assert.equal(ref!.value, shortenCryptoOrderReference(buyFill.orderId));
    assert.equal(ref!.copyValue, buyFill.orderId);
    assert.notEqual(ref!.value, buyFill.orderId);
    assert.match(ref!.value, /…/);
    assert.equal(ref!.copyValue, "cms9rfbbs0013ukeh4r9ksi4zs");
  });

  it("keeps underlying fill data unchanged when building presentation", () => {
    const snapshot = structuredClone(buyFill);
    buildCryptoCustomerReceiptRows(buyFill, "Core Portfolio");
    cryptoFilledOrderSubtitle(buyFill);
    shortenCryptoOrderReference(buyFill.orderId);
    assert.deepEqual(buyFill, snapshot);
  });
});

describe("customer impact warning copy", () => {
  it("uses generic warnings without exact percentages at each tier", () => {
    const under = buildPriceImpactWarnings("4.99");
    assert.equal(under.warnings.length, 0);
    assert.equal(under.requiresHighImpactConfirmation, false);

    const warn = buildPriceImpactWarnings("5");
    assert.equal(warn.warnings.length, 1);
    assert.equal(warn.warnings[0]!.message, CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE);
    assert.doesNotMatch(warn.warnings[0]!.message, /\d+(\.\d+)?%/);
    assert.equal(warn.requiresHighImpactConfirmation, false);

    const confirm = buildPriceImpactWarnings("10");
    assert.equal(confirm.requiresHighImpactConfirmation, true);
    assert.equal(confirm.warnings[0]!.message, CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE);
    assert.doesNotMatch(confirm.warnings[0]!.message, /\d+(\.\d+)?%/);

    const over = buildPriceImpactWarnings("15.01");
    assert.equal(over.exceedsHardLimit, true);
    assert.equal(over.warnings[0]!.message, CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE);
    assert.doesNotMatch(over.warnings[0]!.message, /\d+(\.\d+)?%/);
    assert.equal(customerMessageForCode("PRICE_IMPACT_LIMIT_EXCEEDED"), CRYPTO_CUSTOMER_IMPACT_LIMIT_MESSAGE);
    assert.equal(customerMessageForCode("REQUOTE_REQUIRED"), CRYPTO_CUSTOMER_REQUOTE_MESSAGE);
  });

  it("maps ack UI tiers without exposing percentages", () => {
    assert.equal(
      customerImpactWarningMessage({ requiresAcknowledgement: false }),
      CRYPTO_CUSTOMER_IMPACT_WARN_MESSAGE,
    );
    assert.equal(
      customerImpactWarningMessage({ requiresAcknowledgement: true }),
      CRYPTO_CUSTOMER_IMPACT_CONFIRM_MESSAGE,
    );
    const ack = resolveCryptoImpactAckState({
      priceImpactPercent: "12",
      requiresHighImpactConfirmation: true,
      accepted: false,
    });
    assert.equal(ack.requiresAcknowledgement, true);
    assert.equal(ack.submitEnabled, false);
    assert.equal(
      resolveCryptoImpactAckState({
        priceImpactPercent: "12",
        requiresHighImpactConfirmation: true,
        accepted: true,
      }).submitEnabled,
      true,
    );
    assert.match(CRYPTO_CUSTOMER_IMPACT_ACK_LABEL, /significantly affect its own execution/);
    assert.doesNotMatch(CRYPTO_CUSTOMER_IMPACT_ACK_LABEL, /price$/i);
  });
});

describe("customer ticket source contracts", () => {
  it("does not render model-probing review labels in the shared ticket", () => {
    const ticket = readFileSync(
      join(process.cwd(), "src/components/terminal/crypto-order-ticket.tsx"),
      "utf8",
    );
    assert.match(ticket, /buildCryptoCustomerReviewRows/);
    assert.match(ticket, /cryptoCustomerOrderTypeLabel/);
    assert.match(ticket, /CRYPTO_CUSTOMER_ESTIMATE_DISCLOSURE/);
    assert.match(ticket, /CRYPTO_CUSTOMER_IMPACT_ACK_LABEL/);
    assert.match(ticket, /CRYPTO_FILLED_ORDER_TITLE/);
    assert.match(ticket, /cryptoFilledOrderSubtitle/);
    assert.match(ticket, /Trade again/);
    assert.match(ticket, /DEFAULT_GROSS_FLORINS/);
    assert.match(ticket, /setClientKey\(newClientKey\(\)\)/);
    assert.doesNotMatch(ticket, /secondaryLabel=["']New order["']/);
    assert.doesNotMatch(ticket, /label=["']Price after["']/);
    assert.doesNotMatch(ticket, /label=["']Market impact["']/);
    assert.doesNotMatch(ticket, /label=["']Current price["']/);
    assert.doesNotMatch(ticket, /Estimated average price/);
    assert.doesNotMatch(ticket, /formatCryptoPercent\(preview\.priceImpactPercent/);
    assert.doesNotMatch(ticket, /Price after/);
    assert.doesNotMatch(ticket, /Market impact/);
  });

  it("wires copy control and mobile-safe process summary layout", () => {
    const processUi = readFileSync(
      join(process.cwd(), "src/components/terminal/terminal-process-ui.tsx"),
      "utf8",
    );
    assert.match(processUi, /Copy full order reference/);
    assert.match(processUi, /Copied/);
    assert.match(processUi, /copyValue/);
    assert.match(processUi, /flex-col gap-1 sm:flex-row/);
    assert.match(processUi, /safe-area-inset-bottom/);
    assert.match(processUi, /min-h-11|size-11/);
    assert.match(processUi, /navigator\.clipboard|execCommand\("copy"\)/);
  });

  it("keeps stock order ticket free of crypto impact acknowledgement UI", () => {
    const stock = readFileSync(
      join(process.cwd(), "src/components/terminal/order-ticket.tsx"),
      "utf8",
    );
    assert.doesNotMatch(stock, /CRYPTO_CUSTOMER_IMPACT/);
    assert.doesNotMatch(stock, /acceptHighPriceImpact/);
    assert.doesNotMatch(stock, /buildCryptoCustomerReviewRows/);
  });

  it("keeps exact impact available in internal ops workspace", () => {
    const ops = readFileSync(
      join(process.cwd(), "src/components/internal/workspace/terminal-crypto-asset-workspace-view.tsx"),
      "utf8",
    );
    assert.match(ops, /Fees & curve|CURVE|Launch price|sensitivityLabel|matchesAuthoritativeConfig/);
  });
});
