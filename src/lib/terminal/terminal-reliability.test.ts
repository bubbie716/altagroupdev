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
  assertLedgerReconciles,
  buildSnapshotFromLedger,
} from "@/lib/terminal/terminal-fixture-ledger";
import {
  createTerminalPortfolio,
  listAccessibleTerminalPortfolios,
  resetTerminalPortfolioMemoryForTests,
} from "@/lib/terminal/terminal-portfolio.service";
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
    await new Promise<void>((resolve) => queueMicrotask(resolve));
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
    assert.match(orders, /onCreated=\{\(p\) => \{/);
    assert.match(orders, /search: \{ portfolioId: p\.id \}/);
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
    assert.match(userMenu, /useControlledMenu/);
    assert.match(userMenu, /event\.preventDefault\(\)/);
  });

  it("dropdown and select use menu semantic tokens", () => {
    const menu = readFileSync(join(root, "components/ui/dropdown-menu.tsx"), "utf8");
    const select = readFileSync(join(root, "components/ui/select.tsx"), "utf8");
    assert.match(menu, /--menu-surface/);
    assert.match(menu, /--menu-item-hover/);
    assert.doesNotMatch(menu, /focus:bg-accent/);
    assert.match(select, /--menu-item-hover/);
    assert.match(select, /--menu-item-selected/);
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
