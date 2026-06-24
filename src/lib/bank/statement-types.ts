import type { UserBankTransaction } from "@/lib/bank/backend-types";

export type BankStatementStatusCode = "draft" | "generated" | "void";

export interface BankStatementSummary {
  id: string;
  statementNumber: string;
  bankAccountId: string;
  accountName: string;
  accountNumber: string;
  ownerLabel: string;
  isCompanyAccount: boolean;
  companyName: string | null;
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  transactionCount: number;
  status: BankStatementStatusCode;
  statusLabel: string;
  generatedAt: string | null;
  createdAt: string;
}

export interface BankStatementDetail extends BankStatementSummary {
  routingNumber: string;
  currency: string;
  netChange: number;
  transactions: UserBankTransaction[];
  /** True when opening balance is derived from transaction history only (no ledger snapshot). */
  openingBalanceEstimated: boolean;
}

export interface GenerateStatementInput {
  accountId: string;
  periodStart: string;
  periodEnd: string;
}

export interface InternalStatementOpsSummary {
  recentStatements: BankStatementSummary[];
  voidedCount: number;
  errorPlaceholder: string;
}
