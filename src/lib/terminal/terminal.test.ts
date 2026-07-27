import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCompactVolume,
  formatMarketCap,
  formatTerminalMoney,
  formatTerminalPercent,
  formatTerminalPrice,
} from "@/lib/terminal/format";
import { estimateOrderValue, validateOrderPreview } from "@/lib/terminal/order-validation";
import { filterOrders, filterSecurities, sortSecurities } from "@/lib/terminal/market-filters";
import { MockTseClient } from "@/lib/terminal/mock-tse-client";
import { UnavailableTseClient } from "@/lib/terminal/unavailable-tse-client";
import {
  createTseClient,
  getTseClient,
  resetTseClientForTests,
  resolveTerminalTseMode,
} from "@/lib/terminal/tse-client";
import {
  getFixtureSecurity,
  listFixtureSecurities,
  mockPortfolioIds,
} from "@/lib/terminal/terminal-fixtures";
import {
  archiveTerminalPortfolio,
  createTerminalPortfolio,
  listAccessibleTerminalPortfolios,
  renameTerminalPortfolio,
  resetTerminalPortfolioMemoryForTests,
  resolveTerminalPortfolioId,
  rememberSelectedTerminalPortfolio,
} from "@/lib/terminal/terminal-portfolio.service";
import {
  canCreateCompanyTerminalPortfolio,
  canTradeCompanyTerminalPortfolio,
  canViewCompanyTerminalPortfolio,
} from "@/lib/terminal/portfolio-auth";
import type { AltaUser } from "@/lib/auth/types";
import { ECOSYSTEM_ENTRIES, getEcosystemSwitcherLinks } from "@/lib/site/ecosystem-config";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

function testUser(overrides: Partial<AltaUser> = {}): AltaUser {
  return {
    id: "terminal-user-one",
    discordId: "111",
    discordUsername: "trader",
    avatarUrl: null,
    email: "trader@test.local",
    minecraftUsername: "trader",
    tags: [],
    accountStatus: "active",
    internalAccess: false,
    companyMemberships: [
      {
        userId: "terminal-user-one",
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
    ...overrides,
  };
}

describe("terminal format", () => {
  it("formats money and signed variants", () => {
    assert.equal(formatTerminalMoney(1234.5), "ƒ1,234.50");
    assert.equal(formatTerminalMoney(-12.3, { signed: true }), "-ƒ12.30");
    assert.equal(formatTerminalMoney(12.3, { signed: true }), "+ƒ12.30");
  });

  it("formats percent with sign", () => {
    assert.equal(formatTerminalPercent(2.5), "+2.50%");
    assert.equal(formatTerminalPercent(-1.25), "-1.25%");
  });

  it("formats price and volume", () => {
    assert.equal(formatTerminalPrice(18.72), "ƒ18.72");
    assert.equal(formatCompactVolume(1_842_300), "1.84M");
    assert.equal(formatMarketCap(null), "—");
  });
});

describe("terminal market filters", () => {
  const rows = listFixtureSecurities();

  it("filters by query and gainers/losers", () => {
    const alta = filterSecurities(rows, { query: "alta" });
    assert.equal(alta.length, 1);
    assert.equal(alta[0]?.symbol, "ALTA");
    assert.ok(filterSecurities(rows, { filter: "gainers" }).every((r) => r.dayChangePercent > 0));
    assert.ok(filterSecurities(rows, { filter: "losers" }).every((r) => r.dayChangePercent < 0));
  });

  it("sorts by day change", () => {
    const sorted = sortSecurities(rows, "dayChangePercent", "desc");
    assert.ok((sorted[0]?.dayChangePercent ?? 0) >= (sorted[1]?.dayChangePercent ?? 0));
  });

  it("filters orders", () => {
    const orders = [
      { status: "open" as const, side: "buy" as const },
      { status: "filled" as const, side: "sell" as const },
    ];
    assert.equal(filterOrders(orders, { status: "open" }).length, 1);
    assert.equal(filterOrders(orders, { side: "sell" }).length, 1);
  });
});

describe("terminal order validation", () => {
  const security = getFixtureSecurity("ALTA")!;
  const portfolioId = "tp_test_core";

  it("estimates order value", () => {
    const est = estimateOrderValue(10, 100);
    assert.equal(est.estimatedValue, 1000);
    assert.equal(est.estimatedFees, 1);
  });

  it("rejects halted securities and insufficient buying power", () => {
    const halted = getFixtureSecurity("HALT")!;
    const haltedPreview = validateOrderPreview({
      order: { portfolioId, symbol: "HALT", side: "buy", type: "market", quantity: 1 },
      security: halted,
      marketStatus: "open",
      buyingPower: 10_000,
      holding: null,
    });
    assert.equal(haltedPreview.ok, false);
    assert.ok(haltedPreview.errors.some((e) => /halted/i.test(e)));

    const poor = validateOrderPreview({
      order: { portfolioId, symbol: "ALTA", side: "buy", type: "market", quantity: 1000 },
      security,
      marketStatus: "open",
      buyingPower: 10,
      holding: null,
    });
    assert.equal(poor.ok, false);
    assert.ok(poor.errors.some((e) => /buying power/i.test(e)));
  });

  it("requires portfolioId", () => {
    const preview = validateOrderPreview({
      order: { portfolioId: "", symbol: "ALTA", side: "buy", type: "market", quantity: 1 },
      security,
      marketStatus: "open",
      buyingPower: 10_000,
      holding: null,
    });
    assert.equal(preview.ok, false);
    assert.ok(preview.errors.some((e) => /portfolio/i.test(e)));
  });

  it("accepts a valid market buy", () => {
    const preview = validateOrderPreview({
      order: { portfolioId, symbol: "ALTA", side: "buy", type: "market", quantity: 1 },
      security,
      marketStatus: "open",
      buyingPower: 10_000,
      holding: null,
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.portfolioId, portfolioId);
    assert.ok(preview.estimatedValue > 0);
  });
});

describe("terminal tse clients", () => {
  it("mock client is portfolio-aware for orders and holdings", async () => {
    const userId = "mock-iso-user";
    const ids = mockPortfolioIds(userId);
    const client = new MockTseClient({ userId });

    const core = await client.getPortfolio(ids.personalCore);
    const growth = await client.getPortfolio(ids.personalGrowth);
    const income = await client.getPortfolio(ids.personalIncome);
    const company = await client.getPortfolio(ids.companyAltg);

    assert.ok(core.holdings.length > 0);
    assert.ok(growth.holdings.length > 0);
    assert.ok(income.holdings.length > 0);
    assert.ok(company.holdings.length > 0);
    assert.notEqual(core.totalValue, company.totalValue);
    assert.notEqual(growth.totalValue, income.totalValue);

    const emptyId = `tp_${userId}_scratch`;
    await client.ensurePortfolioMarketState?.(emptyId, "empty");
    const empty = await client.getPortfolio(emptyId);
    assert.equal(empty.holdings.length, 0);

    const preview = await client.previewOrder({
      portfolioId: ids.personalCore,
      symbol: "MINE",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.portfolioId, ids.personalCore);

    const rejected = await client.previewOrder({
      portfolioId: "",
      symbol: "MINE",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(rejected.ok, false);

    const submitted = await client.submitOrder({
      portfolioId: emptyId,
      symbol: "MINE",
      side: "buy",
      type: "limit",
      quantity: 1,
      limitPrice: 18,
    });
    assert.equal(submitted.ok, true);
    if (submitted.ok) {
      assert.equal(submitted.order.portfolioId, emptyId);
      assert.equal(submitted.order.status, "open");
    }

    const emptyOrders = await client.listOrders(emptyId);
    assert.ok(emptyOrders.some((o) => o.id === (submitted.ok ? submitted.order.id : "")));
    const coreOrders = await client.listOrders(ids.personalCore);
    assert.equal(
      coreOrders.some((o) => o.id === (submitted.ok ? submitted.order.id : "")),
      false,
    );
  });

  it("unavailable client disables trading", async () => {
    const client = new UnavailableTseClient();
    assert.equal(client.mode, "unavailable");
    const submit = await client.submitOrder({
      portfolioId: "tp_x",
      symbol: "ALTA",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(submit.ok, false);
    if (!submit.ok) assert.equal(submit.code, "unavailable");
    assert.equal((await client.listSecurities()).length, 0);
  });

  it("factory respects explicit mock mode", () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "mock";
    assert.equal(resolveTerminalTseMode(), "mock");
    const client = createTseClient();
    assert.equal(client.mode, "mock");
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });

  it("factory uses unavailable for explicit unavailable mode", () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "unavailable";
    assert.equal(createTseClient().mode, "unavailable");
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });

  it("isolates mutable mock state by authenticated user", async () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "mock";
    const first = getTseClient({ userId: "terminal-user-one" });
    const second = getTseClient({ userId: "terminal-user-two" });

    await first.addToWatchlist("ALTA");

    assert.equal(
      (await first.getWatchlist()).some((item) => item.symbol === "ALTA"),
      true,
    );
    assert.equal(
      (await second.getWatchlist()).some((item) => item.symbol === "ALTA"),
      false,
    );
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });
});

describe("terminal portfolios", () => {
  const previousStore = process.env.TERMINAL_PORTFOLIO_STORE;

  function withMemoryStore() {
    process.env.TERMINAL_PORTFOLIO_STORE = "memory";
    resetTerminalPortfolioMemoryForTests();
  }

  function restoreStore() {
    if (previousStore === undefined) delete process.env.TERMINAL_PORTFOLIO_STORE;
    else process.env.TERMINAL_PORTFOLIO_STORE = previousStore;
    resetTerminalPortfolioMemoryForTests();
  }

  it("seeds personal and company fixtures with isolation", async () => {
    withMemoryStore();
    try {
      const a = testUser({ id: "user-a" });
      const b = testUser({
        id: "user-b",
        companyMemberships: [
          {
            userId: "user-b",
            companyId: "CO-ALTG",
            role: "owner",
            companyName: "Alta Group N.V.",
            companyType: "Holding Company",
            companyTicker: "ALTG",
            companyStatus: "Listed",
            companyVerificationStatus: "Verified",
          },
        ],
      });

      const aPortfolios = await listAccessibleTerminalPortfolios(a);
      const bPortfolios = await listAccessibleTerminalPortfolios(b);

      assert.ok(aPortfolios.length >= 3);
      assert.ok(aPortfolios.some((p) => p.ownerType === "personal" && p.isDefault));
      assert.ok(aPortfolios.some((p) => p.ownerType === "personal" && !p.isDefault));
      assert.ok(aPortfolios.some((p) => p.ownerType === "company" && p.ownerCompanyId === "CO-ALTG"));
      assert.equal(
        aPortfolios.some((p) => bPortfolios.some((bp) => bp.id === p.id)),
        false,
      );
    } finally {
      restoreStore();
    }
  });

  it("resolves selection order: explicit → recent → default", async () => {
    withMemoryStore();
    try {
      const user = testUser({ id: "sel-user" });
      const portfolios = await listAccessibleTerminalPortfolios(user);
      const defaultId = portfolios.find((p) => p.isDefault)!.id;
      const other = portfolios.find((p) => !p.isDefault)!;

      assert.equal(await resolveTerminalPortfolioId(user, other.id), other.id);
      assert.equal(await resolveTerminalPortfolioId(user, null), defaultId);

      await rememberSelectedTerminalPortfolio(user, other.id);
      assert.equal(await resolveTerminalPortfolioId(user, null), other.id);
    } finally {
      restoreStore();
    }
  });

  it("creates, renames, and archives personal portfolios", async () => {
    withMemoryStore();
    try {
      const user = testUser({ id: "crud-user" });
      const created = await createTerminalPortfolio(user, {
        name: "Speculative",
        ownerType: "personal",
      });
      assert.equal(created.name, "Speculative");
      assert.equal(created.ownerType, "personal");

      const renamed = await renameTerminalPortfolio(user, created.id, "Momentum");
      assert.equal(renamed.name, "Momentum");

      const archived = await archiveTerminalPortfolio(user, created.id);
      assert.equal(archived.status, "archived");
      const remaining = await listAccessibleTerminalPortfolios(user);
      assert.equal(remaining.some((p) => p.id === created.id), false);
    } finally {
      restoreStore();
    }
  });

  it("creates company portfolios only when authorized", async () => {
    withMemoryStore();
    try {
      const owner = testUser({ id: "co-owner" });
      const viewer = testUser({
        id: "co-viewer",
        companyMemberships: [
          {
            userId: "co-viewer",
            companyId: "CO-ALTG",
            role: "viewer",
            companyName: "Alta Group N.V.",
            companyType: "Holding Company",
            companyTicker: "ALTG",
            companyStatus: "Listed",
            companyVerificationStatus: "Verified",
          },
        ],
      });

      assert.equal(canCreateCompanyTerminalPortfolio(owner, "CO-ALTG"), true);
      assert.equal(canCreateCompanyTerminalPortfolio(viewer, "CO-ALTG"), false);
      assert.equal(canTradeCompanyTerminalPortfolio(viewer, "CO-ALTG"), false);
      assert.equal(canViewCompanyTerminalPortfolio(viewer, "CO-ALTG"), false);

      const created = await createTerminalPortfolio(owner, {
        name: "Ops Book",
        ownerType: "company",
        ownerCompanyId: "CO-ALTG",
      });
      assert.equal(created.ownerType, "company");

      await assert.rejects(
        () =>
          createTerminalPortfolio(viewer, {
            name: "Forbidden",
            ownerType: "company",
            ownerCompanyId: "CO-ALTG",
          }),
        /authorized/i,
      );
    } finally {
      restoreStore();
    }
  });

  it("denies cross-company access by portfolio id", async () => {
    withMemoryStore();
    try {
      const owner = testUser({ id: "iso-owner" });
      const outsider = testUser({
        id: "iso-out",
        companyMemberships: [
          {
            userId: "iso-out",
            companyId: "CO-OTHER",
            role: "owner",
            companyName: "Other Co",
            companyType: "Private",
            companyTicker: "OTH",
            companyStatus: "Active",
            companyVerificationStatus: "Verified",
          },
        ],
      });

      const companyPortfolio = (await listAccessibleTerminalPortfolios(owner)).find(
        (p) => p.ownerCompanyId === "CO-ALTG",
      )!;
      await assert.rejects(
        () => resolveTerminalPortfolioId(outsider, companyPortfolio.id),
        /access denied|not found/i,
      );
    } finally {
      restoreStore();
    }
  });
});

describe("terminal ecosystem and production urls", () => {
  it("points Terminal ecosystem home at /terminal", () => {
    const entry = ECOSYSTEM_ENTRIES.find((e) => e.key === "terminal");
    assert.equal(entry?.homePath, "/terminal");
    const links = getEcosystemSwitcherLinks("terminal", "localhost:3000");
    assert.ok(links.find((l) => l.key === "terminal")?.href.includes("/terminal"));
  });

  it("does not resolve production Terminal links to localhost", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const href = resolveEntitySiteUrl("terminal", "/terminal", "terminal.altagroup.dev");
      assert.ok(href.includes("terminal.altagroup.dev"));
      assert.equal(href.includes("localhost"), false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
