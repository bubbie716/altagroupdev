import { createServerFn } from "@tanstack/react-start";
import type { ExecuteDueScheduledTransfersResult } from "@/lib/bank/scheduled-transfer-executor";
import type { ExecuteDuePayrollRunsResult } from "@/lib/bank/payroll-executor";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import type { InternalScheduledTransferDetail } from "@/lib/bank/ui-lab-money-ops-fixtures";

async function requireOperator() {
  const { requireInternalRole } = await import("@/server/auth.service");
  return requireInternalRole();
}

export const fetchInternalScheduledTransfers = createServerFn({ method: "GET" }).handler(
  async (): Promise<InternalScheduledTransferRow[]> => {
    await requireOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalScheduledTransfers } = await import(
        "@/lib/bank/ui-lab-money-ops-fixtures"
      );
      return getUiLabInternalScheduledTransfers();
    }
    const { listInternalScheduledTransfers } = await import("@/server/scheduled-transfer-admin.service");
    return listInternalScheduledTransfers();
  },
);

export const fetchInternalScheduledTransferDetail = createServerFn({ method: "GET" })
  .inputValidator((transferId: string) => transferId)
  .handler(async ({ data: transferId }): Promise<InternalScheduledTransferDetail> => {
    await requireOperator();
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabInternalScheduledTransferDetail } = await import(
        "@/lib/bank/ui-lab-money-ops-fixtures"
      );
      const detail = getUiLabInternalScheduledTransferDetail(transferId);
      if (!detail) throw new Error("NOT_FOUND");
      return detail;
    }
    const { getInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    return getInternalScheduledTransfer(transferId);
  });

export const runDueScheduledTransfersManual = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    scheduledTransfers: ExecuteDueScheduledTransfersResult;
    payroll: ExecuteDuePayrollRunsResult;
  }> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Transfer execution is disabled in UI Lab.");
    }
    const { requireAdmin } = await import("@/server/permissions.service");
    const admin = await requireAdmin();
    const { runDueInternalScheduledTransfers } = await import("@/server/scheduled-transfer-admin.service");
    return runDueInternalScheduledTransfers(admin);
  },
);

export const pauseInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Transfer mutations are disabled in UI Lab.");
    }
    await requireOperator();
    const { pauseInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await pauseInternalScheduledTransfer(user, paymentId);
  });

export const resumeInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Transfer mutations are disabled in UI Lab.");
    }
    await requireOperator();
    const { resumeInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await resumeInternalScheduledTransfer(user, paymentId);
  });

export const cancelInternalScheduledTransferRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Transfer mutations are disabled in UI Lab.");
    }
    await requireOperator();
    const { cancelInternalScheduledTransfer } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    await cancelInternalScheduledTransfer(user, paymentId);
  });

export const runInternalScheduledTransferNowRecord = createServerFn({ method: "POST" })
  .inputValidator((paymentId: string) => paymentId)
  .handler(async ({ data: paymentId }): Promise<ExecuteDueScheduledTransfersResult> => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      throw new Error("BAD_REQUEST:Transfer execution is disabled in UI Lab.");
    }
    await requireOperator();
    const { runInternalScheduledTransferNow } = await import("@/server/scheduled-transfer-admin.service");
    const user = await requireOperator();
    return runInternalScheduledTransferNow(user, paymentId);
  });
