import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import {
  acquireDailyCronLock,
  dailyCronSkippedPayload,
  DAILY_SERVICING_LOCK_KEY,
  evaluateDailyCronGate,
  releaseDailyCronLock,
} from "@/lib/cron/cron-tick-gating";
import {
  accrueInterestForDueLoans,
  executeDueLoanAutoPayments,
} from "@/server/loan.service";
import {
  runAltaCardBillingSchedulerJob,
  runAltaCardStatementSchedulerJob,
} from "@/server/alta-card-billing-scheduler.service";
import { runBankAccountStatementSchedulerJob } from "@/server/bank-statement-scheduler.service";
import { DEPOSIT_INTEREST_JOB_KEY, runDepositInterestSchedulerJob } from "@/server/deposit-interest-scheduler.service";

async function runDailyServicing() {
  const gate = await evaluateDailyCronGate({
    completionJobKey: DEPOSIT_INTEREST_JOB_KEY,
    lockKey: DAILY_SERVICING_LOCK_KEY,
  });
  if (!gate.run) {
    return dailyCronSkippedPayload(gate.reason);
  }

  await acquireDailyCronLock(DAILY_SERVICING_LOCK_KEY);

  try {
    const [loanServicing, altaCard, bankStatements, depositInterest] = await Promise.all([
      (async () => {
        const interest = await accrueInterestForDueLoans();
        const autoPay = await executeDueLoanAutoPayments();
        return { interest, autoPay };
      })(),
      (async () => {
        const statements = await runAltaCardStatementSchedulerJob({ trigger: "cron" });
        const billing = await runAltaCardBillingSchedulerJob({ trigger: "cron" });
        return { statements, billing };
      })(),
      runBankAccountStatementSchedulerJob({ trigger: "cron" }),
      runDepositInterestSchedulerJob({ trigger: "cron" }),
    ]);

    return { skipped: false, loanServicing, altaCard, bankStatements, depositInterest };
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
