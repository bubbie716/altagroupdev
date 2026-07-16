import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { runNccSettlementWorkers } from "@/server/ncc/ncc-workers.service";

export const Route = createFileRoute("/api/cron/ncc-settlement")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "ncc-settlement", runNccSettlementWorkers),
      POST: ({ request }) => handleCronRoute(request, "ncc-settlement", runNccSettlementWorkers),
    },
  },
});
