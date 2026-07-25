import type { TerminalPortfolioSummary } from "@/lib/terminal/types";

/** Portfolio row for the security-page order-ticket picker. */
export type SecurityPortfolioOption = TerminalPortfolioSummary & {
  buyingPower: number;
  /** Shares of the viewed security held in this portfolio (0 if none). */
  holdingQuantity: number;
};

export function formatPortfolioOwnerLine(portfolio: Pick<TerminalPortfolioSummary, "ownerType" | "ownerLabel">): string {
  return portfolio.ownerType === "personal" ? "Personal" : portfolio.ownerLabel;
}

export function formatPortfolioTicketLabel(
  portfolio: Pick<TerminalPortfolioSummary, "name" | "ownerType" | "ownerLabel"> | null | undefined,
): string | null {
  if (!portfolio) return null;
  return `${portfolio.name} · ${formatPortfolioOwnerLine(portfolio)}`;
}

export function groupSecurityPortfolios(portfolios: SecurityPortfolioOption[]) {
  return {
    personal: portfolios.filter((p) => p.ownerType === "personal"),
    company: portfolios.filter((p) => p.ownerType === "company"),
  };
}

export function tradeBlockReason(portfolio: SecurityPortfolioOption): string | null {
  if (!portfolio.capabilities.canView) return "You cannot view this portfolio";
  if (!portfolio.capabilities.canTrade) return "View only — trading not permitted";
  if (portfolio.status !== "active") return "Portfolio is not active";
  return null;
}
