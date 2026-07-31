import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { runCryptoReconciliation } from "@/lib/terminal/crypto/crypto-reconciliation.service";

async function runExecutor() {
  const result = await runCryptoReconciliation({ source: "cron" });
  return {
    ok: result.status !== "FAILED",
    reconciliation: result,
  };
}

export const Route = createFileRoute("/api/cron/terminal-crypto-reconciliation")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleCronRoute(request, "terminal-crypto-reconciliation", runExecutor),
      POST: ({ request }) =>
        handleCronRoute(request, "terminal-crypto-reconciliation", runExecutor),
    },
  },
});
