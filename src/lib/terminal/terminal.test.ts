import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import {
  formatCompactVolume,
  formatMarketCap,
  formatTerminalMoney,
  formatTerminalPercent,
  formatTerminalPrice,
} from "@/lib/terminal/format";
import { estimateOrderValue, validateOrderPreview } from "@/lib/terminal/order-validation";
import { filterOrders, filterSecurities, sortSecurities } from "@/lib/terminal/market-filters";
import { UnavailableTseClient, emptyLocalPortfolioSnapshot } from "@/lib/terminal/unavailable-tse-client";
import {
  createTseClient,
  getTseClient,
  resetTseClientForTests,
  resolveTerminalTseMode,
} from "@/lib/terminal/tse-client";
import {
  decimalToNumber,
  serializeMoney,
  serializeQuantity,
  toDecimal,
} from "@/lib/terminal/terminal-decimal";
import {
  TerminalPersistenceUnavailableError,
  listAccessibleTerminalPortfolios,
} from "@/lib/terminal/terminal-portfolio.service";
import {
  canCreateCompanyTerminalPortfolio,
  canTradeCompanyTerminalPortfolio,
  canViewCompanyTerminalPortfolio,
  companyPortfolioCapabilities,
} from "@/lib/terminal/portfolio-auth";
import type { AltaUser } from "@/lib/auth/types";
import { ECOSYSTEM_ENTRIES, getEcosystemSwitcherLinks } from "@/lib/site/ecosystem-config";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import {
  getFixtureSecurity,
  listFixtureSecurities,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";

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

describe("terminal decimal boundary", () => {
  it("serializes Decimal money and quantities safely", () => {
    const money = toDecimal("1234.567");
    assert.equal(serializeMoney(money), 1234.57);
    assert.equal(serializeQuantity(toDecimal("10.123456789")), 10.12345679);
    assert.equal(decimalToNumber(new Prisma.Decimal("0.00")), 0);
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
    const est = estimateOrderValue(10, security.lastPrice);
    assert.ok(est.estimatedValue > 0);
    assert.ok(est.estimatedFees >= 0);
  });

  it("validates a market buy", () => {
    const result = validateOrderPreview({
      order: {
        portfolioId,
        symbol: "ALTA",
        side: "buy",
        type: "market",
        quantity: 1,
      },
      security,
      buyingPower: 100_000,
      holding: null,
      marketStatus: "open",
    });
    assert.equal(result.ok, true);
  });
});

describe("TSE mode defaults and fail-closed live", () => {
  it("defaults to unavailable even in non-production when unset", () => {
    const prev = process.env.TERMINAL_TSE_MODE;
    const prevVite = process.env.VITE_TERMINAL_TSE_MODE;
    delete process.env.TERMINAL_TSE_MODE;
    delete process.env.VITE_TERMINAL_TSE_MODE;
    assert.equal(resolveTerminalTseMode(), "unavailable");
    if (prev === undefined) delete process.env.TERMINAL_TSE_MODE;
    else process.env.TERMINAL_TSE_MODE = prev;
    if (prevVite === undefined) delete process.env.VITE_TERMINAL_TSE_MODE;
    else process.env.VITE_TERMINAL_TSE_MODE = prevVite;
  });

  it("ignores mock mode for normal runtime", () => {
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "mock";
    assert.equal(resolveTerminalTseMode(), "unavailable");
    process.env.TERMINAL_TSE_MODE = prev;
  });

  it("live without adapter still returns UnavailableTseClient", () => {
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "live";
    resetTseClientForTests();
    const client = createTseClient({ userId: "x" });
    assert.equal(client.mode, "unavailable");
    assert.ok(client instanceof UnavailableTseClient);
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });

  it("factory uses unavailable for explicit unavailable mode", () => {
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "unavailable";
    assert.equal(createTseClient().mode, "unavailable");
    process.env.TERMINAL_TSE_MODE = prev;
  });

  it("scoped clients do not share across users", () => {
    resetTseClientForTests();
    const a = getTseClient({ userId: "a" });
    const b = getTseClient({ userId: "b" });
    assert.notEqual(a, b);
    resetTseClientForTests();
  });
});

describe("unavailable TSE client", () => {
  it("disables trading and returns empty market data", async () => {
    const client = new UnavailableTseClient();
    assert.equal(client.mode, "unavailable");
    assert.deepEqual(await client.listSecurities(), []);
    assert.equal(await client.getSecurity("ALTA"), null);
    const submit = await client.submitOrder({
      portfolioId: "p1",
      symbol: "ALTA",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(submit.ok, false);
    if (!submit.ok) assert.equal(submit.code, "unavailable");
  });

  it("empty local portfolio snapshot marks valuation unavailable", () => {
    const snap = emptyLocalPortfolioSnapshot("p1");
    assert.equal(snap.valuationAvailable, false);
    assert.equal(snap.totalValue, null);
    assert.equal(snap.cashBalance, 0);
    assert.deepEqual(snap.holdings, []);
  });
});

describe("portfolio authorization", () => {
  it("enforces company view/trade/create roles", () => {
    const owner = testUser();
    const viewer = testUser({
      id: "viewer",
      companyMemberships: [
        {
          userId: "viewer",
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
    assert.equal(canViewCompanyTerminalPortfolio(owner, "CO-ALTG"), true);
    assert.equal(canTradeCompanyTerminalPortfolio(owner, "CO-ALTG"), true);
    assert.equal(canCreateCompanyTerminalPortfolio(owner, "CO-ALTG"), true);
    assert.equal(canViewCompanyTerminalPortfolio(viewer, "CO-ALTG"), false);
    assert.equal(canTradeCompanyTerminalPortfolio(viewer, "CO-ALTG"), false);
    const caps = companyPortfolioCapabilities(viewer, "CO-ALTG");
    assert.equal(caps.canView, false);
    assert.equal(caps.canTrade, false);
  });
});

describe("persistence without DB never falls back to memory fixtures", () => {
  it("listAccessibleTerminalPortfolios fails closed when DATABASE_URL is unset", async () => {
    const prev = process.env.DATABASE_URL;
    const prevStore = process.env.TERMINAL_PORTFOLIO_STORE;
    process.env.DATABASE_URL = "";
    delete process.env.TERMINAL_PORTFOLIO_STORE;
    try {
      await listAccessibleTerminalPortfolios(testUser());
      assert.fail("expected TerminalPersistenceUnavailableError");
    } catch (error) {
      assert.ok(error instanceof TerminalPersistenceUnavailableError);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
      if (prevStore === undefined) delete process.env.TERMINAL_PORTFOLIO_STORE;
      else process.env.TERMINAL_PORTFOLIO_STORE = prevStore;
    }
  });

  it("portfolio service source has no memory fixture fallback", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/terminal/terminal-portfolio.service.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /TERMINAL_PORTFOLIO_STORE|seedMemoryStore|memoryByUser/);
    assert.match(src, /TerminalPersistenceUnavailableError/);
  });
});

describe("UI Lab fixture isolation", () => {
  it("normal runtime modules do not statically import UI Lab fixtures", () => {
    const libRoot = join(process.cwd(), "src/lib/terminal");
    const forbidden = [
      "terminal-portfolio.service.ts",
      "terminal-local.service.ts",
      "tse-client.ts",
      "unavailable-tse-client.ts",
      "terminal-ops-admin.service.ts",
    ];
    for (const file of forbidden) {
      const src = readFileSync(join(libRoot, file), "utf8");
      assert.doesNotMatch(src, /ui-lab\//);
      assert.doesNotMatch(src, /ui-lab-terminal-market-fixtures/);
      assert.doesNotMatch(src, /ui-lab-terminal-fixture-ledger/);
      assert.doesNotMatch(src, /MockTseClient/);
    }
    const envSrc = readFileSync(join(libRoot, "terminal-ops-environment.ts"), "utf8");
    assert.doesNotMatch(envSrc, /ui-lab-terminal-market-fixtures/);
    assert.doesNotMatch(envSrc, /MockTseClient/);
    assert.match(envSrc, /UiLabDemonstrationTseClient|UI Lab/);
  });

  it("obsolete mock runtime paths are removed from terminal lib root", () => {
    const names = readdirSync(join(process.cwd(), "src/lib/terminal"));
    assert.ok(!names.includes("mock-tse-client.ts"));
    assert.ok(!names.includes("terminal-fixtures.ts"));
    assert.ok(!names.includes("terminal-fixture-ledger.ts"));
  });

  it("terminal.functions gates UI Lab behind isUiLabMode", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/terminal/terminal.functions.ts"),
      "utf8",
    );
    assert.match(src, /isUiLabMode/);
    assert.match(src, /ui-lab\/ui-lab-demonstration-tse-client/);
  });
});

describe("public Terminal truthful copy", () => {
  it("home keeps portfolios usable without fabricated combined value when unavailable", () => {
    const home = readFileSync(join(process.cwd(), "src/routes/terminal/index.tsx"), "utf8");
    assert.match(home, /Valuation unavailable|marketDataAvailable/);
    assert.doesNotMatch(home, /TerminalUnavailableState/);
    assert.match(home, /Create your first portfolio|Create portfolio/);
  });

  it("portfolio detail does not block on unavailable TSE mode", () => {
    const detail = readFileSync(
      join(process.cwd(), "src/routes/terminal/portfolio/$portfolioId.tsx"),
      "utf8",
    );
    assert.doesNotMatch(detail, /if \(data\.mode === "unavailable"\)/);
  });
});

describe("ecosystem URLs remain site-isolated", () => {
  it("terminal entry resolves to a terminal site URL", () => {
    const terminal = ECOSYSTEM_ENTRIES.find((e) => e.key === "terminal");
    assert.ok(terminal);
    const url = resolveEntitySiteUrl("terminal");
    assert.match(url, /terminal/);
    const links = getEcosystemSwitcherLinks("terminal");
    assert.ok(links.some((l) => l.href.includes("terminal")));
  });
});
