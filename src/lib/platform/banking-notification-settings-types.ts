export const BANKING_NOTIFICATION_PLATFORM_SETTING_KEYS = {
  largeMoneyMovementDmThreshold: "banking.largeMoneyMovementDmThreshold",
} as const;

export type BankingNotificationPlatformSettings = {
  /** Florin amount; 0 disables large-movement DMs. */
  largeMoneyMovementDmThreshold: number;
};

export const DEFAULT_BANKING_NOTIFICATION_PLATFORM_SETTINGS: BankingNotificationPlatformSettings =
  {
    largeMoneyMovementDmThreshold: 0,
  };

export function parseBankingNotificationPlatformSettings(
  input: Partial<BankingNotificationPlatformSettings>,
): BankingNotificationPlatformSettings {
  const threshold = input.largeMoneyMovementDmThreshold ?? 0;
  return {
    largeMoneyMovementDmThreshold:
      Number.isFinite(threshold) && threshold >= 0 ? threshold : 0,
  };
}
