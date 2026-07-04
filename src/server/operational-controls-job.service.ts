import { reconcileBankAccountBalances } from "@/server/balance-reconciliation.service";
import { processNotificationRetryQueue } from "@/server/notification-retry-queue.service";
import { runQueueEscalationJob } from "@/server/ops-queue-escalation.service";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";

export const OPERATIONAL_CONTROLS_JOB_KEY = "operational_controls";

export type OperationalControlsJobResult = {
  notificationRetry: Awaited<ReturnType<typeof processNotificationRetryQueue>>;
  queueEscalation: Awaited<ReturnType<typeof runQueueEscalationJob>>;
  balanceReconciliation: Awaited<ReturnType<typeof reconcileBankAccountBalances>>;
  merchantInvoiceOverdue: Awaited<
    ReturnType<
      typeof import("@/server/merchant-invoice-overdue.job").runMerchantInvoiceOverdueJob
    >
  >;
};

export async function runOperationalControlsJob(): Promise<OperationalControlsJobResult> {
  const startedAt = new Date();

  const [notificationRetry, queueEscalation, balanceReconciliation, merchantInvoiceOverdue] =
    await Promise.all([
    processNotificationRetryQueue(startedAt),
    runQueueEscalationJob(startedAt),
    reconcileBankAccountBalances(),
    (async () => {
      const { runMerchantInvoiceOverdueJob } = await import(
        "@/server/merchant-invoice-overdue.job"
      );
      return runMerchantInvoiceOverdueJob();
    })(),
  ]);

  const completedAt = new Date();
  await recordOpsJobRunDetail(
    OPERATIONAL_CONTROLS_JOB_KEY,
    "Operational controls",
    balanceReconciliation.mismatchCount > 0 ? "FAILED" : "SUCCESS",
    {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount:
        notificationRetry.processed +
        queueEscalation.warnings.length +
        balanceReconciliation.accountsChecked +
        merchantInvoiceOverdue.overdueMarked,
      successCount:
        notificationRetry.sent +
        (balanceReconciliation.mismatchCount === 0 ? balanceReconciliation.accountsChecked : 0),
      failureCount:
        notificationRetry.permanentFailures +
        balanceReconciliation.mismatchCount +
        queueEscalation.escalations.length,
      details: { notificationRetry, queueEscalation, balanceReconciliation, merchantInvoiceOverdue },
    },
  );

  return { notificationRetry, queueEscalation, balanceReconciliation, merchantInvoiceOverdue };
}
