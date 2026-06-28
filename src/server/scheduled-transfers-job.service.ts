import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";
import { executeDuePayrollRuns } from "@/server/payroll-executor.service";

export const SCHEDULED_TRANSFERS_JOB_KEY = "scheduled_transfers";
export const PAYROLL_JOB_KEY = "payroll";

const TRANSFERS_LABEL = "Scheduled transfers";
const PAYROLL_LABEL = "Payroll batches";

export async function runScheduledTransfersJob(): Promise<{
  scheduledTransfers: Awaited<ReturnType<typeof executeDueScheduledTransfers>>;
  payroll: Awaited<ReturnType<typeof executeDuePayrollRuns>>;
}> {
  const startedAt = new Date();

  try {
    const [scheduledTransfers, payroll] = await Promise.all([
      executeDueScheduledTransfers(),
      executeDuePayrollRuns(),
    ]);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await recordOpsJobRunDetail(SCHEDULED_TRANSFERS_JOB_KEY, TRANSFERS_LABEL, "SUCCESS", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      processedCount: scheduledTransfers.executedCount + scheduledTransfers.failedCount + scheduledTransfers.skippedCount,
      successCount: scheduledTransfers.executedCount,
      failureCount: scheduledTransfers.failedCount,
      details: { scheduledTransfers, payroll: { executed: payroll.executedCount } },
    });

    await recordOpsJobRunDetail(PAYROLL_JOB_KEY, PAYROLL_LABEL, payroll.failedCount > 0 ? "FAILED" : "SUCCESS", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      processedCount: payroll.executedCount + payroll.failedCount + payroll.skippedCount,
      successCount: payroll.executedCount,
      failureCount: payroll.failedCount,
      details: payroll,
    });

    return { scheduledTransfers, payroll };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const summary = {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: message,
    };
    await recordOpsJobRunDetail(SCHEDULED_TRANSFERS_JOB_KEY, TRANSFERS_LABEL, "FAILED", summary);
    await recordOpsJobRunDetail(PAYROLL_JOB_KEY, PAYROLL_LABEL, "FAILED", summary);
    throw error;
  }
}
