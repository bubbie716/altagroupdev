export type InternalUserTag = "corporate_admin" | "bank_admin" | "terminal_admin";

/** Per-company role for authorized representatives (future membership model). */
export type CompanyRole =
  | "owner"
  | "executive"
  | "finance_manager"
  | "compliance_contact"
  | "viewer";

export type CompanyType =
  | "Private Company"
  | "Listed Company"
  | "Bank"
  | "Brokerage"
  | "Institution";

export type CompanyAccountStatus = "Pending" | "Active" | "Listed" | "Suspended" | "Rejected";
export type VerificationStatus = "Unverified" | "Pending Review" | "Verified" | "Rejected";
export type RepresentativeStatus = "Authorized" | "Pending" | "Revoked" | "None";
export type DocumentReceiptStatus = "Complete" | "Partial" | "Missing";
export type BoardApprovalStatus = "Approved" | "Pending" | "Not Required" | "Rejected";

export type AccountStatus = "Active" | "Frozen" | "Suspended" | "Pending";
export type ComplianceSeverity = "Low" | "Medium" | "High" | "Critical";
export type ComplianceCaseStatus = "Open" | "Assigned" | "Resolved" | "Escalated";
export type SystemStatusLevel = "Operational" | "Degraded" | "Maintenance";

/**
 * Future auth model (not enforced):
 *   Individual Discord User → Memberships[] → Company/Institution → Permissions
 */
export interface CompanyMembership {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  representativeStatus: RepresentativeStatus;
}

export interface InternalUser {
  id: string;
  username: string;
  discordId: string;
  minecraftUsername: string;
  tags: InternalUserTag[];
  accountStatus: AccountStatus;
  lastActive: string;
  /** Companies this user may act on behalf of (authorized representative). */
  companyMemberships: CompanyMembership[];
}

export interface CompanyRepresentative {
  userId: string;
  username: string;
  role: CompanyRole;
  status: RepresentativeStatus;
  since: string;
}

export interface CompanyDocument {
  id: string;
  name: string;
  status: DocumentReceiptStatus;
  received: string | null;
}

export interface CompanyAccount {
  id: string;
  name: string;
  ticker: string | null;
  type: CompanyType;
  sector: string;
  status: CompanyAccountStatus;
  verificationStatus: VerificationStatus;
  primaryContact: string;
  representativeCount: number;
  representatives: CompanyRepresentative[];
  lastUpdated: string;
  /** Detail-only fields */
  documents?: CompanyDocument[];
  bankAccounts?: { id: string; product: string; status: string }[];
}

export interface InternalOverviewMetrics {
  totalUsers: number;
  activeBankAccounts: number;
  openComplianceFlags: number;
  settlementVolume: string;
  registeredCompanies: number;
  verifiedInstitutions: number;
  authorizedRepresentatives: number;
  pendingCompanyReviews: number;
}

export interface AdminActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  division: string;
}

export interface SystemStatusItem {
  service: string;
  status: SystemStatusLevel;
  detail: string;
}

export interface BankOpsSummary {
  totalAccounts: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  transfersInReview: number;
  lendingQueue: number;
  frozenAccounts: number;
}

export type BankTransferType = "Wire" | "Interbank" | "Internal";

export interface BankOpsTransfer {
  id: string;
  type: BankTransferType;
  from: string;
  to: string;
  amount: string;
  settlement: string;
  submitted: string;
  status: string;
}

export interface BankLoanApplication {
  id: string;
  applicant: string;
  company: string | null;
  product: string;
  amount: string;
  purpose: string;
  status: string;
  submitted: string;
}

export type DepositWithdrawType = "Deposit" | "Withdrawal";

export interface BankDepositWithdrawRequest {
  id: string;
  type: DepositWithdrawType;
  account: string;
  holder: string;
  amount: string;
  method: string;
  status: string;
  submitted: string;
}

export interface BankOpsAccount {
  id: string;
  holder: string;
  product: string;
  balance: string;
  status: AccountStatus;
}






export interface TerminalActivitySummary {
  activeUsers24h: number;
  openOrders: number;
  researchViews24h: number;
  watchlistAdds24h: number;
}

export interface TerminalOrderRow {
  id: string;
  user: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  status: string;
  time: string;
}

export interface ComplianceCase {
  id: string;
  title: string;
  category: string;
  severity: ComplianceSeverity;
  status: ComplianceCaseStatus;
  assignee: string;
  opened: string;
}

export interface InternalSettings {
  maintenanceMode: boolean;
  marketStatus: "Open" | "Pre-Open" | "Closed" | "Halted";
  bankTransfers: "Enabled" | "Review Required" | "Disabled";
  featureFlags: { key: string; label: string; enabled: boolean }[];
}
