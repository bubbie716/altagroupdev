import type {
  FinancialInstitutionStatus,
  InstitutionMemberRole,
  InstitutionMemberStatus,
  RoutingNumberStatus,
  SettlementInstructionStatus,
} from "@prisma/client";

export type PortalInstitutionSummary = {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  institutionType: string;
  status: FinancialInstitutionStatus;
  isAlta: boolean;
  isNCCParticipant: boolean;
};

/** Institution the signed-in user can operate — powers the portal switcher. */
export type PortalInstitutionOption = {
  id: string;
  legalName: string;
  displayName: string;
  institutionType: string;
  status: FinancialInstitutionStatus;
};

export type PortalDashboardMetrics = {
  institution: PortalInstitutionSummary;
  primaryRoutingNumber: string | null;
  settlementBalance: number;
  settlementAvailable: number;
  currency: string;
  todayVolume: number;
  todayCount: number;
  pendingCount: number;
  failedCount: number;
  averageSettlementMs: number | null;
  memberCount: number;
};

export type PortalAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  href?: string;
};

export type PortalNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type PortalSettlementRow = {
  id: string;
  publicReference: string;
  status: SettlementInstructionStatus;
  sendingInstitutionId: string;
  sendingInstitutionName: string;
  receivingInstitutionId: string;
  receivingInstitutionName: string;
  amount: number;
  currency: string;
  submittedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  failureCode: string | null;
  failureReason: string | null;
  stage: string;
  executionStatus: string | null;
  executionStep: string | null;
  completedAt: string | null;
  sourceCommitReference: string | null;
  destinationCreditReference: string | null;
  compensationEligible: boolean;
  compensationStatus: string | null;
  canCancel: boolean;
};

export type PortalSettlementDetail = PortalSettlementRow & {
  purpose: string | null;
  externalReference: string | null;
  idempotencyKey: string;
  sendingRoutingNumber: string;
  receivingRoutingNumber: string;
  submittedByUserId: string | null;
  validatedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  reversedAt: string | null;
  manualReviewReason: string | null;
  outboxFailureCount: number;
  reconciliationStatus: string | null;
  entries: Array<{
    id: string;
    entryType: string;
    amount: number;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
    institutionId: string;
  }>;
  reversal: {
    id: string;
    reason: string;
    actorUserId: string;
    createdAt: string;
    reversalInstructionId: string;
  } | null;
  compensation: {
    id: string;
    reason: string;
    actorUserId: string;
    createdAt: string;
    sourceRestoreReference: string | null;
    compensatingInstructionId: string | null;
  } | null;
  auditEvents: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
    actorUsername: string;
  }>;
};

export type PortalMemberRow = {
  id: string;
  userId: string;
  username: string;
  role: InstitutionMemberRole;
  status: InstitutionMemberStatus;
  createdAt: string;
  revokedAt: string | null;
};

export type PortalRoutingRow = {
  id: string;
  routingNumber: string;
  status: RoutingNumberStatus;
  isPrimary: boolean;
  label: string | null;
  createdAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
};

export type PortalAccountSummary = {
  id: string;
  currency: string;
  ledgerBalance: number;
  availableBalance: number;
  reservedBalance: number;
  status: string;
  dailyNetMovement: number;
  recentEntries: Array<{
    id: string;
    entryType: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
    publicReference: string;
  }>;
};

export type PortalReportMetrics = {
  settlementVolume: number;
  settlementCount: number;
  failureRate: number;
  averageProcessingMs: number | null;
  balances: Array<{ currency: string; ledgerBalance: number; availableBalance: number }>;
  topCounterparties: Array<{ institutionId: string; name: string; volume: number; count: number }>;
  dailyVolume: Array<{ date: string; volume: number; count: number }>;
};

export type PortalAuditRow = {
  id: string;
  createdAt: string;
  actorUsername: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string | null;
};

export type PortalSearchResult = {
  kind: "settlement" | "routing" | "member" | "audit";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export const PORTAL_NAV = [
  { to: "/portal", label: "Dashboard", exact: true },
  { to: "/portal/queue", label: "Processing & Exceptions" },
  { to: "/portal/settlements", label: "Settlement History" },
  { to: "/portal/accounts", label: "Settlement Accounts" },
  { to: "/portal/routing", label: "Routing Numbers" },
  { to: "/portal/members", label: "Institution Members" },
  { to: "/portal/reports", label: "Reports" },
  { to: "/portal/audit", label: "Audit Log" },
  { to: "/portal/developers", label: "Developers" },
  { to: "/portal/settings", label: "Institution Settings" },
  { to: "/portal/support", label: "Support" },
] as const;
