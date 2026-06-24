export type BankAccountTypeCode =
  | "alta_access"
  | "checking"
  | "savings"
  | "reserve"
  | "business_operating"
  | "private";

export type BankAccountStatusCode = "pending" | "active" | "frozen" | "closed";

export type BankTransactionTypeCode = "deposit" | "withdrawal" | "adjustment";

export type BankTransactionStatusCode = "pending" | "approved" | "denied" | "cancelled";

export interface UserBankAccount {
  id: string;
  accountName: string;
  accountType: BankAccountTypeCode;
  accountTypeLabel: string;
  accountNumber: string;
  routingNumber: string;
  balance: number;
  status: BankAccountStatusCode;
  statusLabel: string;
  currency: string;
  companyId: string | null;
  companyName: string | null;
  isCompanyAccount: boolean;
  openingNotes: string | null;
  createdAt: string;
  recentActivity: string;
  /** UI-compat fields for AccountCard */
  name: string;
  product: string;
  type: string;
}

export interface UserBankAccountDetail extends UserBankAccount {
  ownerLabel: string;
  depositsThisMonth: number;
  withdrawalsThisMonth: number;
  netChangeThisMonth: number;
  availableBalance: number;
  recentTransactions: UserBankTransaction[];
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

export interface UserBankDashboard {
  totalRelationshipValue: number;
  checkingBalance: number;
  savingsBalance: number;
  reserveBalance: number;
  businessBalance: number;
  creditAvailable: number;
  privateStatus: string;
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
  destinationInstructions: string;
  memo?: string;
  proof?: BankProofInput;
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
  label: string;
  accountNumber: string;
}

export interface CreateInterbankTransferContactInput {
  label: string;
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

export const BANK_ACCOUNT_TYPE_OPTIONS: { value: BankAccountTypeCode; label: string; description: string }[] = [
  { value: "alta_access", label: "Alta Access", description: "Starter account for new Newport citizens." },
  { value: "checking", label: "Alta Checking", description: "Primary operating account." },
  { value: "savings", label: "Alta Savings", description: "A simple savings account for building Florin reserves." },
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
  return type === "alta_access" || type === "checking" || type === "savings";
}
