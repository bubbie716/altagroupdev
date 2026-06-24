import { createFileRoute } from "@tanstack/react-router";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";

function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization")?.trim();
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch && bearerMatch[1].trim() === secret) {
    return true;
  }
  if (authHeader === secret) {
    return true;
  }

  const url = new URL(request.url);
  return url.searchParams.get("secret")?.trim() === secret;
}

function cronResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

async function runExecutor() {
  const summary = await executeDueScheduledTransfers();
  // #region agent log
  fetch("http://127.0.0.1:7829/ingest/627124d8-5442-41f8-8b52-a7f340773672", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b92618" },
    body: JSON.stringify({
      sessionId: "b92618",
      location: "scheduled-transfers.ts:runExecutor",
      message: "Cron executor response",
      data: summary,
      hypothesisId: "J",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return cronResponse({ ok: true, ...summary });
}

export const Route = createFileRoute("/api/cron/scheduled-transfers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }

        try {
          return await runExecutor();
        } catch {
          return cronResponse({ ok: false, message: "Scheduled transfer execution failed." }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }

        try {
          return await runExecutor();
        } catch {
          return cronResponse({ ok: false, message: "Scheduled transfer execution failed." }, 500);
        }
      },
    },
  },
});
