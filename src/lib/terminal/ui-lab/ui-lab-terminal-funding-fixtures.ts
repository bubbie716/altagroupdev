/**
 * UI Lab demonstration fixtures for Bank ↔ Terminal funding.
 * Never mutates production or local real financial rows.
 */
import { getBankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import type {
  SubmitTerminalFundingTransferInput,
  TerminalFundingEligibility,
  TerminalFundingReceipt,
  TerminalFundingTransferRow,
} from "@/lib/terminal/terminal-funding-types";

const LAB_ACCOUNT_ID = "BA-LAB-CHECKING";
const LAB_COMPANY_ACCOUNT_ID = "BA-LAB-OPERATING";
const LAB_PORTFOLIO_ID = "TP-LAB-PERSONAL";
const LAB_COMPANY_PORTFOLIO_ID = "TP-LAB-COMPANY";

export function getUiLabTerminalFundingEligibility(): TerminalFundingEligibility {
  return {
    accounts: [
      {
        id: LAB_ACCOUNT_ID,
        label: "Personal Checking · AB-2000-100002",
        accountNumber: "AB-2000-100002",
        availableBalance: 12_500,
        ownershipType: "PERSONAL",
        companyId: null,
        canDebit: true,
        canCredit: true,
        blockedReason: null,
      },
      {
        id: LAB_COMPANY_ACCOUNT_ID,
        label: "Business Operating · AB-5000-100020",
        accountNumber: "AB-5000-100020",
        availableBalance: 84_000,
        ownershipType: "COMPANY",
        companyId: "CO-LAB-1",
        canDebit: true,
        canCredit: true,
        blockedReason: null,
      },
      {
        id: "BA-LAB-FROZEN",
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
        id: LAB_PORTFOLIO_ID,
        name: "Primary",
        ownerType: "personal",
        ownerCompanyId: null,
        ownerUserId: "UI-LAB-USER",
        availableCash: 2_450,
        canFund: true,
        blockedReason: null,
      },
      {
        id: LAB_COMPANY_PORTFOLIO_ID,
        name: "Treasury",
        ownerType: "company",
        ownerCompanyId: "CO-LAB-1",
        ownerUserId: null,
        availableCash: 18_200,
        canFund: true,
        blockedReason: null,
      },
      {
        id: "TP-LAB-ARCHIVED",
        name: "Archived book",
        ownerType: "personal",
        ownerCompanyId: null,
        ownerUserId: "UI-LAB-USER",
        availableCash: 0,
        canFund: false,
        blockedReason: "This portfolio is archived.",
      },
    ],
  };
}

const FIXTURE_HISTORY: TerminalFundingTransferRow[] = [
  {
    id: "TFT-LAB-1",
    referenceCode: "TFD-LAB-0001",
    direction: "BANK_TO_TERMINAL",
    status: "COMPLETED",
    amount: 500,
    currency: "FLR",
    bankAccountId: LAB_ACCOUNT_ID,
    bankAccountLabel: "Personal Checking · AB-2000-100002",
    bankAccountMasked: "····0002",
    portfolioId: LAB_PORTFOLIO_ID,
    portfolioName: "Primary",
    ownerUserId: "UI-LAB-USER",
    ownerCompanyId: null,
    ownerLabel: "carter",
    bankTransactionId: "TX-LAB-FUND-1",
    bankTransactionReference: "TFD-LAB-0001",
    failureMessage: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    completedAt: new Date(Date.now() - 86_400_000).toISOString(),
    failedAt: null,
  },
  {
    id: "TFT-LAB-2",
    referenceCode: "TFD-LAB-0002",
    direction: "TERMINAL_TO_BANK",
    status: "COMPLETED",
    amount: 125,
    currency: "FLR",
    bankAccountId: LAB_ACCOUNT_ID,
    bankAccountLabel: "Personal Checking · AB-2000-100002",
    bankAccountMasked: "····0002",
    portfolioId: LAB_PORTFOLIO_ID,
    portfolioName: "Primary",
    ownerUserId: "UI-LAB-USER",
    ownerCompanyId: null,
    ownerLabel: "carter",
    bankTransactionId: "TX-LAB-FUND-2",
    bankTransactionReference: "TFD-LAB-0002",
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
): TerminalFundingReceipt {
  const scenario = getBankActionUiLabScenario();
  const eligibility = getUiLabTerminalFundingEligibility();
  const account = eligibility.accounts.find((a) => a.id === input.bankAccountId);
  const portfolio = eligibility.portfolios.find((p) => p.id === input.portfolioId);

  if (scenario === "validation_error") {
    throw new Error("UI Lab: Please check the amount and try again.");
  }
  if (scenario === "server_error") {
    throw new Error("UI Lab: Temporary server issue. Your entries were preserved.");
  }
  if (input.bankAccountId === "BA-LAB-FROZEN" || account?.canDebit === false) {
    throw new Error("UI Lab: This Bank account is frozen.");
  }
  if (input.portfolioId === "TP-LAB-ARCHIVED" || portfolio?.canFund === false) {
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
