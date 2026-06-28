import { createServerFn } from "@tanstack/react-start";
import type { ExecuteDueScheduledTransfersResult } from "@/lib/bank/scheduled-transfer-executor";
import type { ExecuteDuePayrollRunsResult } from "@/lib/bank/payroll-executor";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";

async function requireOperator() {
  const { requireInternalRole } = await import("@/server/auth.service");
  return requireInternalRole();
}

export const fetchInternalScheduledTransfers = createServerFn({ method: "GET" }).handler(
  async (): Promise<InternalScheduledTransferRow[]> => {
    await requireOperator();
    const { listInternalScheduledTransfers } = await import("@/server/scheduled-transfer-admin.service");
    return listInternalScheduledTransfers();
  },
);

export const runDueScheduledTransfersManual = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    scheduledTransfers: ExecuteDueScheduledTransfersResult;
    payroll: ExecuteDuePayrollRunsResult;
  }> => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const admin = await requireAdmin();
    const { runDueInternalScheduledTransfers } = await import("@/server/scheduled-transfer-admin.service");
    return runDueInternalScheduledTransfers(admin);
  },
);

export const pauseInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { pauseInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await pauseInternalScheduledTransfer(user, paymentId);
  });

export const resumeInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { resumeInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await resumeInternalScheduledTransfer(user, paymentId);
  });

export const cancelInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { cancelInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await cancelInternalScheduledTransfer(user, paymentId);
  });

export const runInternalScheduledTransferNowRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }): Promise<ExecuteDueScheduledTransfersResult> => {
    await requireOperator();
    const { runInternalScheduledTransferNow } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    return runInternalScheduledTransferNow(user, paymentId);
  });
