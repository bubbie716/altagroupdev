import { reconcileBankAccountBalances } from "@/server/balance-reconciliation.service";
import {
  getDiscordOutboxHealthSnapshot,
  processDiscordOutboxAllBots,
} from "@/server/discord-outbox.service";
import { processNotificationRetryQueue } from "@/server/notification-retry-queue.service";
import { runQueueEscalationJob } from "@/server/ops-queue-escalation.service";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";

export const OPERATIONAL_CONTROLS_JOB_KEY = "operational_controls";

export type OperationalControlsJobResult = {
  notificationRetry: Awaited<ReturnType<typeof processNotificationRetryQueue>>;
  discordOutbox: Awaited<ReturnType<typeof processDiscordOutboxAllBots>>;
  discordOutboxHealth: Awaited<ReturnType<typeof getDiscordOutboxHealthSnapshot>>;
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

  const [
    notificationRetry,
    discordOutbox,
    queueEscalation,
    balanceReconciliation,
    merchantInvoiceOverdue,
  ] = await Promise.all([
    processNotificationRetryQueue(startedAt),
    processDiscordOutboxAllBots(startedAt),
    runQueueEscalationJob(startedAt),
    reconcileBankAccountBalances(),
    (async () => {
      const { runMerchantInvoiceOverdueJob } = await import(
        "@/server/merchant-invoice-overdue.job"
      );
      return runMerchantInvoiceOverdueJob();
    })(),
  ]);

  const discordOutboxHealth = await getDiscordOutboxHealthSnapshot();
  const outboxProcessed =
    discordOutbox.bank.processed +
    discordOutbox.secretary.processed +
    discordOutbox.terminal.processed;
  const outboxSent =
    discordOutbox.bank.sent + discordOutbox.secretary.sent + discordOutbox.terminal.sent;
  const outboxDead =
    discordOutbox.bank.dead + discordOutbox.secretary.dead + discordOutbox.terminal.dead;

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
        outboxProcessed +
        queueEscalation.warnings.length +
        balanceReconciliation.accountsChecked +
        merchantInvoiceOverdue.overdueMarked,
      successCount:
        notificationRetry.sent +
        outboxSent +
        (balanceReconciliation.mismatchCount === 0 ? balanceReconciliation.accountsChecked : 0),
      failureCount:
        notificationRetry.permanentFailures +
        outboxDead +
        balanceReconciliation.mismatchCount +
        queueEscalation.escalations.length,
      details: {
        notificationRetry,
        discordOutbox,
        discordOutboxHealth,
        queueEscalation,
        balanceReconciliation,
        merchantInvoiceOverdue,
      },
    },
  );

  return {
    notificationRetry,
    discordOutbox,
    discordOutboxHealth,
    queueEscalation,
    balanceReconciliation,
    merchantInvoiceOverdue,
  };
}
