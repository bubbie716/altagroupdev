export function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch && bearerMatch[1].trim() === secret) return true;
  if (authHeader === secret) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret")?.trim() === secret;
}

export function cronResponse(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
}

export async function handleCronRoute(
  request: Request,
  label: string,
  handler: () => Promise<Record<string, unknown>>,
): Promise<Response> {
  if (!validateCronSecret(request)) {
    return cronResponse({ ok: false, message: "Unauthorized." }, 401);
  }

  try {
    const body = await handler();
    return cronResponse({ ok: true, ...body });
  } catch (error) {
    console.error(`[cron] ${label} failed`, error);
    const message = error instanceof Error ? error.message : "Cron execution failed.";
    return cronResponse({ ok: false, message }, 500);
  }
}
