import { prisma } from "@/server/db";

export type OpsJobRunSummary = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: string | null;
  details?: Record<string, unknown>;
};

export async function recordOpsJobSuccess(
  jobKey: string,
  label: string,
  message?: string,
): Promise<void> {
  const now = new Date();
  await prisma.opsJobRun.upsert({
    where: { jobKey },
    create: {
      jobKey,
      label,
      lastSuccessAt: now,
      lastStatus: "SUCCESS",
      lastMessage: message ?? null,
    },
    update: {
      label,
      lastSuccessAt: now,
      lastStatus: "SUCCESS",
      lastMessage: message ?? null,
    },
  });
}

export async function recordOpsJobFailure(
  jobKey: string,
  label: string,
  message: string,
): Promise<void> {
  const now = new Date();
  await prisma.opsJobRun.upsert({
    where: { jobKey },
    create: {
      jobKey,
      label,
      lastFailureAt: now,
      lastStatus: "FAILED",
      lastMessage: message,
    },
    update: {
      label,
      lastFailureAt: now,
      lastStatus: "FAILED",
      lastMessage: message,
    },
  });
}

export async function listOpsJobRuns() {
  return prisma.opsJobRun.findMany({ orderBy: { label: "asc" } });
}

export async function getOpsJobRun(jobKey: string) {
  return prisma.opsJobRun.findUnique({ where: { jobKey } });
}

export async function recordOpsJobRunDetail(
  jobKey: string,
  label: string,
  status: "SUCCESS" | "FAILED",
  summary: OpsJobRunSummary,
): Promise<void> {
  const now = new Date();
  const message = JSON.stringify(summary);
  await prisma.opsJobRun.upsert({
    where: { jobKey },
    create: {
      jobKey,
      label,
      lastStatus: status,
      lastMessage: message,
      lastSuccessAt: status === "SUCCESS" ? now : null,
      lastFailureAt: status === "FAILED" ? now : null,
    },
    update: {
      label,
      lastStatus: status,
      lastMessage: message,
      ...(status === "SUCCESS" ? { lastSuccessAt: now } : { lastFailureAt: now }),
    },
  });
}
