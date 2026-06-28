import { COMPANY_RELATIONSHIP_INTELLIGENCE_JOB_KEY } from "@/lib/bank/company-relationship-intelligence-config";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { refreshAllCompanyRelationshipProfiles } from "@/server/company-relationship-intelligence.service";

const JOB_LABEL = "Company relationship intelligence refresh";

export async function refreshCompanyRelationshipProfilesScheduled(): Promise<{
  processed: number;
  refreshed: number;
  failed: number;
}> {
  const startedAt = new Date();

  try {
    const result = await refreshAllCompanyRelationshipProfiles(undefined, { allowSystemRefresh: true });
    const completedAt = new Date();

    await recordOpsJobRunDetail(
      COMPANY_RELATIONSHIP_INTELLIGENCE_JOB_KEY,
      JOB_LABEL,
      result.failed > 0 ? "FAILED" : "SUCCESS",
      {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processedCount: result.processed,
        successCount: result.refreshed,
        failureCount: result.failed,
        details: result,
      },
    );

    return result;
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await recordOpsJobRunDetail(COMPANY_RELATIONSHIP_INTELLIGENCE_JOB_KEY, JOB_LABEL, "FAILED", {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      details: { error: message },
    });

    throw error;
  }
}
