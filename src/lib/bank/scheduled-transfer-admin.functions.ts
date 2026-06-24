import { createServerFn } from "@tanstack/react-start";
import type { ExecuteDueScheduledTransfersResult } from "@/lib/bank/scheduled-transfer-executor";
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
  async (): Promise<ExecuteDueScheduledTransfersResult> => {
    await requireOperator();
    const { runDueInternalScheduledTransfers } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    return runDueInternalScheduledTransfers(user);
  },
);

export const pauseInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .validator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { pauseInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await pauseInternalScheduledTransfer(user, paymentId);
  });

export const resumeInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .validator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { resumeInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await resumeInternalScheduledTransfer(user, paymentId);
  });

export const cancelInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .validator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    await requireOperator();
    const { cancelInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await cancelInternalScheduledTransfer(user, paymentId);
  });

export const runInternalScheduledTransferNowRecord = createServerFn({ method: "POST" })
  .validator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }): Promise<ExecuteDueScheduledTransfersResult> => {
    await requireOperator();
    const { runInternalScheduledTransferNow } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    return runInternalScheduledTransferNow(user, paymentId);
  });
