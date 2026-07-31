import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { executeDueTerminalScheduledTrades } from "@/server/terminal-scheduled-trade-executor.service";

export const TERMINAL_SCHEDULED_TRADES_JOB_KEY = "terminal_scheduled_trades";

const JOB_LABEL = "Terminal scheduled trades";

/**
 * Future mini-PC timer:
 *   /opt/alta-cron/run.sh terminal-scheduled-trades
 * maps to GET /api/cron/terminal-scheduled-trades with CRON_SECRET.
 */
export async function runTerminalScheduledTradesJob(): Promise<{
  ok: boolean;
  result: Awaited<ReturnType<typeof executeDueTerminalScheduledTrades>>;
  error?: string;
}> {
  const startedAt = new Date();

  try {
    const result = await executeDueTerminalScheduledTrades();
    const completedAt = new Date();
    await recordOpsJobRunDetail(
      TERMINAL_SCHEDULED_TRADES_JOB_KEY,
      JOB_LABEL,
      "SUCCESS",
      {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processedCount: result.submittedCount + result.failedCount + result.skippedCount + result.deferredCount,
        successCount: result.submittedCount,
        failureCount: result.failedCount,
        errorSummary: null,
        details: result as Record<string, unknown>,
      },
    );
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAt = new Date();
    await recordOpsJobRunDetail(TERMINAL_SCHEDULED_TRADES_JOB_KEY, JOB_LABEL, "FAILED", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: message,
      details: { error: message },
    });
    console.error("[terminal-scheduled-trades-job] execution failed", error);
    return {
      ok: false,
      result: {
        dueCount: 0,
        submittedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        deferredCount: 0,
      },
      error: message,
    };
  }
}
