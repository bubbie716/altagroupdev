import { createFileRoute } from "@tanstack/react-router";
import { processAltaCardBilling } from "@/server/alta-card-billing.service";

function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch && bearerMatch[1].trim() === secret) return true;
  if (authHeader === secret) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret")?.trim() === secret;
}

function cronResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
}

// TODO: Register in production cron scheduler when ready.
export const Route = createFileRoute("/api/cron/alta-card-billing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await processAltaCardBilling();
          return cronResponse({ ok: true, ...result });
        } catch {
          return cronResponse({ ok: false, message: "Alta Card billing process failed." }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await processAltaCardBilling();
          return cronResponse({ ok: true, ...result });
        } catch {
          return cronResponse({ ok: false, message: "Alta Card billing process failed." }, 500);
        }
      },
    },
  },
});
