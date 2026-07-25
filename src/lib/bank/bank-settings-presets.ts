import type { UserNotificationType } from "@prisma/client";
import {
  BANK_DISCORD_NOTIFICATION_GROUPS,
  BANK_DISCORD_NOTIFICATION_OPTIONS,
  type DiscordNotificationPrefs,
} from "@/lib/bank/bank-settings-types";

export const DISCORD_NOTIFICATION_PRESETS = ["important", "recommended", "all", "custom"] as const;

export type DiscordNotificationPreset = (typeof DISCORD_NOTIFICATION_PRESETS)[number];

export const DISCORD_NOTIFICATION_PRESET_LABELS: Record<DiscordNotificationPreset, string> = {
  important: "Important only",
  recommended: "Recommended",
  all: "All",
  custom: "Custom",
};

export const DISCORD_NOTIFICATION_PRESET_DESCRIPTIONS: Record<DiscordNotificationPreset, string> = {
  important: "Failed money movement plus approvals and declines.",
  recommended: "Important alerts plus everyday transfers, Alta Pay, and deposits.",
  all: "Every Alta Bank alert the Discord bot can send.",
  custom: "Choose alerts category by category.",
};

/** Money that failed, and decisions you need to act on. Nothing routine. */
export const DISCORD_IMPORTANT_NOTIFICATION_TYPES: readonly UserNotificationType[] = [
  "TRANSFER_FAILED",
  "LARGE_MONEY_MOVEMENT_ALERT",
  "DEPOSIT_APPROVED",
  "WITHDRAWAL_APPROVED",
  "ALTA_PAY_FAILED",
  "SCHEDULED_TRANSFER_FAILED",
  "PAYROLL_RUN_FAILED",
  "CUSTOMER_PAYMENT_FAILED",
  "COMMERCIAL_PRO_BILLING_FAILED",
  "COMMERCIAL_PRO_PAST_DUE",
  "LOAN_APPLICATION_APPROVED",
  "LOAN_APPLICATION_DENIED",
  "LOAN_AUTOPAY_FAILED",
  "ALTA_CARD_APPLICATION_APPROVED",
  "ALTA_CARD_APPLICATION_DENIED",
  "ALTA_CARD_AUTOPAY_FAILED",
  "ALTA_CARD_FROZEN",
  "COMPANY_VERIFIED",
];

/** Everyday receipts layered on top of the important set. */
const DISCORD_RECOMMENDED_ADDITIONS: readonly UserNotificationType[] = [
  "DEPOSIT_SUBMITTED",
  "WITHDRAWAL_SUBMITTED",
  "TRANSFER_COMPLETED",
  "TRANSFER_RECEIVED",
  "ALTA_PAY_SENT",
  "ALTA_PAY_RECEIVED",
  "SCHEDULED_TRANSFER_EXECUTED",
  "PAYROLL_RUN_EXECUTED",
  "MERCHANT_INVOICE_RECEIVED",
  "MERCHANT_INVOICE_REMINDER",
  "ALTA_CARD_PAYMENT_MADE",
  "ALTA_CARD_AUTOPAY_SUCCEEDED",
  "ALTA_CARD_ACTIVATED",
  "LOAN_PAYMENT_MADE",
  "LOAN_PAID_OFF",
  "DEAL_ROOM_MESSAGE_RECEIVED",
];

export const DISCORD_RECOMMENDED_NOTIFICATION_TYPES: readonly UserNotificationType[] = [
  ...DISCORD_IMPORTANT_NOTIFICATION_TYPES,
  ...DISCORD_RECOMMENDED_ADDITIONS,
];

/** Commercial-heavy groups start closed so personal customers see a short list. */
export const COLLAPSED_BY_DEFAULT_DISCORD_GROUP_IDS: readonly string[] = ["merchant", "commercial"];

export const ALL_DISCORD_NOTIFICATION_TYPES: readonly UserNotificationType[] =
  BANK_DISCORD_NOTIFICATION_OPTIONS.map((option) => option.type);

/** Absent prefs mean "on" — every read goes through here so presets compare fairly. */
export function isDiscordNotificationEnabled(
  prefs: DiscordNotificationPrefs,
  type: UserNotificationType,
): boolean {
  return prefs[type] !== false;
}

function prefsFromEnabledTypes(
  enabled: readonly UserNotificationType[],
): DiscordNotificationPrefs {
  const enabledSet = new Set(enabled);
  const prefs: DiscordNotificationPrefs = {};
  for (const type of ALL_DISCORD_NOTIFICATION_TYPES) {
    prefs[type] = enabledSet.has(type);
  }
  return prefs;
}

/** Rewrites implicit "on" values as explicit booleans without changing meaning. */
export function normalizeDiscordNotificationPrefs(
  prefs: DiscordNotificationPrefs,
): DiscordNotificationPrefs {
  const next: DiscordNotificationPrefs = {};
  for (const type of ALL_DISCORD_NOTIFICATION_TYPES) {
    next[type] = isDiscordNotificationEnabled(prefs, type);
  }
  return next;
}

export function allDiscordNotificationsOff(): DiscordNotificationPrefs {
  return prefsFromEnabledTypes([]);
}

export function applyDiscordNotificationPreset(
  preset: DiscordNotificationPreset,
  current: DiscordNotificationPrefs = {},
): DiscordNotificationPrefs {
  switch (preset) {
    case "important":
      return prefsFromEnabledTypes(DISCORD_IMPORTANT_NOTIFICATION_TYPES);
    case "recommended":
      return prefsFromEnabledTypes(DISCORD_RECOMMENDED_NOTIFICATION_TYPES);
    case "all":
      return prefsFromEnabledTypes(ALL_DISCORD_NOTIFICATION_TYPES);
    case "custom":
      return normalizeDiscordNotificationPrefs(current);
  }
}

function matchesEnabledTypes(
  prefs: DiscordNotificationPrefs,
  enabled: readonly UserNotificationType[],
): boolean {
  const enabledSet = new Set(enabled);
  return ALL_DISCORD_NOTIFICATION_TYPES.every(
    (type) => isDiscordNotificationEnabled(prefs, type) === enabledSet.has(type),
  );
}

/**
 * Maps saved prefs back onto a preset so a freshly loaded form shows the right
 * radio without writing anything and looking dirty.
 */
export function detectDiscordNotificationPreset(
  prefs: DiscordNotificationPrefs,
): DiscordNotificationPreset {
  if (matchesEnabledTypes(prefs, ALL_DISCORD_NOTIFICATION_TYPES)) return "all";
  if (matchesEnabledTypes(prefs, DISCORD_RECOMMENDED_NOTIFICATION_TYPES)) return "recommended";
  if (matchesEnabledTypes(prefs, DISCORD_IMPORTANT_NOTIFICATION_TYPES)) return "important";
  return "custom";
}

export function anyDiscordNotificationEnabled(prefs: DiscordNotificationPrefs): boolean {
  return ALL_DISCORD_NOTIFICATION_TYPES.some((type) => isDiscordNotificationEnabled(prefs, type));
}

export function enabledDiscordNotificationCount(prefs: DiscordNotificationPrefs): number {
  return ALL_DISCORD_NOTIFICATION_TYPES.filter((type) =>
    isDiscordNotificationEnabled(prefs, type),
  ).length;
}

export function setDiscordGroupEnabled(
  prefs: DiscordNotificationPrefs,
  groupId: string,
  enabled: boolean,
): DiscordNotificationPrefs {
  const group = BANK_DISCORD_NOTIFICATION_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return prefs;
  const next: DiscordNotificationPrefs = { ...prefs };
  for (const option of group.options) {
    next[option.type] = enabled;
  }
  return next;
}

export function discordGroupEnabledCount(
  prefs: DiscordNotificationPrefs,
  groupId: string,
): { enabled: number; total: number } {
  const group = BANK_DISCORD_NOTIFICATION_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return { enabled: 0, total: 0 };
  const enabled = group.options.filter((option) =>
    isDiscordNotificationEnabled(prefs, option.type),
  ).length;
  return { enabled, total: group.options.length };
}
