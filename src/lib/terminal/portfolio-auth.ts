import type { CompanyRole } from "@/lib/auth/types";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canViewBusinessTreasury,
  findCompanyMembership,
} from "@/lib/auth/permissions";

/** View company Terminal portfolios (same roles as treasury view). */
export const TERMINAL_PORTFOLIO_VIEW_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
  "compliance_contact",
] as const;

/** Trade / rename / archive company Terminal portfolios. */
export const TERMINAL_PORTFOLIO_TRADE_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
] as const;

export function canViewCompanyTerminalPortfolio(user: AltaUser, companyId: string): boolean {
  return canViewBusinessTreasury(user, { companyId });
}

export function canTradeCompanyTerminalPortfolio(user: AltaUser, companyId: string): boolean {
  return canManageBusinessTreasury(user, { companyId });
}

export function canCreateCompanyTerminalPortfolio(user: AltaUser, companyId: string): boolean {
  return canManageBusinessTreasury(user, { companyId });
}

export function canRenameCompanyTerminalPortfolio(user: AltaUser, companyId: string): boolean {
  return canManageBusinessTreasury(user, { companyId });
}

export function canArchiveCompanyTerminalPortfolio(user: AltaUser, companyId: string): boolean {
  return canManageBusinessTreasury(user, { companyId });
}

export type TerminalPortfolioCapabilities = {
  canView: boolean;
  canTrade: boolean;
  canRename: boolean;
  canArchive: boolean;
};

export function personalPortfolioCapabilities(): TerminalPortfolioCapabilities {
  return { canView: true, canTrade: true, canRename: true, canArchive: true };
}

export function companyPortfolioCapabilities(
  user: AltaUser,
  companyId: string,
): TerminalPortfolioCapabilities {
  const membership = findCompanyMembership(user, { companyId });
  if (!membership) {
    return { canView: false, canTrade: false, canRename: false, canArchive: false };
  }
  return {
    canView: canViewCompanyTerminalPortfolio(user, companyId),
    canTrade: canTradeCompanyTerminalPortfolio(user, companyId),
    canRename: canRenameCompanyTerminalPortfolio(user, companyId),
    canArchive: canArchiveCompanyTerminalPortfolio(user, companyId),
  };
}
