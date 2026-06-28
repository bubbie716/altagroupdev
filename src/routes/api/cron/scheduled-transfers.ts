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
import { refreshRelationshipProfilesScheduled } from "@/server/relationship-intelligence-scheduler.service";
import { refreshRelationshipRecommendationsScheduled } from "@/server/relationship-intelligence-recommendation-scheduler.service";
import { refreshCompanyRelationshipProfilesScheduled } from "@/server/company-relationship-intelligence-scheduler.service";
import { refreshCompanyRelationshipRecommendationsScheduled } from "@/server/company-relationship-recommendation-scheduler.service";

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

async function executeRelationshipIntelligenceRefresh() {
  const summary: Record<string, unknown> = {};

  try {
    summary.personalProfiles = await refreshRelationshipProfilesScheduled();
  } catch (error) {
    summary.personalProfiles = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    summary.personalRecommendations = await refreshRelationshipRecommendationsScheduled();
  } catch (error) {
    summary.personalRecommendations = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    summary.companyProfiles = await refreshCompanyRelationshipProfilesScheduled();
  } catch (error) {
    summary.companyProfiles = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    summary.companyRecommendations = await refreshCompanyRelationshipRecommendationsScheduled();
  } catch (error) {
    summary.companyRecommendations = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return summary;
}

async function runExecutor() {
  const [scheduledTransfers, payroll, loanServicing, altaCard, bankStatements, depositInterest, relationshipIntelligence] =
    await Promise.all([
      executeDueScheduledTransfers(),
      executeDuePayrollRuns(),
      executeLoanServicing(),
      executeAltaCardServicing(),
      executeBankStatementServicing(),
      executeDepositInterestServicing(),
      executeRelationshipIntelligenceRefresh(),
    ]);
  return cronResponse({
    ok: true,
    scheduledTransfers,
    payroll,
    loanServicing,
    altaCard,
    bankStatements,
    depositInterest,
    relationshipIntelligence,
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
