import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFixtureSecurity } from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";
import {
  canReviewQuickTrade,
  getQuickTradeReviewErrors,
  requireExplicitPortfolioId,
  resetQuickTradeFields,
} from "@/lib/terminal/quick-trade";

const root = join(process.cwd(), "src");

describe("Home Quick Trade entry points", () => {
  it("Trade opens Quick Trade while View markets still routes to Markets", () => {
    const home = readFileSync(join(root, "routes/terminal/index.tsx"), "utf8");
    assert.match(home, /QuickTradeDialog/);
    assert.match(home, /setQuickTradeOpen\(true\)/);
    assert.match(home, />\s*Trade\s*</);
    assert.match(home, /label="View markets"/);
    assert.match(home, /href="\/terminal\/markets"/);
    // Trade is no longer a markets link
    assert.doesNotMatch(
      home,
      /QuickAction href="\/terminal\/markets" label="Trade"/,
    );
    assert.match(home, /initialPortfolios=\{portfolios\}/);
    assert.match(home, /tradeButtonRef/);
    assert.match(home, /onCloseAutoFocus/);
    // Home Trade stays usable when TSE is offline (crypto remains tradeable).
    assert.doesNotMatch(home, /disabled=\{mode === "unavailable"\}/);
    assert.match(home, /Alta crypto trading stays open/);
  });
});

describe("Quick Trade architecture contracts", () => {
  it("ships a reusable dialog with optional initialSymbol and shared order ticket", () => {
    const dialog = readFileSync(
      join(root, "components/terminal/quick-trade-dialog.tsx"),
      "utf8",
    );
    assert.match(dialog, /export function QuickTradeDialog/);
    assert.match(dialog, /initialSymbol\?/);
    assert.match(dialog, /OrderTicket/);
    assert.match(dialog, /previewTerminalOrder|suppressInlineSuccess/);
    assert.match(dialog, /SecurityPortfolioDropdown/);
    assert.doesNotMatch(dialog, /<SecurityPortfolioPicker/);
    assert.match(dialog, /SymbolAutocomplete/);
    assert.match(dialog, /fetchQuickTradeContext/);
    assert.match(dialog, /closeThenRun/);
    assert.match(dialog, /data-\[state=closed\]:pointer-events-none/);
    assert.match(dialog, /max-lg:bottom-\[calc\(3\.25rem\+env\(safe-area-inset-bottom/);
    assert.doesNotMatch(dialog, /useMediaQueryMax/);
    assert.match(dialog, /Trade again/);
    assert.match(dialog, /View order/);
    assert.match(dialog, /Done/);
    assert.match(dialog, /pathname !== openPathRef/);
    // TSE offline must not hard-block crypto Quick Trade.
    assert.doesNotMatch(
      dialog,
      /mode === "unavailable" && ctx \?/,
    );
    assert.match(dialog, /Stock trading is offline|Stock trading unavailable/);
    assert.match(dialog, /NPFC, NVA, or VLT/);
  });

  it("reuses server preview/submit paths from the order ticket", () => {
    const ticket = readFileSync(join(root, "components/terminal/order-ticket.tsx"), "utf8");
    assert.match(ticket, /previewTerminalOrder/);
    assert.match(ticket, /submitTerminalOrder/);
    assert.match(ticket, /requireExplicitPortfolioId/);
    assert.match(ticket, /validateOrderPreview/);
    assert.match(ticket, /reviewBlocked/);
    assert.match(ticket, /suppressInlineSuccess/);
    assert.match(ticket, /Buying power/);
    assert.match(ticket, /Shares held/);
  });

  it("exposes a lean quick-trade context server function", () => {
    const fns = readFileSync(join(root, "lib/terminal/terminal.functions.ts"), "utf8");
    assert.match(fns, /export const fetchQuickTradeContext/);
    assert.match(fns, /rememberSelectedTerminalPortfolio/);
    assert.match(fns, /resolveTerminalPortfolioId/);
  });
});

describe("Quick Trade field helpers", () => {
  const security = getFixtureSecurity("ALTA")!;
  const portfolioId = "tp_test_core";

  it("requires an explicit portfolioId for preview/submit payloads", () => {
    assert.equal(requireExplicitPortfolioId(" tp_abc "), "tp_abc");
    assert.throws(() => requireExplicitPortfolioId(null), /Portfolio is required/);
    assert.throws(() => requireExplicitPortfolioId(""), /Portfolio is required/);
    assert.throws(() => requireExplicitPortfolioId("   "), /Portfolio is required/);
  });

  it("Trade another resets trade fields while callers preserve portfolio", () => {
    const reset = resetQuickTradeFields({ lastPrice: 12.5 });
    assert.equal(reset.symbol, null);
    assert.equal(reset.side, "buy");
    assert.equal(reset.type, "market");
    assert.equal(reset.quantity, "1");
    assert.equal(reset.limitPrice, "12.5");
  });

  it("shows limit-price validation only for limit orders", () => {
    const marketErrors = getQuickTradeReviewErrors({
      portfolioId,
      security,
      marketStatus: "open",
      buyingPower: 50_000,
      holding: null,
      side: "buy",
      type: "market",
      quantity: "1",
      limitPrice: "",
      canTradeSelected: true,
    });
    assert.equal(canReviewQuickTrade(marketErrors), true);

    const limitErrors = getQuickTradeReviewErrors({
      portfolioId,
      security,
      marketStatus: "open",
      buyingPower: 50_000,
      holding: null,
      side: "buy",
      type: "limit",
      quantity: "1",
      limitPrice: "",
      canTradeSelected: true,
    });
    assert.equal(canReviewQuickTrade(limitErrors), false);
    assert.ok(limitErrors.some((e) => /limit price/i.test(e)));
  });

  it("validates whole shares, buying power, and owned shares", () => {
    const fractional = getQuickTradeReviewErrors({
      portfolioId,
      security,
      marketStatus: "open",
      buyingPower: 50_000,
      holding: null,
      side: "buy",
      type: "market",
      quantity: "1.5",
      limitPrice: "",
      canTradeSelected: true,
    });
    assert.ok(fractional.some((e) => /whole number/i.test(e)));

    const poor = getQuickTradeReviewErrors({
      portfolioId,
      security,
      marketStatus: "open",
      buyingPower: 1,
      holding: null,
      side: "buy",
      type: "market",
      quantity: "100",
      limitPrice: "",
      canTradeSelected: true,
    });
    assert.ok(poor.some((e) => /buying power/i.test(e)));

    const sell = getQuickTradeReviewErrors({
      portfolioId,
      security,
      marketStatus: "open",
      buyingPower: 50_000,
      holding: {
        symbol: security.symbol,
        name: security.name,
        quantity: 1,
        averageCost: 1,
        lastPrice: security.lastPrice,
        marketValue: security.lastPrice,
        totalReturn: 0,
        totalReturnPercent: 0,
        dayReturn: 0,
        dayReturnPercent: 0,
        weightPercent: 0,
        sparkline: [],
      },
      side: "sell",
      type: "market",
      quantity: "5",
      limitPrice: "",
      canTradeSelected: true,
    });
    assert.ok(sell.some((e) => /enough shares/i.test(e)));
  });

  it("blocks review without portfolio or security and when trading is unavailable", () => {
    assert.deepEqual(
      getQuickTradeReviewErrors({
        portfolioId: null,
        security: null,
        marketStatus: "open",
        buyingPower: 0,
        holding: null,
        side: "buy",
        type: "market",
        quantity: "1",
        limitPrice: "",
        canTradeSelected: true,
      }),
      ["Select a portfolio"],
    );
    assert.deepEqual(
      getQuickTradeReviewErrors({
        portfolioId,
        security: null,
        marketStatus: "open",
        buyingPower: 10_000,
        holding: null,
        side: "buy",
        type: "market",
        quantity: "1",
        limitPrice: "",
        canTradeSelected: true,
      }),
      ["Select a security"],
    );
    assert.deepEqual(
      getQuickTradeReviewErrors({
        portfolioId,
        security,
        marketStatus: "open",
        buyingPower: 10_000,
        holding: null,
        side: "buy",
        type: "market",
        quantity: "1",
        limitPrice: "",
        canTradeSelected: true,
        modeUnavailable: true,
      }),
      ["Market connection unavailable"],
    );
  });
  it("always renders order fields before a ticker is selected", () => {
    const dialog = readFileSync(
      join(root, "components/terminal/quick-trade-dialog.tsx"),
      "utf8",
    );
    const ticket = readFileSync(join(root, "components/terminal/order-ticket.tsx"), "utf8");
    const fns = readFileSync(join(root, "lib/terminal/terminal.functions.ts"), "utf8");
    assert.match(ticket, /security: SecurityDetail \| null/);
    assert.match(ticket, /Select a security to review an order/);
    assert.doesNotMatch(dialog, /Search and select a ticker to continue/);
    // OrderTicket is mounted unconditionally in the form phase (not gated on security && ctx)
    assert.match(dialog, /<OrderTicket[\s\S]*security=\{security\}/);
    assert.match(dialog, /initialPortfolios/);
    assert.match(dialog, /skipFetchForHydratedPortfolioRef/);
    assert.match(fns, /basePortfolios/);
    assert.doesNotMatch(
      fns.slice(fns.indexOf("fetchQuickTradeContext")),
      /enrichSecurityPortfolioOptions/,
    );
    assert.match(ticket, /confirmPresentation/);
    assert.match(ticket, /"inline"/);
    assert.match(dialog, /confirmPresentation="inline"/);
    assert.match(dialog, /setReviewing/);
  });
});

describe("symbol autocomplete keyboard contract", () => {
  it("rejects unknown tickers and supports listbox keyboard attributes", () => {
    const auto = readFileSync(
      join(root, "components/terminal/symbol-autocomplete.tsx"),
      "utf8",
    );
    assert.match(auto, /role="combobox"/);
    assert.match(auto, /ArrowDown/);
    assert.match(auto, /ArrowUp/);
    assert.match(auto, /Unknown ticker/);
    assert.match(auto, /row\.symbol/);
    assert.match(auto, /row\.name/);
  });
});
