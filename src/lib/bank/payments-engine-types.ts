import type { PaymentFrequencyCode } from "@/lib/bank/business-banking-types";
import type { PaymentEngineFundingSource } from "@/lib/bank/payment-engine-funding-types";

export type AltaPayScheduleTypeCode = "scheduled" | "recurring";
export type AltaPayScheduleStatusCode = "approved" | "executed" | "cancelled" | "paused" | "failed";

export interface AltaPayScheduleRow {
  id: string;
  paymentType: AltaPayScheduleTypeCode;
  paymentTypeLabel: string;
  payeeLabel: string;
  recipientCompanyId: string | null;
  recipientUserId: string | null;
  amount: number;
  frequency: PaymentFrequencyCode | null;
  frequencyLabel: string | null;
  scheduledDate: string | null;
  nextRunDate: string | null;
  lastRunAt: string | null;
  status: AltaPayScheduleStatusCode;
  statusLabel: string;
  memo: string | null;
  bankAccountId: string | null;
  fundingSource: PaymentEngineFundingSource;
  fundingAccountLabel: string;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  createdAt: string;
}

export interface CreateAltaPayScheduleInput {
  fundingSource: PaymentEngineFundingSource;
  paymentType: AltaPayScheduleTypeCode;
  recipientCompanyId?: string;
  recipientUserId?: string;
  payeeLabel: string;
  amount: number;
  scheduledDate: string;
  scheduledTime?: string;
  frequency?: PaymentFrequencyCode;
  memo?: string;
}

export type MerchantAutopayApprovalStatusCode = "active" | "paused" | "cancelled";

export interface MerchantAutopayApprovalRow {
  id: string;
  merchantCompanyId: string;
  merchantName: string;
  fundingSource: PaymentEngineFundingSource;
  fundingAccountLabel: string;
  maxInvoiceAmount: number;
  confirmationRequiredAboveAmount: number | null;
  allowedFrequency: PaymentFrequencyCode;
  allowedFrequencyLabel: string;
  maxPaymentsPerMonth: number;
  expiresAt: string | null;
  allowRecurringInvoices: boolean;
  status: MerchantAutopayApprovalStatusCode;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMerchantAutopayApprovalInput {
  merchantCompanyId: string;
  fundingSource: PaymentEngineFundingSource;
  maxInvoiceAmount: number;
  confirmationRequiredAboveAmount?: number;
  allowedFrequency: PaymentFrequencyCode;
  maxPaymentsPerMonth?: number;
  expiresAt?: string | null;
  allowRecurringInvoices?: boolean;
}

export interface UpdateMerchantAutopayApprovalInput {
  approvalId: string;
  maxInvoiceAmount?: number;
  confirmationRequiredAboveAmount?: number | null;
  allowedFrequency?: PaymentFrequencyCode;
  maxPaymentsPerMonth?: number;
  expiresAt?: string | null;
  allowRecurringInvoices?: boolean;
}

export type RecurringInvoiceScheduleStatusCode = "active" | "paused" | "cancelled";

export interface RecurringInvoiceScheduleRow {
  id: string;
  templateName: string;
  recipientLabel: string;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  amount: number;
  description: string;
  frequency: PaymentFrequencyCode;
  frequencyLabel: string;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  autoSendEnabled: boolean;
  status: RecurringInvoiceScheduleStatusCode;
  statusLabel: string;
  nextRunDate: string | null;
  lastRunAt: string | null;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  createdAt: string;
}

export interface CreateRecurringInvoiceScheduleInput {
  companyId: string;
  templateName: string;
  recipientUserId?: string;
  recipientCompanyId?: string;
  amount: number;
  description: string;
  frequency: PaymentFrequencyCode;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string | null;
  autoSendEnabled?: boolean;
}

export type PaymentEngineNotificationPrefKey =
  | "beforePayment"
  | "afterPayment"
  | "failedPayment"
  | "newRecurringInvoice"
  | "autopayDisabled";

export type PaymentEngineNotificationPrefs = Partial<
  Record<PaymentEngineNotificationPrefKey, boolean>
>;

export const DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS: Required<PaymentEngineNotificationPrefs> =
  {
    beforePayment: true,
    afterPayment: true,
    failedPayment: true,
    newRecurringInvoice: true,
    autopayDisabled: true,
  };

export interface AutopayEvaluationResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  approvalId?: string;
  fundingSource?: PaymentEngineFundingSource;
  /** @deprecated Use fundingSource */
  fundingAccountId?: string;
}
