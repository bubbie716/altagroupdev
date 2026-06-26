import { createServerFn } from "@tanstack/react-start";

export const previewAltaCardStatementInterestRecord = createServerFn({ method: "GET" })
  .inputValidator((statementId: string) => statementId)
  .handler(async ({ data: statementId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { calculateStatementInterest } = await import("@/server/alta-card-interest.service");
    return calculateStatementInterest(statementId);
  });

export const applyAltaCardStatementInterestRecord = createServerFn({ method: "POST" })
  .inputValidator((statementId: string) => statementId)
  .handler(async ({ data: statementId }) => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { applyStatementInterestForAdmin } = await import("@/server/alta-card-interest.service");
    const admin = await requireAdmin();
    return applyStatementInterestForAdmin(admin.id, statementId);
  });

export const applyAltaCardInterestBatchRecord = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("@/server/permissions.service");
  const { applyInterestBatchForAdmin } = await import("@/server/alta-card-interest.service");
  const admin = await requireAdmin();
  return applyInterestBatchForAdmin(admin.id);
});

export const waiveAltaCardFeeRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { feeId: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/server/permissions.service");
    const { waiveAltaCardFee } = await import("@/server/alta-card-fee.service");
    const admin = await requireAdmin();
    return waiveAltaCardFee(admin.id, data.feeId, data.reason);
  });

export const fetchCardFeesRecord = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { listCardFees } = await import("@/server/alta-card-fee.service");
    const user = await requireAuth();
    return listCardFees(user.id, cardId);
  });

export const fetchInternalCardFeesRecord = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { listInternalCardFees } = await import("@/server/alta-card-fee.service");
    return listInternalCardFees(cardId);
  });

export const runAltaCardBillingProcessRecord = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("@/server/permissions.service");
  const { runAltaCardBillingSchedulerJob } = await import("@/server/alta-card-billing-scheduler.service");
  const admin = await requireAdmin();
  return runAltaCardBillingSchedulerJob({ trigger: "manual", actorUserId: admin.id });
});

export const fetchCardBillingSummaryRecord = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCardBillingSummary } = await import("@/server/alta-card-billing.service");
    const user = await requireAuth();
    return getCardBillingSummary(user.id, cardId);
  });
