import { RELATIONSHIP_RECOMMENDATIONS_JOB_KEY } from "@/lib/bank/relationship-recommendation-config";
import { recordOpsJobRunDetail } from "@/server/ops-job-run.service";
import { refreshRecommendationsForAllProfiles } from "@/server/relationship-intelligence-recommendation.service";

const JOB_LABEL = "Relationship recommendations refresh";

export async function refreshRelationshipRecommendationsScheduled(): Promise<{
  processed: number;
  generated: number;
  failed: number;
}> {
  const startedAt = new Date();

  try {
    const result = await refreshRecommendationsForAllProfiles();
    const completedAt = new Date();

    await recordOpsJobRunDetail(
      RELATIONSHIP_RECOMMENDATIONS_JOB_KEY,
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

    await recordOpsJobRunDetail(RELATIONSHIP_RECOMMENDATIONS_JOB_KEY, JOB_LABEL, "FAILED", {
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
