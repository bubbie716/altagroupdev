import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

process.env.VITE_UI_LAB_MODE = "true";

const {
  previewUiLabCryptoOrder,
  resetUiLabCryptoFixturesForTests,
  getUiLabPortfolioCrypto,
  listUiLabCryptoAssets,
  submitUiLabCryptoOrder,
} = await import("./ui-lab-crypto-fixtures");
const { getUiLabDemonstrationClient, resetUiLabDemonstrationClientsForTests } = await import(
  "./ui-lab-demonstration-tse-client"
);
const { mockPortfolioIds } = await import("./ui-lab-terminal-market-fixtures");
const { getUiLabCryptoOpsDeskSummary } = await import("./ui-lab-crypto-ops-fixtures");
const { getUiLabTerminalAttention } = await import("./ui-lab-terminal-ops-fixtures");
const { presentCryptoAssetStatus } = await import(
  "@/lib/terminal/crypto/crypto-status-presentation"
);
const { formatCryptoChangeAmount } = await import("@/lib/terminal/crypto/crypto-format");
const { UI_LAB_MOCK_USER } = await import("@/lib/auth/ui-lab");

afterEach(() => {
  resetUiLabCryptoFixturesForTests();
  resetUiLabDemonstrationClientsForTests();
});

describe("UI Lab crypto fixtures — market/wallet consistency", () => {
  it("previews a demo VLT sell without INTERNAL_FAILURE", () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const preview = previewUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "VLT",
        side: "SELL",
        grossFlorins: "5",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.ok(Number(preview.preview.estimatedExecutedQuantity) > 0);
  });

  it("fills a buy then a sell against updated circulating supply", () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const buyPreview = previewUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(buyPreview.ok, true);
    if (!buyPreview.ok) return;

    const buy = submitUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
        clientKey: "lab-client-buy-1",
        expectedMarketStateVersion: buyPreview.preview.marketStateVersion,
        quoteExpiresAt: buyPreview.preview.quoteExpiresAt,
        quoteFingerprint: buyPreview.preview.quoteFingerprint,
        acceptHighPriceImpact: true,
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal("ok" in buy && buy.ok, true);

    const sellPreview = previewUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "NVA",
        side: "SELL",
        grossFlorins: "10",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(sellPreview.ok, true);
    if (!sellPreview.ok) return;

    const sell = submitUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "NVA",
        side: "SELL",
        grossFlorins: "10",
        clientKey: "lab-client-sell-1",
        expectedMarketStateVersion: sellPreview.preview.marketStateVersion,
        quoteExpiresAt: sellPreview.preview.quoteExpiresAt,
        quoteFingerprint: sellPreview.preview.quoteFingerprint,
        acceptHighPriceImpact: true,
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal("ok" in sell && sell.ok, true);
  });
});

describe("UI Lab crypto cash remaining matches portfolio buying power", () => {
  it("uses Core Portfolio ledger cash, not ƒ10,000", async () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const client = getUiLabDemonstrationClient(UI_LAB_MOCK_USER.id);
    const portfolio = await client.getPortfolio(ids.personalCore);
    const preview = previewUiLabCryptoOrder(
      {
        portfolioId: ids.personalCore,
        symbol: "NPFC",
        side: "BUY",
        grossFlorins: "100",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.preview.currentTerminalCash, portfolio.buyingPower.toFixed(2));
    assert.notEqual(preview.preview.currentTerminalCash, "10000.00");
    const expectedAfter = (portfolio.buyingPower - 100).toFixed(2);
    assert.equal(preview.preview.estimatedTerminalCashAfter, expectedAfter);
  });

  it("uses ALTG Treasury ledger cash for company portfolio", async () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const client = getUiLabDemonstrationClient(UI_LAB_MOCK_USER.id);
    const portfolio = await client.getPortfolio(ids.companyAltg);
    const preview = previewUiLabCryptoOrder(
      {
        portfolioId: ids.companyAltg,
        symbol: "NPFC",
        side: "BUY",
        grossFlorins: "100",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.preview.currentTerminalCash, portfolio.buyingPower.toFixed(2));
    assert.ok(Number(preview.preview.currentTerminalCash) > 50_000);
  });

  it("rejects buys when portfolio has insufficient cash", async () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const client = getUiLabDemonstrationClient(UI_LAB_MOCK_USER.id);
    await client.ensurePortfolioMarketState(`${ids.personalCore}_broke`, "empty");
    // Empty seed still has FIXTURE_EMPTY_CASH; force zero for this case.
    client.setAvailableCash(`${ids.personalCore}_broke`, 0);
    const preview = previewUiLabCryptoOrder(
      {
        portfolioId: `${ids.personalCore}_broke`,
        symbol: "NPFC",
        side: "BUY",
        grossFlorins: "100",
      },
      { userKey: UI_LAB_MOCK_USER.id },
    );
    assert.equal(preview.ok, false);
    if (preview.ok) return;
    assert.equal(preview.code, "INSUFFICIENT_CASH");
  });
});

describe("crypto status presentation consistency", () => {
  it("customer and ops share Active · Demonstration for healthy UI Lab assets", () => {
    const customer = listUiLabCryptoAssets({ userKey: UI_LAB_MOCK_USER.id });
    const desk = getUiLabCryptoOpsDeskSummary("active_healthy");
    for (const symbol of ["NPFC", "NVA", "VLT"] as const) {
      const c = customer.find((a) => a.symbol === symbol);
      const o = desk.assets.find((a) => a.symbol === symbol);
      assert.ok(c);
      assert.ok(o);
      assert.equal(o!.status, "ACTIVE");
      assert.equal(c!.status, "ACTIVE");
      const presentedCustomer = presentCryptoAssetStatus({
        status: "ACTIVE",
        surface: "customer",
        uiLab: true,
      });
      const presentedOps = presentCryptoAssetStatus({
        status: "ACTIVE",
        surface: "ops",
        uiLab: true,
      });
      assert.equal(presentedCustomer.statusLabel, presentedOps.statusLabel);
      assert.match(presentedCustomer.statusLabel, /Demonstration/);
      assert.equal(c!.statusLabel, presentedCustomer.statusLabel);
    }
  });
});

describe("Terminal Inbox crypto attention", () => {
  it("healthy scenario has no crypto integrity attention items", () => {
    const attention = getUiLabTerminalAttention({ cryptoOpsScenario: "active_healthy" });
    assert.equal(
      attention.filter((a) => a.kind.startsWith("crypto_")).length,
      0,
    );
  });

  it("warning scenario emits crypto attention", () => {
    const attention = getUiLabTerminalAttention({ cryptoOpsScenario: "halted" });
    assert.ok(attention.some((a) => a.kind === "crypto_lifecycle" && a.symbol === "NVA"));
  });

  it("critical scenario emits reconciliation attention", () => {
    const attention = getUiLabTerminalAttention({ cryptoOpsScenario: "undercollateralized" });
    assert.ok(
      attention.some((a) => a.kind === "crypto_reconciliation" && a.symbol === "NVA"),
    );
  });
});

describe("Quick Trade crypto change formatting", () => {
  it("formats VLT small negative change without -ƒ0.00", () => {
    const text = formatCryptoChangeAmount(-0.002, "VLT", { signed: true });
    assert.doesNotMatch(text, /-ƒ0\.00$/);
    assert.match(text, /0\.002/);
  });

  it("formats NPFC money amounts at 2 dp", async () => {
    const { formatCryptoMoney } = await import("@/lib/terminal/crypto/crypto-format");
    assert.match(formatCryptoMoney(1, { signed: true }), /ƒ1\.00/);
  });
});

describe("crypto holdings total return semantics", () => {
  it("exposes totalReturn distinct from day-change fixtures", () => {
    const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    const summary = getUiLabPortfolioCrypto({
      portfolioId: ids.personalCore,
      userKey: UI_LAB_MOCK_USER.id,
    });
    const vlt = summary.balances.find((b) => b.symbol === "VLT");
    assert.ok(vlt);
    assert.ok(vlt!.totalReturn != null);
    // Avg cost 0.11 vs mark ~0.10 → negative total return, not day change -1.96 alone.
    assert.notEqual(vlt!.totalReturnPercent, "-1.96");
  });
});

describe("customer security page wallet ID exposure", () => {
  it("does not render raw acw_ wallet ids in the primary holding summary", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/routes/terminal/security/$symbol.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /Wallet · \{data\.walletPublicId\}/);
  });
});
