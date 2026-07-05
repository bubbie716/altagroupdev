export const COMMERCIAL_PLATFORM_SETTING_KEYS = {
  proMonthlyFee: "commercial.proMonthlyFee",
  coreInvoiceMonthlyLimit: "commercial.coreInvoiceMonthlyLimit",
  corePaymentLinkMonthlyLimit: "commercial.corePaymentLinkMonthlyLimit",
  coreTeamMemberLimit: "commercial.coreTeamMemberLimit",
  proBillingGracePeriodDays: "commercial.proBillingGracePeriodDays",
} as const;

/** @deprecated Legacy DB key — read as fallback when migrating settings. */
export const LEGACY_COMMERCIAL_PLATFORM_SETTING_KEYS = {
  coreActivePaymentLinkLimit: "commercial.coreActivePaymentLinkLimit",
} as const;

export type CommercialPlatformSettings = {
  proMonthlyFee: number;
  coreInvoiceMonthlyLimit: number;
  corePaymentLinkMonthlyLimit: number;
  coreTeamMemberLimit: number;
  proBillingGracePeriodDays: number;
};

export const DEFAULT_COMMERCIAL_PLATFORM_SETTINGS: CommercialPlatformSettings = {
  proMonthlyFee: 10_000,
  coreInvoiceMonthlyLimit: 10,
  corePaymentLinkMonthlyLimit: 5,
  coreTeamMemberLimit: 3,
  proBillingGracePeriodDays: 7,
};

export type CommercialPlatformSettingsView = CommercialPlatformSettings & {
  updatedAt: string | null;
  updatedById: string | null;
  updatedByUsername: string | null;
  canEdit: boolean;
};

export type UpdateCommercialPlatformSettingsInput = CommercialPlatformSettings & {
  reason: string;
};

export function parseCommercialPlatformSettings(
  input: Partial<CommercialPlatformSettings>,
): CommercialPlatformSettings {
  const defaults = DEFAULT_COMMERCIAL_PLATFORM_SETTINGS;
  return {
    proMonthlyFee: input.proMonthlyFee ?? defaults.proMonthlyFee,
    coreInvoiceMonthlyLimit: input.coreInvoiceMonthlyLimit ?? defaults.coreInvoiceMonthlyLimit,
    corePaymentLinkMonthlyLimit:
      input.corePaymentLinkMonthlyLimit ?? defaults.corePaymentLinkMonthlyLimit,
    coreTeamMemberLimit: input.coreTeamMemberLimit ?? defaults.coreTeamMemberLimit,
    proBillingGracePeriodDays:
      input.proBillingGracePeriodDays ?? defaults.proBillingGracePeriodDays,
  };
}
