import { createFileRoute } from "@tanstack/react-router";
import { cronResponse, validateCronSecret } from "@/lib/cron/cron-http";
import { runBankAccountStatementSchedulerJob } from "@/server/bank-statement-scheduler.service";

export const Route = createFileRoute("/api/cron/bank-statements")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await runBankAccountStatementSchedulerJob({ trigger: "cron" });
          return cronResponse({
            ok: result.ok,
            skipped: result.skipped,
            skipReason: result.skipReason,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            eligibleAccounts: result.eligibleAccounts,
            statementsGenerated: result.statementsGenerated,
            skippedExisting: result.skippedExisting,
            failed: result.failed,
            failures: result.failures,
            durationMs: result.durationMs,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Bank statement generation failed.";
          return cronResponse({ ok: false, message }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await runBankAccountStatementSchedulerJob({ trigger: "cron" });
          return cronResponse({
            ok: result.ok,
            skipped: result.skipped,
            skipReason: result.skipReason,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            eligibleAccounts: result.eligibleAccounts,
            statementsGenerated: result.statementsGenerated,
            skippedExisting: result.skippedExisting,
            failed: result.failed,
            failures: result.failures,
            durationMs: result.durationMs,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Bank statement generation failed.";
          return cronResponse({ ok: false, message }, 500);
        }
      },
    },
  },
});
