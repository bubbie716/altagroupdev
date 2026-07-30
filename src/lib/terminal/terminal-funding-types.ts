/** Shared types for Alta Bank ↔ Alta Terminal funding transfers. */

export type TerminalFundingDirection = "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";

export type TerminalFundingStatus = "PENDING" | "COMPLETED" | "FAILED";

export type SubmitTerminalFundingTransferInput = {
  direction: TerminalFundingDirection;
  bankAccountId: string;
  portfolioId: string;
  amount: number;
  memo?: string | null;
  idempotencyKey?: string | null;
};

export type TerminalFundingReceipt = {
  id: string;
  referenceCode: string;
  direction: TerminalFundingDirection;
  status: TerminalFundingStatus;
  amount: number;
  currency: string;
  bankAccountId: string;
  bankAccountLabel: string;
  portfolioId: string;
  portfolioName: string;
  bankTransactionId: string | null;
  bankTransactionReference: string | null;
  resultingBankAvailable: number | null;
  resultingTerminalCash: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type TerminalFundingTransferRow = {
  id: string;
  referenceCode: string;
  direction: TerminalFundingDirection;
  status: TerminalFundingStatus;
  amount: number;
  currency: string;
  bankAccountId: string;
  bankAccountLabel: string;
  /** Masked for Terminal-only staff (e.g. ····100002). */
  bankAccountMasked: string;
  portfolioId: string;
  portfolioName: string;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  ownerLabel: string;
  bankTransactionId: string | null;
  bankTransactionReference: string | null;
  failureMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
};

export type TerminalFundingEligibility = {
  accounts: Array<{
    id: string;
    label: string;
    accountNumber: string;
    availableBalance: number;
    ownershipType: "PERSONAL" | "COMPANY";
    companyId: string | null;
    canDebit: boolean;
    canCredit: boolean;
    blockedReason: string | null;
  }>;
  portfolios: Array<{
    id: string;
    name: string;
    ownerType: "personal" | "company";
    ownerCompanyId: string | null;
    ownerUserId: string | null;
    availableCash: number;
    canFund: boolean;
    blockedReason: string | null;
  }>;
};

export const TERMINAL_FUNDING_TSE_DISCLAIMER =
  "This moves florins between your Alta Bank account and your Alta Terminal portfolio cash. It does not deposit funds into TSE custody or enable securities trading.";
