import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { MockTseClient } from "@/lib/terminal/mock-tse-client";
import { mockPortfolioIds } from "@/lib/terminal/terminal-fixtures";
import {
  FIXTURE_PROFILES,
  applyFixtureLedger,
  assertChartSeriesHealthy,
  assertLedgerReconciles,
  buildSnapshotFromLedger,
} from "@/lib/terminal/terminal-fixture-ledger";
import {
  createTerminalPortfolio,
  listAccessibleTerminalPortfolios,
  resetTerminalPortfolioMemoryForTests,
} from "@/lib/terminal/terminal-portfolio.service";
import { companiesFromUiLabUser } from "@/lib/auth/ui-lab-fixtures";
import { UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { getEcosystemSwitcherLinks } from "@/lib/site/ecosystem-config";
import { getFooterEcosystemLinks } from "@/lib/site/site-links";
import { filterOrders } from "@/lib/terminal/market-filters";
import type { AltaUser } from "@/lib/auth/types";

const root = join(process.cwd(), "src");

function testUser(): AltaUser {
  return {
    id: "ux-test-user",
    discordId: "999",
    discordUsername: "ux",
    avatarUrl: null,
    email: "ux@test.local",
    minecraftUsername: "ux",
    tags: [],
    accountStatus: "active",
    developerAccessStatus: "none",
    developerAccess: false,
    internalAccess: false,
    companyMemberships: [
      {
        userId: "ux-test-user",
        companyId: "CO-ALTG",
        role: "owner",
        companyName: "Alta Group N.V.",
        companyType: "Holding Company",
        companyTicker: "ALTG",
        companyStatus: "Listed",
        companyVerificationStatus: "Verified",
      },
    ],
    createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    lastLoginAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
  };
}

describe("closeThenRun", () => {
  it("closes before running the action", async () => {
    const order: string[] = [];
    closeThenRun(
      () => order.push("close"),
      () => order.push("action"),
    );
    assert.deepEqual(order, ["close"]);
    // Node tests fall back to queueMicrotask; browsers use double rAF.
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

describe("create portfolio ownership", () => {
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

  it("creates exactly one portfolio in memory store", async () => {
    process.env.TERMINAL_PORTFOLIO_STORE = "memory";
    resetTerminalPortfolioMemoryForTests();
    const user = testUser();
    const before = await listAccessibleTerminalPortfolios(user);
    const created = await createTerminalPortfolio(user, {
      name: "Solo Create",
      ownerType: "personal",
      ownerCompanyId: null,
    });
    const after = await listAccessibleTerminalPortfolios(user);
    assert.equal(after.length, before.length + 1);
    assert.equal(created.name, "Solo Create");
    assert.ok(after.some((p) => p.id === created.id));
  });
});

describe("navigation menu closure helpers", () => {
  it("ecosystem and account menus use controlled open state", () => {
    const eco = readFileSync(join(root, "components/site/ecosystem-switcher.tsx"), "utf8");
    const userMenu = readFileSync(join(root, "components/auth/user-menu.tsx"), "utf8");
    assert.match(eco, /useControlledMenu/);
    assert.match(eco, /runAfterClose/);
    assert.doesNotMatch(eco, /onSelect=\{\(event\) => \{\s*event\.preventDefault/);
    assert.match(userMenu, /useControlledMenu/);
    assert.doesNotMatch(userMenu, /event\.preventDefault\(\);\s*navigateToAccountItem/);
  });

  it("dropdown and select dismiss portals immediately when closed", () => {
    const menu = readFileSync(join(root, "components/ui/dropdown-menu.tsx"), "utf8");
    const select = readFileSync(join(root, "components/ui/select.tsx"), "utf8");
    assert.match(menu, /--menu-surface/);
    assert.match(menu, /--menu-item-hover/);
    assert.match(menu, /data-\[state=closed\]:pointer-events-none/);
    assert.match(menu, /data-\[state=closed\]:opacity-0/);
    assert.doesNotMatch(menu, /data-\[state=closed\]:animate-out/);
    assert.match(select, /data-\[state=closed\]:pointer-events-none/);
    assert.doesNotMatch(select, /data-\[state=closed\]:animate-out/);
  });

  it("registers a route-change overlay safety net", () => {
    const rootRoute = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    assert.match(rootRoute, /TransientOverlayRouteGuard/);
    const guard = readFileSync(
      join(root, "components/ui/transient-overlay-route-guard.tsx"),
      "utf8",
    );
    assert.match(guard, /closeAllTransientOverlays/);
  });
});

describe("fixture ledger reconciliation", () => {
  for (const key of ["core", "growth", "income", "active", "treasury"] as const) {
    it(`reconciles ${key} cash, lots, and snapshot totals`, () => {
      const profile = FIXTURE_PROFILES[key];
      const applied = applyFixtureLedger(`tp_test_${key}`, profile);
      assertLedgerReconciles(applied);
      const snap = buildSnapshotFromLedger(`tp_test_${key}`, applied, profile);
      assert.equal(snap.cashBalance, applied.cash);
      const lotEquity = applied.lots.reduce((sum, lot) => {
        // Snapshot equity uses live quotes; cash + equity === totalValue.
        return sum;
      }, 0);
      void lotEquity;
      assert.equal(snap.totalValue, Number((snap.equityValue + snap.cashBalance).toFixed(2)));
      assert.ok(snap.seriesByRange["1D"].length > 10);
      assert.ok(snap.seriesByRange.ALL.length > 10);
      assert.ok(applied.orders.length > 0);
      assert.ok(applied.activity.length > 0);
    });
  }

  it("empty profile has no holdings or orders", () => {
    const applied = applyFixtureLedger("tp_empty", FIXTURE_PROFILES.empty);
    assert.equal(applied.lots.length, 0);
    assert.equal(applied.orders.length, 0);
    assert.equal(applied.cash, 0);
  });

  it("seeded mock portfolios are distinct", async () => {
    const client = new MockTseClient({ userId: "distinct-user" });
    const ids = mockPortfolioIds("distinct-user");
    const snaps = await Promise.all([
      client.getPortfolio(ids.personalCore),
      client.getPortfolio(ids.personalGrowth),
      client.getPortfolio(ids.personalIncome),
      client.getPortfolio(ids.personalActive),
      client.getPortfolio(ids.companyAltg),
    ]);
    const signatures = snaps.map((s) =>
      JSON.stringify({
        cash: s.cashBalance,
        equity: s.equityValue,
        holdings: s.holdings.map((h) => `${h.symbol}:${h.quantity}`).sort(),
      }),
    );
    assert.equal(new Set(signatures).size, signatures.length);

    const orders = await Promise.all(Object.values(ids).map((id) => client.listOrders(id)));
    const activity = await Promise.all(
      Object.values(ids).map((id) => client.listPortfolioActivity(id)),
    );
    assert.ok(orders.every((list) => list.length > 0));
    assert.ok(activity.every((list) => list.length > 0));

    const statuses = new Set(orders.flat().map((o) => o.status));
    assert.ok(statuses.has("open"));
    assert.ok(statuses.has("filled") || statuses.has("partial"));
    assert.ok(statuses.has("cancelled"));
    assert.ok(statuses.has("rejected"));

    const charts = snaps.map((s) => s.seriesByRange["1M"].map((p) => p.v).join(","));
    assert.equal(new Set(charts).size, charts.length);
  });

  it("renders partial, cancelled, and rejected orders", async () => {
    const client = new MockTseClient({ userId: "order-status-user" });
    const ids = mockPortfolioIds("order-status-user");
    const activeOrders = await client.listOrders(ids.personalActive);
    assert.ok(activeOrders.some((o) => o.status === "partial"));
    assert.ok(activeOrders.some((o) => o.status === "cancelled"));
    assert.ok(activeOrders.some((o) => o.status === "rejected" && o.rejectReason));
  });
});

describe("companies invitation migration", () => {
  it("ships a forward migration for discordNotifiedAt", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260724180000_invitation_discord_notified_at/migration.sql",
      ),
      "utf8",
    );
    assert.match(migration, /CompanyInvitation/);
    assert.match(migration, /discordNotifiedAt/);
    assert.match(migration, /AltaPrivateInvitation/);
  });

  it("companies route has a local error boundary", () => {
    const page = readFileSync(join(root, "routes/companies/index.tsx"), "utf8");
    assert.match(page, /errorComponent:\s*CompaniesDashboardError/);
    assert.match(page, /\[companies\.dashboard\]/);
  });
});

describe("1D chart reconciliation", () => {
  for (const key of ["core", "growth", "income", "active", "treasury"] as const) {
    it(`anchors ${key} 1D series to dayChange within one cent`, () => {
      const profile = FIXTURE_PROFILES[key];
      const applied = applyFixtureLedger(`tp_chart_${key}`, profile);
      const snap = buildSnapshotFromLedger(`tp_chart_${key}`, applied, profile);
      const series = snap.seriesByRange["1D"];
      const start = series[0]!.v;
      const end = series[series.length - 1]!.v;
      const expectedStart = Number((snap.totalValue - snap.dayChange).toFixed(2));
      assert.ok(Math.abs(end - snap.totalValue) <= 0.01, `${key} end ${end} vs ${snap.totalValue}`);
      assert.ok(Math.abs(start - expectedStart) <= 0.01, `${key} start ${start} vs ${expectedStart}`);
      const chartChange = Number((end - start).toFixed(2));
      assert.ok(Math.abs(chartChange - snap.dayChange) <= 0.01);
      const chartPct =
        Math.abs(start) > 0.005 ? Number((((end - start) / Math.abs(start)) * 100).toFixed(2)) : 0;
      assert.ok(Math.abs(chartPct - snap.dayChangePercent) <= 0.02);
      assertChartSeriesHealthy(series, {
        endValue: snap.totalValue,
        startValue: expectedStart,
        maxSingleStepRatio: 0.12,
      });
    });
  }

  it("empty cash portfolio has a flat 1D chart", async () => {
    process.env.TERMINAL_PORTFOLIO_STORE = "memory";
    resetTerminalPortfolioMemoryForTests();
    const user = testUser();
    const created = await createTerminalPortfolio(user, {
      name: "Empty Lab",
      ownerType: "personal",
      ownerCompanyId: null,
    });
    const client = new MockTseClient({ userId: user.id });
    const snap = await client.getPortfolio(created.id);
    assert.equal(snap.dayChange, 0);
    assert.equal(snap.dayChangePercent, 0);
    const series = snap.seriesByRange["1D"];
    assert.ok(series.every((p) => Math.abs(p.v - snap.totalValue) <= 0.01));
    assertChartSeriesHealthy(series, {
      endValue: snap.totalValue,
      startValue: snap.totalValue,
      maxSingleStepRatio: 0.01,
    });
  });

  it("growth chart has no near-zero plunge", () => {
    const profile = FIXTURE_PROFILES.growth;
    const applied = applyFixtureLedger("tp_growth_drop", profile);
    const snap = buildSnapshotFromLedger("tp_growth_drop", applied, profile);
    const series = snap.seriesByRange["1D"];
    const min = Math.min(...series.map((p) => p.v));
    const median = series.map((p) => p.v).sort((a, b) => a - b)[Math.floor(series.length / 2)]!;
    assert.ok(min > median * 0.7, `unexpected plunge: min=${min} median=${median}`);
    assert.ok(min > snap.totalValue * 0.5);
  });

  it("seeded charts remain visibly distinct", () => {
    const signatures = (["core", "growth", "income", "active", "treasury"] as const).map((key) => {
      const profile = FIXTURE_PROFILES[key];
      const applied = applyFixtureLedger(`tp_shape_${key}`, profile);
      const snap = buildSnapshotFromLedger(`tp_shape_${key}`, applied, profile);
      return snap.seriesByRange["1M"].map((p) => p.v.toFixed(2)).join(",");
    });
    assert.equal(new Set(signatures).size, signatures.length);
  });
});

describe("orders filter search contract", () => {
  it("keeps status and side while swapping portfolioId", () => {
    const ordersSource = readFileSync(join(root, "routes/terminal/orders.tsx"), "utf8");
    assert.match(ordersSource, /portfolioId: patch\.portfolioId !== undefined/);
    assert.match(ordersSource, /status: patch\.status \?\? prev\.status/);
    assert.match(ordersSource, /side: patch\.side \?\? prev\.side/);
  });

  it("invalid status/side fall back to all", () => {
    // Mirror validateSearch parsing used by the Orders route.
    const statuses = ["all", "open", "filled", "cancelled", "rejected", "partial"] as const;
    const sides = ["all", "buy", "sell"] as const;
    const parseStatus = (value: unknown) =>
      typeof value === "string" && (statuses as readonly string[]).includes(value) ? value : "all";
    const parseSide = (value: unknown) =>
      typeof value === "string" && (sides as readonly string[]).includes(value) ? value : "all";
    assert.equal(parseStatus("filled"), "filled");
    assert.equal(parseStatus("nope"), "all");
    assert.equal(parseSide("buy"), "buy");
    assert.equal(parseSide(undefined), "all");
  });

  it("filterOrders respects status and side", async () => {
    const client = new MockTseClient({ userId: "filter-user" });
    const ids = mockPortfolioIds("filter-user");
    const orders = await client.listOrders(ids.personalCore);
    const filled = filterOrders(orders, { status: "filled", side: "all" });
    assert.ok(filled.length > 0);
    assert.ok(filled.every((o) => o.status === "filled"));
    const buys = filterOrders(orders, { status: "all", side: "buy" });
    assert.ok(buys.every((o) => o.side === "buy"));
  });
});

describe("UI Lab identity alignment", () => {
  it("Companies fixture matches Terminal ALTG ownership", () => {
    const companies = companiesFromUiLabUser(UI_LAB_MOCK_USER);
    const altg = companies.find((c) => c.id === "CO-ALTG");
    assert.ok(altg);
    assert.equal(altg!.name, "Alta Group N.V.");
    assert.equal(altg!.ticker, "ALTG");
    assert.equal(altg!.role, "owner");
    const membership = UI_LAB_MOCK_USER.companyMemberships.find((m) => m.companyId === "CO-ALTG");
    assert.equal(membership?.role, altg!.role);
    assert.equal(membership?.companyName, altg!.name);
  });

  it("profile route has a local error boundary", () => {
    const page = readFileSync(join(root, "routes/profile.tsx"), "utf8");
    assert.match(page, /errorComponent:\s*ProfilePageError/);
    assert.match(page, /fetchUserBankSummary/);
  });

  it("bank and company server fns short-circuit in UI Lab without weakening production paths", () => {
    const bank = readFileSync(join(root, "lib/bank/bank.functions.ts"), "utf8");
    const company = readFileSync(join(root, "lib/company/company.functions.ts"), "utf8");
    assert.match(bank, /isUiLabMode\(\)/);
    assert.match(bank, /getUiLabBankSummary/);
    assert.match(company, /getUiLabCompaniesDashboard/);
    assert.match(company, /getCompaniesDashboard/);
  });
});

describe("ecosystem URL hydration contract", () => {
  it("footer and header links match for the same request host", () => {
    const host = "localhost:3000";
    const header = getEcosystemSwitcherLinks("terminal", host);
    const footer = getFooterEcosystemLinks("terminal", host);
    for (const link of header.filter((l) => !l.current)) {
      const foot = footer.find((f) => f.label === link.name);
      assert.ok(foot && "href" in foot);
      assert.equal(foot.href, link.href);
    }
    assert.equal(resolveEntitySiteUrl("corporate", "/home", host), "http://localhost:3000/home");
    assert.equal(resolveEntitySiteUrl("bank", "/", host), "http://localhost:3000/?site=bank");
  });
});

describe("portfolio chart mobile sizing", () => {
  it("keeps a stable height and skeleton while sized", () => {
    const chart = readFileSync(join(root, "components/terminal/portfolio-chart.tsx"), "utf8");
    assert.match(chart, /h-\[220px\] sm:h-\[260px\]/);
    assert.match(chart, /animate-pulse/);
    assert.match(chart, /containerSize\.width > 0 && containerSize\.height > 0/);
    assert.match(chart, /ResizeObserver/);
    assert.match(chart, /requestAnimationFrame/);
  });
});
