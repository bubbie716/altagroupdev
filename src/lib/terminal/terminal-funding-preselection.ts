import type {
  TerminalFundingEligibility,
  TerminalFundingDirection,
} from "@/lib/terminal/terminal-funding-types";

export type TerminalFundingPreselection = {
  portfolioId: string;
  bankAccountId: string;
  /** True when a supplied portfolioId was kept because it is eligible. */
  portfolioPreselected: boolean;
  /** True when a supplied portfolioId was present but could not be used. */
  portfolioUnavailable: boolean;
  portfolioUnavailableReason: string | null;
};

function accountsCompatibleWithPortfolio(
  eligibility: TerminalFundingEligibility,
  portfolio: TerminalFundingEligibility["portfolios"][number] | undefined,
) {
  if (!portfolio) return eligibility.accounts;
  return eligibility.accounts.filter((a) => {
    if (portfolio.ownerType === "personal") return a.ownershipType === "PERSONAL";
    return a.ownershipType === "COMPANY" && a.companyId === portfolio.ownerCompanyId;
  });
}

function portfoliosCompatibleWithAccount(
  eligibility: TerminalFundingEligibility,
  account: TerminalFundingEligibility["accounts"][number] | undefined,
) {
  if (!account) return eligibility.portfolios;
  return eligibility.portfolios.filter((p) => {
    if (account.ownershipType === "PERSONAL") return p.ownerType === "personal";
    return p.ownerType === "company" && p.ownerCompanyId === account.companyId;
  });
}

function firstFundablePortfolio(
  portfolios: TerminalFundingEligibility["portfolios"],
) {
  return portfolios.find((p) => p.canFund) ?? portfolios[0] ?? null;
}

function firstUsableAccount(
  accounts: TerminalFundingEligibility["accounts"],
  direction?: TerminalFundingDirection | null,
) {
  if (direction === "BANK_TO_TERMINAL") {
    return accounts.find((a) => a.canDebit) ?? accounts[0] ?? null;
  }
  if (direction === "TERMINAL_TO_BANK") {
    return accounts.find((a) => a.canCredit) ?? accounts[0] ?? null;
  }
  return accounts.find((a) => a.canDebit || a.canCredit) ?? accounts[0] ?? null;
}

/**
 * Resolve portfolio/account selection after eligibility loads.
 * Never leaves an orphan ID that would blank a Select.
 */
export function resolveTerminalFundingPreselection(
  eligibility: TerminalFundingEligibility,
  defaults: {
    portfolioId?: string | null;
    bankAccountId?: string | null;
    direction?: TerminalFundingDirection | null;
  } = {},
): TerminalFundingPreselection {
  const requestedPortfolioId = defaults.portfolioId?.trim() || "";
  const requestedAccountId = defaults.bankAccountId?.trim() || "";

  let portfolioUnavailable = false;
  let portfolioUnavailableReason: string | null = null;
  let portfolioPreselected = false;

  let portfolio =
    (requestedPortfolioId
      ? eligibility.portfolios.find((p) => p.id === requestedPortfolioId)
      : undefined) ?? null;

  if (requestedPortfolioId) {
    if (!portfolio) {
      portfolioUnavailable = true;
      portfolioUnavailableReason =
        "The linked Terminal portfolio is unavailable. Choose another eligible portfolio.";
    } else if (!portfolio.canFund) {
      portfolioUnavailable = true;
      portfolioUnavailableReason =
        portfolio.blockedReason ??
        "The linked Terminal portfolio cannot be used for funding. Choose another eligible portfolio.";
      portfolio = null;
    } else {
      portfolioPreselected = true;
    }
  }

  if (!portfolio) {
    portfolio = firstFundablePortfolio(eligibility.portfolios);
  }

  const compatibleAccounts = accountsCompatibleWithPortfolio(eligibility, portfolio ?? undefined);
  let account =
    (requestedAccountId
      ? compatibleAccounts.find((a) => a.id === requestedAccountId)
      : undefined) ?? null;

  if (!account) {
    // Prefer an account that keeps the resolved portfolio in the compatible set.
    account = firstUsableAccount(compatibleAccounts, defaults.direction);
  }

  if (!account) {
    account = firstUsableAccount(eligibility.accounts, defaults.direction);
  }

  // If the chosen account would exclude the portfolio, prefer a portfolio compatible with the account.
  if (account && portfolio) {
    const compatiblePortfolios = portfoliosCompatibleWithAccount(eligibility, account);
    if (!compatiblePortfolios.some((p) => p.id === portfolio!.id)) {
      if (portfolioPreselected) {
        // Keep the deep-linked portfolio; re-pick a compatible account instead.
        account =
          firstUsableAccount(
            accountsCompatibleWithPortfolio(eligibility, portfolio),
            defaults.direction,
          ) ?? account;
      } else {
        portfolio = firstFundablePortfolio(compatiblePortfolios) ?? portfolio;
      }
    }
  }

  return {
    portfolioId: portfolio?.id ?? "",
    bankAccountId: account?.id ?? "",
    portfolioPreselected,
    portfolioUnavailable,
    portfolioUnavailableReason,
  };
}
