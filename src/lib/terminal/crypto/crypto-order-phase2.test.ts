import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertAssetAllowsSide,
  assertWalletCanTrade,
} from "./crypto-lifecycle";
import { CryptoOrderError } from "./crypto-order-types";
import {
  parseCryptoOrderPreviewInput,
  parseCryptoOrderSubmitInput,
} from "./crypto-order-validation";
import {
  buildQuoteExpiry,
  createQuoteFingerprint,
  isQuoteExpired,
  stableSha256,
  stableStringify,
  verifyQuoteFingerprint,
} from "./crypto-quote-token";
import {
  buildPriceImpactWarnings,
  computeRealizedGainLoss,
  computeWeightedAverageCost,
  m1CandleIntervalStart,
} from "./crypto-settlement-math";
import { d } from "./crypto-decimal";

describe("crypto order validation", () => {
  it("accepts buy gross florins and rejects dual amount+quantity", () => {
    const buy = parseCryptoOrderPreviewInput({
      portfolioId: "p1",
      symbol: "nva",
      side: "BUY",
      grossFlorins: "100.00",
    });
    assert.equal(buy.symbol, "NVA");
    assert.equal(buy.grossFlorins, "100.00");
    assert.equal(buy.quantity, null);

    assert.throws(
      () =>
        parseCryptoOrderPreviewInput({
          portfolioId: "p1",
          symbol: "NVA",
          side: "BUY",
          grossFlorins: "10",
          quantity: "1",
        }),
      (err: unknown) => err instanceof CryptoOrderError && err.code === "VALIDATION_FAILED",
    );
  });

  it("rejects JavaScript number financial inputs", () => {
    assert.throws(
      () =>
        parseCryptoOrderPreviewInput({
          portfolioId: "p1",
          symbol: "NVA",
          side: "BUY",
          grossFlorins: 100 as unknown as string,
        }),
      (err: unknown) => err instanceof CryptoOrderError && err.code === "VALIDATION_FAILED",
    );
  });

  it("requires submit quote fields and client key", () => {
    assert.throws(
      () =>
        parseCryptoOrderSubmitInput({
          portfolioId: "p1",
          symbol: "NVA",
          side: "BUY",
          grossFlorins: "10",
          clientKey: "short",
          expectedMarketStateVersion: 0,
          quoteExpiresAt: new Date().toISOString(),
          quoteFingerprint: "abc",
        }),
      (err: unknown) => err instanceof CryptoOrderError && err.code === "VALIDATION_FAILED",
    );
  });
});

describe("lifecycle gates", () => {
  it("blocks draft/halted/closed and redemption-only buys", () => {
    assert.throws(() => assertAssetAllowsSide("DRAFT", "BUY"), (e: unknown) =>
      e instanceof CryptoOrderError && e.code === "ASSET_DRAFT",
    );
    assert.throws(() => assertAssetAllowsSide("HALTED", "SELL"), (e: unknown) =>
      e instanceof CryptoOrderError && e.code === "ASSET_HALTED",
    );
    assert.throws(() => assertAssetAllowsSide("REDEMPTION_ONLY", "BUY"), (e: unknown) =>
      e instanceof CryptoOrderError && e.code === "REDEMPTION_ONLY",
    );
    assert.doesNotThrow(() => assertAssetAllowsSide("REDEMPTION_ONLY", "SELL"));
    assert.throws(() => assertAssetAllowsSide("CLOSED", "BUY"), (e: unknown) =>
      e instanceof CryptoOrderError && e.code === "ASSET_CLOSED",
    );
  });

  it("blocks frozen/closed wallets", () => {
    assert.doesNotThrow(() => assertWalletCanTrade("ACTIVE"));
    assert.doesNotThrow(() => assertWalletCanTrade(null));
    assert.throws(() => assertWalletCanTrade("FROZEN"), (e: unknown) =>
      e instanceof CryptoOrderError && e.code === "WALLET_FROZEN",
    );
  });
});

describe("quote tokens and stable hashing", () => {
  it("uses insertion-order-independent hashing", () => {
    assert.equal(
      stableSha256({ a: "1", b: "2" }),
      stableSha256({ b: "2", a: "1" }),
    );
    assert.notEqual(stableStringify({ a: 1, b: 2 }), JSON.stringify({ b: 2, a: 1 }));
  });

  it("verifies quote fingerprints and expiry", () => {
    const expires = buildQuoteExpiry(new Date("2026-07-31T12:00:00.000Z"), 15_000);
    const payload = {
      portfolioId: "p1",
      symbol: "NVA",
      side: "BUY" as const,
      grossFlorins: "100",
      quantity: null,
      marketStateVersion: 3,
      quoteExpiresAt: expires.toISOString(),
    };
    const fp = createQuoteFingerprint(payload);
    assert.ok(verifyQuoteFingerprint(payload, fp));
    assert.equal(verifyQuoteFingerprint({ ...payload, marketStateVersion: 4 }, fp), false);
    assert.equal(isQuoteExpired(expires, new Date("2026-07-31T12:00:10.000Z")), false);
    assert.equal(isQuoteExpired(expires, new Date("2026-07-31T12:00:16.000Z")), true);
  });
});

describe("settlement math", () => {
  it("computes weighted average cost including fees", () => {
    const avg = computeWeightedAverageCost({
      previousQuantity: "10",
      previousAverageCost: "5",
      purchasedQuantity: "10",
      totalCustomerCost: "60",
    });
    assert.equal(avg.toFixed(2), "5.50");
  });

  it("computes realized gain/loss from net proceeds", () => {
    const rgl = computeRealizedGainLoss({
      soldQuantity: "10",
      averageCost: "5",
      netProceedsAfterFees: "60",
    });
    assert.equal(rgl.toFixed(2), "10.00");
  });

  it("warns at 5% and requires confirmation at 10%", () => {
    const warn = buildPriceImpactWarnings("5");
    assert.equal(warn.warnings.length, 1);
    assert.equal(warn.requiresHighImpactConfirmation, false);
    const confirm = buildPriceImpactWarnings("-10");
    assert.equal(confirm.requiresHighImpactConfirmation, true);
  });

  it("floors candle starts to UTC minutes", () => {
    const start = m1CandleIntervalStart(new Date("2026-07-31T15:42:33.123Z"));
    assert.equal(start.toISOString(), "2026-07-31T15:42:00.000Z");
  });
});

describe("phase 2 schema/source guards", () => {
  it("adds accrued revenue, wallet ledger, and does not put crypto in TerminalPosition", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    assert.match(schema, /accruedRevenue/);
    assert.match(schema, /TERMINAL_REVENUE/);
    assert.match(schema, /model TerminalCryptoWalletLedgerEntry/);
    assert.match(schema, /realizedGainLoss/);
    assert.match(schema, /entryKey/);
    const position = schema.match(/model TerminalPosition \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.doesNotMatch(position, /TerminalCrypto/);
  });

  it("ships phase 2 hardening migration without activating assets", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260731160000_terminal_crypto_execution_hardening/migration.sql",
      ),
      "utf8",
    );
    assert.match(sql, /accruedRevenue/);
    assert.match(sql, /TerminalCryptoWalletLedgerEntry/);
    assert.match(sql, /TERMINAL_REVENUE/);
    assert.doesNotMatch(sql, /SET[\s\S]*"status"\s*=\s*'ACTIVE'/);
  });

  it("keeps pricing engine free of Prisma IO and execution gated from UI Lab", () => {
    const pricing = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/crypto-pricing.ts"),
      "utf8",
    );
    assert.doesNotMatch(pricing, /PrismaClient|\$transaction/);
    const fns = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/terminal-crypto-order.functions.ts"),
      "utf8",
    );
    assert.match(fns, /assertNotUiLabMutation/);
    assert.match(fns, /terminal\.place_order/);
    // Phase 3: submit requires CRYPTO progressive consent (closed the prior TODO).
    assert.match(fns, /terminal\.crypto_trade/);
    // ConsentRequiredError must rethrow so the progressive consent dialog can open.
    assert.match(fns, /isConsentRequiredError/);
    assert.match(fns, /throw error/);
  });

  it("documents lock order in execution service", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/terminal-crypto-execution.service.ts"),
      "utf8",
    );
    assert.match(src, /Lock order/);
    assert.match(src, /TerminalPortfolio/);
    assert.match(src, /TerminalPortfolioCashAccount/);
    assert.match(src, /TerminalCryptoMarketState/);
    assert.match(src, /instrumentKind: "CRYPTO"/);
    assert.match(src, /executionVenue: "ALTA_CRYPTO"/);
    assert.doesNotMatch(src, /terminalPosition\.create/);
  });
});

describe("average cost identity sanity", () => {
  it("buy then full sell realizes fee drag as a loss at unchanged price", () => {
    const buyCost = d("100");
    const qty = d("19.77528089");
    const avg = computeWeightedAverageCost({
      previousQuantity: "0",
      previousAverageCost: "0",
      purchasedQuantity: qty,
      totalCustomerCost: buyCost,
    });
    // Round-trip before curve move: redeem net < gross paid due to fees
    const netProceeds = d("98");
    const rgl = computeRealizedGainLoss({
      soldQuantity: qty,
      averageCost: avg,
      netProceedsAfterFees: netProceeds,
    });
    assert.ok(rgl.lessThan(0));
  });
});
