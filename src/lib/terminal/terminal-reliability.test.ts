import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeThenRun } from "@/lib/ui/close-then-run";
import {
  FIXTURE_PROFILES,
  applyFixtureLedger,
  assertChartSeriesHealthy,
  assertLedgerReconciles,
  buildSnapshotFromLedger,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-fixture-ledger";
import { UiLabDemonstrationTseClient } from "@/lib/terminal/ui-lab/ui-lab-demonstration-tse-client";
import { mockPortfolioIds } from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";
import { filterOrders } from "@/lib/terminal/market-filters";
import { companiesFromUiLabUser } from "@/lib/auth/ui-lab-fixtures";
import { UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { getEcosystemSwitcherLinks } from "@/lib/site/ecosystem-config";
import { getFooterEcosystemLinks } from "@/lib/site/site-links";

const root = join(process.cwd(), "src");

describe("closeThenRun", () => {
  it("closes before running the action", async () => {
    const order: string[] = [];
    closeThenRun(
      () => order.push("close"),
      () => order.push("action"),
    );
    assert.deepEqual(order, ["close"]);
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }
      queueMicrotask(() => resolve());
    });
    assert.deepEqual(order, ["close", "action"]);
  });
});

describe("create portfolio ownership UX contracts", () => {
  it("PortfolioSwitcher does not navigate when onCreated is provided", () => {
    const source = readFileSync(
      join(root, "components/terminal/portfolio-switcher.tsx"),
      "utf8",
    );
    assert.match(source, /Parent owns navigation when onCreated is provided/);
    assert.match(source, /Creating…/);
    assert.match(source, /submitGuard/);
    assert.match(source, /shouldResetRef/);
    assert.match(source, /if \(busy && !next\) return/);
  });

  it("Orders route owns search navigation only via onCreated", () => {
    const orders = readFileSync(join(root, "routes/terminal/orders.tsx"), "utf8");
    assert.match(orders, /onCreated=\{\(p\) => updateSearch\(\{ portfolioId: p\.id \}\)\}/);
    assert.match(orders, /validateSearch/);
    assert.match(orders, /status: parseStatus/);
    assert.match(orders, /side: parseSide/);
    assert.match(orders, /updateSearch\(\{ portfolioId: id \}\)/);
    assert.doesNotMatch(orders, /replace:\s*true/);
  });
});

describe("UI Lab demonstration ledger integrity", () => {
  it("fixture profiles reconcile cash and charts", () => {
    for (const key of Object.keys(FIXTURE_PROFILES) as Array<keyof typeof FIXTURE_PROFILES>) {
      const portfolioId = `tp_test_${key}`;
      const applied = applyFixtureLedger(portfolioId, FIXTURE_PROFILES[key]);
      assertLedgerReconciles(applied);
      const snap = buildSnapshotFromLedger(portfolioId, applied, FIXTURE_PROFILES[key]);
      assert.equal(snap.valuationAvailable, true);
      assert.ok(snap.totalValue != null);
      assertChartSeriesHealthy(snap.seriesByRange["1D"]!, {
        endValue: snap.totalValue ?? undefined,
        maxSingleStepRatio: 0.35,
      });
    }
  });

  it("demonstration client keeps users distinct", async () => {
    const client = new UiLabDemonstrationTseClient({ userId: "distinct-user" });
    const ids = mockPortfolioIds("distinct-user");
    const snap = await client.getPortfolio(ids.personalCore);
    assert.ok((snap.totalValue ?? 0) > 0);
    assert.equal(client.mode, "mock");
  });

  it("order status filtering works on demonstration orders", async () => {
    const client = new UiLabDemonstrationTseClient({ userId: "order-status-user" });
    const ids = mockPortfolioIds("order-status-user");
    const orders = await client.listOrders(ids.personalCore);
    assert.ok(filterOrders(orders, { status: "open" }).every((o) => o.status === "open"));
  });
});

describe("navigation menu closure helpers", () => {
  it("ecosystem and account menus use controlled open state", () => {
    const eco = readFileSync(join(root, "components/site/ecosystem-switcher.tsx"), "utf8");
    assert.match(eco, /open=\{menu\.open\}/);
    const menu = readFileSync(join(root, "components/auth/user-menu.tsx"), "utf8");
    assert.match(menu, /open=\{/);
  });
});

describe("cross-site links remain consistent", () => {
  it("UI Lab companies and footers keep terminal paths", () => {
    const companies = companiesFromUiLabUser(UI_LAB_MOCK_USER);
    assert.ok(companies.length > 0);
    assert.match(resolveEntitySiteUrl("terminal"), /terminal/);
    assert.ok(getEcosystemSwitcherLinks("terminal").length > 0);
    assert.ok(getFooterEcosystemLinks("terminal").length > 0);
  });
});

describe("runtime mock removal contracts", () => {
  it("portfolio service has no memory fixture seed or TERMINAL_PORTFOLIO_STORE", () => {
    const src = readFileSync(join(root, "lib/terminal/terminal-portfolio.service.ts"), "utf8");
    assert.doesNotMatch(src, /TERMINAL_PORTFOLIO_STORE/);
    assert.doesNotMatch(src, /seedMemoryStore|memoryByUser|mockPortfolioIds/);
    assert.doesNotMatch(src, /ensureDbDefaults/);
    assert.match(src, /TerminalPersistenceUnavailableError/);
  });

  it("tse-client never constructs MockTseClient", () => {
    const src = readFileSync(join(root, "lib/terminal/tse-client.ts"), "utf8");
    assert.doesNotMatch(src, /MockTseClient/);
    assert.doesNotMatch(src, /mock-tse-client/);
    assert.match(src, /UnavailableTseClient/);
  });

  it("bank bridge still gates UI Lab", () => {
    const bank = readFileSync(join(root, "lib/bank/bank.functions.ts"), "utf8");
    assert.match(bank, /isUiLabMode\(\)/);
  });
});

describe("schema migration presence", () => {
  it("ships forward-only persistent foundation migration", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260730160000_terminal_persistent_foundation/migration.sql",
      ),
      "utf8",
    );
    assert.match(sql, /TerminalPortfolioCashAccount/);
    assert.match(sql, /TerminalCashLedgerEntry/);
    assert.match(sql, /TerminalPosition/);
    assert.match(sql, /TerminalOrder/);
    assert.match(sql, /TerminalOrderFill/);
    assert.match(sql, /TerminalPortfolioActivity/);
    assert.match(sql, /TerminalWatchlist/);
    assert.match(sql, /INSERT INTO "TerminalPortfolioCashAccount"/);
    assert.doesNotMatch(sql, /DROP TABLE "TerminalPortfolio"/);
  });
});
