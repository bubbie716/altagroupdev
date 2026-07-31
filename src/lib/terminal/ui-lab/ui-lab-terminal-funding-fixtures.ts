/**
 * UI Lab demonstration fixtures for Bank ↔ Terminal funding.
 * Never mutates production or local real financial rows.
 */
import type { BankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import { UI_LAB_INTERNAL_ACCOUNT_CATALOG } from "@/lib/bank/ui-lab-money-ops-fixtures";
import {
  UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS,
  UI_LAB_TERMINAL_FUNDING_OWNER_IDS,
  UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES,
  UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS,
  UI_LAB_TERMINAL_PORTFOLIO_IDS,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-canonical-ids";
import type {
  SubmitTerminalFundingTransferInput,
  TerminalFundingEligibility,
  TerminalFundingReceipt,
  TerminalFundingTransferRow,
} from "@/lib/terminal/terminal-funding-types";

function accountFromCatalog(id: string) {
  const row = UI_LAB_INTERNAL_ACCOUNT_CATALOG.find((a) => a.id === id);
  if (!row) throw new Error(`Missing UI Lab bank account catalog entry: ${id}`);
  return row;
}

const personalChecking = accountFromCatalog(UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking);
const companyOperating = accountFromCatalog(UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.companyOperating);

export function getUiLabTerminalFundingEligibility(): TerminalFundingEligibility {
  return {
    accounts: [
      {
        id: personalChecking.id,
        label: `${personalChecking.accountName} · ${personalChecking.accountNumber}`,
        accountNumber: personalChecking.accountNumber,
        availableBalance: personalChecking.balance,
        ownershipType: "PERSONAL",
        companyId: null,
        canDebit: true,
        canCredit: true,
        blockedReason: null,
      },
      {
        id: companyOperating.id,
        label: `${companyOperating.accountName} · ${companyOperating.accountNumber}`,
        accountNumber: companyOperating.accountNumber,
        availableBalance: companyOperating.balance,
        ownershipType: "COMPANY",
        companyId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.companyId,
        canDebit: true,
        canCredit: true,
        blockedReason: null,
      },
      {
        id: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.frozenReserve,
        label: "Frozen Reserve · AB-2000-100099",
        accountNumber: "AB-2000-100099",
        availableBalance: 500,
        ownershipType: "PERSONAL",
        companyId: null,
        canDebit: false,
        canCredit: false,
        blockedReason: "This account is not active.",
      },
    ],
    portfolios: [
      {
        id: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
        name: "Core Portfolio",
        ownerType: "personal",
        ownerCompanyId: null,
        ownerUserId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.userId,
        availableCash: 2_450,
        canFund: true,
        blockedReason: null,
      },
      {
        id: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
        name: "ALTG Treasury",
        ownerType: "company",
        ownerCompanyId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.companyId,
        ownerUserId: null,
        availableCash: 18_200,
        canFund: true,
        blockedReason: null,
      },
      {
        id: UI_LAB_TERMINAL_PORTFOLIO_IDS.archived,
        name: "Archived book",
        ownerType: "personal",
        ownerCompanyId: null,
        ownerUserId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.userId,
        availableCash: 0,
        canFund: false,
        blockedReason: "This portfolio is archived.",
      },
    ],
  };
}

const FIXTURE_HISTORY: TerminalFundingTransferRow[] = [
  {
    id: UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS.bankToTerminal,
    referenceCode: UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES.bankToTerminal,
    direction: "BANK_TO_TERMINAL",
    status: "COMPLETED",
    amount: 500,
    currency: "FLR",
    bankAccountId: personalChecking.id,
    bankAccountLabel: `${personalChecking.accountName} · ${personalChecking.accountNumber}`,
    bankAccountMasked: "····0002",
    portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
    portfolioName: "Core Portfolio",
    ownerUserId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.userId,
    ownerCompanyId: null,
    ownerLabel: "carter",
    bankTransactionId: "TX-LAB-FUND-1",
    bankTransactionReference: UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES.bankToTerminal,
    failureMessage: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    completedAt: new Date(Date.now() - 86_400_000).toISOString(),
    failedAt: null,
  },
  {
    id: UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS.terminalToBank,
    referenceCode: UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES.terminalToBank,
    direction: "TERMINAL_TO_BANK",
    status: "COMPLETED",
    amount: 125,
    currency: "FLR",
    bankAccountId: personalChecking.id,
    bankAccountLabel: `${personalChecking.accountName} · ${personalChecking.accountNumber}`,
    bankAccountMasked: "····0002",
    portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
    portfolioName: "Core Portfolio",
    ownerUserId: UI_LAB_TERMINAL_FUNDING_OWNER_IDS.userId,
    ownerCompanyId: null,
    ownerLabel: "carter",
    bankTransactionId: "TX-LAB-FUND-2",
    bankTransactionReference: UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES.terminalToBank,
    failureMessage: null,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    completedAt: new Date(Date.now() - 172_800_000).toISOString(),
    failedAt: null,
  },
];

export function listUiLabTerminalFundingTransfers(filters?: {
  direction?: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
  status?: "PENDING" | "COMPLETED" | "FAILED";
  q?: string;
}): TerminalFundingTransferRow[] {
  return FIXTURE_HISTORY.filter((row) => {
    if (filters?.direction && row.direction !== filters.direction) return false;
    if (filters?.status && row.status !== filters.status) return false;
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      return (
        row.referenceCode.toLowerCase().includes(q) ||
        row.portfolioName.toLowerCase().includes(q) ||
        row.bankAccountLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function getUiLabTerminalFundingTransfer(
  transferId: string,
): TerminalFundingTransferRow | null {
  return FIXTURE_HISTORY.find((r) => r.id === transferId) ?? null;
}

export function mockUiLabTerminalFundingSubmission(
  input: SubmitTerminalFundingTransferInput,
  scenario: BankActionUiLabScenario = "success",
): TerminalFundingReceipt {
  const eligibility = getUiLabTerminalFundingEligibility();
  const account = eligibility.accounts.find((a) => a.id === input.bankAccountId);
  const portfolio = eligibility.portfolios.find((p) => p.id === input.portfolioId);

  if (scenario === "validation_error") {
    throw new Error("UI Lab: Please check the amount and try again.");
  }
  if (scenario === "server_error") {
    throw new Error("UI Lab: Temporary server issue. Your entries were preserved.");
  }
  if (
    input.bankAccountId === UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.frozenReserve ||
    account?.canDebit === false
  ) {
    throw new Error("UI Lab: This Bank account is frozen.");
  }
  if (
    input.portfolioId === UI_LAB_TERMINAL_PORTFOLIO_IDS.archived ||
    portfolio?.canFund === false
  ) {
    throw new Error("UI Lab: This portfolio cannot accept funding.");
  }
  if (
    input.direction === "BANK_TO_TERMINAL" &&
    account &&
    input.amount > account.availableBalance
  ) {
    throw new Error("UI Lab: Insufficient available Bank balance.");
  }
  if (
    input.direction === "TERMINAL_TO_BANK" &&
    portfolio &&
    input.amount > portfolio.availableCash
  ) {
    throw new Error("UI Lab: Insufficient Terminal available cash.");
  }

  const suffix = scenario === "idempotent_replay" ? "REPLAY" : "LAB";
  const referenceCode = `TFD-${suffix}-${Date.now().toString(36).toUpperCase()}`;
  const bankCash =
    input.direction === "BANK_TO_TERMINAL"
      ? (account?.availableBalance ?? 0) - input.amount
      : (account?.availableBalance ?? 0) + input.amount;
  const terminalCash =
    input.direction === "BANK_TO_TERMINAL"
      ? (portfolio?.availableCash ?? 0) + input.amount
      : (portfolio?.availableCash ?? 0) - input.amount;

  return {
    id: `TFT-${suffix}`,
    referenceCode,
    direction: input.direction,
    status: "COMPLETED",
    amount: input.amount,
    currency: "FLR",
    bankAccountId: input.bankAccountId,
    bankAccountLabel: account?.label ?? "UI Lab account",
    portfolioId: input.portfolioId,
    portfolioName: portfolio?.name ?? "UI Lab portfolio",
    bankTransactionId: `TX-${referenceCode}`,
    bankTransactionReference: referenceCode,
    resultingBankAvailable: bankCash,
    resultingTerminalCash: terminalCash,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

/** Throws when UI Lab scenario is eligibility_error. */
export function assertUiLabTerminalFundingEligibilityScenario(
  scenario: BankActionUiLabScenario | "eligibility_error",
): void {
  if (scenario === "eligibility_error") {
    throw new Error("UI Lab: Unable to load funding accounts and portfolios.");
  }
}
