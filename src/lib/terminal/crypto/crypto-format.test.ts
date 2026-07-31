import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoNegativeZeroFlorin,
  containsNegativeZeroFlorin,
  cryptoMarketStatusLabel,
  cryptoPriceFractionDigits,
  formatCryptoChangeAmount,
  formatCryptoDisplayPriceFromRaw,
  formatCryptoMoney,
  formatCryptoPercent,
  formatCryptoPrice,
  formatCryptoPriceTransition,
  formatCryptoQuantityDisplay,
  normalizeDisplaySignedZero,
} from "@/lib/terminal/crypto/crypto-format";
import { buildPortfolioAllocation } from "@/lib/terminal/crypto/portfolio-allocation";
import {
  CRYPTO_IMPACT_CONFIRM_THRESHOLD,
  CRYPTO_IMPACT_WARN_THRESHOLD,
  resolveCryptoImpactAckState,
  shouldResetHighImpactAcknowledgement,
} from "@/lib/terminal/crypto/crypto-impact-ack";
import { cryptoOpsAttentionCta } from "@/lib/terminal/crypto/crypto-ops-ui";
import type { CryptoPortfolioBalance } from "@/lib/terminal/crypto/crypto-market-read.service";
import type { Holding } from "@/lib/terminal/types";

describe("crypto-aware price formatting", () => {
  it("never renders negative zero for a small VLT change", () => {
    const text = formatCryptoChangeAmount(-0.002, "VLT", { signed: true });
    assert.equal(text, "-ƒ0.0020");
    assert.equal(containsNegativeZeroFlorin(text), false);
    assertNoNegativeZeroFlorin(text);
  });

  it("formats exact zero without a sign", () => {
    assert.equal(formatCryptoChangeAmount(0, "VLT", { signed: true }), "ƒ0.0000");
    assert.equal(formatCryptoMoney(0, { signed: true }), "ƒ0.00");
    assert.equal(formatCryptoPercent(-0, { signed: true }), "0.00%");
    assert.equal(normalizeDisplaySignedZero(-0, 2), 0);
  });

  it("formats small positive changes with enough precision", () => {
    assert.equal(formatCryptoChangeAmount(0.002, "VLT", { signed: true }), "+ƒ0.0020");
    assert.equal(formatCryptoChangeAmount(0.00012, "NVA", { signed: true }), "+ƒ0.0001");
  });

  it("formats normal NPFC and NVA prices", () => {
    assert.equal(formatCryptoPrice(1, "NPFC"), "ƒ1.00");
    assert.equal(formatCryptoPrice(5.01, "NVA"), "ƒ5.01");
    assert.equal(formatCryptoPrice(0.1, "VLT"), "ƒ0.1000");
    assert.equal(cryptoPriceFractionDigits("NPFC", 1), 2);
    assert.equal(cryptoPriceFractionDigits("NVA", 5), 2);
    assert.ok(cryptoPriceFractionDigits("VLT", 0.1) >= 4);
  });

  it("keeps florin totals at two decimals", () => {
    assert.equal(formatCryptoMoney(49.996), "ƒ50.00");
    assert.equal(formatCryptoMoney("12.345"), "ƒ12.35");
  });
});

describe("preview display rounding without mutating raw quotes", () => {
  it("rounds noisy execution prices for display only", () => {
    const rawAvg = "5.006249999997";
    const rawBefore = "5.000000000000";
    const rawAfter = "5.012499999994";
    assert.equal(formatCryptoDisplayPriceFromRaw(rawAvg, "NVA"), "ƒ5.0063");
    assert.equal(
      formatCryptoPriceTransition(rawBefore, rawAfter, "NVA"),
      "ƒ5.0000 → ƒ5.0125",
    );
    // Underlying strings unchanged for signing / version checks.
    assert.equal(rawAvg, "5.006249999997");
    assert.equal(rawBefore, "5.000000000000");
    assert.equal(rawAfter, "5.012499999994");
  });
});

describe("mixed portfolio allocation", () => {
  it("reconciles stock and crypto weights to ~100%", () => {
    const holdings: Holding[] = [
      {
        symbol: "ALTA",
        name: "Alta Group",
        quantity: 10,
        averageCost: 10,
        lastPrice: 20,
        marketValue: 150,
        totalReturn: null,
        totalReturnPercent: null,
        dayReturn: null,
        dayReturnPercent: null,
        weightPercent: 100,
        sparkline: [],
      },
    ];
    const cryptoBalances: CryptoPortfolioBalance[] = [
      {
        symbol: "NPFC",
        displayName: "Newport Florin Coin",
        quantity: "25",
        averageCost: "1",
        currentPrice: "1",
        markedValue: "25.00",
        totalReturn: "0",
        totalReturnPercent: "0",
      },
      {
        symbol: "NVA",
        displayName: "Nova Coin",
        quantity: "4",
        averageCost: "5",
        currentPrice: "5",
        markedValue: "20.00",
        totalReturn: "0",
        totalReturnPercent: "0",
      },
      {
        symbol: "VLT",
        displayName: "Volt Coin",
        quantity: "50",
        averageCost: "0.1",
        currentPrice: "0.1",
        markedValue: "5.00",
        totalReturn: "0",
        totalReturnPercent: "0",
      },
    ];

    const model = buildPortfolioAllocation({ holdings, cryptoBalances });
    assert.ok(model);
    assert.equal(model!.investedEquity, 200);
    assert.ok(model!.rows.some((r) => r.symbol === "NPFC" && r.kind === "CRYPTO"));
    assert.ok(model!.rows.some((r) => r.symbol === "ALTA" && r.kind === "STOCK"));
    assert.ok(Math.abs(model!.weightSum - 100) < 0.15);
    assert.match(model!.basisDescription, /Cash is not included/);
  });

  it("supports crypto-only and empty portfolios", () => {
    const cryptoOnly = buildPortfolioAllocation({
      holdings: [],
      cryptoBalances: [
        {
          symbol: "NPFC",
          displayName: "Newport Florin Coin",
          quantity: "10",
          averageCost: "1",
          currentPrice: "1",
          markedValue: "10.00",
          totalReturn: null,
          totalReturnPercent: null,
        },
      ],
    });
    assert.ok(cryptoOnly);
    assert.equal(cryptoOnly!.rows.length, 1);
    assert.equal(cryptoOnly!.weightSum, 100);

    assert.equal(buildPortfolioAllocation({ holdings: [], cryptoBalances: [] }), null);
  });
});

describe("high-impact acknowledgement state machine", () => {
  it("warns at 5% without requiring acknowledgement", () => {
    const state = resolveCryptoImpactAckState({
      priceImpactPercent: "5",
      requiresHighImpactConfirmation: false,
      accepted: false,
    });
    assert.equal(CRYPTO_IMPACT_WARN_THRESHOLD, 5);
    assert.equal(state.showWarning, true);
    assert.equal(state.requiresAcknowledgement, false);
    assert.equal(state.submitEnabled, true);
  });

  it("requires acknowledgement at and above 10%", () => {
    for (const impact of ["9.99", "10", "10.01", "25"] as const) {
      const state = resolveCryptoImpactAckState({
        priceImpactPercent: impact,
        requiresHighImpactConfirmation: Number(impact) >= 10,
        accepted: false,
      });
      if (Number(impact) < CRYPTO_IMPACT_CONFIRM_THRESHOLD) {
        assert.equal(state.requiresAcknowledgement, false);
        assert.equal(state.submitEnabled, true);
      } else {
        assert.equal(state.requiresAcknowledgement, true);
        assert.equal(state.submitEnabled, false);
        assert.equal(
          resolveCryptoImpactAckState({
            priceImpactPercent: impact,
            requiresHighImpactConfirmation: true,
            accepted: true,
          }).submitEnabled,
          true,
        );
      }
    }
  });

  it("resets acknowledgement when impact materially changes", () => {
    assert.equal(
      shouldResetHighImpactAcknowledgement({
        previousImpactPercent: "10",
        nextImpactPercent: "12",
        previousRequired: true,
        nextRequired: true,
      }),
      true,
    );
    assert.equal(
      shouldResetHighImpactAcknowledgement({
        previousImpactPercent: "4",
        nextImpactPercent: "4.005",
        previousRequired: false,
        nextRequired: false,
      }),
      false,
    );
  });
});

describe("internal attention versus demonstration banner", () => {
  it("uses descriptive CTAs instead of generic Review", () => {
    assert.equal(
      cryptoOpsAttentionCta({ kind: "reconciliation_issue", severity: "CRITICAL" }).label,
      "Review reconciliation issue",
    );
    assert.equal(
      cryptoOpsAttentionCta({ kind: "readiness", severity: "INFO" }).label,
      "Review asset readiness",
    );
    assert.equal(
      cryptoOpsAttentionCta({ kind: "failed_job", severity: "WARNING" }).label,
      "Review failed job",
    );
  });

  it("ready_to_activate fixture source no longer treats demonstration as attention", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures.ts"),
      "utf8",
    );
    assert.match(src, /Demonstration context is a banner, not an attention incident/);
    assert.doesNotMatch(
      src,
      /case "ready_to_activate"[\s\S]*?needsAttention\.push\(\{[\s\S]*?severity: "INFO"/,
    );
  });

  it("keeps critical CTA wording for reconciliation attention", () => {
    const cta = cryptoOpsAttentionCta({ kind: "reconciliation", severity: "CRITICAL" });
    assert.match(cta.label, /Review reconciliation issue/);
  });
});

describe("crypto market status and quantity terminology", () => {
  it("uses Crypto · 24/7 for crypto-scoped status", () => {
    assert.equal(cryptoMarketStatusLabel(true), "Crypto · 24/7");
    assert.equal(cryptoMarketStatusLabel(false), "Crypto · unavailable");
  });

  it("labels crypto quantity with the symbol, not shares", () => {
    const qty = formatCryptoQuantityDisplay("4.5", "NVA");
    assert.match(qty, /NVA/);
    assert.doesNotMatch(qty, /\bsh\b|shares/i);
  });
});
