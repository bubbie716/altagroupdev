export const COMMERCIAL_PLATFORM_SETTING_KEYS = {
  proMonthlyFee: "commercial.proMonthlyFee",
  coreInvoiceMonthlyLimit: "commercial.coreInvoiceMonthlyLimit",
  coreActivePaymentLinkLimit: "commercial.coreActivePaymentLinkLimit",
  coreTeamMemberLimit: "commercial.coreTeamMemberLimit",
  proBillingGracePeriodDays: "commercial.proBillingGracePeriodDays",
} as const;

export type CommercialPlatformSettings = {
  proMonthlyFee: number;
  coreInvoiceMonthlyLimit: number;
  coreActivePaymentLinkLimit: number;
  coreTeamMemberLimit: number;
  proBillingGracePeriodDays: number;
};

export const DEFAULT_COMMERCIAL_PLATFORM_SETTINGS: CommercialPlatformSettings = {
  proMonthlyFee: 10_000,
  coreInvoiceMonthlyLimit: 10,
  coreActivePaymentLinkLimit: 5,
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
    coreActivePaymentLinkLimit:
      input.coreActivePaymentLinkLimit ?? defaults.coreActivePaymentLinkLimit,
    coreTeamMemberLimit: input.coreTeamMemberLimit ?? defaults.coreTeamMemberLimit,
    proBillingGracePeriodDays:
      input.proBillingGracePeriodDays ?? defaults.proBillingGracePeriodDays,
  };
}
