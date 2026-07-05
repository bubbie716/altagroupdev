import { createServerFn } from "@tanstack/react-start";
import type {
  CreateAltaPayScheduleInput,
  CreateMerchantAutopayApprovalInput,
  CreateRecurringInvoiceScheduleInput,
  UpdateMerchantAutopayApprovalInput,
} from "@/lib/bank/payments-engine-types";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

function rethrow(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith("BAD_REQUEST:")) throw new Error(error.message.slice("BAD_REQUEST:".length));
    if (error.message === "FORBIDDEN") throw new Error("You don't have permission to do that.");
    if (error.message === "NOT_FOUND") throw new Error("Not found.");
  }
  throw error;
}

export const fetchAltaPaySchedules = createServerFn({ method: "GET" }).handler(async () => {
  const { listAltaPaySchedules } = await import("@/server/alta-pay-schedule.service");
  try {
    return await listAltaPaySchedules(await actor());
  } catch (error) {
    rethrow(error);
  }
});

export const createAltaPayScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateAltaPayScheduleInput) => input)
  .handler(async ({ data }) => {
    const { createAltaPaySchedule } = await import("@/server/alta-pay-schedule.service");
    try {
      return await createAltaPaySchedule(await actor(), data);
    } catch (error) {
      rethrow(error);
    }
  });

export const pauseAltaPayScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((scheduleId: string) => scheduleId)
  .handler(async ({ data: scheduleId }) => {
    const { pauseAltaPaySchedule } = await import("@/server/alta-pay-schedule.service");
    try {
      return await pauseAltaPaySchedule(await actor(), scheduleId);
    } catch (error) {
      rethrow(error);
    }
  });

export const resumeAltaPayScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((scheduleId: string) => scheduleId)
  .handler(async ({ data: scheduleId }) => {
    const { resumeAltaPaySchedule } = await import("@/server/alta-pay-schedule.service");
    try {
      return await resumeAltaPaySchedule(await actor(), scheduleId);
    } catch (error) {
      rethrow(error);
    }
  });

export const cancelAltaPayScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((scheduleId: string) => scheduleId)
  .handler(async ({ data: scheduleId }) => {
    const { cancelAltaPaySchedule } = await import("@/server/alta-pay-schedule.service");
    try {
      return await cancelAltaPaySchedule(await actor(), scheduleId);
    } catch (error) {
      rethrow(error);
    }
  });

export const fetchMerchantAutopayApprovals = createServerFn({ method: "GET" }).handler(async () => {
  const { listMerchantAutopayApprovals } = await import("@/server/merchant-autopay.service");
  try {
    return await listMerchantAutopayApprovals(await actor());
  } catch (error) {
    rethrow(error);
  }
});

export const createMerchantAutopayApprovalFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateMerchantAutopayApprovalInput) => input)
  .handler(async ({ data }) => {
    const { createMerchantAutopayApproval } = await import("@/server/merchant-autopay.service");
    try {
      return await createMerchantAutopayApproval(await actor(), data);
    } catch (error) {
      rethrow(error);
    }
  });

export const updateMerchantAutopayApprovalFn = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateMerchantAutopayApprovalInput) => input)
  .handler(async ({ data }) => {
    const { updateMerchantAutopayApproval } = await import("@/server/merchant-autopay.service");
    try {
      return await updateMerchantAutopayApproval(await actor(), data);
    } catch (error) {
      rethrow(error);
    }
  });

export const pauseMerchantAutopayApprovalFn = createServerFn({ method: "POST" })
  .inputValidator((approvalId: string) => approvalId)
  .handler(async ({ data: approvalId }) => {
    const { pauseMerchantAutopayApproval } = await import("@/server/merchant-autopay.service");
    try {
      return await pauseMerchantAutopayApproval(await actor(), approvalId);
    } catch (error) {
      rethrow(error);
    }
  });

export const cancelMerchantAutopayApprovalFn = createServerFn({ method: "POST" })
  .inputValidator((approvalId: string) => approvalId)
  .handler(async ({ data: approvalId }) => {
    const { cancelMerchantAutopayApproval } = await import("@/server/merchant-autopay.service");
    try {
      return await cancelMerchantAutopayApproval(await actor(), approvalId);
    } catch (error) {
      rethrow(error);
    }
  });

export const fetchRecurringInvoiceSchedules = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { listRecurringInvoiceSchedules } = await import("@/server/merchant-recurring-invoice.service");
    try {
      return await listRecurringInvoiceSchedules(await actor(), companyId);
    } catch (error) {
      rethrow(error);
    }
  });

export const createRecurringInvoiceScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateRecurringInvoiceScheduleInput) => input)
  .handler(async ({ data }) => {
    const { createRecurringInvoiceSchedule } = await import("@/server/merchant-recurring-invoice.service");
    try {
      return await createRecurringInvoiceSchedule(await actor(), data);
    } catch (error) {
      rethrow(error);
    }
  });

export const deactivateRecurringInvoiceScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; scheduleId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelRecurringInvoiceSchedule } = await import("@/server/merchant-recurring-invoice.service");
    try {
      return await cancelRecurringInvoiceSchedule(await actor(), data.companyId, data.scheduleId);
    } catch (error) {
      rethrow(error);
    }
  });

export const fetchRecurringInvoiceAnalytics = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getRecurringInvoiceAnalytics } = await import("@/server/merchant-recurring-invoice.service");
    const { canManageMerchantInvoices } = await import("@/lib/auth/permissions");
    const user = await actor();
    if (!canManageMerchantInvoices(user, { companyId })) throw new Error("FORBIDDEN");
    return getRecurringInvoiceAnalytics(companyId);
  });

export const fetchPaymentsEnginePlatformSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const { getPaymentsEnginePlatformSettings } = await import(
    "@/server/payments-engine-platform-settings.service"
  );
  return getPaymentsEnginePlatformSettings();
});
