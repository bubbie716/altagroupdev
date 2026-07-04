import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { runOperationalControlsJob } from "@/server/operational-controls-job.service";

export const Route = createFileRoute("/api/cron/operational-controls")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "operational-controls", runOperationalControlsJob),
      POST: ({ request }) => handleCronRoute(request, "operational-controls", runOperationalControlsJob),
    },
  },
});
