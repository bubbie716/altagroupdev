import {
  DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS,
  PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS,
  parsePaymentsEnginePlatformSettings,
  type PaymentsEnginePlatformSettings,
} from "@/lib/platform/payments-engine-settings-types";
import { prisma } from "@/server/db";

let cache: { value: PaymentsEnginePlatformSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getPaymentsEnginePlatformSettings(): Promise<PaymentsEnginePlatformSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: Object.values(PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS) } },
  });
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  const parsed = parsePaymentsEnginePlatformSettings({
    maxScheduledPaymentFutureDays: byKey[PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.maxScheduledPaymentFutureDays] as
      | number
      | undefined,
    allowedRecurringIntervals: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.allowedRecurringIntervals
    ] as PaymentsEnginePlatformSettings["allowedRecurringIntervals"] | undefined,
    defaultRetryCount: byKey[PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.defaultRetryCount] as
      | number
      | undefined,
    defaultRetryDelayMinutes: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.defaultRetryDelayMinutes
    ] as number | undefined,
    defaultAutopayMaxInvoiceAmount: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.defaultAutopayMaxInvoiceAmount
    ] as number | undefined,
    defaultMerchantApprovalExpiryDays: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.defaultMerchantApprovalExpiryDays
    ] as number | undefined,
    recurringInvoicesRequirePro: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.recurringInvoicesRequirePro
    ] as boolean | undefined,
    maxFailedAttemptsBeforeDisableSchedule: byKey[
      PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS.maxFailedAttemptsBeforeDisableSchedule
    ] as number | undefined,
  });

  cache = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
  return parsed;
}

export function invalidatePaymentsEnginePlatformSettingsCache(): void {
  cache = null;
}

export async function updatePaymentsEnginePlatformSettings(
  actorUserId: string,
  input: PaymentsEnginePlatformSettings,
  reason: string,
): Promise<PaymentsEnginePlatformSettings> {
  const parsed = parsePaymentsEnginePlatformSettings(input);
  const entries = Object.entries(PAYMENTS_ENGINE_PLATFORM_SETTING_KEYS) as Array<
    [keyof PaymentsEnginePlatformSettings, string]
  >;

  await prisma.$transaction(
    entries.map(([field, key]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: parsed[field], updatedById: actorUserId },
        update: { value: parsed[field], updatedById: actorUserId },
      }),
    ),
  );

  invalidatePaymentsEnginePlatformSettingsCache();

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "PAYMENTS_ENGINE_SETTING_CHANGED",
    entityType: "PLATFORM",
    description: `Updated payments engine settings: ${reason}`,
    metadata: { reason, settings: parsed },
  });

  return parsed;
}

export { DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS };
