export type BankAccountTypeCode =
  | "alta_access"
  | "checking"
  | "savings"
  | "money_market"
  | "reserve"
  | "business_operating"
  | "private";

export type BankAccountStatusCode = "pending" | "active" | "frozen" | "closed";

/** Customer-safe account status snapshot — no internal operator data. */
export interface CustomerAccountStatus {
  accountStatus: BankAccountStatusCode;
  restrictDeposits: boolean;
  restrictWithdrawals: boolean;
  restrictTransfers: boolean;
  heldFunds: number;
  pendingWithdrawals: number;
  inGoodStanding: boolean;
  hasIssues: boolean;
  headline: string;
  notices: string[];
}

export type BankTransactionTypeCode =
  | "deposit"
  | "withdrawal"
  | "adjustment"
  | "loan_payment"
  | "interest_charge"
  | "interest_credit";

export type BankTransactionStatusCode = "pending" | "approved" | "denied" | "cancelled";

export interface UserBankAccount {
  id: string;
  accountName: string;
  accountType: BankAccountTypeCode;
  accountTypeLabel: string;
  accountNumber: string;
  routingNumber: string;
  balance: number;
  availableBalance: number;
  status: BankAccountStatusCode;
  statusLabel: string;
  currency: string;
  companyId: string | null;
  companyName: string | null;
  isCompanyAccount: boolean;
  openingNotes: string | null;
  restrictDeposits: boolean;
  restrictWithdrawals: boolean;
  restrictTransfers: boolean;
  createdAt: string;
  recentActivity: string;
  /** UI-compat fields for AccountCard */
  name: string;
  product: string;
  type: string;
  interestAccrualEnabled: boolean;
  interestRateLabel: string | null;
  accountStatusInfo: CustomerAccountStatus;
}

export interface AccountInterestInfo {
  applicable: boolean;
  lastInterestDate?: string | null;
  lastInterestAmount?: number | null;
}

export interface UserBankAccountDetail extends UserBankAccount {
  ownerLabel: string;
  depositsThisMonth: number;
  withdrawalsThisMonth: number;
  netChangeThisMonth: number;
  availableBalance: number;
  recentTransactions: UserBankTransaction[];
  interestInfo: AccountInterestInfo;
}

export interface OpenBankAccountResult {
  accountId: string;
  accountName: string;
  accountTypeLabel: string;
  accountNumber: string;
  routingNumber: string;
  statusLabel: string;
  instant: boolean;
}

export interface UserBankTransaction {
  id: string;
  referenceCode: string;
  bankAccountId: string;
  accountName: string;
  accountNumber: string;
  type: BankTransactionTypeCode;
  typeLabel: string;
  amount: number;
  status: BankTransactionStatusCode;
  statusLabel: string;
  description: string;
  memo: string | null;
  proofImageUrl: string | null;
  proofFileName: string | null;
  proofUploadedAt: string | null;
  hasProof: boolean;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** Customer deposit/withdrawal request visible on Deposit and Withdraw pages. */
export interface BankRequestInProgress {
  id: string;
  referenceCode: string;
  bankAccountId: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  status: Extract<BankTransactionStatusCode, "pending" | "approved" | "denied">;
  statusLabel: string;
  denialMessage: string | null;
  submittedAt: string;
  lastUpdatedAt: string;
  proofImageUrl: string | null;
  hasProof: boolean;
}

export interface UserBankDashboard {
  totalRelationshipValue: number;
  checkingBalance: number;
  savingsBalance: number;
  privateBalance: number;
  moneyMarketBalance: number;
  businessBalance: number;
  creditAvailable: number;
  privateStatus: string;
  enrolledInPrivate: boolean;
  accountCount: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

export interface UserBankSummary {
  totalBalance: number;
  activeAccountCount: number;
  pendingAccountCount: number;
  pendingDepositCount: number;
  pendingWithdrawalCount: number;
}

export interface OpenBankAccountInput {
  accountType: BankAccountTypeCode;
  accountName: string;
  ownership: "personal" | "company";
  companyId?: string;
  openingNotes?: string;
}

export interface SubmitDepositInput {
  bankAccountId: string;
  amount: number;
  memo?: string;
}

export interface BankProofInput {
  proofImageUrl: string;
  proofFileName: string;
  proofMimeType: string;
  proofSizeBytes: number;
  proofUploadedAt: Date;
}

export interface SubmitWithdrawalInput {
  bankAccountId: string;
  amount: number;
  memo?: string;
}

export interface SubmitInternalTransferInput {
  fromAccountId: string;
  toAccountId?: string;
  toAccountNumber?: string;
  amount: number;
  memo?: string;
}

export interface UserBankTransfer {
  id: string;
  referenceCode: string;
  fromAccountId: string;
  fromAccountName: string;
  fromAccountNumber: string;
  toAccountId: string;
  toAccountName: string;
  toAccountNumber: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  direction: "sent" | "received";
}

export type TransferContactScopeCode = "intrabank" | "interbank";
export type IntrabankContactKindCode = "own_account" | "player_account";

export interface TransferContact {
  id: string;
  scope: TransferContactScopeCode;
  label: string;
  intrabankKind: IntrabankContactKindCode | null;
  bankAccountId: string | null;
  accountNumber: string | null;
  resolvedName: string | null;
  recipientInstitution: string | null;
  recipientName: string | null;
  routingNumber: string | null;
  wireAccountNumber: string | null;
  createdAt: string;
}

export interface CreateIntrabankTransferContactInput {
  recipientName: string;
  accountNumber: string;
}

export interface CreateInterbankTransferContactInput {
  recipientInstitution: string;
  recipientName: string;
  routingNumber: string;
  wireAccountNumber: string;
}

export interface InternalBankAccountRow {
  id: string;
  accountNumber: string;
  accountName: string;
  holder: string;
  product: string;
  balance: string;
  status: string;
  companyName: string | null;
  createdAt: string;
}

export interface InternalBankTransactionRow {
  id: string;
  referenceCode: string;
  type: string;
  account: string;
  holder: string;
  amount: string;
  method: string;
  status: string;
  submitted: string;
  proofImageUrl: string | null;
  proofFileName: string | null;
  proofUploadedAt: string | null;
  hasProof: boolean;
  description: string;
  memo: string | null;
}

export interface InternalBankOpsSummary {
  totalAccounts: number;
  pendingAccountOpenings: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  frozenAccounts: number;
  lendingQueue: number;
  transfersInReview: number;
  privateInvitesPending: number;
  altaPayCountThisMonth: number;
  altaPayVolumeThisMonth: number;
}

export interface InternalBankAccountDetail {
  id: string;
  accountNumber: string;
  accountName: string;
  holder: string;
  ownerUserId: string;
  product: string;
  balance: number;
  currency: string;
  status: string;
  routingNumber: string;
  companyId: string | null;
  companyName: string | null;
  openingNotes: string | null;
  createdAt: string;
  updatedAt: string;
  pendingTransactions: InternalBankTransactionRow[];
  recentTransactions: InternalBankTransactionRow[];
}

export type AdminAccountAdjustmentInput = {
  accountId: string;
  direction: "credit" | "debit";
  amount: number;
  reason: string;
  referenceCode?: string;
  allowOverdraft?: boolean;
  /** When set, used as the customer-facing bank transaction description. */
  customerDescription?: string;
  /** Customer-safe explanation for notifications — never internal staff notes. */
  customerFacingReason?: string | null;
  /** When true, skip customer Discord / in-app notifications. */
  silentNotification?: boolean;
};

export type InternalBankAccountFilters = {
  q?: string;
  accountType?: string;
  status?: string;
  companyId?: string;
};

export const BANK_ACCOUNT_TYPE_OPTIONS: { value: BankAccountTypeCode; label: string; description: string }[] = [
  { value: "alta_access", label: "Alta Access", description: "Starter account for new Newport citizens." },
  { value: "checking", label: "Alta Checking", description: "Primary operating account." },
  { value: "savings", label: "Alta Savings", description: "A simple savings account for building Florin reserves." },
  {
    value: "money_market",
    label: "Alta Money Market",
    description: "Higher-yield money market account — opens immediately.",
  },
  {
    value: "reserve",
    label: "Reserve Account by Alta Private",
    description: "Ultra-secure reserve account — Alta Private members only.",
  },
  {
    value: "business_operating",
    label: "Business Operating Account",
    description: "Operating account for verified companies — opens immediately.",
  },
  {
    value: "private",
    label: "Summit Money Market by Alta Private",
    description: "Yield-focused money market — invitation and review required.",
  },
];

const PERSONAL_ACCOUNT_TYPES: BankAccountTypeCode[] = [
  "alta_access",
  "checking",
  "savings",
  "money_market",
  "reserve",
  "private",
];

const COMPANY_ACCOUNT_TYPES: BankAccountTypeCode[] = ["business_operating"];

const PRIVATE_BANKING_ACCOUNT_TYPES: BankAccountTypeCode[] = ["reserve", "private"];

export function isPrivateBankingAccountType(type: BankAccountTypeCode): boolean {
  return PRIVATE_BANKING_ACCOUNT_TYPES.includes(type);
}

export function getBankAccountTypeOptionsForOpening(
  ownership: "personal" | "company",
  isPrivateClient: boolean,
) {
  const allowed =
    ownership === "company"
      ? COMPANY_ACCOUNT_TYPES
      : PERSONAL_ACCOUNT_TYPES.filter(
          (type) => isPrivateClient || !isPrivateBankingAccountType(type),
        );

  return BANK_ACCOUNT_TYPE_OPTIONS.filter((option) => allowed.includes(option.value));
}

export function defaultBankAccountTypeForOwnership(
  ownership: "personal" | "company",
): BankAccountTypeCode {
  return ownership === "company" ? "business_operating" : "alta_access";
}

export function formatBankAccountTypeLabel(type: BankAccountTypeCode): string {
  return BANK_ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function isInstantApprovalAccountType(type: BankAccountTypeCode): boolean {
  return (
    type === "alta_access" ||
    type === "checking" ||
    type === "savings" ||
    type === "money_market"
  );
}
