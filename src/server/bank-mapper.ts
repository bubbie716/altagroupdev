import type {
  BankAccountStatus as DbBankAccountStatus,
  BankAccountType as DbBankAccountType,
  BankTransactionStatus as DbBankTransactionStatus,
  BankTransactionType as DbBankTransactionType,
} from "@prisma/client";
import type {
  BankAccountStatusCode,
  BankAccountTypeCode,
  BankTransactionStatusCode,
  BankTransactionTypeCode,
  InternalBankAccountRow,
  InternalBankTransactionRow,
  UserBankAccount,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import { hasStoredProof, getProofFileUrl } from "@/lib/storage/proof-upload.constants";
import { getRoutingNumber } from "@/lib/bank/routing";
import { formatBankTransactionTypeLabel } from "@/lib/bank/transaction-display";
import { formatMonthlyInterestRateLabel } from "@/lib/bank/account-interest-service";
import { buildCustomerAccountStatus } from "@/lib/bank/account-status-copy";

const ACCOUNT_TYPE_TO_DB: Record<BankAccountTypeCode, DbBankAccountType> = {
  alta_access: "ALTA_ACCESS",
  checking: "CHECKING",
  savings: "SAVINGS",
  money_market: "MONEY_MARKET",
  reserve: "RESERVE",
  business_operating: "BUSINESS_OPERATING",
  private: "PRIVATE",
};

const ACCOUNT_TYPE_FROM_DB: Record<DbBankAccountType, BankAccountTypeCode> = {
  ALTA_ACCESS: "alta_access",
  CHECKING: "checking",
  SAVINGS: "savings",
  MONEY_MARKET: "money_market",
  RESERVE: "reserve",
  BUSINESS_OPERATING: "business_operating",
  PRIVATE: "private",
};

const ACCOUNT_STATUS_FROM_DB: Record<DbBankAccountStatus, BankAccountStatusCode> = {
  PENDING: "pending",
  ACTIVE: "active",
  FROZEN: "frozen",
  CLOSED: "closed",
};

const TRANSACTION_TYPE_FROM_DB: Record<DbBankTransactionType, BankTransactionTypeCode> = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  ADJUSTMENT: "adjustment",
  LOAN_PAYMENT: "loan_payment",
  INTEREST_CHARGE: "interest_charge",
  INTEREST_CREDIT: "interest_credit",
};

const TRANSACTION_STATUS_FROM_DB: Record<DbBankTransactionStatus, BankTransactionStatusCode> = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
  CANCELLED: "cancelled",
};

export function toDbBankAccountType(type: BankAccountTypeCode): DbBankAccountType {
  return ACCOUNT_TYPE_TO_DB[type];
}

export function fromDbBankAccountType(type: DbBankAccountType): BankAccountTypeCode {
  return ACCOUNT_TYPE_FROM_DB[type];
}

export function fromDbBankAccountStatus(status: DbBankAccountStatus): BankAccountStatusCode {
  return ACCOUNT_STATUS_FROM_DB[status];
}

export function fromDbBankTransactionType(type: DbBankTransactionType): BankTransactionTypeCode {
  return TRANSACTION_TYPE_FROM_DB[type];
}

export function fromDbBankTransactionStatus(status: DbBankTransactionStatus): BankTransactionStatusCode {
  return TRANSACTION_STATUS_FROM_DB[status];
}

function formatStatusLabel(status: BankAccountStatusCode): string {
  if (status === "pending") return "Under Review";
  if (status === "active") return "Active";
  if (status === "frozen") return "Frozen";
  return "Closed";
}

function formatTransactionStatusLabel(status: BankTransactionStatusCode): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTransactionTypeLabel(type: BankTransactionTypeCode): string {
  return formatBankTransactionTypeLabel(type);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

type BankAccountRecord = {
  id: string;
  userId: string;
  companyId: string | null;
  accountType: DbBankAccountType;
  accountName: string;
  accountNumber: string;
  status: DbBankAccountStatus;
  balance: { toNumber(): number };
  currency: string;
  openingNotes: string | null;
  restrictDeposits?: boolean;
  restrictWithdrawals?: boolean;
  restrictTransfers?: boolean;
  createdAt: Date;
  interestAccrualEnabled?: boolean;
  interestRate?: { toNumber(): number };
  company?: { name: string } | null;
  transactions?: { createdAt: Date; description: string; type: DbBankTransactionType }[];
};

export function mapUserBankAccount(account: BankAccountRecord): UserBankAccount {
  const accountType = fromDbBankAccountType(account.accountType);
  const status = fromDbBankAccountStatus(account.status);
  const balance = decimalToNumber(account.balance);
  const latest = account.transactions?.[0];

  let recentActivity = "No activity yet";
  if (latest) {
    recentActivity = latest.description;
  }

  return {
    id: account.id,
    accountName: account.accountName,
    accountType,
    accountTypeLabel: formatBankAccountTypeLabel(accountType),
    accountNumber: account.accountNumber,
    routingNumber: getRoutingNumber(),
    balance,
    availableBalance: balance,
    status,
    statusLabel: formatStatusLabel(status),
    currency: account.currency,
    companyId: account.companyId,
    companyName: account.company?.name ?? null,
    isCompanyAccount: Boolean(account.companyId),
    openingNotes: account.openingNotes,
    restrictDeposits: account.restrictDeposits ?? false,
    restrictWithdrawals: account.restrictWithdrawals ?? false,
    restrictTransfers: account.restrictTransfers ?? false,
    createdAt: account.createdAt.toISOString(),
    recentActivity,
    name: account.accountName,
    product: formatBankAccountTypeLabel(accountType),
    type: account.companyId ? "Business" : "Personal",
    interestAccrualEnabled: account.interestAccrualEnabled ?? false,
    interestRateLabel:
      account.interestAccrualEnabled && account.interestRate
        ? formatMonthlyInterestRateLabel(decimalToNumber(account.interestRate))
        : null,
    accountStatusInfo: buildCustomerAccountStatus({
      status,
      restrictDeposits: account.restrictDeposits ?? false,
      restrictWithdrawals: account.restrictWithdrawals ?? false,
      restrictTransfers: account.restrictTransfers ?? false,
      heldFunds: 0,
      pendingWithdrawals: 0,
    }),
  };
}

type BankTransactionRecord = {
  id: string;
  referenceCode: string;
  bankAccountId: string;
  type: DbBankTransactionType;
  amount: { toNumber(): number };
  status: DbBankTransactionStatus;
  description: string;
  memo: string | null;
  proofImageUrl: string | null;
  proofFileName: string | null;
  proofUploadedAt: Date | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  bankAccount: {
    accountName: string;
    accountNumber: string;
    user: { discordUsername: string };
    company?: { name: string } | null;
  };
};

export function mapUserBankTransaction(tx: BankTransactionRecord): UserBankTransaction {
  const type = fromDbBankTransactionType(tx.type);
  const status = fromDbBankTransactionStatus(tx.status);

  return {
    id: tx.id,
    referenceCode: tx.referenceCode,
    bankAccountId: tx.bankAccountId,
    accountName: tx.bankAccount.accountName,
    accountNumber: tx.bankAccount.accountNumber,
    type,
    typeLabel: formatTransactionTypeLabel(type),
    amount: decimalToNumber(tx.amount),
    status,
    statusLabel: formatTransactionStatusLabel(status),
    description: tx.description,
    memo: tx.memo,
    proofImageUrl: getProofFileUrl(tx.proofImageUrl, { transactionId: tx.id }),
    proofFileName: tx.proofFileName,
    proofUploadedAt: tx.proofUploadedAt?.toISOString() ?? null,
    hasProof: hasStoredProof(tx.proofImageUrl),
    createdAt: tx.createdAt.toISOString(),
    reviewedAt: tx.reviewedAt?.toISOString() ?? null,
    reviewNote: null,
  };
}

export function mapInternalBankAccountRow(account: BankAccountRecord & {
  user: { discordUsername: string };
}): InternalBankAccountRow {
  const accountType = fromDbBankAccountType(account.accountType);
  const status = fromDbBankAccountStatus(account.status);
  const holder = account.company?.name
    ? `${account.user.discordUsername} · ${account.company.name}`
    : account.user.discordUsername;

  return {
    id: account.id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    holder,
    product: formatBankAccountTypeLabel(accountType),
    balance: `ƒ${decimalToNumber(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    status: formatStatusLabel(status),
    companyName: account.company?.name ?? null,
    createdAt: account.createdAt.toISOString().slice(0, 10),
  };
}

export function mapInternalBankTransactionRow(tx: BankTransactionRecord): InternalBankTransactionRow {
  const type = fromDbBankTransactionType(tx.type);
  const status = fromDbBankTransactionStatus(tx.status);
  const holder = tx.bankAccount.company?.name
    ? `${tx.bankAccount.user.discordUsername} · ${tx.bankAccount.company.name}`
    : tx.bankAccount.user.discordUsername;

  return {
    id: tx.id,
    referenceCode: tx.referenceCode,
    type: formatTransactionTypeLabel(type),
    account: tx.bankAccount.accountNumber,
    holder,
    amount: `ƒ${decimalToNumber(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    method: tx.description,
    status: formatTransactionStatusLabel(status),
    submitted: tx.createdAt.toISOString(),
    proofImageUrl: getProofFileUrl(tx.proofImageUrl, { transactionId: tx.id }),
    proofFileName: tx.proofFileName,
    proofUploadedAt: tx.proofUploadedAt?.toISOString() ?? null,
    hasProof: hasStoredProof(tx.proofImageUrl),
    description: tx.description,
    memo: tx.memo,
  };
}

export function mapAccountCardStatus(status: BankAccountStatusCode): "Active" | "Restricted" | "Under Review" {
  if (status === "active") return "Active";
  if (status === "pending") return "Under Review";
  return "Restricted";
}
