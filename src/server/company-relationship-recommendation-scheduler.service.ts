import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { refreshCompanyRecommendationsForAllProfiles } from "@/server/company-relationship-recommendation.service";

export const COMPANY_RELATIONSHIP_RECOMMENDATIONS_JOB_KEY = "company_relationship_recommendations";

const JOB_LABEL = "Company relationship recommendations refresh";

export async function refreshCompanyRelationshipRecommendationsScheduled(): Promise<{
  processed: number;
  generated: number;
  failed: number;
}> {
  const startedAt = new Date();

  try {
    const result = await refreshCompanyRecommendationsForAllProfiles();
    const completedAt = new Date();

    await recordOpsJobRunDetail(
      COMPANY_RELATIONSHIP_RECOMMENDATIONS_JOB_KEY,
      JOB_LABEL,
      result.failed > 0 ? "FAILED" : "SUCCESS",
      {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processedCount: result.processed,
        successCount: result.generated,
        failureCount: result.failed,
        details: result,
      },
    );

    return result;
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await recordOpsJobRunDetail(COMPANY_RELATIONSHIP_RECOMMENDATIONS_JOB_KEY, JOB_LABEL, "FAILED", {
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
