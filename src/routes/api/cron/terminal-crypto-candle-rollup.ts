import { createFileRoute } from "@tanstack/react-router";
import { handleCronRoute } from "@/lib/cron/cron-http";
import { rollupCryptoCandles } from "@/lib/terminal/crypto/crypto-candle-rollup.service";

async function runExecutor() {
  const result = await rollupCryptoCandles();
  return {
    ok: result.ok,
    candleRollup: result,
  };
}

export const Route = createFileRoute("/api/cron/terminal-crypto-candle-rollup")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleCronRoute(request, "terminal-crypto-candle-rollup", runExecutor),
      POST: ({ request }) =>
        handleCronRoute(request, "terminal-crypto-candle-rollup", runExecutor),
    },
  },
});
