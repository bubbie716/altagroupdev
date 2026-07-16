import { createHash } from "node:crypto";
import type { NccApiEnvironment } from "@prisma/client";
import { prisma } from "@/server/db";

export async function hashIpForLog(request: Request): Promise<string | null> {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`ncc-ip:${ip}`).digest("hex").slice(0, 32);
}

export async function writeNccApiRequestLog(input: {
  requestId: string;
  institutionId: string;
  credentialId?: string | null;
  environment: NccApiEnvironment;
  method: string;
  route: string;
  responseStatus: number;
  errorCode?: string | null;
  latencyMs: number;
  idempotencyKey?: string | null;
  sourceIpHash?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const idempotencyKeyPrefix = input.idempotencyKey
    ? input.idempotencyKey.slice(0, 12)
    : null;
  try {
    await prisma.nccApiRequestLog.create({
      data: {
        requestId: input.requestId,
        institutionId: input.institutionId,
        credentialId: input.credentialId ?? null,
        environment: input.environment,
        method: input.method,
        route: input.route,
        responseStatus: input.responseStatus,
        errorCode: input.errorCode ?? null,
        latencyMs: input.latencyMs,
        idempotencyKeyPrefix,
        sourceIpHash: input.sourceIpHash ?? null,
        userAgent: input.userAgent?.slice(0, 200) ?? null,
      },
    });
  } catch (error) {
    console.error("[ncc-api-log] failed to persist request log", error);
  }
}

export async function listInstitutionApiLogs(
  institutionId: string,
  options?: { limit?: number; cursor?: string },
) {
  const limit = Math.min(options?.limit ?? 50, 100);
  return prisma.nccApiRequestLog.findMany({
    where: {
      institutionId,
      ...(options?.cursor ? { id: { lt: options.cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      requestId: true,
      method: true,
      route: true,
      responseStatus: true,
      errorCode: true,
      latencyMs: true,
      environment: true,
      idempotencyKeyPrefix: true,
      createdAt: true,
      credentialId: true,
    },
  });
}

/** Retention guidance: purge request logs older than 90 days by default. */
export async function pruneNccApiRequestLogs(retentionDays = 90): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000);
  const result = await prisma.nccApiRequestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
