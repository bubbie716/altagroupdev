import type { OrderRecord, OrderStatus, PortfolioActivityKind } from "@/lib/terminal/types";
import type { TerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";

export type TerminalInvestorKind = "individual" | "company";

export type TerminalInvestorRow = {
  id: string;
  kind: TerminalInvestorKind;
  label: string;
  portfolioCount: number;
  activePortfolioCount: number;
  accessStatus: "active" | "restricted" | "unknown";
  needsAttention: boolean;
  attentionDetail: string | null;
  lastActivityAt: string | null;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
};

export type TerminalOpsPortfolioRow = {
  id: string;
  name: string;
  ownerType: "personal" | "company";
  ownerLabel: string;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  status: "active" | "archived";
  isDefault: boolean;
  totalValue: number | null;
  cashBalance: number | null;
  buyingPower: number | null;
  openOrderCount: number;
  lastActivityAt: string | null;
  needsAttention: boolean;
  attentionDetail: string | null;
  dataTrustworthy: boolean;
  updatedAt: string;
  createdAt: string;
};

export type TerminalOpsOrderRow = OrderRecord & {
  portfolioName: string;
  investorLabel: string;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  needsAttention: boolean;
};

export type TerminalOpsAttentionItem = {
  id: string;
  kind:
    | "rejected_order"
    | "failed_order"
    | "stale_open_order"
    | "connection_unavailable"
    | "portfolio_access"
    | "maintenance";
  title: string;
  detail: string;
  href: string;
  createdAt: string;
  portfolioId?: string;
  orderId?: string;
};

export type TerminalOpsHomeSummary = {
  environment: TerminalOpsEnvironmentStatus;
  attention: TerminalOpsAttentionItem[];
  investorCount: number;
  activePortfolioCount: number;
  openOrderCount: number;
  rejectedOrderCount: number;
  recordedPortfolioValue: number | null;
  lastActivityAt: string | null;
};

export type TerminalOpsPortfolioDetail = TerminalOpsPortfolioRow & {
  holdings: Array<{
    symbol: string;
    name: string;
    quantity: number;
    marketValue: number;
    totalReturnPercent: number;
  }>;
  openOrders: TerminalOpsOrderRow[];
  recentOrders: TerminalOpsOrderRow[];
  activity: Array<{
    id: string;
    kind: PortfolioActivityKind;
    title: string;
    detail: string;
    occurredAt: string;
    amount: number | null;
  }>;
  /** Recent Bank ↔ Terminal funding; Bank account is masked for Terminal-only staff. */
  fundingTransfers?: Array<{
    id: string;
    referenceCode: string;
    direction: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
    status: "PENDING" | "COMPLETED" | "FAILED";
    amount: number;
    bankAccountMasked: string;
    createdAt: string;
  }>;
};

export const TERMINAL_ORDER_LIST_FILTERS = [
  "all",
  "open",
  "partial",
  "filled",
  "cancelled",
  "rejected",
] as const;

export type TerminalOrderListFilter = (typeof TERMINAL_ORDER_LIST_FILTERS)[number];

export const TERMINAL_ORDER_FILTER_LABELS: Record<TerminalOrderListFilter, string> = {
  all: "All",
  open: "Open",
  partial: "Partially filled",
  filled: "Filled",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

export const TERMINAL_PORTFOLIO_LIST_FILTERS = [
  "all",
  "personal",
  "company",
  "active",
  "archived",
  "needs_attention",
] as const;

export type TerminalPortfolioListFilter = (typeof TERMINAL_PORTFOLIO_LIST_FILTERS)[number];

export const TERMINAL_PORTFOLIO_FILTER_LABELS: Record<TerminalPortfolioListFilter, string> = {
  all: "All",
  personal: "Personal",
  company: "Company",
  active: "Active",
  archived: "Archived",
  needs_attention: "Needs attention",
};

export const TERMINAL_INVESTOR_LIST_FILTERS = [
  "all",
  "individuals",
  "companies",
  "active",
  "restricted",
  "needs_attention",
] as const;

export type TerminalInvestorListFilter = (typeof TERMINAL_INVESTOR_LIST_FILTERS)[number];

export const TERMINAL_INVESTOR_FILTER_LABELS: Record<TerminalInvestorListFilter, string> = {
  all: "All",
  individuals: "Individuals",
  companies: "Companies",
  active: "Active",
  restricted: "Restricted",
  needs_attention: "Needs attention",
};

export const TERMINAL_PORTFOLIO_ACTIVITY_FILTERS = [
  "all",
  "cash",
  "orders",
  "dividends",
  "fees",
  "adjustments",
  "operator",
] as const;

export type TerminalPortfolioActivityFilter = (typeof TERMINAL_PORTFOLIO_ACTIVITY_FILTERS)[number];

export function parseTerminalOrderListFilter(raw: string | undefined | null): TerminalOrderListFilter {
  if (raw && (TERMINAL_ORDER_LIST_FILTERS as readonly string[]).includes(raw)) {
    return raw as TerminalOrderListFilter;
  }
  return "all";
}

export function parseTerminalPortfolioListFilter(
  raw: string | undefined | null,
): TerminalPortfolioListFilter {
  if (raw && (TERMINAL_PORTFOLIO_LIST_FILTERS as readonly string[]).includes(raw)) {
    return raw as TerminalPortfolioListFilter;
  }
  return "all";
}

export function parseTerminalInvestorListFilter(
  raw: string | undefined | null,
): TerminalInvestorListFilter {
  if (raw && (TERMINAL_INVESTOR_LIST_FILTERS as readonly string[]).includes(raw)) {
    return raw as TerminalInvestorListFilter;
  }
  return "all";
}

export function plainOrderStatusLabel(status: OrderStatus | string): string {
  const s = String(status).toLowerCase();
  if (s === "open") return "Open";
  if (s === "partial") return "Partially filled";
  if (s === "filled") return "Filled";
  if (s === "cancelled") return "Cancelled";
  if (s === "rejected") return "Rejected";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function plainOrderSideLabel(side: string): string {
  return side.toLowerCase() === "sell" ? "Sell" : "Buy";
}

export function plainOrderTypeLabel(type: string): string {
  return type.toLowerCase() === "limit" ? "Limit" : "Market";
}

export type OrderLifecycleStage = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming" | "skipped";
  at?: string | null;
  detail?: string | null;
};

export function buildOrderLifecycle(order: OrderRecord): OrderLifecycleStage[] {
  const status = order.status;
  const submitted: OrderLifecycleStage = {
    id: "submitted",
    label: "Submitted",
    state: "complete",
    at: order.submittedAt,
  };
  const open: OrderLifecycleStage = {
    id: "open",
    label: "Open",
    state:
      status === "open"
        ? "current"
        : status === "partial" || status === "filled"
          ? "complete"
          : status === "cancelled" || status === "rejected"
            ? "skipped"
            : "upcoming",
    at: status === "open" || status === "partial" || status === "filled" ? order.updatedAt : null,
  };
  const partial: OrderLifecycleStage = {
    id: "partial",
    label: "Partially filled",
    state:
      status === "partial"
        ? "current"
        : status === "filled"
          ? "complete"
          : status === "open"
            ? "upcoming"
            : "skipped",
    at: status === "partial" || status === "filled" ? order.updatedAt : null,
    detail:
      order.filledQuantity > 0
        ? `${order.filledQuantity} of ${order.quantity} filled`
        : null,
  };
  const terminalLabel =
    status === "rejected" ? "Rejected" : status === "cancelled" ? "Cancelled" : "Filled";
  const terminal: OrderLifecycleStage = {
    id: status === "rejected" ? "rejected" : status === "cancelled" ? "cancelled" : "filled",
    label: terminalLabel,
    state:
      status === "filled" || status === "cancelled" || status === "rejected"
        ? "complete"
        : "upcoming",
    at: status === "filled" || status === "cancelled" || status === "rejected" ? order.updatedAt : null,
    detail: status === "rejected" ? order.rejectReason : null,
  };
  return [submitted, open, partial, terminal];
}

export function orderNeedsAttention(order: Pick<OrderRecord, "status" | "rejectReason">): boolean {
  return order.status === "rejected" || Boolean(order.rejectReason);
}

export function availableOrderActions(
  order: Pick<OrderRecord, "status">,
  ordersMutable: boolean,
): Array<"cancel"> {
  if (!ordersMutable) return [];
  if (order.status === "open" || order.status === "partial") return ["cancel"];
  return [];
}

export function orderMatchesListFilter(
  order: Pick<OrderRecord, "status">,
  filter: TerminalOrderListFilter,
): boolean {
  if (filter === "all") return true;
  return order.status === filter;
}

export function portfolioMatchesListFilter(
  row: TerminalOpsPortfolioRow,
  filter: TerminalPortfolioListFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "personal") return row.ownerType === "personal";
  if (filter === "company") return row.ownerType === "company";
  if (filter === "active") return row.status === "active";
  if (filter === "archived") return row.status === "archived";
  if (filter === "needs_attention") return row.needsAttention;
  return true;
}

export function investorMatchesListFilter(
  row: TerminalInvestorRow,
  filter: TerminalInvestorListFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "individuals") return row.kind === "individual";
  if (filter === "companies") return row.kind === "company";
  if (filter === "active") return row.accessStatus === "active";
  if (filter === "restricted") return row.accessStatus === "restricted";
  if (filter === "needs_attention") return row.needsAttention;
  return true;
}

export function activityMatchesTerminalFilter(
  kind: PortfolioActivityKind,
  filter: TerminalPortfolioActivityFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "cash") return kind === "cash_deposit" || kind === "cash_withdrawal";
  if (filter === "orders") return kind === "buy_fill" || kind === "sell_fill";
  if (filter === "dividends") return kind === "dividend";
  if (filter === "fees") return kind === "trading_fee";
  if (filter === "adjustments") return kind === "adjustment" || kind === "realized_gain_loss";
  if (filter === "operator") return kind === "adjustment";
  return true;
}

export function plainActivityKindTitle(kind: PortfolioActivityKind): string {
  switch (kind) {
    case "cash_deposit":
      return "Cash deposit";
    case "cash_withdrawal":
      return "Cash withdrawal";
    case "buy_fill":
      return "Buy fill";
    case "sell_fill":
      return "Sell fill";
    case "dividend":
      return "Dividend";
    case "trading_fee":
      return "Trading fee";
    case "adjustment":
      return "Adjustment";
    case "realized_gain_loss":
      return "Realized gain/loss";
  }
}
