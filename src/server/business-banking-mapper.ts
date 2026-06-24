import type {
  PaymentFrequency,
  PayrollEmployee,
  PayrollEmployeeStatus,
  PayrollRun,
  PayrollRunStatus,
  ScheduledPayment,
  ScheduledPaymentStatus,
  ScheduledPaymentType,
  ScheduledTransferExecutionStatus,
  ScheduledTransferScope,
} from "@prisma/client";
import type { CompanyRole } from "@/lib/auth/types";
import { fromDbCompanyRole } from "@/server/enum-map";
import type {
  BusinessRepresentativeRow,
  BusinessTreasuryAccount,
  BusinessTreasuryCompany,
  BusinessTreasuryPermissions,
  PaymentFrequencyCode,
  PayrollEmployeeRow,
  PayrollEmployeeStatusCode,
  PayrollRunLineItem,
  PayrollRunRow,
  PayrollRunStatusCode,
  ScheduledPaymentRow,
  ScheduledPaymentStatusCode,
  ScheduledPaymentTypeCode,
  ScheduledTransferScopeCode,
  ScheduledExecutionStatusCode,
} from "@/lib/bank/business-banking-types";
import { COMPANY_ROLE_LABELS } from "@/lib/bank/business-banking-types";

const PAYMENT_TYPE_FROM_DB: Record<ScheduledPaymentType, ScheduledPaymentTypeCode> = {
  ONE_TIME: "one_time",
  SCHEDULED: "scheduled",
  RECURRING: "recurring",
};

const PAYMENT_TYPE_LABELS: Record<ScheduledPaymentTypeCode, string> = {
  one_time: "One-time",
  scheduled: "Scheduled",
  recurring: "Recurring",
};

const FREQUENCY_FROM_DB: Record<PaymentFrequency, PaymentFrequencyCode> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
};

const FREQUENCY_LABELS: Record<PaymentFrequencyCode, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const PAYMENT_STATUS_FROM_DB: Record<ScheduledPaymentStatus, ScheduledPaymentStatusCode> = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXECUTED: "executed",
  CANCELLED: "cancelled",
  PAUSED: "paused",
  FAILED: "failed",
};

const PAYMENT_STATUS_LABELS: Record<ScheduledPaymentStatusCode, string> = {
  pending_review: "Pending review",
  approved: "Active",
  rejected: "Rejected",
  executed: "Completed",
  cancelled: "Cancelled",
  paused: "Paused",
  failed: "Failed",
};

const TRANSFER_SCOPE_FROM_DB: Record<ScheduledTransferScope, ScheduledTransferScopeCode> = {
  INTRABANK: "intrabank",
  INTERBANK: "interbank",
};

const TRANSFER_SCOPE_LABELS: Record<ScheduledTransferScopeCode, string> = {
  intrabank: "Intrabank",
  interbank: "Interbank",
};

const EMPLOYEE_STATUS_FROM_DB: Record<PayrollEmployeeStatus, PayrollEmployeeStatusCode> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const EMPLOYEE_STATUS_LABELS: Record<PayrollEmployeeStatusCode, string> = {
  active: "Active",
  inactive: "Inactive",
};

const PAYROLL_STATUS_FROM_DB: Record<PayrollRunStatus, PayrollRunStatusCode> = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXECUTED: "executed",
  CANCELLED: "cancelled",
};

const PAYROLL_STATUS_LABELS: Record<PayrollRunStatusCode, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  executed: "Executed",
  cancelled: "Cancelled",
};

const EXECUTION_STATUS_FROM_DB: Record<
  ScheduledTransferExecutionStatus,
  ScheduledExecutionStatusCode
> = {
  PENDING: "pending",
  EXECUTED: "executed",
  FAILED: "failed",
  SKIPPED: "skipped",
};

const EXECUTION_STATUS_LABELS: Record<ScheduledExecutionStatusCode, string> = {
  pending: "Pending",
  executed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export function mapTreasuryPermissions(role: CompanyRole): BusinessTreasuryPermissions {
  return {
    canView: role !== "viewer",
    canManage: role === "owner" || role === "executive" || role === "finance_manager",
    viewOnly: role === "compliance_contact",
    role,
    roleLabel: COMPANY_ROLE_LABELS[role],
  };
}

export function mapTreasuryCompany(
  company: { id: string; name: string },
  account: { id: string; accountName: string; accountNumber: string; balance: { toString(): string }; currency: string },
  role: CompanyRole,
): BusinessTreasuryCompany {
  const operatingAccount: BusinessTreasuryAccount = {
    id: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    balance: decimalToNumber(account.balance),
    currency: account.currency,
  };

  return {
    companyId: company.id,
    companyName: company.name,
    operatingAccount,
    permissions: mapTreasuryPermissions(role),
  };
}

export function mapScheduledPayment(row: ScheduledPayment): ScheduledPaymentRow {
  const paymentType = PAYMENT_TYPE_FROM_DB[row.paymentType];
  const frequency = row.frequency ? FREQUENCY_FROM_DB[row.frequency] : null;
  const status = PAYMENT_STATUS_FROM_DB[row.status];
  const transferScope = TRANSFER_SCOPE_FROM_DB[row.transferScope];

  return {
    id: row.id,
    transferScope,
    transferScopeLabel: TRANSFER_SCOPE_LABELS[transferScope],
    paymentType,
    paymentTypeLabel: PAYMENT_TYPE_LABELS[paymentType],
    label: row.label,
    recipientName: row.recipientName,
    recipientAccountNumber: row.recipientAccountNumber,
    recipientInstitution: row.recipientInstitution,
    routingNumber: row.routingNumber,
    wireAccountNumber: row.wireAccountNumber,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    frequency,
    frequencyLabel: frequency ? FREQUENCY_LABELS[frequency] : null,
    scheduledDate: row.scheduledDate?.toISOString() ?? null,
    nextRunDate: row.nextRunDate?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastExecutionStatus: row.lastExecutionStatus
      ? EXECUTION_STATUS_FROM_DB[row.lastExecutionStatus]
      : null,
    lastExecutionStatusLabel: row.lastExecutionStatus
      ? EXECUTION_STATUS_LABELS[EXECUTION_STATUS_FROM_DB[row.lastExecutionStatus]]
      : null,
    lastFailureReason: row.lastFailureReason,
    consecutiveFailures: row.consecutiveFailures,
    status,
    statusLabel: PAYMENT_STATUS_LABELS[status],
    memo: row.memo,
    bankAccountId: row.bankAccountId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapPayrollEmployee(row: PayrollEmployee): PayrollEmployeeRow {
  const payFrequency = FREQUENCY_FROM_DB[row.payFrequency];
  const status = EMPLOYEE_STATUS_FROM_DB[row.status];

  return {
    id: row.id,
    displayName: row.displayName,
    title: row.title,
    accountNumber: row.accountNumber,
    payAmount: decimalToNumber(row.payAmount),
    payFrequency,
    payFrequencyLabel: FREQUENCY_LABELS[payFrequency],
    status,
    statusLabel: EMPLOYEE_STATUS_LABELS[status],
    createdAt: row.createdAt.toISOString(),
  };
}

function parseLineItems(raw: unknown): PayrollRunLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is PayrollRunLineItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as PayrollRunLineItem).employeeId === "string" &&
        typeof (item as PayrollRunLineItem).displayName === "string" &&
        typeof (item as PayrollRunLineItem).amount === "number"
      );
    })
    .map((item) => ({
      employeeId: item.employeeId,
      displayName: item.displayName,
      amount: item.amount,
    }));
}

export function mapPayrollRun(row: PayrollRun): PayrollRunRow {
  const status = PAYROLL_STATUS_FROM_DB[row.status];

  return {
    id: row.id,
    label: row.label,
    totalAmount: decimalToNumber(row.totalAmount),
    status,
    statusLabel: PAYROLL_STATUS_LABELS[status],
    payDate: row.payDate.toISOString(),
    lineItems: parseLineItems(row.lineItems),
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapRepresentative(
  membership: { id: string; userId: string; role: import("@prisma/client").CompanyRole; createdAt: Date; user: { discordUsername: string } },
): BusinessRepresentativeRow {
  const role = fromDbCompanyRole(membership.role);
  return {
    membershipId: membership.id,
    userId: membership.userId,
    discordUsername: membership.user.discordUsername,
    role,
    roleLabel: COMPANY_ROLE_LABELS[role],
    joinedAt: membership.createdAt.toISOString(),
  };
}

export function toDbPaymentType(type: ScheduledPaymentTypeCode): ScheduledPaymentType {
  const map: Record<ScheduledPaymentTypeCode, ScheduledPaymentType> = {
    one_time: "ONE_TIME",
    scheduled: "SCHEDULED",
    recurring: "RECURRING",
  };
  return map[type];
}

export function toDbPaymentFrequency(freq: PaymentFrequencyCode): PaymentFrequency {
  const map: Record<PaymentFrequencyCode, PaymentFrequency> = {
    weekly: "WEEKLY",
    biweekly: "BIWEEKLY",
    monthly: "MONTHLY",
    quarterly: "QUARTERLY",
  };
  return map[freq];
}

export function toDbTransferScope(scope: ScheduledTransferScopeCode): ScheduledTransferScope {
  const map: Record<ScheduledTransferScopeCode, ScheduledTransferScope> = {
    intrabank: "INTRABANK",
    interbank: "INTERBANK",
  };
  return map[scope];
}
