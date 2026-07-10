type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(config.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(config.key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= config.limit) {
    return { allowed: false, retryAfterMs: Math.max(0, existing.resetAt - now) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return Response.json(
    { ok: false, message: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}

export function clientRateLimitKey(request: Request, label: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${label}:${ip}`;
}

export async function enforceRateLimit(
  request: Request,
  label: string,
  limit: number,
  windowMs: number,
): Promise<Response | null> {
  const result = checkRateLimit({
    key: clientRateLimitKey(request, label),
    limit,
    windowMs,
  });
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterMs);
  }
  return null;
}

export function assertUserRateLimit(
  userId: string,
  label: string,
  limit: number,
  windowMs: number,
): void {
  const result = checkRateLimit({
    key: `${label}:user:${userId}`,
    limit,
    windowMs,
  });
  if (!result.allowed) {
    throw new Error("RATE_LIMITED");
  }
}
