import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import {
  accrueInterestForDueLoans,
  executeDueLoanAutoPayments,
} from "@/server/loan.service";
import { resolveSystemActorUserId } from "@/server/system-actor.service";

export const LOAN_SERVICING_JOB_KEY = "loan_servicing";

const JOB_LABEL = "Loan servicing";

export async function runLoanServicingJob(actorUserId?: string): Promise<{
  interest: Awaited<ReturnType<typeof accrueInterestForDueLoans>>;
  autoPay: Awaited<ReturnType<typeof executeDueLoanAutoPayments>>;
}> {
  const startedAt = new Date();
  const actor = actorUserId ?? (await resolveSystemActorUserId());

  try {
    const interest = await accrueInterestForDueLoans(actor);
    const autoPay = await executeDueLoanAutoPayments();
    const completedAt = new Date();
    const processed =
      interest.processed + autoPay.executedCount + autoPay.failedCount + autoPay.skippedCount;
    const failed = autoPay.failedCount;
    const success = interest.accrued + autoPay.executedCount;

    await recordOpsJobRunDetail(LOAN_SERVICING_JOB_KEY, JOB_LABEL, failed > 0 ? "FAILED" : "SUCCESS", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: processed,
      successCount: Math.max(0, success),
      failureCount: failed,
      details: { interest, autoPay },
    });

    return { interest, autoPay };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await recordOpsJobRunDetail(LOAN_SERVICING_JOB_KEY, JOB_LABEL, "FAILED", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: message,
    });

    throw error;
  }
}
