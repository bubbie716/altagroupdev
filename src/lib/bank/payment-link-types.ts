import type {
  PaymentLinkAmountType,
  PaymentLinkStatus,
  PaymentLinkUsageType,
} from "@prisma/client";

export const PAYMENT_LINK_REFERENCE_PREFIX = "PLINK-";
export const PAYMENT_LINK_PAY_REFERENCE_PREFIX = "PL-PAY-";

export type PaymentLinkFundingSource =
  | { kind: "bank_account"; accountId: string }
  | { kind: "alta_card"; cardId: string };

export type CreatePaymentLinkInput = {
  companyId: string;
  title?: string;
  description: string;
  internalMemo?: string;
  amountType: PaymentLinkAmountType;
  usageType: PaymentLinkUsageType;
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
  expiresAt?: string | null;
};

export type UpdatePaymentLinkInput = {
  linkId: string;
  companyId: string;
  title?: string;
  description?: string;
  internalMemo?: string | null;
  amount?: number;
  minAmount?: number | null;
  maxAmount?: number | null;
  expiresAt?: string | null;
};

import type { CustomerFacingBranding } from "@/lib/bank/company-branding-types";

export type PaymentLinkSummaryRow = {
  id: string;
  slug: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantName: string;
  title: string | null;
  description: string;
  amountType: PaymentLinkAmountType;
  usageType: PaymentLinkUsageType;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
  status: PaymentLinkStatus;
  expiresAt: string | null;
  paymentCount: number;
  totalCollected: number;
  createdAt: string;
  checkoutUrl: string;
};

export type PaymentLinkPaymentRow = {
  id: string;
  amount: number;
  feeAmount: number;
  payerLabel: string | null;
  paymentReferenceCode: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
};

export type PaymentLinkEventRow = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type PaymentLinkDetail = PaymentLinkSummaryRow & {
  internalMemo: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  recentPayments: PaymentLinkPaymentRow[];
  events: PaymentLinkEventRow[];
};

export type PaymentLinkDashboard = {
  activeCount: number;
  totalCollected: number;
  paymentCount: number;
  recent: PaymentLinkSummaryRow[];
};

export type PaymentLinkCheckoutContext = {
  slug: string;
  merchantName: string;
  title: string | null;
  description: string;
  amountType: PaymentLinkAmountType;
  usageType: PaymentLinkUsageType;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
  status: PaymentLinkStatus;
  expiresAt: string | null;
  payable: boolean;
  statusMessage: string | null;
  branding?: CustomerFacingBranding;
};

export type PaymentLinkPaymentQuote = {
  slug: string;
  merchantName: string;
  description: string;
  amount: number;
  feeAmount: number;
  totalDebited: number;
  netToMerchant: number;
};

export type PayPaymentLinkInput = {
  slug: string;
  amount?: number;
  fundingSource: PaymentLinkFundingSource;
  idempotencyKey: string;
};

export type PayPaymentLinkResult = {
  slug: string;
  paymentReferenceCode: string;
  amount: number;
  feeAmount: number;
  totalDebited: number;
  merchantName: string;
  fundingSourceLabel: string;
};

export const PAYMENT_LINK_EVENT_LABELS: Record<string, string> = {
  CREATED: "Link created",
  UPDATED: "Link updated",
  PAUSED: "Link paused",
  ACTIVATED: "Link activated",
  CANCELLED: "Link cancelled",
  PAYMENT_COMPLETED: "Payment received",
  PAYMENT_FAILED: "Payment failed",
  EXPIRED: "Link expired",
};

export const PAYMENT_LINK_STATUS_LABELS: Record<PaymentLinkStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  EXPIRED: "Expired",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
