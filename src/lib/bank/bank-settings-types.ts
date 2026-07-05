import type { UserNotificationType } from "@prisma/client";

export type DiscordNotificationPrefs = Partial<Record<UserNotificationType, boolean>>;

export interface BankSettingsAccountOption {
  id: string;
  accountName: string;
  accountNumber: string;
  ownerLabel: string | null;
}

export interface UserBankSettingsView {
  /** Explicit user choice; null means automatic (oldest personal account). */
  explicitDefaultAltaPayReceiveAccountId: string | null;
  /** Account Alta Pay uses today — explicit choice or oldest personal account. */
  defaultAltaPayReceiveAccountId: string | null;
  defaultAltaPayFundingAccountId: string | null;
  discordNotificationPrefs: DiscordNotificationPrefs;
  paymentEngineNotificationPrefs: import("@/lib/bank/payments-engine-types").PaymentEngineNotificationPrefs;
  receiveAccountOptions: BankSettingsAccountOption[];
  fundingAccountOptions: BankSettingsAccountOption[];
}

export interface UpdateUserBankSettingsInput {
  defaultAltaPayReceiveAccountId?: string | null;
  defaultAltaPayFundingAccountId?: string | null;
  discordNotificationPrefs?: DiscordNotificationPrefs;
  paymentEngineNotificationPrefs?: import("@/lib/bank/payments-engine-types").PaymentEngineNotificationPrefs;
}

export const BANK_DISCORD_NOTIFICATION_OPTIONS = [
  { type: "DEPOSIT_SUBMITTED", label: "Deposit request submitted" },
  { type: "DEPOSIT_APPROVED", label: "Deposit approved" },
  { type: "WITHDRAWAL_SUBMITTED", label: "Withdrawal request submitted" },
  { type: "WITHDRAWAL_APPROVED", label: "Withdrawal approved" },
  { type: "TRANSFER_COMPLETED", label: "Transfer completed" },
  { type: "TRANSFER_RECEIVED", label: "Transfer received" },
  { type: "TRANSFER_FAILED", label: "Transfer failed" },
  { type: "ALTA_PAY_SENT", label: "Alta Pay sent" },
  { type: "ALTA_PAY_RECEIVED", label: "Alta Pay received" },
  { type: "ALTA_PAY_FAILED", label: "Alta Pay failed" },
  { type: "SCHEDULED_TRANSFER_EXECUTED", label: "Scheduled transfer completed" },
  { type: "SCHEDULED_TRANSFER_FAILED", label: "Scheduled transfer failed" },
  { type: "PAYROLL_RUN_EXECUTED", label: "Payroll batch completed" },
  { type: "PAYROLL_RUN_FAILED", label: "Payroll batch failed" },
  { type: "LOAN_APPLICATION_APPROVED", label: "Loan application approved" },
  { type: "LOAN_APPLICATION_DENIED", label: "Loan application declined" },
  { type: "LOAN_PAYMENT_MADE", label: "Loan payment received" },
  { type: "LOAN_PAID_OFF", label: "Loan paid off" },
  { type: "LOAN_AUTOPAY_FAILED", label: "Loan autopay failed" },
  { type: "ALTA_CARD_APPLICATION_APPROVED", label: "Alta Card application approved" },
  { type: "ALTA_CARD_APPLICATION_DENIED", label: "Alta Card application declined" },
  { type: "ALTA_CARD_PAYMENT_MADE", label: "Alta Card payment received" },
  { type: "ALTA_CARD_AUTOPAY_SUCCEEDED", label: "Alta Card autopay completed" },
  { type: "ALTA_CARD_AUTOPAY_FAILED", label: "Alta Card autopay failed" },
  { type: "ALTA_CARD_REVIEW_DECIDED", label: "Alta Card review decision" },
  { type: "ALTA_CARD_ACTIVATED", label: "Alta Card activated" },
  { type: "COMPANY_VERIFIED", label: "Company verified" },
  { type: "COMPANY_ROLE_CHANGED", label: "Company role updated" },
] as const satisfies ReadonlyArray<{ type: UserNotificationType; label: string }>;
