import { createServerFn } from "@tanstack/react-start";
import type { OpsReviewFlagReasonCode, OpsReviewFlagTargetType } from "@/lib/internal/ops-review-flag.types";
import type { OpsReportFilters } from "@/lib/internal/ops-report.types";

async function actorId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchActiveOpsReviewFlags = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { targetType: OpsReviewFlagTargetType; targetId: string }) => input,
  )
  .handler(async ({ data }) => {
    const { listActiveOpsReviewFlags } = await import("@/server/ops-review-flag.service");
    return listActiveOpsReviewFlags(data.targetType, data.targetId);
  });

export const fetchOpsReviewFlagsForCustomer = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { collectCustomerFlagTargets, listActiveOpsReviewFlagsForTargets } = await import(
      "@/server/ops-review-flag.service"
    );
    const targets = await collectCustomerFlagTargets(userId);
    return listActiveOpsReviewFlagsForTargets(targets);
  });

export const fetchOpsReviewFlagsForCompany = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { collectCompanyFlagTargets, listActiveOpsReviewFlagsForTargets } = await import(
      "@/server/ops-review-flag.service"
    );
    const targets = await collectCompanyFlagTargets(companyId);
    return listActiveOpsReviewFlagsForTargets(targets);
  });

export const createOpsReviewFlagOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      targetType: OpsReviewFlagTargetType;
      targetId: string;
      reason: OpsReviewFlagReasonCode;
      customReason?: string;
      note?: string;
      silentNotification?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { createOpsReviewFlag } = await import("@/server/ops-review-flag.service");
    return createOpsReviewFlag(await actorId(), data);
  });

export const resolveOpsReviewFlagOps = createServerFn({ method: "POST" })
  .inputValidator((input: { flagId: string; reason: string; silentNotification?: boolean }) => input)
  .handler(async ({ data }) => {
    const { resolveOpsReviewFlag } = await import("@/server/ops-review-flag.service");
    return resolveOpsReviewFlag(await actorId(), data.flagId, data.reason, {
      silentNotification: data.silentNotification,
    });
  });

export const setExceptionDispositionOps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      exceptionKey: string;
      status: "RESOLVED" | "ESCALATED" | "DISMISSED";
      reason: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { setExceptionDisposition } = await import("@/server/ops-exception-disposition.service");
    return setExceptionDisposition(await actorId(), data.exceptionKey, data.status, data.reason);
  });

export const fetchOpsReports = createServerFn({ method: "GET" })
  .inputValidator((filters: OpsReportFilters) => filters)
  .handler(async ({ data }) => {
    const { getOpsReports } = await import("@/server/ops-reports.service");
    return getOpsReports(data);
  });

export const exportOpsReportsCsvOps = createServerFn({ method: "GET" })
  .inputValidator((filters: OpsReportFilters) => filters)
  .handler(async ({ data }) => {
    const { exportOpsReportsCsv } = await import("@/server/ops-reports.service");
    return exportOpsReportsCsv(data);
  });

export const fetchUniversalCustomerTimeline = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { buildUniversalCustomerTimeline } = await import("@/server/ops-universal-timeline.service");
    return buildUniversalCustomerTimeline(userId);
  });

export const fetchUniversalCompanyTimeline = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { buildUniversalCompanyTimeline } = await import("@/server/ops-universal-timeline.service");
    return buildUniversalCompanyTimeline(companyId);
  });

export const fetchQueueAgingMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { getQueueAgingMetrics } = await import("@/server/ops-queue-aging.service");
  return getQueueAgingMetrics();
});

export const bulkDenyDepositsOps = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionIds: string[]; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { bulkDenyDeposits } = await import("@/server/ops-bulk.service");
    return bulkDenyDeposits(await actorId(), data.transactionIds, data.reviewNote);
  });

export const bulkDenyWithdrawalsOps = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionIds: string[]; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { bulkDenyWithdrawals } = await import("@/server/ops-bulk.service");
    return bulkDenyWithdrawals(await actorId(), data.transactionIds, data.reviewNote);
  });
