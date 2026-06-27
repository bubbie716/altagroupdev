import { createFileRoute } from "@tanstack/react-router";
import { cronResponse, validateCronSecret } from "@/lib/cron/cron-http";
import {
  accrueInterestForDueLoans,
  executeDueLoanAutoPayments,
} from "@/server/loan.service";
import {
  runAltaCardBillingSchedulerJob,
  runAltaCardStatementSchedulerJob,
} from "@/server/alta-card-billing-scheduler.service";
import { runBankAccountStatementSchedulerJob } from "@/server/bank-statement-scheduler.service";
import { runDepositInterestSchedulerJob } from "@/server/deposit-interest-scheduler.service";
import { executeDuePayrollRuns } from "@/server/payroll-executor.service";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";

async function executeLoanServicing() {
  const interest = await accrueInterestForDueLoans();
  const autoPay = await executeDueLoanAutoPayments();
  return { interest, autoPay };
}

async function executeAltaCardServicing() {
  const statements = await runAltaCardStatementSchedulerJob({ trigger: "cron" });
  const billing = await runAltaCardBillingSchedulerJob({ trigger: "cron" });
  return { statements, billing };
}

async function executeBankStatementServicing() {
  return runBankAccountStatementSchedulerJob({ trigger: "cron" });
}

async function executeDepositInterestServicing() {
  return runDepositInterestSchedulerJob({ trigger: "cron" });
}

async function runExecutor() {
  const [scheduledTransfers, payroll, loanServicing, altaCard, bankStatements, depositInterest] =
    await Promise.all([
      executeDueScheduledTransfers(),
      executeDuePayrollRuns(),
      executeLoanServicing(),
      executeAltaCardServicing(),
      executeBankStatementServicing(),
      executeDepositInterestServicing(),
    ]);
  return cronResponse({
    ok: true,
    scheduledTransfers,
    payroll,
    loanServicing,
    altaCard,
    bankStatements,
    depositInterest,
  });
}

export const Route = createFileRoute("/api/cron/scheduled-transfers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }

        try {
          return await runExecutor();
        } catch {
          return cronResponse({ ok: false, message: "Cron execution failed." }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }

        try {
          return await runExecutor();
        } catch {
          return cronResponse({ ok: false, message: "Cron execution failed." }, 500);
        }
      },
    },
  },
});
