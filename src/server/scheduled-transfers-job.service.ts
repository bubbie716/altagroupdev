import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";
import { executeDuePayrollRuns } from "@/server/payroll-executor.service";

export const SCHEDULED_TRANSFERS_JOB_KEY = "scheduled_transfers";
export const PAYROLL_JOB_KEY = "payroll";

const TRANSFERS_LABEL = "Scheduled transfers";
const PAYROLL_LABEL = "Payroll batches";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runScheduledTransfersJob(): Promise<{
  ok: boolean;
  scheduledTransfers: Awaited<ReturnType<typeof executeDueScheduledTransfers>>;
  payroll: Awaited<ReturnType<typeof executeDuePayrollRuns>>;
  errors: string[];
}> {
  const startedAt = new Date();
  const errors: string[] = [];

  let scheduledTransfers: Awaited<ReturnType<typeof executeDueScheduledTransfers>> = {
    dueCount: 0,
    executedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };
  let payroll: Awaited<ReturnType<typeof executeDuePayrollRuns>> = {
    dueCount: 0,
    executedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  try {
    scheduledTransfers = await executeDueScheduledTransfers();
  } catch (error) {
    const message = errorMessage(error);
    errors.push(`Scheduled transfers: ${message}`);
    console.error("[scheduled-transfers-job] transfer execution failed", error);
  }

  try {
    payroll = await executeDuePayrollRuns();
  } catch (error) {
    const message = errorMessage(error);
    errors.push(`Payroll: ${message}`);
    console.error("[scheduled-transfers-job] payroll execution failed", error);
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const ok = errors.length === 0;

  await recordOpsJobRunDetail(
    SCHEDULED_TRANSFERS_JOB_KEY,
    TRANSFERS_LABEL,
    ok ? "SUCCESS" : "FAILED",
    {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      processedCount:
        scheduledTransfers.executedCount +
        scheduledTransfers.failedCount +
        scheduledTransfers.skippedCount,
      successCount: scheduledTransfers.executedCount,
      failureCount: scheduledTransfers.failedCount,
      errorSummary: errors[0] ?? null,
      details: { scheduledTransfers, payroll: { executed: payroll.executedCount }, errors },
    },
  );

  await recordOpsJobRunDetail(
    PAYROLL_JOB_KEY,
    PAYROLL_LABEL,
    errors.some((entry) => entry.startsWith("Payroll:")) || payroll.failedCount > 0
      ? "FAILED"
      : "SUCCESS",
    {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      processedCount: payroll.executedCount + payroll.failedCount + payroll.skippedCount,
      successCount: payroll.executedCount,
      failureCount: payroll.failedCount,
      errorSummary: errors.find((entry) => entry.startsWith("Payroll:")) ?? null,
      details: payroll,
    },
  );

  return { ok, scheduledTransfers, payroll, errors };
}
