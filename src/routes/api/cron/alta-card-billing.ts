import { createFileRoute } from "@tanstack/react-router";
import { cronResponse, validateCronSecret } from "@/lib/cron/cron-http";
import { runAltaCardBillingSchedulerJob } from "@/server/alta-card-billing-scheduler.service";

export const Route = createFileRoute("/api/cron/alta-card-billing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await runAltaCardBillingSchedulerJob({ trigger: "cron" });
          return cronResponse({
            ok: result.ok,
            cardsProcessed: result.cardsProcessed,
            overdueStatements: result.overdueStatementsMarked,
            interestApplied: result.interestApplied,
            feesApplied: result.lateFeesApplied,
            failures: result.failures,
            durationMs: result.durationMs,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            overdueMarked: result.overdueMarked,
            interest: result.interest,
            lateFees: result.lateFees,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Alta Card billing process failed.";
          return cronResponse({ ok: false, message }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await runAltaCardBillingSchedulerJob({ trigger: "cron" });
          return cronResponse({
            ok: result.ok,
            cardsProcessed: result.cardsProcessed,
            overdueStatements: result.overdueStatementsMarked,
            interestApplied: result.interestApplied,
            feesApplied: result.lateFeesApplied,
            failures: result.failures,
            durationMs: result.durationMs,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            overdueMarked: result.overdueMarked,
            interest: result.interest,
            lateFees: result.lateFees,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Alta Card billing process failed.";
          return cronResponse({ ok: false, message }, 500);
        }
      },
    },
  },
});
