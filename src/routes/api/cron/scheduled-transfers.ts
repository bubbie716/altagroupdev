import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { runScheduledTransfersJob } from "@/server/scheduled-transfers-job.service";

async function runExecutor() {
  const result = await runScheduledTransfersJob();
  return {
    ok: result.ok,
    scheduledTransfers: result.scheduledTransfers,
    payroll: result.payroll,
    errors: result.errors,
  };
}

export const Route = createFileRoute("/api/cron/scheduled-transfers")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "scheduled-transfers", runExecutor),
      POST: ({ request }) => handleCronRoute(request, "scheduled-transfers", runExecutor),
    },
  },
});
