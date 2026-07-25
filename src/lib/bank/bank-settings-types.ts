import type { UserNotificationType } from "@prisma/client";
import type {
  PaymentEngineNotificationPrefKey,
  PaymentEngineNotificationPrefs,
} from "@/lib/bank/payments-engine-types";

export type DiscordNotificationPrefs = Partial<Record<UserNotificationType, boolean>>;

export interface BankSettingsAccountOption {
  id: string;
  accountName: string;
  accountNumber: string;
  ownerLabel: string | null;
}

export interface UserBankSettingsView {
  explicitDefaultAltaPayReceiveAccountId: string | null;
  defaultAltaPayReceiveAccountId: string | null;
  defaultAltaPayFundingAccountId: string | null;
  discordNotificationPrefs: DiscordNotificationPrefs;
  paymentEngineNotificationPrefs: PaymentEngineNotificationPrefs;
  receiveAccountOptions: BankSettingsAccountOption[];
  fundingAccountOptions: BankSettingsAccountOption[];
}

export interface UpdateUserBankSettingsInput {
  defaultAltaPayReceiveAccountId?: string | null;
  defaultAltaPayFundingAccountId?: string | null;
  discordNotificationPrefs?: DiscordNotificationPrefs;
  paymentEngineNotificationPrefs?: PaymentEngineNotificationPrefs;
}

export type DiscordNotificationOption = {
  type: UserNotificationType;
  label: string;
};

export type DiscordNotificationGroup = {
  id: string;
  label: string;
  options: DiscordNotificationOption[];
};

export const BANK_DISCORD_NOTIFICATION_GROUPS: DiscordNotificationGroup[] = [
  {
    id: "banking",
    label: "Banking & transfers",
    options: [
      { type: "DEPOSIT_SUBMITTED", label: "Deposit request submitted" },
      { type: "DEPOSIT_APPROVED", label: "Deposit approved" },
      { type: "WITHDRAWAL_SUBMITTED", label: "Withdrawal request submitted" },
      { type: "WITHDRAWAL_APPROVED", label: "Withdrawal approved" },
      { type: "TRANSFER_COMPLETED", label: "Transfer completed" },
      { type: "TRANSFER_RECEIVED", label: "Transfer received" },
      { type: "TRANSFER_FAILED", label: "Transfer failed" },
      { type: "LARGE_MONEY_MOVEMENT_ALERT", label: "Large money movement alert" },
    ],
  },
  {
    id: "alta-pay",
    label: "Alta Pay & scheduled payments",
    options: [
      { type: "ALTA_PAY_SENT", label: "Alta Pay sent" },
      { type: "ALTA_PAY_RECEIVED", label: "Alta Pay received" },
      { type: "ALTA_PAY_FAILED", label: "Alta Pay failed" },
      { type: "SCHEDULED_TRANSFER_EXECUTED", label: "Scheduled transfer completed" },
      { type: "SCHEDULED_TRANSFER_FAILED", label: "Scheduled transfer failed" },
      { type: "PAYROLL_RUN_EXECUTED", label: "Payroll batch completed" },
      { type: "PAYROLL_RUN_FAILED", label: "Payroll batch failed" },
    ],
  },
  {
    id: "merchant",
    label: "Invoices & payment links",
    options: [
      { type: "MERCHANT_INVOICE_RECEIVED", label: "Invoice received" },
      { type: "MERCHANT_INVOICE_REMINDER", label: "Invoice reminder" },
      { type: "MERCHANT_INVOICE_PAID", label: "Invoice paid" },
      { type: "MERCHANT_INVOICE_CANCELLED", label: "Invoice cancelled" },
      { type: "MERCHANT_INVOICE_OVERDUE", label: "Invoice overdue (merchant)" },
      { type: "CUSTOMER_PAYMENT_FAILED", label: "Your payment failed" },
      { type: "MERCHANT_PAYMENT_FAILED", label: "Customer payment failed (merchant)" },
      { type: "PAYMENT_LINK_PAID", label: "Payment link paid" },
      { type: "PAYMENT_LINK_RECEIPT", label: "Payment link receipt" },
      { type: "MERCHANT_FIRST_PAYMENT_RECEIVED", label: "First commercial payment received" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial Pro billing",
    options: [
      { type: "COMMERCIAL_PRO_ACTIVATED", label: "Commercial Pro activated" },
      { type: "COMMERCIAL_PRO_BILLING_SUCCEEDED", label: "Commercial Pro billing succeeded" },
      { type: "COMMERCIAL_PRO_BILLING_FAILED", label: "Commercial Pro billing failed" },
      { type: "COMMERCIAL_PRO_PAST_DUE", label: "Commercial Pro billing past due" },
      { type: "COMMERCIAL_PRO_DOWNGRADED", label: "Commercial Pro downgraded" },
      { type: "COMMERCIAL_BILLING_ACCOUNT_CHANGED", label: "Commercial billing account changed" },
      { type: "COMMERCIAL_PRO_RENEWAL_REMINDER", label: "Commercial Pro renewal reminder" },
      { type: "COMMERCIAL_BILLING_LOW_BALANCE_WARNING", label: "Billing account low balance warning" },
    ],
  },
  {
    id: "deal-rooms",
    label: "Deal rooms & lending",
    options: [
      { type: "DEAL_ROOM_CREATED", label: "Secure Deal Room opened" },
      { type: "DEAL_ROOM_MESSAGE_RECEIVED", label: "New Deal Room message" },
      { type: "LOAN_APPLICATION_APPROVED", label: "Loan application approved" },
      { type: "LOAN_APPLICATION_DENIED", label: "Loan application declined" },
      { type: "LOAN_PAYMENT_MADE", label: "Loan payment received" },
      { type: "LOAN_PAID_OFF", label: "Loan paid off" },
      { type: "LOAN_AUTOPAY_FAILED", label: "Loan autopay failed" },
    ],
  },
  {
    id: "credit",
    label: "Credit / Alta Card",
    options: [
      { type: "ALTA_CARD_APPLICATION_APPROVED", label: "Alta Card application approved" },
      { type: "ALTA_CARD_APPLICATION_DENIED", label: "Alta Card application declined" },
      { type: "ALTA_CARD_PAYMENT_MADE", label: "Alta Card payment received" },
      { type: "ALTA_CARD_AUTOPAY_SUCCEEDED", label: "Alta Card autopay completed" },
      { type: "ALTA_CARD_AUTOPAY_FAILED", label: "Alta Card autopay failed" },
      { type: "ALTA_CARD_REVIEW_DECIDED", label: "Alta Card review decision" },
      { type: "ALTA_CARD_ACTIVATED", label: "Alta Card activated" },
      { type: "ALTA_CARD_FROZEN", label: "Alta Card frozen" },
      { type: "ALTA_CARD_UNFROZEN", label: "Alta Card unfrozen" },
    ],
  },
  {
    id: "companies",
    label: "Companies",
    options: [
      { type: "COMPANY_VERIFIED", label: "Company verified" },
      { type: "COMPANY_ROLE_CHANGED", label: "Company role updated" },
    ],
  },
];

/** Flat list for pref parsing and legacy callers. */
export const BANK_DISCORD_NOTIFICATION_OPTIONS = BANK_DISCORD_NOTIFICATION_GROUPS.flatMap(
  (group) => group.options,
);

export const PAYMENT_ENGINE_NOTIFICATION_OPTIONS: ReadonlyArray<{
  key: PaymentEngineNotificationPrefKey;
  label: string;
}> = [
  { key: "beforePayment", label: "Before scheduled or AutoPay payments" },
  { key: "afterPayment", label: "After scheduled or AutoPay payments" },
  { key: "failedPayment", label: "Failed scheduled or AutoPay payments" },
  { key: "newRecurringInvoice", label: "New recurring invoice notices" },
  { key: "autopayDisabled", label: "AutoPay approval changes" },
];
