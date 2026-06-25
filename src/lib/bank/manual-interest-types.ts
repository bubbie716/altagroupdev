import type { BankAccountStatusCode, BankAccountTypeCode } from "@/lib/bank/backend-types";

export type ManualInterestMode = "PERCENTAGE" | "FIXED_AMOUNT";

export type ManualInterestCategoryCode = BankAccountTypeCode | "all";

export interface ManualInterestApplicationInput {
  mode: ManualInterestMode;
  /** Human-readable percent, e.g. 2 = 2%. */
  percentageRate?: number;
  fixedAmount?: number;
  /** Selected categories, or `["all"]` for every eligible type. */
  accountTypes: ManualInterestCategoryCode[];
  reason: string;
  internalNote?: string;
  /** Client-generated key to prevent duplicate batch submission. */
  idempotencyKey?: string;
}

export interface ManualInterestPreviewAccountRow {
  accountId: string;
  accountName: string;
  accountNumber: string;
  ownerLabel: string;
  accountType: BankAccountTypeCode;
  accountTypeLabel: string;
  status: BankAccountStatusCode;
  statusLabel: string;
  currentBalance: number;
  interestCredit: number;
  projectedBalance: number;
  eligible: boolean;
  skipReason?: string;
}

export interface ManualInterestPreviewResult {
  mode: ManualInterestMode;
  selectedCategoryLabels: string[];
  affectedAccountCount: number;
  skippedAccountCount: number;
  totalBalancesAffected: number;
  totalInterestToCredit: number;
  estimatedAverageCredit: number;
  accounts: ManualInterestPreviewAccountRow[];
  skippedAccounts: ManualInterestPreviewAccountRow[];
}

export interface ManualInterestApplyAccountResult {
  accountId: string;
  accountNumber: string;
  status: "processed" | "skipped" | "failed";
  interestAmount?: number;
  transactionId?: string;
  referenceCode?: string;
  reason?: string;
}

export interface ManualInterestApplyResult {
  batchReferenceId: string;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  totalInterestCredited: number;
  results: ManualInterestApplyAccountResult[];
  idempotentReplay?: boolean;
}

export const MANUAL_INTEREST_CATEGORY_OPTIONS: {
  value: ManualInterestCategoryCode;
  label: string;
}[] = [
  { value: "all", label: "All Categories" },
  { value: "alta_access", label: "Alta Access" },
  { value: "checking", label: "Alta Checking" },
  { value: "savings", label: "Alta Savings" },
  { value: "money_market", label: "Alta Money Market" },
  { value: "business_operating", label: "Business Operating Account" },
  { value: "reserve", label: "Reserve Account by Alta Private" },
  { value: "private", label: "Summit Money Market by Alta Private" },
];

export const MANUAL_INTEREST_CONFIRMATION_PHRASE = "APPLY INTEREST";
