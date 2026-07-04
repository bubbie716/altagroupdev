import { OPS_JOBS_CATALOG } from "@/lib/internal/ops-jobs-catalog";
import { formatOpsJobRunHealthDetail } from "@/lib/internal/ops-job-run-display";
import { listOpsJobRuns } from "@/server/ops-job-run.service";
import { requireAdmin, requireOperator } from "@/server/permissions.service";
import { writeAuditLog } from "@/server/audit.service";

type OpsJobRunSummary = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: string | null;
  details?: Record<string, unknown>;
};

function parseSummary(lastMessage: string | null | undefined): OpsJobRunSummary | null {
  if (!lastMessage?.trimStart().startsWith("{")) return null;
  try {
    return JSON.parse(lastMessage) as OpsJobRunSummary;
  } catch {
    return null;
  }
}

export type OpsJobRow = {
  jobKey: string;
  label: string;
  description: string;
  cronEndpoint: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  durationMs: number | null;
  processedCount: number | null;
  successCount: number | null;
  failureCount: number | null;
  nextScheduledRun: string;
  latestError: string | null;
  detailSummary: string;
  manualRunKey: string | null;
  manualImpact: string | null;
};

export async function listOpsJobs(): Promise<OpsJobRow[]> {
  await requireOperator();
  const runs = await listOpsJobRuns();
  const runMap = new Map(runs.map((r) => [r.jobKey, r]));

  return OPS_JOBS_CATALOG.map((entry) => {
    const run = runMap.get(entry.jobKey);
    const summary = parseSummary(run?.lastMessage);
    const lastRunAt = run?.lastSuccessAt ?? run?.lastFailureAt;
    const detailSummary = formatOpsJobRunHealthDetail(
      entry.jobKey,
      run?.lastMessage,
      entry.description,
    );

    return {
      jobKey: entry.jobKey,
      label: entry.label,
      description: entry.description,
      cronEndpoint: entry.cronEndpoint ?? null,
      lastRunAt: lastRunAt?.toISOString() ?? null,
      lastStatus: run?.lastStatus ?? null,
      durationMs: summary?.durationMs ?? null,
      processedCount: summary?.processedCount ?? null,
      successCount: summary?.successCount ?? null,
      failureCount: summary?.failureCount ?? null,
      nextScheduledRun: entry.nextSchedule,
      latestError: summary?.errorSummary ?? (run?.lastStatus === "FAILED" && !summary ? run.lastMessage : null),
      detailSummary,
      manualRunKey: entry.manualRunKey ?? null,
      manualImpact: entry.manualImpact ?? null,
    };
  });
}

export async function runManualOpsJob(
  actorUserId: string,
  jobKey: string,
  reason: string,
): Promise<{ ok: true; summary: string }> {
  await requireAdmin();

  let summary: string;

  switch (jobKey) {
    case "scheduled_transfers":
    case "payroll": {
      const { runScheduledTransfersJob } = await import("@/server/scheduled-transfers-job.service");
      const result = await runScheduledTransfersJob();
      summary =
        jobKey === "payroll"
          ? `Payroll: ${result.payroll.executedCount} executed · ${result.payroll.failedCount} failed`
          : `Transfers: ${result.scheduledTransfers.executedCount} executed · ${result.scheduledTransfers.failedCount} failed`;
      break;
    }
    case "BANK_ACCOUNT_STATEMENTS": {
      const { runBankAccountStatementSchedulerJob } = await import(
        "@/server/bank-statement-scheduler.service"
      );
      const result = await runBankAccountStatementSchedulerJob({
        force: true,
        trigger: "manual",
        actorUserId,
      });
      summary = `${result.statementsGenerated} generated · ${result.skippedExisting} skipped · ${result.failed} failed`;
      break;
    }
    case "ALTA_CARD_STATEMENTS": {
      const { runAltaCardStatementSchedulerJob } = await import(
        "@/server/alta-card-billing-scheduler.service"
      );
      const result = await runAltaCardStatementSchedulerJob({
        trigger: "manual",
        force: true,
        actorUserId,
      });
      summary = result.skipped
        ? `Skipped: ${result.skipReason ?? "not month end"}`
        : `${result.statementsGenerated} generated · ${result.failureCount} failed`;
      break;
    }
    case "ALTA_CARD_BILLING": {
      const { runAltaCardBillingSchedulerJob } = await import(
        "@/server/alta-card-billing-scheduler.service"
      );
      const result = await runAltaCardBillingSchedulerJob({ trigger: "manual", actorUserId });
      summary = `${result.cardsProcessed} cards · ${result.autopaySucceeded} autopay ok · ${result.failureCount} failures`;
      break;
    }
    case "relationship_intelligence": {
      const { refreshRelationshipProfilesScheduled } = await import(
        "@/server/relationship-intelligence-scheduler.service"
      );
      const result = await refreshRelationshipProfilesScheduled();
      summary = `${result.refreshed}/${result.processed} refreshed · ${result.failed} failed`;
      break;
    }
    case "relationship_recommendations": {
      const { refreshRelationshipRecommendationsScheduled } = await import(
        "@/server/relationship-intelligence-recommendation-scheduler.service"
      );
      const result = await refreshRelationshipRecommendationsScheduled();
      summary = `${result.generated}/${result.processed} generated · ${result.failed} failed`;
      break;
    }
    case "company_relationship_intelligence": {
      const { refreshCompanyRelationshipProfilesScheduled } = await import(
        "@/server/company-relationship-intelligence-scheduler.service"
      );
      const result = await refreshCompanyRelationshipProfilesScheduled();
      summary = `${result.refreshed}/${result.processed} refreshed · ${result.failed} failed`;
      break;
    }
    case "company_relationship_recommendations": {
      const { refreshCompanyRelationshipRecommendationsScheduled } = await import(
        "@/server/company-relationship-recommendation-scheduler.service"
      );
      const result = await refreshCompanyRelationshipRecommendationsScheduled();
      summary = `${result.generated}/${result.processed} generated · ${result.failed} failed`;
      break;
    }
    case "loan_servicing": {
      const { runLoanServicingJob } = await import("@/server/loan-servicing-job.service");
      const result = await runLoanServicingJob(actorUserId);
      summary = `Interest: ${result.interest.accrued} accrued · Autopay: ${result.autoPay.executedCount} executed · ${result.autoPay.failedCount} failed`;
      break;
    }
    case "operational_controls": {
      const { runOperationalControlsJob } = await import("@/server/operational-controls-job.service");
      const result = await runOperationalControlsJob();
      summary = `DM retry: ${result.notificationRetry.sent} sent · Queue: ${result.queueEscalation.escalations.length} escalations · Reconciliation: ${result.balanceReconciliation.mismatchCount} mismatches`;
      break;
    }
    case "balance_reconciliation": {
      const { reconcileBankAccountBalances } = await import("@/server/balance-reconciliation.service");
      const result = await reconcileBankAccountBalances({ actorUserId });
      summary = `${result.accountsChecked} accounts checked · ${result.mismatchCount} mismatch(es)`;
      break;
    }
    default:
      throw new Error(`BAD_REQUEST:Unknown or non-runnable job: ${jobKey}`);
  }

  await writeAuditLog({
    actorUserId,
    action: "OPS_JOB_MANUAL_RUN",
    entityType: "PLATFORM",
    entityId: jobKey,
    description: `Manual job run: ${jobKey}. ${summary}`,
    metadata: { jobKey, reason, source: "ADMIN", summary },
  });

  return { ok: true, summary };
}
