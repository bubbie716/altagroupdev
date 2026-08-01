/**
 * Deterministic Terminal internal-ops fixtures for UI Lab / mock mode.
 * Never writes to Prisma. Distinct portfolios; empty portfolio stays empty.
 */
import type {
  TerminalInvestorRow,
  TerminalOpsAttentionItem,
  TerminalOpsHomeSummary,
  TerminalOpsOrderRow,
  TerminalOpsPortfolioDetail,
  TerminalOpsPortfolioRow,
} from "@/lib/terminal/terminal-ops-types";
import { resolveTerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import { formatTerminalOrderSearchSublabel } from "@/lib/terminal/terminal-desk";
import { UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";
import {
  UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES,
  UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS,
  UI_LAB_TERMINAL_PORTFOLIO_IDS,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-canonical-ids";
import {
  getUiLabCryptoOpsDeskSummary,
  searchUiLabCryptoMarkets,
} from "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures";

export { UI_LAB_TERMINAL_PORTFOLIO_IDS };

const UI_LAB_OWNER_LABEL = formatAltaUserHandle(UI_LAB_MOCK_USER);

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function getUiLabTerminalInvestors(): TerminalInvestorRow[] {
  return [
    {
      id: `user:${UI_LAB_MOCK_USER.id}`,
      kind: "individual",
      label: UI_LAB_OWNER_LABEL,
      portfolioCount: 3,
      activePortfolioCount: 3,
      accessStatus: "active",
      needsAttention: false,
      attentionDetail: null,
      lastActivityAt: daysFromNow(-1),
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
    },
    {
      id: `company:${UI_LAB_CORE_COMPANY_ID}`,
      kind: "company",
      label: "Alta Group N.V.",
      portfolioCount: 1,
      activePortfolioCount: 1,
      accessStatus: "active",
      needsAttention: false,
      attentionDetail: null,
      lastActivityAt: daysFromNow(-2),
      ownerUserId: null,
      ownerCompanyId: UI_LAB_CORE_COMPANY_ID,
    },
    {
      id: "user:ui-lab-restricted",
      kind: "individual",
      label: "riley.restricted",
      portfolioCount: 1,
      activePortfolioCount: 0,
      accessStatus: "restricted",
      needsAttention: true,
      attentionDetail: "Terminal access restricted",
      lastActivityAt: daysFromNow(-14),
      ownerUserId: "ui-lab-restricted",
      ownerCompanyId: null,
    },
  ];
}

export function getUiLabTerminalPortfolios(): TerminalOpsPortfolioRow[] {
  const trustworthy = false;
  return [
    {
      id: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      name: "Core Portfolio",
      ownerType: "personal",
      ownerLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      status: "active",
      isDefault: true,
      totalValue: 128_400,
      cashBalance: 12_250,
      buyingPower: 24_500,
      openOrderCount: 1,
      lastActivityAt: daysFromNow(-1),
      needsAttention: false,
      attentionDetail: null,
      dataTrustworthy: trustworthy,
      updatedAt: daysFromNow(-1),
      createdAt: daysFromNow(-120),
    },
    {
      id: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalGrowth,
      name: "Growth Portfolio",
      ownerType: "personal",
      ownerLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      status: "active",
      isDefault: false,
      totalValue: 64_200,
      cashBalance: 4_100,
      buyingPower: 8_200,
      openOrderCount: 0,
      lastActivityAt: daysFromNow(-3),
      needsAttention: false,
      attentionDetail: null,
      dataTrustworthy: trustworthy,
      updatedAt: daysFromNow(-3),
      createdAt: daysFromNow(-90),
    },
    {
      id: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalEmpty,
      name: "New empty portfolio",
      ownerType: "personal",
      ownerLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      status: "active",
      isDefault: false,
      totalValue: 0,
      cashBalance: 0,
      buyingPower: 0,
      openOrderCount: 0,
      lastActivityAt: null,
      needsAttention: false,
      attentionDetail: null,
      dataTrustworthy: trustworthy,
      updatedAt: daysFromNow(-5),
      createdAt: daysFromNow(-5),
    },
    {
      id: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
      name: "ALTG Treasury",
      ownerType: "company",
      ownerLabel: "Alta Group N.V.",
      ownerUserId: null,
      ownerCompanyId: UI_LAB_CORE_COMPANY_ID,
      status: "active",
      isDefault: false,
      totalValue: 410_000,
      cashBalance: 55_000,
      buyingPower: 110_000,
      openOrderCount: 1,
      lastActivityAt: daysFromNow(-2),
      needsAttention: false,
      attentionDetail: null,
      dataTrustworthy: trustworthy,
      updatedAt: daysFromNow(-2),
      createdAt: daysFromNow(-200),
    },
    {
      id: UI_LAB_TERMINAL_PORTFOLIO_IDS.archived,
      name: "Legacy sleeve",
      ownerType: "personal",
      ownerLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      status: "archived",
      isDefault: false,
      totalValue: null,
      cashBalance: null,
      buyingPower: null,
      openOrderCount: 0,
      lastActivityAt: daysFromNow(-40),
      needsAttention: false,
      attentionDetail: null,
      dataTrustworthy: trustworthy,
      updatedAt: daysFromNow(-40),
      createdAt: daysFromNow(-300),
    },
  ];
}

function baseOrder(partial: TerminalOpsOrderRow): TerminalOpsOrderRow {
  return {
    ...partial,
    needsAttention: partial.status === "rejected" || Boolean(partial.rejectReason),
  };
}

export function getUiLabTerminalOrders(): TerminalOpsOrderRow[] {
  return [
    baseOrder({
      id: "ui-lab-term-ord-open-1",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      portfolioName: "Core Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "NPT",
      name: "Newport Petroleum",
      side: "buy",
      type: "limit",
      status: "open",
      quantity: 40,
      filledQuantity: 0,
      limitPrice: 42.5,
      averageFillPrice: null,
      estimatedValue: 1_700,
      submittedAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1),
      rejectReason: null,
      needsAttention: false,
    }),
    baseOrder({
      id: "ui-lab-term-ord-partial-1",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
      portfolioName: "ALTG Treasury",
      investorLabel: "Alta Group N.V.",
      ownerUserId: null,
      ownerCompanyId: UI_LAB_CORE_COMPANY_ID,
      symbol: "ALTG",
      name: "Alta Group",
      side: "sell",
      type: "limit",
      status: "partial",
      quantity: 100,
      filledQuantity: 35,
      limitPrice: 18.2,
      averageFillPrice: 18.25,
      estimatedValue: 1_820,
      submittedAt: daysFromNow(-2),
      updatedAt: daysFromNow(-1),
      rejectReason: null,
      needsAttention: false,
    }),
    baseOrder({
      id: "ui-lab-term-ord-filled-1",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalGrowth,
      portfolioName: "Growth Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "HARB",
      name: "Harbor Logistics",
      side: "buy",
      type: "market",
      status: "filled",
      quantity: 25,
      filledQuantity: 25,
      limitPrice: null,
      averageFillPrice: 31.4,
      estimatedValue: 785,
      submittedAt: daysFromNow(-4),
      updatedAt: daysFromNow(-4),
      rejectReason: null,
      needsAttention: false,
    }),
    baseOrder({
      id: "ui-lab-term-ord-cancelled-1",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      portfolioName: "Core Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "NPT",
      name: "Newport Petroleum",
      side: "buy",
      type: "limit",
      status: "cancelled",
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 40,
      averageFillPrice: null,
      estimatedValue: 400,
      submittedAt: daysFromNow(-6),
      updatedAt: daysFromNow(-5),
      rejectReason: null,
      needsAttention: false,
    }),
    baseOrder({
      id: "ui-lab-term-ord-rejected-1",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      portfolioName: "Core Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "NPT",
      name: "Newport Petroleum",
      side: "buy",
      type: "market",
      status: "rejected",
      quantity: 500,
      filledQuantity: 0,
      limitPrice: null,
      averageFillPrice: null,
      estimatedValue: 21_000,
      submittedAt: daysFromNow(-2),
      updatedAt: daysFromNow(-2),
      rejectReason: "Insufficient buying power",
      needsAttention: true,
    }),
    baseOrder({
      id: "ui-lab-term-ord-crypto-filled-nva",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      portfolioName: "Core Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "NVA",
      name: "Nova Coin",
      side: "buy",
      type: "market",
      status: "filled",
      quantity: 4,
      filledQuantity: 4,
      limitPrice: null,
      averageFillPrice: 5.0,
      estimatedValue: 20.2,
      submittedAt: daysFromNow(-3),
      updatedAt: daysFromNow(-3),
      rejectReason: null,
      needsAttention: false,
      instrumentKind: "CRYPTO",
      executionVenue: "ALTA_CRYPTO",
    }),
    baseOrder({
      id: "ui-lab-term-ord-crypto-filled-vlt",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      portfolioName: "Core Portfolio",
      investorLabel: UI_LAB_OWNER_LABEL,
      ownerUserId: UI_LAB_MOCK_USER.id,
      ownerCompanyId: null,
      symbol: "VLT",
      name: "Volt Coin",
      side: "buy",
      type: "market",
      status: "filled",
      quantity: 50,
      filledQuantity: 50,
      limitPrice: null,
      averageFillPrice: 0.1,
      estimatedValue: 5.05,
      submittedAt: daysFromNow(-5),
      updatedAt: daysFromNow(-5),
      rejectReason: null,
      needsAttention: false,
      instrumentKind: "CRYPTO",
      executionVenue: "ALTA_CRYPTO",
    }),
    baseOrder({
      id: "ui-lab-term-ord-crypto-rejected-npfc",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
      portfolioName: "ALTG Treasury",
      investorLabel: "Alta Group N.V.",
      ownerUserId: null,
      ownerCompanyId: UI_LAB_CORE_COMPANY_ID,
      symbol: "NPFC",
      name: "Newport Florin Coin",
      side: "buy",
      type: "market",
      status: "rejected",
      quantity: 10_000,
      filledQuantity: 0,
      limitPrice: null,
      averageFillPrice: null,
      estimatedValue: 10_010,
      submittedAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1),
      rejectReason: "Price impact limit exceeded (demonstration)",
      needsAttention: true,
      instrumentKind: "CRYPTO",
      executionVenue: "ALTA_CRYPTO",
    }),
  ];
}

export function getUiLabTerminalPortfolioDetail(
  portfolioId: string,
): TerminalOpsPortfolioDetail | null {
  const row = getUiLabTerminalPortfolios().find((p) => p.id === portfolioId);
  if (!row) return null;
  const orders = getUiLabTerminalOrders().filter((o) => o.portfolioId === portfolioId);
  const isEmpty = portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.personalEmpty;
  return {
    ...row,
    holdings: isEmpty
      ? []
      : [
          {
            symbol: "NPT",
            name: "Newport Petroleum",
            quantity: 120,
            marketValue: 5_100,
            totalReturnPercent: 8.2,
          },
          {
            symbol: "ALTG",
            name: "Alta Group",
            quantity: 80,
            marketValue: 1_456,
            totalReturnPercent: -1.4,
          },
          ...(portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore ||
          portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury
            ? [
                {
                  symbol: "NVA",
                  name: "Nova Coin (demonstration)",
                  quantity: 4,
                  marketValue: 20,
                  totalReturnPercent: 5.26,
                },
                {
                  symbol: "VLT",
                  name: "Volt Coin (demonstration)",
                  quantity: 50,
                  marketValue: 5,
                  totalReturnPercent: -9.09,
                },
                {
                  symbol: "NPFC",
                  name: "Newport Florin Coin (demonstration)",
                  quantity: 25,
                  marketValue: 25,
                  totalReturnPercent: 0,
                },
              ]
            : []),
        ],
    openOrders: orders.filter((o) => o.status === "open" || o.status === "partial"),
    recentOrders: orders,
    activity: isEmpty
      ? []
      : [
          {
            id: `${portfolioId}-act-crypto-1`,
            kind: "buy_fill" as const,
            title: "Buy fill · NVA",
            detail: "Demonstration crypto · 4 NVA @ ƒ5.00",
            occurredAt: daysFromNow(-3),
            amount: -20.2,
          },
          {
            id: `${portfolioId}-act-1`,
            kind: "buy_fill" as const,
            title: "Buy fill · NPT",
            detail: "25 shares @ ƒ31.40",
            occurredAt: daysFromNow(-4),
            amount: -785,
          },
          {
            id: `${portfolioId}-act-2`,
            kind: "dividend" as const,
            title: "Dividend · ALTG",
            detail: "Cash dividend",
            occurredAt: daysFromNow(-10),
            amount: 42.5,
          },
          {
            id: `${portfolioId}-act-3`,
            kind: "cash_deposit" as const,
            title: "Cash deposit",
            detail: "Transfer from Alta Bank",
            occurredAt: daysFromNow(-20),
            amount: 5_000,
          },
        ],
    fundingTransfers: isEmpty
      ? []
      : [
          {
            id: UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS.bankToTerminal,
            referenceCode: UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES.bankToTerminal,
            direction: "BANK_TO_TERMINAL" as const,
            status: "COMPLETED" as const,
            amount: 500,
            bankAccountMasked: "····0002",
            createdAt: daysFromNow(-1),
          },
        ],
  };
}

export function getUiLabTerminalOrderDetail(orderId: string): TerminalOpsOrderRow | null {
  return getUiLabTerminalOrders().find((o) => o.id === orderId) ?? null;
}

export function getUiLabTerminalAttention(opts?: {
  cryptoOpsScenario?: import("./ui-lab-crypto-ops-fixtures").UiLabCryptoOpsScenario;
}): TerminalOpsAttentionItem[] {
  const rejected = getUiLabTerminalOrders().filter((o) => o.status === "rejected");
  const items: TerminalOpsAttentionItem[] = rejected.map((o) => ({
    id: `attn-order-${o.id}`,
    kind: "rejected_order" as const,
    title: `Rejected order · ${o.symbol}`,
    detail: o.rejectReason ?? "Order rejected",
    href: `/internal/terminal/orders/${o.id}`,
    createdAt: o.updatedAt,
    portfolioId: o.portfolioId,
    orderId: o.id,
  }));
  for (const investor of getUiLabTerminalInvestors()) {
    if (!investor.needsAttention && investor.accessStatus !== "restricted") continue;
    items.push({
      id: `attn-investor-${investor.id}`,
      kind: "maintenance",
      title: `Restricted investor · ${investor.label}`,
      detail: investor.attentionDetail ?? "Terminal access restricted",
      href: investor.ownerUserId
        ? `/internal/users/${investor.ownerUserId}`
        : investor.ownerCompanyId
          ? `/internal/companies/${investor.ownerCompanyId}`
          : "/internal/terminal/investors",
      createdAt: investor.lastActivityAt ?? daysFromNow(-14),
    });
  }
  // Real integrity/recon/lifecycle incidents only — never demo/readiness banners.
  if (isUiLabMode()) {
    for (const item of getUiLabCryptoOpsDeskSummary(opts?.cryptoOpsScenario).needsAttention) {
      if (item.severity !== "CRITICAL" && item.severity !== "WARNING") continue;
      const kind =
        item.kind === "lifecycle" || item.kind === "status"
          ? ("crypto_lifecycle" as const)
          : ("crypto_reconciliation" as const);
      items.push({
        id: `attn-crypto-${item.symbol ?? item.kind}-${item.severity}`,
        kind,
        title: item.symbol ? `${item.symbol} · Crypto market` : "Crypto markets",
        detail: item.summary,
        href: item.href,
        createdAt: daysFromNow(-1),
        symbol: item.symbol,
      });
    }
  }
  return items;
}

export function getUiLabTerminalHomeSummary(): TerminalOpsHomeSummary {
  const environment = resolveTerminalOpsEnvironmentStatus();
  const portfolios = getUiLabTerminalPortfolios().filter((p) => p.status === "active");
  const orders = getUiLabTerminalOrders();
  const attention = getUiLabTerminalAttention();
  return {
    environment,
    attention,
    investorCount: getUiLabTerminalInvestors().length,
    activePortfolioCount: portfolios.length,
    openOrderCount: orders.filter((o) => o.status === "open" || o.status === "partial").length,
    rejectedOrderCount: orders.filter((o) => o.status === "rejected").length,
    recordedPortfolioValue: null,
    lastActivityAt: daysFromNow(-1),
  };
}

/** Terminal-scoped UI Lab search — investors, companies, portfolios, orders only. */
export function searchUiLabTerminalOps(
  query: string,
  limit = 30,
): import("@/lib/internal/ops-types").GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: import("@/lib/internal/ops-types").GlobalSearchResult[] = [];
  const exact: import("@/lib/internal/ops-types").GlobalSearchResult[] = [];
  const rest: import("@/lib/internal/ops-types").GlobalSearchResult[] = [];

  function push(
    bucket: "exact" | "rest",
    row: import("@/lib/internal/ops-types").GlobalSearchResult,
  ) {
    (bucket === "exact" ? exact : rest).push(row);
  }

  for (const order of getUiLabTerminalOrders()) {
    const hay = [order.symbol, order.name, order.id, order.portfolioName, order.investorLabel]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) continue;
    const row = {
      id: order.id,
      type: "terminal_order" as const,
      label: order.symbol,
      sublabel: formatTerminalOrderSearchSublabel(order),
      href: `/internal/terminal/orders/${order.id}?site=terminal`,
      status: order.status,
      date: order.submittedAt.slice(0, 10),
    };
    push(order.symbol.toLowerCase() === q || order.id.toLowerCase() === q ? "exact" : "rest", row);
  }

  for (const portfolio of getUiLabTerminalPortfolios()) {
    const hay = [portfolio.name, portfolio.ownerLabel, portfolio.id, portfolio.ownerType]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) continue;
    const row = {
      id: portfolio.id,
      type: "terminal_portfolio" as const,
      label: portfolio.name,
      sublabel: `${portfolio.ownerLabel} · ${portfolio.ownerType === "company" ? "Company" : "Personal"} · ${portfolio.status}`,
      href: `/internal/terminal/portfolios/${portfolio.id}?tab=overview&site=terminal`,
      status: portfolio.status,
    };
    push(
      portfolio.name.toLowerCase() === q || portfolio.id.toLowerCase() === q ? "exact" : "rest",
      row,
    );
  }

  for (const investor of getUiLabTerminalInvestors()) {
    const hay = [investor.label, investor.id, investor.kind].join(" ").toLowerCase();
    if (!hay.includes(q)) continue;
    if (investor.kind === "company" && investor.ownerCompanyId) {
      push(investor.label.toLowerCase() === q ? "exact" : "rest", {
        id: investor.ownerCompanyId,
        type: "company",
        label: investor.label,
        sublabel: "Company investor",
        href: `/internal/companies/${investor.ownerCompanyId}?tab=overview&site=terminal`,
        status: investor.accessStatus,
      });
    } else if (investor.ownerUserId) {
      push(investor.label.toLowerCase() === q ? "exact" : "rest", {
        id: investor.ownerUserId,
        type: "user",
        label: investor.label,
        sublabel: "Investor",
        href: `/internal/users/${investor.ownerUserId}?tab=overview&site=terminal`,
        status: investor.accessStatus,
      });
    }
  }

  for (const row of [...exact, ...rest]) {
    if (results.length >= limit) break;
    if (results.some((r) => r.type === row.type && r.id === row.id)) continue;
    results.push(row);
  }

  if (results.length < limit) {
    for (const crypto of searchUiLabCryptoMarkets(query, limit - results.length)) {
      if (results.some((r) => r.type === crypto.type && r.id === crypto.id)) continue;
      results.push(crypto);
      if (results.length >= limit) break;
    }
  }
  return results;
}
