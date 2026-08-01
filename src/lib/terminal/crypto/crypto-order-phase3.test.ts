/**
 * Phase 3 customer crypto market contracts — visibility, consent, quote secret, search.
 * Does not require migrated DB for most assertions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCryptoSymbolVisible,
  tradingCapabilitiesForStatus,
} from "@/lib/terminal/crypto/crypto-market-read.service";
import {
  isCryptoQuoteSecretConfigured,
  resolveCryptoQuoteSecret,
} from "@/lib/terminal/crypto/crypto-quote-token";
import { getActionConsentRequirement } from "@/lib/legal/product-consent-requirements";
import { PRODUCT_CONSENT_BUNDLES } from "@/lib/legal/legal-consent-bundle";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { isTerminalCryptoSymbol } from "@/lib/terminal/crypto/crypto-instrument";

describe("Phase 3 crypto visibility", () => {
  it("never exposes DRAFT to ordinary customers", () => {
    assert.equal(isCryptoSymbolVisible("DRAFT", false), false);
    assert.equal(isCryptoSymbolVisible("DRAFT", true), false);
  });

  it("shows ACTIVE and REDEMPTION_ONLY", () => {
    assert.equal(isCryptoSymbolVisible("ACTIVE", false), true);
    assert.equal(isCryptoSymbolVisible("REDEMPTION_ONLY", false), true);
  });

  it("shows HALTED only when held or includeHalted", () => {
    assert.equal(isCryptoSymbolVisible("HALTED", false), false);
    assert.equal(isCryptoSymbolVisible("HALTED", true), true);
    assert.equal(isCryptoSymbolVisible("HALTED", false, { includeHalted: true }), true);
  });

  it("shows CLOSED only when held", () => {
    assert.equal(isCryptoSymbolVisible("CLOSED", false), false);
    assert.equal(isCryptoSymbolVisible("CLOSED", true), true);
  });

  it("maps trading capabilities by status", () => {
    assert.deepEqual(tradingCapabilitiesForStatus("ACTIVE"), { canBuy: true, canSell: true });
    assert.deepEqual(tradingCapabilitiesForStatus("REDEMPTION_ONLY"), {
      canBuy: false,
      canSell: true,
    });
    assert.deepEqual(tradingCapabilitiesForStatus("HALTED"), { canBuy: false, canSell: false });
    assert.deepEqual(tradingCapabilitiesForStatus("DRAFT"), { canBuy: false, canSell: false });
  });
});

describe("Phase 3 crypto consent", () => {
  it("defines CRYPTO scope with AT-LEGAL-006 ACKNOWLEDGED", () => {
    assert.deepEqual(PRODUCT_CONSENT_BUNDLES.CRYPTO.documents, [
      { documentId: "AT-LEGAL-006", acceptanceType: "ACKNOWLEDGED" },
    ]);
    const doc = getLegalDocument("AT-LEGAL-006");
    assert.ok(doc);
    assert.equal(doc!.version, "1.1");
    assert.match(doc!.title, /Crypto Trading and Custody/i);
  });

  it("requires TERMINAL + CRYPTO for terminal.crypto_trade", () => {
    assert.deepEqual([...getActionConsentRequirement("terminal.crypto_trade").scopes], [
      "TERMINAL",
      "CRYPTO",
    ]);
  });

  it("keeps place_order as TERMINAL-only so browsing/preview can proceed", () => {
    assert.deepEqual([...getActionConsentRequirement("terminal.place_order").scopes], [
      "TERMINAL",
    ]);
  });
});

describe("Phase 3 quote secret hardening", () => {
  it("allows resolve in non-production without dedicated secret", () => {
    const prevNode = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL_ENV;
    const prevSecret = process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
    try {
      process.env.NODE_ENV = "test";
      delete process.env.VERCEL_ENV;
      delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
      assert.ok(resolveCryptoQuoteSecret().length > 0);
      assert.equal(isCryptoQuoteSecretConfigured(), true);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
      if (prevSecret === undefined) delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
      else process.env.TERMINAL_CRYPTO_QUOTE_SECRET = prevSecret;
    }
  });

  it("fails closed in production without dedicated secret", () => {
    const prevNode = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL_ENV;
    const prevSecret = process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
    const prevSession = process.env.SESSION_SECRET;
    try {
      process.env.NODE_ENV = "production";
      process.env.VERCEL_ENV = "production";
      delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
      process.env.SESSION_SECRET = "this-is-long-enough-session-secret-value";
      assert.throws(() => resolveCryptoQuoteSecret(), /TERMINAL_CRYPTO_QUOTE_SECRET/);
      assert.equal(isCryptoQuoteSecretConfigured(), false);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
      if (prevSecret === undefined) delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
      else process.env.TERMINAL_CRYPTO_QUOTE_SECRET = prevSecret;
      if (prevSession === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = prevSession;
    }
  });
});

describe("Phase 3 instrument helpers and source contracts", () => {
  it("recognizes launch crypto symbols", () => {
    assert.equal(isTerminalCryptoSymbol("NPFC"), true);
    assert.equal(isTerminalCryptoSymbol("nva"), true);
    assert.equal(isTerminalCryptoSymbol("ALT"), false);
  });

  it("keeps crypto market-only in CryptoOrderTicket source", () => {
    const ticket = readFileSync(
      join(process.cwd(), "src/components/terminal/crypto-order-ticket.tsx"),
      "utf8",
    );
    assert.match(ticket, /Market order/);
    assert.doesNotMatch(ticket, /setOrderType|orderType.*limit/i);
    assert.match(ticket, /requestConsent\(\["TERMINAL", "CRYPTO"\]\)/);
    assert.match(ticket, /isConsentCancelledError/);
    assert.doesNotMatch(ticket, /code === "CONSENT_REQUIRED"/);
    assert.match(ticket, /buildCryptoCustomerReviewRows/);
    assert.doesNotMatch(ticket, /label=["']Price after["']/);
    assert.doesNotMatch(ticket, /label=["']Market impact["']/);
  });

  it("wires submit to terminal.crypto_trade", () => {
    const fns = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/terminal-crypto-order.functions.ts"),
      "utf8",
    );
    assert.match(fns, /terminal\.crypto_trade/);
  });

  it("includes CRYPTO product consent presentation copy", () => {
    const service = readFileSync(
      join(process.cwd(), "src/server/product-consent.service.ts"),
      "utf8",
    );
    assert.match(service, /CRYPTO:\s*\{\s*title:\s*"Alta Terminal Crypto"/);
  });

  it("executor routes CRYPTO away from TSE", () => {
    const executor = readFileSync(
      join(process.cwd(), "src/server/terminal-scheduled-trade-executor.service.ts"),
      "utf8",
    );
    assert.match(executor, /processCryptoOccurrence/);
    assert.match(executor, /instrumentKind === "CRYPTO"/);
    assert.match(executor, /submitTerminalCryptoOrder/);
    assert.match(executor, /PRICE_IMPACT_TOO_HIGH/);
    assert.match(executor, /acceptHighPriceImpact: false/);
  });

  it("does not invent 24h change as zero in markets UI", () => {
    const markets = readFileSync(
      join(process.cwd(), "src/routes/terminal/markets.tsx"),
      "utf8",
    );
    assert.match(markets, /noTradesYet \|\| asset\.dayChangePercent == null/);
    assert.match(markets, /—/);
  });

  it("documents TERMINAL_CRYPTO_QUOTE_SECRET in .env.example", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    assert.match(env, /TERMINAL_CRYPTO_QUOTE_SECRET/);
  });

  it("documents TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID in .env.example", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    assert.match(env, /TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID/);
  });
});
