import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  availableOrderActions,
  buildOrderLifecycle,
  investorMatchesListFilter,
  orderMatchesListFilter,
  plainOrderStatusLabel,
  portfolioMatchesListFilter,
  activityMatchesTerminalFilter,
  parseTerminalOrderListFilter,
  parseTerminalPortfolioListFilter,
  parseTerminalInvestorListFilter,
  orderNeedsAttention,
  type TerminalInvestorRow,
  type TerminalOpsPortfolioRow,
} from "@/lib/terminal/terminal-ops-types";
import {
  buildTerminalOpsAttention,
  buildInvestorsFromPortfolios,
  getTerminalOpsSystemStatus,
} from "@/lib/terminal/terminal-ops-admin.service";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  getUiLabTerminalOrders,
  getUiLabTerminalPortfolios,
  getUiLabTerminalPortfolioDetail,
  UI_LAB_TERMINAL_PORTFOLIO_IDS,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures";
import {
  buildListReturnPath,
  isSafeInternalFrom,
  parseTerminalOrderRecordSearch,
  parseTerminalPortfolioWorkspaceSearch,
  CUSTOMER_LEGACY_TAB_MAP,
  COMPANY_LEGACY_TAB_MAP,
} from "@/lib/internal/record-workspace-search";
import {
  assertEntityInternalRouteAccess,
  isInternalPathAllowedForUser,
} from "@/lib/internal/entity-internal-scope";
import { canAccessBankInternal, canAccessTerminalInternal } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import {
  TERMINAL_PRIMARY_NAV,
  resolveInternalPrimarySection,
} from "@/components/internal/console/internal-nav-config";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    tags,
    accountStatus: "active",
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("Phase 7 Terminal navigation and scope", () => {
  it("exposes six Terminal primary destinations", () => {
    assert.equal(TERMINAL_PRIMARY_NAV.length, 6);
    assert.deepEqual(
      TERMINAL_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Investors", "Portfolios", "Orders", "System"],
    );
  });

  it("scopes Terminal nav sections correctly", () => {
    assert.equal(resolveInternalPrimarySection("terminal", "/internal"), "home");
    assert.equal(resolveInternalPrimarySection("terminal", "/internal/terminal/inbox"), "inbox");
    assert.equal(
      resolveInternalPrimarySection("terminal", "/internal/terminal/investors"),
      "investors",
    );
    assert.equal(resolveInternalPrimarySection("terminal", "/internal/users/abc"), "investors");
    assert.equal(
      resolveInternalPrimarySection("terminal", "/internal/terminal/portfolios/x"),
      "portfolios",
    );
    assert.equal(
      resolveInternalPrimarySection("terminal", "/internal/terminal/orders/y"),
      "orders",
    );
    assert.equal(
      resolveInternalPrimarySection("terminal", "/internal/terminal/settings"),
      "system",
    );
  });

  it("allows Terminal panel paths including investors deep links", () => {
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/terminal/portfolios"),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/users/ui-lab-user"),
    );
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal/bank/accounts"));
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal/settings"));
  });

  it("keeps Terminal-only staff off Bank routes and Bank-only off Terminal ops", () => {
    const terminalAdmin = userWithTags(["terminal_admin"]);
    const bankAdmin = userWithTags(["bank_admin"]);
    assert.equal(canAccessBankInternal(terminalAdmin), false);
    assert.equal(canAccessTerminalInternal(terminalAdmin), true);
    assert.equal(canAccessBankInternal(bankAdmin), true);
    assert.equal(canAccessTerminalInternal(bankAdmin), false);
    assert.equal(
      isInternalPathAllowedForUser("terminal", "/internal/terminal/orders", terminalAdmin),
      true,
    );
    assert.equal(
      isInternalPathAllowedForUser("terminal", "/internal/bank/accounts", terminalAdmin),
      false,
    );
    assert.throws(() => assertEntityInternalRouteAccess("bank", "/internal/bank", terminalAdmin));
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal", bankAdmin));
  });
});

describe("Phase 7 Terminal environment and fixtures", () => {
  it("labels mock/UI Lab environment and marks market data untrustworthy", () => {
    const status = resolveTerminalOpsEnvironmentStatus();
    assert.ok(["mock", "unavailable", "live", "degraded"].includes(status.connectionState));
    if (status.connectionState === "mock") {
      assert.match(status.detail, /Demonstration|Not live/i);
      assert.equal(status.marketDataTrustworthy, false);
    }
  });

  it("keeps distinct mock portfolios and empty new portfolio empty", () => {
    const portfolios = getUiLabTerminalPortfolios();
    const ids = new Set(portfolios.map((p) => p.id));
    assert.equal(ids.size, portfolios.length);
    const empty = getUiLabTerminalPortfolioDetail(UI_LAB_TERMINAL_PORTFOLIO_IDS.personalEmpty);
    assert.ok(empty);
    assert.equal(empty.holdings.length, 0);
    assert.equal(empty.activity.length, 0);
    const core = getUiLabTerminalPortfolioDetail(UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.ok(core && core.holdings.length > 0);
  });

  it("normalizes order statuses and lifecycle without inventing stages", () => {
    assert.equal(plainOrderStatusLabel("partial"), "Partially filled");
    assert.equal(parseTerminalOrderListFilter("rejected"), "rejected");
    const rejected = getUiLabTerminalOrders().find((o) => o.status === "rejected")!;
    const life = buildOrderLifecycle(rejected);
    assert.ok(life.some((s) => s.id === "rejected"));
    assert.ok(orderNeedsAttention(rejected));
    assert.deepEqual(availableOrderActions(rejected, true), []);
    const open = getUiLabTerminalOrders().find((o) => o.status === "open")!;
    assert.deepEqual(availableOrderActions(open, true), ["cancel"]);
    assert.deepEqual(availableOrderActions(open, false), []);
  });

  it("filters investors/portfolios/orders and activity kinds", () => {
    const investor: TerminalInvestorRow = {
      id: "user:1",
      kind: "individual",
      label: "a",
      portfolioCount: 1,
      activePortfolioCount: 1,
      accessStatus: "restricted",
      needsAttention: true,
      attentionDetail: "x",
      lastActivityAt: null,
      ownerUserId: "1",
      ownerCompanyId: null,
    };
    assert.equal(investorMatchesListFilter(investor, "restricted"), true);
    assert.equal(investorMatchesListFilter(investor, "companies"), false);
    const portfolio = getUiLabTerminalPortfolios()[0]!;
    assert.equal(
      portfolioMatchesListFilter(portfolio, "personal"),
      portfolio.ownerType === "personal",
    );
    assert.equal(orderMatchesListFilter({ status: "filled" }, "filled"), true);
    assert.equal(activityMatchesTerminalFilter("dividend", "dividends"), true);
    assert.equal(activityMatchesTerminalFilter("buy_fill", "cash"), false);
  });

  it("builds investors from portfolio metadata and connection attention when unavailable", () => {
    const portfolios: TerminalOpsPortfolioRow[] = [
      {
        id: "p1",
        name: "Core",
        ownerType: "personal",
        ownerLabel: "alice",
        ownerUserId: "u1",
        ownerCompanyId: null,
        status: "active",
        isDefault: true,
        totalValue: null,
        cashBalance: null,
        buyingPower: null,
        openOrderCount: 0,
        lastActivityAt: null,
        needsAttention: false,
        attentionDetail: null,
        dataTrustworthy: false,
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const investors = buildInvestorsFromPortfolios(portfolios);
    assert.equal(investors.length, 1);
    assert.equal(investors[0]?.kind, "individual");
    const unavailableEnv = {
      ...resolveTerminalOpsEnvironmentStatus(),
      connectionState: "unavailable" as const,
      detail: "TSE unavailable",
      marketDataTrustworthy: false,
      ordersMutable: false,
    };
    const attention = buildTerminalOpsAttention(unavailableEnv, []);
    assert.ok(attention.some((a) => a.kind === "connection_unavailable"));
  });

  it("documents system sync/recon and recurring trades as unavailable", async () => {
    const system = await getTerminalOpsSystemStatus();
    assert.equal(system.synchronization.available, false);
    assert.equal(system.reconciliation.available, false);
    assert.ok(system.reconciliation.readiness.length > 0);
    assert.equal(system.recurringTrades.available, false);
  });
});

describe("Phase 7 return context and legacy maps", () => {
  it("parses terminal portfolio/order search and preserves safe from/site", () => {
    assert.equal(parseTerminalPortfolioWorkspaceSearch({ tab: "activity" }).tab, "activity");
    assert.equal(parseTerminalOrderRecordSearch({ tab: "lifecycle" }).section, "lifecycle");
    assert.equal(parseTerminalOrderRecordSearch({ from: "https://evil.example" }).from, undefined);
    assert.ok(isSafeInternalFrom("/internal/terminal/orders?status=open"));
    assert.ok(CUSTOMER_LEGACY_TAB_MAP.terminal);
    assert.ok(COMPANY_LEGACY_TAB_MAP.terminal);
    const path = buildListReturnPath("/internal/terminal/portfolios", {
      status: "personal",
      site: "terminal",
    });
    assert.match(path, /\/internal\/terminal\/portfolios/);
    assert.match(path, /site=terminal/);
  });

  it("maps legacy Terminal settings under System navigation", () => {
    assert.equal(parseTerminalInvestorListFilter("needs_attention"), "needs_attention");
    assert.equal(parseTerminalPortfolioListFilter("archived"), "archived");
    const settings = TERMINAL_PRIMARY_NAV.find((l) => l.label === "System")!;
    assert.ok(settings.matchPrefixes?.includes("/internal/terminal/settings"));
  });
});

describe("Phase 7 source structure and interest Accrue UX", () => {
  it("uses RecordWorkspacePage for portfolios and RecordSinglePage for orders", () => {
    const portfolioView = read(
      "components/internal/workspace/terminal-portfolio-workspace-view.tsx",
    );
    const orderView = read("components/internal/workspace/terminal-order-workspace-view.tsx");
    assert.match(portfolioView, /RecordWorkspacePage/);
    assert.match(orderView, /RecordSinglePage/);
    assert.doesNotMatch(orderView, /Unavailable in UI Lab/);
    assert.match(orderView, /canCancel/);
  });

  it("hides interest Accrue controls in UI Lab", () => {
    const interest = read("components/bank/internal-account-interest-ops.tsx");
    assert.match(interest, /useUiLabMutationGate/);
    assert.match(interest, /Manual interest accrual and preview are disabled in UI Lab/);
    assert.match(interest, /!uiLab/);
    assert.doesNotMatch(interest, /label="Accrue"[\s\S]*uiLab/);
  });

  it("blocks terminal order mutations in UI Lab server function", () => {
    const fns = read("lib/terminal/terminal-ops.functions.ts");
    assert.match(fns, /Order mutations are disabled in UI Lab/);
    assert.match(fns, /Live order cancellation is not implemented/);
  });

  it("redacts Bank products for Terminal-only customer/company views", () => {
    const customer = read("components/internal/workspace/customer-workspace-view.tsx");
    const company = read("components/internal/workspace/company-workspace-view.tsx");
    assert.match(customer, /canAccessBankInternal/);
    assert.match(customer, /hidden for Terminal-only staff/);
    assert.match(company, /canAccessBankInternal/);
    assert.match(company, /TerminalOwnerPortfoliosBlock/);
  });

  it("keeps shared shell sources for Corporate, Bank, and Terminal", () => {
    const nav = read("components/internal/console/internal-nav-config.ts");
    assert.match(nav, /CORPORATE_PRIMARY_NAV/);
    assert.match(nav, /BANK_PRIMARY_NAV/);
    assert.match(nav, /TERMINAL_PRIMARY_NAV/);
    assert.match(nav, /Investors/);
  });
});
