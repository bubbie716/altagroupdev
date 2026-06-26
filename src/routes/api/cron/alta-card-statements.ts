import { createFileRoute } from "@tanstack/react-router";
import { generateStatementsForEligibleCards } from "@/server/alta-card-statement.service";

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

export const Route = createFileRoute("/api/cron/alta-card-statements")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await generateStatementsForEligibleCards();
          return cronResponse({ ok: true, ...result });
        } catch {
          return cronResponse({ ok: false, message: "Alta Card statement generation failed." }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const result = await generateStatementsForEligibleCards();
          return cronResponse({ ok: true, ...result });
        } catch {
          return cronResponse({ ok: false, message: "Alta Card statement generation failed." }, 500);
        }
      },
    },
  },
});
