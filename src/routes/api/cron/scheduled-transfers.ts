import { createFileRoute } from "@tanstack/react-router";
import { executeDueScheduledTransfers } from "@/server/scheduled-transfer-executor.service";

function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}` || authHeader === secret) {
    return true;
  }

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runExecutor() {
  const summary = await executeDueScheduledTransfers();
  return Response.json({ ok: true, ...summary });
}

export const Route = createFileRoute("/api/cron/scheduled-transfers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
        }

        try {
          return await runExecutor();
        } catch {
          return Response.json({ ok: false, message: "Scheduled transfer execution failed." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
        }

        try {
          return await runExecutor();
        } catch {
          return Response.json({ ok: false, message: "Scheduled transfer execution failed." }, { status: 500 });
        }
      },
    },
  },
});
