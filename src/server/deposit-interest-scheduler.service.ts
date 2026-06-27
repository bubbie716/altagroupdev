import { accrueInterestForDueAccounts } from "@/lib/bank/account-interest-service";
import type { DepositInterestSchedulerResult } from "@/lib/bank/manual-interest-scheduler-types";
import { executeDueScheduledManualInterest } from "@/server/manual-interest-scheduler.service";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { prisma } from "@/server/db";

export const DEPOSIT_INTEREST_JOB_KEY = "deposit_interest";
const JOB_LABEL = "Deposit interest servicing";

type SchedulerTrigger = "cron" | "manual";

async function resolveActorUserId(actorUserId?: string): Promise<string | undefined> {
  if (actorUserId) return actorUserId;
  const systemActor = await prisma.user.findFirst({
    where: { tags: { some: { tag: "ADMIN" } } },
    select: { id: true },
  });
  return systemActor?.id;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function runDepositInterestSchedulerJob(options?: {
  trigger?: SchedulerTrigger;
  actorUserId?: string;
}): Promise<DepositInterestSchedulerResult> {
  const startedAt = new Date();
  const actorUserId = await resolveActorUserId(options?.actorUserId);

  try {
    const [depositAccrual, scheduledManualInterest] = await Promise.all([
      accrueInterestForDueAccounts(actorUserId),
      executeDueScheduledManualInterest(),
    ]);

    const completedAt = new Date();
    const failureCount = depositAccrual.failedCount + scheduledManualInterest.failedCount;
    const processedCount =
      depositAccrual.processedCount +
      depositAccrual.skippedCount +
      scheduledManualInterest.dueCount;
    const successCount = depositAccrual.processedCount + scheduledManualInterest.appliedCount;

    await recordOpsJobRunDetail(
      DEPOSIT_INTEREST_JOB_KEY,
      JOB_LABEL,
      failureCount > 0 ? "FAILED" : "SUCCESS",
      {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processedCount,
        successCount,
        failureCount,
        details: {
          trigger: options?.trigger ?? "cron",
          depositAccrualProcessed: depositAccrual.processedCount,
          depositAccrualSkipped: depositAccrual.skippedCount,
          depositAccrualFailed: depositAccrual.failedCount,
          depositAccrualTotalCredited: depositAccrual.totalInterestCredited,
          scheduledManualDue: scheduledManualInterest.dueCount,
          scheduledManualApplied: scheduledManualInterest.appliedCount,
          scheduledManualFailed: scheduledManualInterest.failedCount,
          scheduledManualSkipped: scheduledManualInterest.skippedCount,
        },
      },
    );

    return {
      depositAccrual: {
        processedCount: depositAccrual.processedCount,
        skippedCount: depositAccrual.skippedCount,
        failedCount: depositAccrual.failedCount,
        totalInterestCredited: depositAccrual.totalInterestCredited,
      },
      scheduledManualInterest,
    };
  } catch (error) {
    const completedAt = new Date();
    await recordOpsJobRunDetail(DEPOSIT_INTEREST_JOB_KEY, JOB_LABEL, "FAILED", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: errorMessage(error),
      details: { trigger: options?.trigger ?? "cron" },
    });
    throw error;
  }
}
