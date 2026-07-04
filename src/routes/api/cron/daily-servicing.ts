import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute, runCronSubJob } from "@/lib/cron/cron-http";
import {
  acquireDailyCronLock,
  dailyCronSkippedPayload,
  DAILY_SERVICING_JOB_KEY,
  DAILY_SERVICING_LOCK_KEY,
  evaluateDailyCronGate,
  releaseDailyCronLock,
} from "@/lib/cron/cron-tick-gating";
import { runLoanServicingJob } from "@/server/loan-servicing-job.service";
import {
  runAltaCardBillingSchedulerJob,
  runAltaCardStatementSchedulerJob,
} from "@/server/alta-card-billing-scheduler.service";
import { runBankAccountStatementSchedulerJob } from "@/server/bank-statement-scheduler.service";
import { runDepositInterestSchedulerJob } from "@/server/deposit-interest-scheduler.service";
import { runCommercialProBillingJob } from "@/server/commercial-pro-billing-job.service";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";

const DAILY_SERVICING_JOB_LABEL = "Daily servicing";

function isCronSubJobError(result: unknown): result is { error: string } {
  return Boolean(result && typeof result === "object" && "error" in result);
}

async function runDailyServicing() {
  const gate = await evaluateDailyCronGate({
    completionJobKey: DAILY_SERVICING_JOB_KEY,
    lockKey: DAILY_SERVICING_LOCK_KEY,
  });
  if (!gate.run) {
    return dailyCronSkippedPayload(gate.reason);
  }

  await acquireDailyCronLock(DAILY_SERVICING_LOCK_KEY);
  const startedAt = new Date();

  try {
    const [loanServicing, altaCard, bankStatements, depositInterest, commercialBilling] =
      await Promise.all([
      runCronSubJob("loan-servicing", () => runLoanServicingJob()),
      runCronSubJob("alta-card", async () => {
        const statements = await runAltaCardStatementSchedulerJob({ trigger: "cron" });
        const billing = await runAltaCardBillingSchedulerJob({ trigger: "cron" });
        return { statements, billing };
      }),
      runCronSubJob("bank-statements", () => runBankAccountStatementSchedulerJob({ trigger: "cron" })),
      runCronSubJob("deposit-interest", () => runDepositInterestSchedulerJob({ trigger: "cron" })),
      runCronSubJob("commercial-pro-billing", () => runCommercialProBillingJob({ trigger: "cron" })),
    ]);

    const subJobErrors = [
      isCronSubJobError(loanServicing) ? loanServicing.error : null,
      isCronSubJobError(altaCard) ? altaCard.error : null,
      isCronSubJobError(bankStatements) ? bankStatements.error : null,
      isCronSubJobError(depositInterest) ? depositInterest.error : null,
      isCronSubJobError(commercialBilling) ? commercialBilling.error : null,
    ].filter((message): message is string => message != null);

    const completedAt = new Date();
    await recordOpsJobRunDetail(
      DAILY_SERVICING_JOB_KEY,
      DAILY_SERVICING_JOB_LABEL,
      subJobErrors.length > 0 ? "FAILED" : "SUCCESS",
      {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processedCount: 5,
        successCount: 5 - subJobErrors.length,
        failureCount: subJobErrors.length,
        errorSummary: subJobErrors[0] ?? null,
        details: { loanServicing, altaCard, bankStatements, depositInterest, commercialBilling },
      },
    );

    return {
      skipped: false,
      ok: subJobErrors.length === 0,
      partialFailures: subJobErrors.length > 0,
      errors: subJobErrors,
      loanServicing,
      altaCard,
      bankStatements,
      depositInterest,
      commercialBilling,
    };
  } finally {
    await releaseDailyCronLock(DAILY_SERVICING_LOCK_KEY);
  }
}

export const Route = createFileRoute("/api/cron/daily-servicing")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "daily-servicing", runDailyServicing),
      POST: ({ request }) => handleCronRoute(request, "daily-servicing", runDailyServicing),
    },
  },
});
