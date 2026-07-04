import type { MerchantInvoiceStatus } from "@prisma/client";

export const MERCHANT_INVOICE_REFERENCE_PREFIX = "INV-";
export const MERCHANT_INVOICE_PAY_REFERENCE_PREFIX = "INV-PAY-";

export type MerchantInvoiceFundingSource =
  | { kind: "bank_account"; accountId: string }
  | { kind: "alta_card"; cardId: string };

export type MerchantInvoiceRecipientKind = "person" | "company";

export type MerchantInvoiceRecipientOption = {
  kind: MerchantInvoiceRecipientKind;
  id: string;
  displayName: string;
  subtitle: string | null;
  canReceive: boolean;
  destinationLabel: string;
};

export type MerchantInvoiceLineItemInput = {
  description: string;
  quantity?: number;
  unitAmount: number;
};

export type CreateMerchantInvoiceInput = {
  companyId: string;
  recipientUserId?: string;
  recipientCompanyId?: string;
  amount: number;
  description: string;
  memo?: string;
  dueDate?: string | null;
  lineItems?: MerchantInvoiceLineItemInput[];
};

export type UpdateMerchantInvoiceDraftInput = {
  invoiceId: string;
  companyId: string;
  recipientUserId?: string | null;
  recipientCompanyId?: string | null;
  amount?: number;
  description?: string;
  memo?: string | null;
  dueDate?: string | null;
  lineItems?: MerchantInvoiceLineItemInput[];
};

export type MerchantInvoiceLineItemRow = {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  sortOrder: number;
};

export type MerchantInvoiceEventRow = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type MerchantInvoiceSummaryRow = {
  id: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantName: string;
  recipientKind: MerchantInvoiceRecipientKind;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  recipientName: string;
  amount: number;
  amountPaid: number;
  currency: string;
  description: string;
  memo: string | null;
  dueDate: string | null;
  status: MerchantInvoiceStatus;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type MerchantInvoiceDetail = MerchantInvoiceSummaryRow & {
  lineItems: MerchantInvoiceLineItemRow[];
  events: MerchantInvoiceEventRow[];
  paymentReferenceCode: string | null;
};

export type MerchantInvoiceDashboard = {
  outstandingTotal: number;
  paidThisMonth: number;
  overdueCount: number;
  recent: MerchantInvoiceSummaryRow[];
};

export type MerchantInvoicePaymentQuote = {
  invoiceId: string;
  referenceCode: string;
  merchantName: string;
  amount: number;
  feeAmount: number;
  totalDebited: number;
  netToMerchant: number;
  description: string;
  dueDate: string | null;
  status: MerchantInvoiceStatus;
};

export type PayMerchantInvoiceInput = {
  invoiceId: string;
  fundingSource: MerchantInvoiceFundingSource;
  idempotencyKey: string;
};

export type PayMerchantInvoiceResult = {
  invoiceId: string;
  referenceCode: string;
  paymentReferenceCode: string;
  amount: number;
  feeAmount: number;
  totalDebited: number;
  merchantName: string;
  fundingSourceLabel: string;
};

export const PAYABLE_INVOICE_STATUSES: MerchantInvoiceStatus[] = [
  "SENT",
  "VIEWED",
  "OVERDUE",
];

export const UNPAID_INVOICE_STATUSES: MerchantInvoiceStatus[] = [
  "SENT",
  "VIEWED",
  "OVERDUE",
  "PARTIALLY_PAID",
];

export const MERCHANT_INVOICE_EVENT_LABELS: Record<string, string> = {
  CREATED: "Invoice created",
  UPDATED: "Invoice updated",
  SENT: "Invoice sent",
  VIEWED: "Invoice viewed",
  REMINDER_SENT: "Reminder sent",
  PAYMENT_INITIATED: "Payment initiated",
  PAYMENT_COMPLETED: "Invoice paid",
  PAYMENT_FAILED: "Payment failed",
  CANCELLED: "Invoice cancelled",
  VOIDED: "Invoice voided",
  OVERDUE_MARKED: "Marked overdue",
};
