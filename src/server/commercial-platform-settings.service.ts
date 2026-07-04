import { isAdmin } from "@/lib/auth/permissions";
import {
  COMMERCIAL_PLATFORM_SETTING_KEYS,
  DEFAULT_COMMERCIAL_PLATFORM_SETTINGS,
  parseCommercialPlatformSettings,
  type CommercialPlatformSettings,
  type CommercialPlatformSettingsView,
  type UpdateCommercialPlatformSettingsInput,
} from "@/lib/platform/commercial-plan-settings-types";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/permissions.service";

const SETTING_KEYS = Object.values(COMMERCIAL_PLATFORM_SETTING_KEYS);
const CACHE_TTL_MS = 10_000;

let settingsCache: { value: CommercialPlatformSettings; expiresAt: number } | null = null;

export function clearCommercialPlatformSettingsCache(): void {
  settingsCache = null;
}

function badRequest(msg: string): never {
  throw new Error(`BAD_REQUEST:${msg}`);
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeSettings(raw: Map<string, { value: unknown; updatedAt: Date }>): CommercialPlatformSettings {
  const defaults = DEFAULT_COMMERCIAL_PLATFORM_SETTINGS;
  return {
    proMonthlyFee: parseNumber(
      raw.get(COMMERCIAL_PLATFORM_SETTING_KEYS.proMonthlyFee)?.value,
      defaults.proMonthlyFee,
    ),
    coreInvoiceMonthlyLimit: parseNumber(
      raw.get(COMMERCIAL_PLATFORM_SETTING_KEYS.coreInvoiceMonthlyLimit)?.value,
      defaults.coreInvoiceMonthlyLimit,
    ),
    coreActivePaymentLinkLimit: parseNumber(
      raw.get(COMMERCIAL_PLATFORM_SETTING_KEYS.coreActivePaymentLinkLimit)?.value,
      defaults.coreActivePaymentLinkLimit,
    ),
    coreTeamMemberLimit: parseNumber(
      raw.get(COMMERCIAL_PLATFORM_SETTING_KEYS.coreTeamMemberLimit)?.value,
      defaults.coreTeamMemberLimit,
    ),
    proBillingGracePeriodDays: parseNumber(
      raw.get(COMMERCIAL_PLATFORM_SETTING_KEYS.proBillingGracePeriodDays)?.value,
      defaults.proBillingGracePeriodDays,
    ),
  };
}

async function readSettingsRows(): Promise<Map<string, { value: unknown; updatedAt: Date }>> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: SETTING_KEYS } },
    select: { key: true, value: true, updatedAt: true },
  });
  return new Map(rows.map((row) => [row.key, { value: row.value, updatedAt: row.updatedAt }]));
}

async function writeSetting(key: string, value: unknown, actorUserId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedById: actorUserId },
    update: { value: value as object, updatedById: actorUserId },
  });
}

export async function getCommercialPlatformSettings(): Promise<CommercialPlatformSettings> {
  if (settingsCache && Date.now() < settingsCache.expiresAt) {
    return settingsCache.value;
  }
  try {
    const rows = await readSettingsRows();
    const value = normalizeSettings(rows);
    settingsCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error("[commercial-settings] Failed to read platform settings; using defaults", error);
    return DEFAULT_COMMERCIAL_PLATFORM_SETTINGS;
  }
}

export async function getCommercialPlatformSettingsView(): Promise<CommercialPlatformSettingsView> {
  const { requireOperator } = await import("@/server/permissions.service");
  const actor = await requireOperator();
  const rows = await readSettingsRows();
  const settings = normalizeSettings(rows);

  const updatedByKey = COMMERCIAL_PLATFORM_SETTING_KEYS.proMonthlyFee;
  const updatedRow = rows.get(updatedByKey);
  let updatedById: string | null = null;
  let updatedByUsername: string | null = null;
  let updatedAt: string | null = null;

  const latestRow = [...rows.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0];
  updatedAt = latestRow?.updatedAt.toISOString() ?? null;

  const platformRow = await prisma.platformSetting.findFirst({
    where: { key: { in: SETTING_KEYS }, updatedById: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { updatedById: true },
  });
  updatedById = platformRow?.updatedById ?? null;
  if (updatedById) {
    const updater = await prisma.user.findUnique({
      where: { id: updatedById },
      select: { discordUsername: true },
    });
    updatedByUsername = updater?.discordUsername ?? null;
  }

  return {
    ...settings,
    updatedAt,
    updatedById,
    updatedByUsername,
    canEdit: isAdmin(actor),
  };
}

export async function setCommercialPlatformSettings(
  actorUserId: string,
  input: UpdateCommercialPlatformSettingsInput,
): Promise<CommercialPlatformSettingsView> {
  await requireAdmin();
  const reason = input.reason.trim();
  if (!reason) badRequest("Reason is required");

  const previous = await getCommercialPlatformSettings();
  const next: CommercialPlatformSettings = {
    proMonthlyFee: input.proMonthlyFee,
    coreInvoiceMonthlyLimit: input.coreInvoiceMonthlyLimit,
    coreActivePaymentLinkLimit: input.coreActivePaymentLinkLimit,
    coreTeamMemberLimit: input.coreTeamMemberLimit,
    proBillingGracePeriodDays: input.proBillingGracePeriodDays,
  };

  if (next.proMonthlyFee < 0) badRequest("Pro monthly fee must be zero or greater.");
  if (next.coreInvoiceMonthlyLimit < 1) badRequest("Core invoice limit must be at least 1.");
  if (next.coreActivePaymentLinkLimit < 1) badRequest("Core payment link limit must be at least 1.");
  if (next.coreTeamMemberLimit < 1) badRequest("Core team member limit must be at least 1.");
  if (next.proBillingGracePeriodDays < 0) badRequest("Grace period days must be zero or greater.");

  await Promise.all(
    Object.entries(COMMERCIAL_PLATFORM_SETTING_KEYS).map(([field, key]) =>
      writeSetting(key, next[field as keyof CommercialPlatformSettings], actorUserId),
    ),
  );

  clearCommercialPlatformSettingsCache();

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "COMMERCIAL_PLAN_SETTING_CHANGED",
    entityType: "PLATFORM",
    entityId: "commercial-plan-settings",
    description: "Updated Alta Commercial platform plan settings",
    metadata: {
      reason,
      previous,
      next,
      actorUserId,
    },
  });

  return getCommercialPlatformSettingsView();
}
