import type { CompanyRole } from "@/lib/auth/types";

export type ScheduledPaymentTypeCode = "one_time" | "scheduled" | "recurring";
export type PaymentFrequencyCode = "weekly" | "biweekly" | "monthly" | "quarterly";
export type ScheduledPaymentStatusCode =
  | "pending_review"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled"
  | "paused"
  | "failed";
export type ScheduledExecutionStatusCode = "pending" | "executed" | "failed" | "skipped";
export type PayrollEmployeeStatusCode = "active" | "inactive";
export type PayrollRunStatusCode =
  | "pending_review"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled"
  | "failed";

export interface BusinessTreasuryPermissions {
  canView: boolean;
  canManage: boolean;
  viewOnly: boolean;
  role: CompanyRole;
  roleLabel: string;
}

export interface BusinessTreasuryAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  balance: number;
  currency: string;
}

export interface BusinessTreasuryCompany {
  companyId: string;
  companyName: string;
  operatingAccount: BusinessTreasuryAccount;
  permissions: BusinessTreasuryPermissions;
}

export interface BusinessBankingOverview {
  companies: BusinessTreasuryCompany[];
  selectedCompanyId: string | null;
}

export type ScheduledTransferScopeCode = "intrabank" | "interbank";

export interface ScheduledPaymentRow {
  id: string;
  transferScope: ScheduledTransferScopeCode;
  transferScopeLabel: string;
  paymentType: ScheduledPaymentTypeCode;
  paymentTypeLabel: string;
  label: string;
  recipientName: string;
  recipientAccountNumber: string | null;
  recipientInstitution: string | null;
  routingNumber: string | null;
  wireAccountNumber: string | null;
  amount: number;
  currency: string;
  frequency: PaymentFrequencyCode | null;
  frequencyLabel: string | null;
  scheduledDate: string | null;
  nextRunDate: string | null;
  lastRunAt: string | null;
  lastExecutionStatus: ScheduledExecutionStatusCode | null;
  lastExecutionStatusLabel: string | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  status: ScheduledPaymentStatusCode;
  statusLabel: string;
  memo: string | null;
  bankAccountId: string | null;
  createdAt: string;
}

export interface PayrollEmployeeRow {
  id: string;
  displayName: string;
  title: string | null;
  accountNumber: string;
  payAmount: number;
  payFrequency: PaymentFrequencyCode;
  payFrequencyLabel: string;
  payDay: string;
  payDayLabel: string;
  nextPayDate: string | null;
  status: PayrollEmployeeStatusCode;
  statusLabel: string;
  createdAt: string;
}

export interface PayrollRunLineItem {
  employeeId: string;
  displayName: string;
  amount: number;
  accountNumber: string;
}

export interface PayrollRunRow {
  id: string;
  label: string;
  totalAmount: number;
  status: PayrollRunStatusCode;
  statusLabel: string;
  payDate: string;
  lineItems: PayrollRunLineItem[];
  memo: string | null;
  lastFailureReason: string | null;
  createdAt: string;
}

export interface BusinessRepresentativeRow {
  membershipId: string;
  userId: string;
  discordUsername: string;
  role: CompanyRole;
  roleLabel: string;
  joinedAt: string;
}

export interface CreateScheduledPaymentInput {
  companyId: string;
  bankAccountId: string;
  paymentType: ScheduledPaymentTypeCode;
  recipientName: string;
  recipientAccountNumber?: string;
  amount: number;
  frequency?: PaymentFrequencyCode;
  scheduledDate?: string;
  /** 24-hour time in America/New_York, e.g. `09:30` */
  scheduledTime?: string;
  memo?: string;
}

export interface CreateUserScheduledTransferInput {
  bankAccountId: string;
  transferScope: ScheduledTransferScopeCode;
  paymentType: ScheduledPaymentTypeCode;
  recipientName: string;
  recipientAccountNumber?: string;
  recipientInstitution?: string;
  routingNumber?: string;
  wireAccountNumber?: string;
  amount: number;
  frequency?: PaymentFrequencyCode;
  scheduledDate?: string;
  /** 24-hour time in America/New_York, e.g. `09:30` */
  scheduledTime?: string;
  memo?: string;
}

export interface CreatePayrollEmployeeInput {
  companyId: string;
  displayName: string;
  title?: string;
  accountNumber: string;
  payAmount: number;
  payFrequency: PaymentFrequencyCode;
  payDay: string;
}

export interface UpdatePayrollEmployeeInput {
  companyId: string;
  employeeId: string;
  displayName: string;
  title?: string;
  accountNumber: string;
  payAmount: number;
  payFrequency: PaymentFrequencyCode;
  payDay: string;
}

export interface CreatePayrollRunInput {
  companyId: string;
  bankAccountId: string;
  label: string;
  payDate: string;
  employeeIds: string[];
  memo?: string;
}

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  executive: "Executive",
  finance_manager: "Finance Manager",
  compliance_contact: "Compliance Contact",
  viewer: "Viewer",
};

export const INTERBANK_EXECUTION_NOTICE =
  "Interbank scheduled transfers require operator review before execution.";

export const FUTURE_EXECUTION_NOTICE =
  "Automatic payment execution coming in a future release.";
