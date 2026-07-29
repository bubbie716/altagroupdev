/** Shared helpers for Terminal Internal directories (Phase 7). */

import type {
  TerminalInvestorRow,
  TerminalOpsOrderRow,
  TerminalOpsPortfolioRow,
} from "@/lib/terminal/terminal-ops-types";
import {
  plainOrderSideLabel,
  plainOrderStatusLabel,
  plainOrderTypeLabel,
} from "@/lib/terminal/terminal-ops-types";

export const TERMINAL_LIST_PAGE_SIZE = 25;

export function investorNeedsAttention(row: Pick<TerminalInvestorRow, "needsAttention" | "accessStatus">): boolean {
  return row.needsAttention || row.accessStatus === "restricted";
}

export function sortInvestorsForDirectory(rows: TerminalInvestorRow[], attentionOnly = false): TerminalInvestorRow[] {
  const list = attentionOnly ? rows.filter(investorNeedsAttention) : [...rows];
  return list.sort((a, b) => {
    const aAtt = investorNeedsAttention(a) ? 0 : 1;
    const bAtt = investorNeedsAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    const aAct = a.lastActivityAt ?? "";
    const bAct = b.lastActivityAt ?? "";
    return bAct.localeCompare(aAct);
  });
}

export function investorTypeLabel(kind: TerminalInvestorRow["kind"]): string {
  if (kind === "company") return "Company";
  if (kind === "individual") return "Individual";
  return kind;
}

export function investorPortfolioCountLabel(row: TerminalInvestorRow): string {
  if (row.portfolioCount === 0) return "No portfolios";
  if (row.activePortfolioCount === row.portfolioCount) {
    return `${row.activePortfolioCount} active portfolio${row.activePortfolioCount === 1 ? "" : "s"}`;
  }
  return `${row.activePortfolioCount} active of ${row.portfolioCount}`;
}

export function sortPortfoliosForDirectory(
  rows: TerminalOpsPortfolioRow[],
  attentionOnly = false,
): TerminalOpsPortfolioRow[] {
  const list = attentionOnly ? rows.filter((r) => r.needsAttention) : [...rows];
  return list.sort((a, b) => {
    const aAtt = a.needsAttention ? 0 : 1;
    const bAtt = b.needsAttention ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    const aArch = a.status === "archived" ? 1 : 0;
    const bArch = b.status === "archived" ? 1 : 0;
    if (aArch !== bArch) return aArch - bArch;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function portfolioOwnerTypeLabel(ownerType: TerminalOpsPortfolioRow["ownerType"]): string {
  return ownerType === "company" ? "Company" : "Personal";
}

export function orderFillProgressLabel(row: Pick<TerminalOpsOrderRow, "filledQuantity" | "quantity">): string {
  return `${row.filledQuantity} of ${row.quantity} filled`;
}

/** Concise Terminal order search sublabel — distinguishes same-symbol rows. */
export function formatTerminalOrderSearchSublabel(
  order: Pick<
    TerminalOpsOrderRow,
    | "side"
    | "type"
    | "status"
    | "portfolioName"
    | "investorLabel"
    | "submittedAt"
    | "filledQuantity"
    | "quantity"
    | "limitPrice"
    | "id"
  >,
): string {
  const status = plainOrderStatusLabel(order.status);
  const submitted = order.submittedAt.slice(0, 16).replace("T", " ");
  const fill =
    order.status === "partial" || order.status === "filled"
      ? `${order.filledQuantity}/${order.quantity} filled`
      : null;
  const limit =
    order.type === "limit" && order.limitPrice != null ? `Limit ${order.limitPrice}` : null;
  // Short operator reference — not the raw internal id as the primary label.
  const ref = order.id.replace(/^ui-lab-term-ord-/, "").replace(/-/g, "·");
  return [
    plainOrderSideLabel(order.side),
    plainOrderTypeLabel(order.type),
    status,
    order.portfolioName,
    order.investorLabel,
    submitted,
    fill,
    limit,
    `Ref ${ref}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function sortOrdersForDirectory(
  rows: TerminalOpsOrderRow[],
  attentionOnly = false,
): TerminalOpsOrderRow[] {
  const list = attentionOnly ? rows.filter((r) => r.needsAttention || r.status === "rejected") : [...rows];
  const rank = (status: string, needsAttention: boolean) => {
    if (status === "rejected" || needsAttention) return 0;
    if (status === "open" || status === "partial") return 1;
    return 2;
  };
  return list.sort((a, b) => {
    const sr = rank(a.status, a.needsAttention) - rank(b.status, b.needsAttention);
    if (sr !== 0) return sr;
    return b.submittedAt.localeCompare(a.submittedAt);
  });
}

export type TerminalReadinessStatus = "ready" | "not_configured" | "not_implemented" | "failed";

export type TerminalReadinessItem = {
  id: string;
  label: string;
  status: TerminalReadinessStatus;
  detail?: string;
};

export function terminalReadinessLabel(status: TerminalReadinessStatus): string {
  if (status === "ready") return "Ready";
  if (status === "not_configured") return "Not configured";
  if (status === "failed") return "Failed";
  return "Not implemented";
}
