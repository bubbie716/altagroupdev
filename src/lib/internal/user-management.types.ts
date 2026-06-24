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
  minecraftUsername: string | null;
  accountStatus: AccountStatus;
  tags: UserTag[];
  companyCount: number;
  bankAccountCount: number;
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
  email: string | null;
  companyMemberships: InternalUserCompanyMembership[];
  bankAccounts: InternalUserBankAccountSummary[];
  recentTransactions: InternalUserRecentTransaction[];
  capabilities: InternalUserManagementCapabilities;
};

export type InternalAccessMetrics = {
  totalUsers: number;
  admins: number;
  operators: number;
  privateClients: number;
  developers: number;
  issuers: number;
  restrictedUsers: number;
  frozenUsers: number;
};

export const ALL_USER_TAGS: UserTag[] = [
  "admin",
  "operator",
  "private_client",
  "developer",
  "issuer",
];

export const ALL_ACCOUNT_STATUSES: AccountStatus[] = [
  "active",
  "restricted",
  "frozen",
  "pending_review",
];
