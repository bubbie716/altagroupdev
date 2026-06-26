import { createServerFn } from "@tanstack/react-start";
import type {
  AltaCardBillingSchedulerResult,
  AltaCardSchedulerJobRunRow,
  AltaCardStatementSchedulerResult,
} from "@/lib/bank/alta-card-scheduler-types";

export const fetchAltaCardSchedulerJobRuns = createServerFn({ method: "GET" }).handler(
  async (): Promise<AltaCardSchedulerJobRunRow[]> => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { listAltaCardSchedulerJobRuns } = await import(
      "@/server/alta-card-billing-scheduler.service"
    );
    return listAltaCardSchedulerJobRuns();
  },
);

export const runAltaCardStatementSchedulerManual = createServerFn({ method: "POST" }).handler(
  async (): Promise<AltaCardStatementSchedulerResult> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { runAltaCardStatementSchedulerJob } = await import(
      "@/server/alta-card-billing-scheduler.service"
    );
    const admin = await requireAdmin();
    return runAltaCardStatementSchedulerJob({
      trigger: "manual",
      force: true,
      actorUserId: admin.id,
    });
  },
);

export const runAltaCardBillingSchedulerManual = createServerFn({ method: "POST" }).handler(
  async (): Promise<AltaCardBillingSchedulerResult> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { runAltaCardBillingSchedulerJob } = await import(
      "@/server/alta-card-billing-scheduler.service"
    );
    const admin = await requireAdmin();
    return runAltaCardBillingSchedulerJob({
      trigger: "manual",
      actorUserId: admin.id,
    });
  },
);
