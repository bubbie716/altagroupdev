import { prisma } from "@/server/db";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";

export type NccRateLimitClass =
  | "read"
  | "settlement_submit"
  | "settlement_cancel"
  | "settlement_reverse"
  | "credential_manage"
  | "webhook_manage"
  | "webhook_test";

const LIMITS: Record<NccRateLimitClass, { limit: number; windowMs: number }> = {
  read: { limit: 120, windowMs: 60_000 },
  settlement_submit: { limit: 30, windowMs: 60_000 },
  settlement_cancel: { limit: 20, windowMs: 60_000 },
  settlement_reverse: { limit: 10, windowMs: 60_000 },
  credential_manage: { limit: 20, windowMs: 60_000 },
  webhook_manage: { limit: 20, windowMs: 60_000 },
  webhook_test: { limit: 10, windowMs: 60_000 },
};

function floorWindow(now: Date, windowMs: number): Date {
  const ms = now.getTime() - (now.getTime() % windowMs);
  return new Date(ms);
}

/**
 * Durable DB-backed rate limit suitable for multi-instance serverless.
 * Dimensions: credential + institution + route class (+ optional IP hash).
 */
export async function enforceNccApiRateLimit(input: {
  className: NccRateLimitClass;
  credentialId: string;
  institutionId: string;
  ipHash?: string | null;
}): Promise<{ retryAfterMs: number }> {
  const cfg = LIMITS[input.className];
  const now = new Date();
  const windowStart = floorWindow(now, cfg.windowMs);

  const keys = [
    `cred:${input.credentialId}:${input.className}`,
    `inst:${input.institutionId}:${input.className}`,
  ];
  if (input.ipHash) keys.push(`ip:${input.ipHash}:${input.className}`);

  for (const bucketKey of keys) {
    const row = await prisma.nccApiRateLimitBucket.upsert({
      where: { bucketKey_windowStart: { bucketKey, windowStart } },
      create: {
        bucketKey,
        windowStart,
        count: 1,
        institutionId: input.institutionId,
      },
      update: { count: { increment: 1 } },
    });
    if (row.count > cfg.limit) {
      const retryAfterMs = Math.max(1, windowStart.getTime() + cfg.windowMs - now.getTime());
      throw new NccApiError("RATE_LIMITED", "Rate limit exceeded. Retry after the indicated delay.", 429, {
        retryAfterMs,
      });
    }
  }
  return { retryAfterMs: 0 };
}

export function rateLimitHeaders(retryAfterMs: number): HeadersInit {
  return {
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
  };
}

export async function pruneNccRateLimitBuckets(olderThanMs = 24 * 60 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.nccApiRateLimitBucket.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}
