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
  receiveAccountOptions: BankSettingsAccountOption[];
  fundingAccountOptions: BankSettingsAccountOption[];
}

export interface UpdateUserBankSettingsInput {
  defaultAltaPayReceiveAccountId?: string | null;
  defaultAltaPayFundingAccountId?: string | null;
  discordNotificationPrefs?: DiscordNotificationPrefs;
}

export const BANK_DISCORD_NOTIFICATION_OPTIONS = [
  { type: "DEPOSIT_SUBMITTED", label: "Deposit request submitted" },
  { type: "DEPOSIT_APPROVED", label: "Deposit approved" },
  { type: "DEPOSIT_DENIED", label: "Deposit denied" },
  { type: "WITHDRAWAL_SUBMITTED", label: "Withdrawal request submitted" },
  { type: "WITHDRAWAL_APPROVED", label: "Withdrawal approved" },
  { type: "WITHDRAWAL_DENIED", label: "Withdrawal denied" },
  { type: "TRANSFER_COMPLETED", label: "Transfer completed" },
  { type: "ALTA_PAY_SENT", label: "Alta Pay sent" },
  { type: "LOAN_APPLICATION_APPROVED", label: "Loan application approved" },
  { type: "LOAN_APPLICATION_DENIED", label: "Loan application declined" },
  { type: "ALTA_CARD_APPLICATION_APPROVED", label: "Alta Card application approved" },
  { type: "ALTA_CARD_APPLICATION_DENIED", label: "Alta Card application declined" },
] as const satisfies ReadonlyArray<{ type: UserNotificationType; label: string }>;
