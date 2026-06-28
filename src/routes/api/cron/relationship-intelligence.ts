import { createFileRoute } from "@tanstack/react-router";
import { RELATIONSHIP_INTELLIGENCE_JOB_KEY } from "@/lib/bank/relationship-intelligence-config";
import { handleCronRoute } from "@/lib/cron/cron-http";
import {
  acquireDailyCronLock,
  dailyCronSkippedPayload,
  evaluateDailyCronGate,
  RELATIONSHIP_INTELLIGENCE_CRON_LOCK_KEY,
  releaseDailyCronLock,
} from "@/lib/cron/cron-tick-gating";
import { refreshCompanyRelationshipProfilesScheduled } from "@/server/company-relationship-intelligence-scheduler.service";
import { refreshCompanyRelationshipRecommendationsScheduled } from "@/server/company-relationship-recommendation-scheduler.service";
import { refreshRelationshipProfilesScheduled } from "@/server/relationship-intelligence-scheduler.service";
import { refreshRelationshipRecommendationsScheduled } from "@/server/relationship-intelligence-recommendation-scheduler.service";

async function runRelationshipIntelligenceCron() {
  const gate = await evaluateDailyCronGate({
    completionJobKey: RELATIONSHIP_INTELLIGENCE_JOB_KEY,
    lockKey: RELATIONSHIP_INTELLIGENCE_CRON_LOCK_KEY,
  });
  if (!gate.run) {
    return dailyCronSkippedPayload(gate.reason);
  }

  await acquireDailyCronLock(RELATIONSHIP_INTELLIGENCE_CRON_LOCK_KEY);

  try {
    const [personalProfiles, personalRecommendations, companyProfiles, companyRecommendations] =
      await Promise.all([
        refreshRelationshipProfilesScheduled().catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
        refreshRelationshipRecommendationsScheduled().catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
        refreshCompanyRelationshipProfilesScheduled().catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
        refreshCompanyRelationshipRecommendationsScheduled().catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
      ]);

    return {
      skipped: false,
      personalProfiles,
      personalRecommendations,
      companyProfiles,
      companyRecommendations,
    };
  } finally {
    await releaseDailyCronLock(RELATIONSHIP_INTELLIGENCE_CRON_LOCK_KEY);
  }
}

export const Route = createFileRoute("/api/cron/relationship-intelligence")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleCronRoute(request, "relationship-intelligence", runRelationshipIntelligenceCron),
      POST: ({ request }) =>
        handleCronRoute(request, "relationship-intelligence", runRelationshipIntelligenceCron),
    },
  },
});
