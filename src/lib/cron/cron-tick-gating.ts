import { RELATIONSHIP_INTELLIGENCE_JOB_KEY } from "@/lib/bank/relationship-intelligence-config";
import { getOpsJobRun } from "@/server/ops-job-run.service";
import { prisma } from "@/server/db";

const HEAVY_CRON_LOCK_KEY = "cron_heavy_bundle_lock";
const HEAVY_CRON_LOCK_TTL_MS = 15 * 60 * 1000;

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export type HeavyCronSkipReason = "already_ran_today" | "in_progress";

export type HeavyCronGateResult =
  | { run: true }
  | { run: false; reason: HeavyCronSkipReason };

/** Heavy cron work (RI, billing, statements, deposit interest) runs at most once per UTC day. */
export async function evaluateHeavyCronGate(): Promise<HeavyCronGateResult> {
  const now = new Date();

  const lock = await prisma.platformSetting.findUnique({
    where: { key: HEAVY_CRON_LOCK_KEY },
    select: { value: true },
  });
  const lockValue = lock?.value;
  if (lockValue && typeof lockValue === "object" && lockValue !== null && "expiresAt" in lockValue) {
    const expiresAt = new Date(String((lockValue as { expiresAt: string }).expiresAt));
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt > now) {
      return { run: false, reason: "in_progress" };
    }
  }

  const lastRun = await getOpsJobRun(RELATIONSHIP_INTELLIGENCE_JOB_KEY);
  if (lastRun?.lastSuccessAt && isSameUtcDay(lastRun.lastSuccessAt, now)) {
    return { run: false, reason: "already_ran_today" };
  }

  return { run: true };
}

export async function acquireHeavyCronLock(): Promise<void> {
  const expiresAt = new Date(Date.now() + HEAVY_CRON_LOCK_TTL_MS).toISOString();
  await prisma.platformSetting.upsert({
    where: { key: HEAVY_CRON_LOCK_KEY },
    create: { key: HEAVY_CRON_LOCK_KEY, value: { expiresAt } },
    update: { value: { expiresAt } },
  });
}

export async function releaseHeavyCronLock(): Promise<void> {
  await prisma.platformSetting.deleteMany({ where: { key: HEAVY_CRON_LOCK_KEY } });
}

export function heavyCronSkippedPayload(reason: HeavyCronSkipReason): Record<string, unknown> {
  return {
    skipped: true,
    skipReason:
      reason === "already_ran_today"
        ? "Heavy cron bundle already completed today"
        : "Heavy cron bundle already in progress",
  };
}
