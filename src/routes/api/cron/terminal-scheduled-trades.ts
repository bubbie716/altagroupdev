import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { runTerminalScheduledTradesJob } from "@/server/terminal-scheduled-trades-job.service";

async function runExecutor() {
  const result = await runTerminalScheduledTradesJob();
  return {
    ok: result.ok,
    scheduledTrades: result.result,
    error: result.error ?? null,
  };
}

export const Route = createFileRoute("/api/cron/terminal-scheduled-trades")({
  server: {
    handlers: {
      GET: ({ request }) => handleCronRoute(request, "terminal-scheduled-trades", runExecutor),
      POST: ({ request }) => handleCronRoute(request, "terminal-scheduled-trades", runExecutor),
    },
  },
});
