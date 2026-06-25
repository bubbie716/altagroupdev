import { prisma } from "@/server/db";

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
