import { createServerFn } from "@tanstack/react-start";

export const fetchOpsJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { listOpsJobs } = await import("@/server/ops-jobs.service");
  return listOpsJobs();
});

export const runManualOpsJobRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { jobKey: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { runManualOpsJob } = await import("@/server/ops-jobs.service");
    const admin = await requireAdmin();
    if (!data.reason.trim()) throw new Error("Reason is required");
    return runManualOpsJob(admin.id, data.jobKey, data.reason.trim());
  });
