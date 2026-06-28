import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { executeDuePayrollRuns } from "@/server/payroll-executor.service";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";

async function runExecutor() {
  const [scheduledTransfers, payroll] = await Promise.all([
    executeDueScheduledTransfers(),
    executeDuePayrollRuns(),
  ]);
  return { scheduledTransfers, payroll };
}

export const Route = createFileRoute("/api/cron/scheduled-transfers")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "scheduled-transfers", runExecutor),
      POST: ({ request }) => handleCronRoute(request, "scheduled-transfers", runExecutor),
    },
  },
});
