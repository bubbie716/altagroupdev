import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  availableOrderActions,
  buildOrderLifecycle,
  orderNeedsAttention,
  plainOrderStatusLabel,
} from "@/lib/terminal/terminal-ops-types";
import {
  investorPortfolioCountLabel,
  investorTypeLabel,
  orderFillProgressLabel,
  sortInvestorsForDirectory,
  sortOrdersForDirectory,
  sortPortfoliosForDirectory,
  terminalReadinessLabel,
} from "@/lib/terminal/terminal-desk";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  getUiLabTerminalAttention,
  getUiLabTerminalInvestors,
  getUiLabTerminalOrders,
  getUiLabTerminalPortfolios,
  searchUiLabTerminalOps,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures";
import { getTerminalOpsSystemStatus } from "@/lib/terminal/terminal-ops-admin.service";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 7 Terminal shell and Home", () => {
  it("labels Terminal as Operations console, not Maintenance", () => {
    const sidebar = read("components/internal/console/internal-sidebar.tsx");
    const mobile = read("components/internal/console/internal-mobile-nav.tsx");
    assert.match(sidebar, /Operations console/);
    assert.match(mobile, /Operations console/);
    assert.match(sidebar, /site\.key === "terminal"[\s\S]*Operations console/);
    assert.doesNotMatch(
      sidebar.replace(/site\.key === "exchange"[\s\S]*?Maintenance console/, ""),
      /site\.key === "terminal"[\s\S]*Maintenance console/,
    );
  });

  it("keeps Terminal Home compact with environment banner and directories", () => {
    const home = read("components/internal/terminal-internal-home.tsx");
    assert.match(home, /TerminalEnvironmentBanner/);
    assert.match(home, /compact/);
    assert.match(home, /Needs attention/);
    assert.match(home, /Operations snapshot/);
    assert.match(home, /to="\/internal\/terminal\/investors"/);
    assert.match(home, /to="\/internal\/terminal\/portfolios"/);
    assert.match(home, /to="\/internal\/terminal\/orders"/);
    assert.match(home, /View System/);
    assert.match(home, /uniqueAttention|new Map\(attention/);
    assert.doesNotMatch(home, /Unavailable/);
  });

  it("deduplicates attention items by id in fixtures", () => {
    const attention = getUiLabTerminalAttention();
    const ids = attention.map((a) => a.id);
    assert.equal(ids.length, new Set(ids).size);
    assert.ok(attention.some((a) => a.kind === "rejected_order"));
    assert.ok(attention.some((a) => /restricted/i.test(a.title)));
  });
});

describe("Phase 7 Terminal directories", () => {
  it("uses Review CTAs and omits generic Open", () => {
    for (const rel of [
      "routes/internal/terminal/investors/index.tsx",
      "routes/internal/terminal/portfolios/index.tsx",
      "routes/internal/terminal/orders/index.tsx",
      "routes/internal/terminal/inbox.tsx",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, />\s*Open\s*</);
      assert.doesNotMatch(src, /["']Open["']/);
    }
    assert.match(read("routes/internal/terminal/investors/index.tsx"), /Review investor/);
    assert.match(read("routes/internal/terminal/portfolios/index.tsx"), /Review portfolio/);
    assert.match(read("routes/internal/terminal/orders/index.tsx"), /Review order/);
  });

  it("omits repeated Unavailable portfolio value cells when data is untrustworthy", () => {
    const src = read("routes/internal/terminal/portfolios/index.tsx");
    assert.match(src, /anyTrustworthy/);
    assert.match(src, /Financial values[\s\S]*unavailable/);
    assert.doesNotMatch(src, /Value: Unavailable|Cash: Unavailable/);
    assert.doesNotMatch(src, />Unavailable</);
  });

  it("humanizes investor type and portfolio counts", () => {
    assert.equal(investorTypeLabel("individual"), "Individual");
    assert.equal(investorTypeLabel("company"), "Company");
    const row = getUiLabTerminalInvestors()[0]!;
    assert.match(investorPortfolioCountLabel(row), /active/);
    assert.doesNotMatch(investorPortfolioCountLabel(row), /\d+ \/ \d+/);
  });

  it("sorts attention-first for investors, portfolios, and orders", () => {
    const investors = sortInvestorsForDirectory(getUiLabTerminalInvestors());
    assert.equal(investors[0]?.accessStatus, "restricted");
    const orders = sortOrdersForDirectory(getUiLabTerminalOrders());
    assert.equal(orders[0]?.status, "rejected");
    const portfolios = sortPortfoliosForDirectory([
      ...getUiLabTerminalPortfolios().map((p, i) =>
        i === 0 ? { ...p, needsAttention: true, attentionDetail: "x" } : p,
      ),
    ]);
    assert.equal(portfolios[0]?.needsAttention, true);
  });

  it("formats fill progress as N of M filled", () => {
    const partial = getUiLabTerminalOrders().find((o) => o.status === "partial")!;
    assert.equal(orderFillProgressLabel(partial), "35 of 100 filled");
    const open = getUiLabTerminalOrders().find((o) => o.status === "open")!;
    assert.equal(orderFillProgressLabel(open), "0 of 40 filled");
  });

  it("paginates Terminal directories with Show more", () => {
    for (const rel of [
      "routes/internal/terminal/investors/index.tsx",
      "routes/internal/terminal/portfolios/index.tsx",
      "routes/internal/terminal/orders/index.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /TERMINAL_LIST_PAGE_SIZE/);
      assert.match(src, /Show more/);
    }
  });
});

describe("Phase 7 Terminal records", () => {
  it("omits portfolio Actions when no mutable controls exist", () => {
    const portfolio = read("components/internal/workspace/terminal-portfolio-workspace-view.tsx");
    assert.doesNotMatch(portfolio, /RecordActionsSheet/);
    assert.doesNotMatch(portfolio, /headerActions=\{/);
    assert.match(portfolio, /Market and cash figures are unavailable/);
    assert.doesNotMatch(portfolio, /moneyOrUnavailable|>Unavailable</);
  });

  it("omits order Actions unless cancellation is genuinely available", () => {
    const order = read("components/internal/workspace/terminal-order-workspace-view.tsx");
    assert.match(order, /canCancel/);
    assert.match(order, /headerActions = canCancel/);
    assert.doesNotMatch(order, /Unavailable in UI Lab/);
    assert.match(order, /Failure reason/);
    assert.match(order, /ordersMutable/);
  });

  it("gates cancel by status and mutability", () => {
    const rejected = getUiLabTerminalOrders().find((o) => o.status === "rejected")!;
    const open = getUiLabTerminalOrders().find((o) => o.status === "open")!;
    assert.deepEqual(availableOrderActions(rejected, true), []);
    assert.deepEqual(availableOrderActions(open, true), ["cancel"]);
    assert.deepEqual(availableOrderActions(open, false), []);
    assert.ok(orderNeedsAttention(rejected));
    assert.equal(plainOrderStatusLabel("partial"), "Partially filled");
    assert.ok(buildOrderLifecycle(rejected).some((s) => s.id === "rejected"));
  });

  it("marks mock and unavailable environments as non-mutable", () => {
    const env = resolveTerminalOpsEnvironmentStatus();
    if (env.connectionState === "mock" || env.connectionState === "unavailable") {
      assert.equal(env.ordersMutable, false);
      assert.equal(env.marketDataTrustworthy, false);
    }
  });
});

describe("Phase 7 Terminal search and System", () => {
  it("indexes investors, companies, portfolios, and orders in UI Lab Terminal search", () => {
    const bySymbol = searchUiLabTerminalOps("NPT");
    assert.ok(bySymbol.some((r) => r.type === "terminal_order"));
    assert.ok(
      bySymbol.every((r) => r.type !== "account" && r.type !== "alta_card" && r.type !== "loan"),
    );

    const byPortfolio = searchUiLabTerminalOps("Core Portfolio");
    assert.ok(byPortfolio.some((r) => r.type === "terminal_portfolio"));

    const byInvestor = searchUiLabTerminalOps("carter");
    assert.ok(byInvestor.some((r) => r.type === "user" || r.type === "terminal_order"));

    const byCompany = searchUiLabTerminalOps("Alta Group");
    assert.ok(byCompany.some((r) => r.type === "company" || r.type === "terminal_portfolio"));
  });

  it("excludes Bank product types from Terminal search wiring", () => {
    const searchFn = read("lib/internal/ops-platform.functions.ts");
    assert.match(searchFn, /searchUiLabTerminalOps/);
    const service = read("server/ops-global-search.service.ts");
    assert.match(service, /terminalOnly/);
    assert.match(service, /terminal_portfolio/);
    assert.match(service, /Bank products are intentionally excluded/);
    assert.doesNotMatch(
      service.slice(service.indexOf("if (terminalOnly)"), service.indexOf("const [")),
      /bankAccount/,
    );
  });

  it("collapses System into connection, readiness checklist, and configuration", async () => {
    const system = read("routes/internal/terminal/system.tsx");
    assert.match(system, /Connection/);
    assert.match(system, /Readiness/);
    assert.match(system, /TSE adapter/);
    assert.match(system, /Database/);
    assert.match(system, /Newport \/ live market data/);
    assert.match(system, /TSE order execution/);
    assert.match(system, /TSE portfolio sync/);
    assert.match(system, /Crypto reconciliation/);
    assert.match(system, /TSE pooled-custody reconciliation/);
    assert.match(system, /Crypto markets/);
    assert.match(system, /Blocked by Newport\/TSE/);
    assert.match(system, /terminalReadinessLabel/);
    assert.match(system, /Technical details/);
    // TSE sync / pooled-custody recon remain blocked; crypto desk is separate.
    assert.match(system, /blocked_by_newport/);
    assert.doesNotMatch(system, /Fully reconciled/);
    assert.doesNotMatch(system, /Schedule recurring/);
    const status = await getTerminalOpsSystemStatus();
    assert.equal(status.synchronization.available, false);
    assert.equal(status.reconciliation.available, false);
    assert.equal(status.jobs.available, true);
    assert.equal(status.recurringTrades.available, true);
    assert.ok(status.cryptoReconciliation);
    assert.equal(status.newportLiveMarket.available, false);
    assert.equal(terminalReadinessLabel("not_implemented"), "Not implemented");
    assert.equal(terminalReadinessLabel("ready"), "Available now");
  });

  it("keeps Terminal Settings scoped to Terminal maintenance only", () => {
    const settings = read("routes/internal/terminal/settings.tsx");
    assert.match(settings, /maintenanceScopesForInternalSettings\("terminal"\)/);
    assert.match(settings, /showCreditDesk=\{false\}/);
    assert.match(settings, /showCommercialPlans=\{false\}/);
    assert.match(settings, /section="maintenance"/);
    assert.match(settings, /sectionBasePath="\/internal\/terminal\/settings"/);
    const platform = read("components/internal/internal-platform-settings-sections.tsx");
    assert.match(platform, /tabs\.length > 1/);
    assert.match(platform, /showCreditDesk/);
  });

  it("labels global search result types for portfolios and orders", () => {
    const searchUi = read("components/internal/internal-global-search.tsx");
    assert.match(searchUi, /terminal_portfolio: "Portfolio"/);
    assert.match(searchUi, /terminal_order: "Order"/);
    assert.match(searchUi, /Search investors, portfolios, orders/);
  });
});
