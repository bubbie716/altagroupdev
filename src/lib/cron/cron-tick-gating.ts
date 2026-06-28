import { getOpsJobRun } from "@/server/ops-job-run.service";
import { prisma } from "@/server/db";

const DAILY_CRON_LOCK_TTL_MS = 15 * 60 * 1000;

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export type DailyCronSkipReason = "already_ran_today" | "in_progress";

export type DailyCronGateResult = { run: true } | { run: false; reason: DailyCronSkipReason };

/** Runs at most once per UTC day; uses OpsJobRun lastSuccessAt on completionJobKey. */
export async function evaluateDailyCronGate(options: {
  completionJobKey: string;
  lockKey: string;
}): Promise<DailyCronGateResult> {
  const now = new Date();

  const lock = await prisma.platformSetting.findUnique({
    where: { key: options.lockKey },
    select: { value: true },
  });
  const lockValue = lock?.value;
  if (lockValue && typeof lockValue === "object" && lockValue !== null && "expiresAt" in lockValue) {
    const expiresAt = new Date(String((lockValue as { expiresAt: string }).expiresAt));
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt > now) {
      return { run: false, reason: "in_progress" };
    }
  }

  const lastRun = await getOpsJobRun(options.completionJobKey);
  if (lastRun?.lastSuccessAt && isSameUtcDay(lastRun.lastSuccessAt, now)) {
    return { run: false, reason: "already_ran_today" };
  }

  return { run: true };
}

export async function acquireDailyCronLock(lockKey: string): Promise<void> {
  const expiresAt = new Date(Date.now() + DAILY_CRON_LOCK_TTL_MS).toISOString();
  await prisma.platformSetting.upsert({
    where: { key: lockKey },
    create: { key: lockKey, value: { expiresAt } },
    update: { value: { expiresAt } },
  });
}

export async function releaseDailyCronLock(lockKey: string): Promise<void> {
  await prisma.platformSetting.deleteMany({ where: { key: lockKey } });
}

export function dailyCronSkippedPayload(reason: DailyCronSkipReason): Record<string, unknown> {
  return {
    skipped: true,
    skipReason:
      reason === "already_ran_today"
        ? "Already completed today"
        : "Already in progress",
  };
}

export const DAILY_SERVICING_LOCK_KEY = "cron_daily_servicing_lock";
export const RELATIONSHIP_INTELLIGENCE_CRON_LOCK_KEY = "cron_relationship_intelligence_lock";
