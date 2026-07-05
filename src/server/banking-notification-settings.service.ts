import {
  BANKING_NOTIFICATION_PLATFORM_SETTING_KEYS,
  DEFAULT_BANKING_NOTIFICATION_PLATFORM_SETTINGS,
  parseBankingNotificationPlatformSettings,
  type BankingNotificationPlatformSettings,
} from "@/lib/platform/banking-notification-settings-types";
import { prisma } from "@/server/db";

let cache: { value: BankingNotificationPlatformSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getBankingNotificationPlatformSettings(): Promise<BankingNotificationPlatformSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const row = await prisma.platformSetting.findUnique({
    where: { key: BANKING_NOTIFICATION_PLATFORM_SETTING_KEYS.largeMoneyMovementDmThreshold },
  });

  const threshold =
    typeof row?.value === "number" ? row.value : DEFAULT_BANKING_NOTIFICATION_PLATFORM_SETTINGS.largeMoneyMovementDmThreshold;

  const parsed = parseBankingNotificationPlatformSettings({ largeMoneyMovementDmThreshold: threshold });
  cache = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
  return parsed;
}

export function invalidateBankingNotificationPlatformSettingsCache(): void {
  cache = null;
}

export async function updateBankingNotificationPlatformSettings(
  actorUserId: string,
  input: BankingNotificationPlatformSettings,
  reason: string,
): Promise<BankingNotificationPlatformSettings> {
  const parsed = parseBankingNotificationPlatformSettings(input);

  await prisma.platformSetting.upsert({
    where: { key: BANKING_NOTIFICATION_PLATFORM_SETTING_KEYS.largeMoneyMovementDmThreshold },
    create: {
      key: BANKING_NOTIFICATION_PLATFORM_SETTING_KEYS.largeMoneyMovementDmThreshold,
      value: parsed.largeMoneyMovementDmThreshold,
      updatedById: actorUserId,
    },
    update: {
      value: parsed.largeMoneyMovementDmThreshold,
      updatedById: actorUserId,
    },
  });

  invalidateBankingNotificationPlatformSettingsCache();

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BANKING_NOTIFICATION_SETTING_CHANGED",
    entityType: "PLATFORM",
    description: `Updated banking notification settings: ${reason}`,
    metadata: { reason, settings: parsed },
  });

  return parsed;
}
