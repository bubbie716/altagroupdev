import type { AccountStatus, CompanyRole, UserTag } from "@/lib/auth/types";

export type InternalUserListFilters = {
  q?: string;
  discordId?: string;
  tag?: UserTag;
  accountStatus?: AccountStatus;
};

export type InternalUserListRow = {
  id: string;
  discordUsername: string;
  discordId: string;
  email: string | null;
  minecraftUsername: string | null;
  accountStatus: AccountStatus;
  tags: UserTag[];
  companyCount: number;
  bankAccountCount: number;
  totalBankBalance: number;
  lastLoginAt: string;
  createdAt: string;
};

export type InternalUserCompanyMembership = {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  roleLabel: string;
};

export type InternalUserBankAccountSummary = {
  id: string;
  accountName: string;
  accountNumber: string;
  accountTypeLabel: string;
  statusLabel: string;
  balance: number;
  currency: string;
  isCompanyAccount: boolean;
  companyName: string | null;
};

export type InternalUserRecentTransaction = {
  id: string;
  accountId: string;
  accountName: string;
  accountNumber: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
};

export type InternalUserTagAction = {
  canGrant: boolean;
  canRevoke: boolean;
  requiresConfirm: boolean;
  danger: boolean;
};

export type InternalUserManagementCapabilities = {
  tags: Record<UserTag, InternalUserTagAction>;
  allowedAccountStatuses: AccountStatus[];
  canChangeAccountStatus: boolean;
};

export type InternalUserDetail = InternalUserListRow & {
  avatarUrl: string | null;
  companyMemberships: InternalUserCompanyMembership[];
  bankAccounts: InternalUserBankAccountSummary[];
  recentTransactions: InternalUserRecentTransaction[];
  loanApplications: InternalUserLoanApplicationSummary[];
  activeLoans: InternalUserLoanSummary[];
  recentAuditLogs: import("@/lib/internal/audit.types").AuditLogRow[];
  capabilities: InternalUserManagementCapabilities;
};

export type InternalUserLoanApplicationSummary = {
  id: string;
  productLabel: string;
  statusLabel: string;
  requestedAmount: number;
  createdAt: string;
};

export type InternalUserLoanSummary = {
  id: string;
  productLabel: string;
  statusLabel: string;
  principalAmount: number;
  principalOutstanding: number;
  currentPayoffAmount: number;
  createdAt: string;
};

export type InternalAccessMetrics = {
  totalUsers: number;
  admins: number;
  privateClients: number;
  restrictedUsers: number;
  frozenUsers: number;
};

export const ALL_USER_TAGS: UserTag[] = [
  "corporate_admin",
  "bank_admin",
  "terminal_admin",
  "private_client",
];

export const ALL_ACCOUNT_STATUSES: AccountStatus[] = [
  "active",
  "restricted",
  "frozen",
  "pending_review",
];
