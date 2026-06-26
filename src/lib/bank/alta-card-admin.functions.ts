import { createServerFn } from "@tanstack/react-start";
import type {
  ChangeCardTierAdminInput,
  ChangeCardStatusInput,
  AdminManualFeeInput,
  AdminManualPaymentInput,
  UpdateCardLimitAdminInput,
  UpdateCardRateAdminInput,
} from "@/server/alta-card-admin.service";
import type { CreateAltaCardAdjustmentInput } from "@/lib/bank/alta-card-types";

async function actorId(): Promise<string> {
  const { requireOperator } = await import("@/server/permissions.service");
  const user = await requireOperator();
  return user.id;
}

export const fetchInternalCardOperationsContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { getInternalCardOperationsContext } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return getInternalCardOperationsContext(userId, cardId);
  });

export const changeAltaCardStatusRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ChangeCardStatusInput) => input)
  .handler(async ({ data }) => {
    const { changeAltaCardStatus } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return changeAltaCardStatus(userId, data);
  });

export const updateAltaCardLimitAdminRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateCardLimitAdminInput) => input)
  .handler(async ({ data }) => {
    const { updateAltaCardLimitAdmin } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return updateAltaCardLimitAdmin(userId, data);
  });

export const updateAltaCardRateAdminRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateCardRateAdminInput) => input)
  .handler(async ({ data }) => {
    const { updateAltaCardRateAdmin } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return updateAltaCardRateAdmin(userId, data);
  });

export const changeAltaCardTierAdminRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ChangeCardTierAdminInput) => input)
  .handler(async ({ data }) => {
    const { changeAltaCardTierAdmin } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return changeAltaCardTierAdmin(userId, data);
  });

export const submitAdminManualCardPaymentRecord = createServerFn({ method: "POST" })
  .inputValidator((input: AdminManualPaymentInput) => input)
  .handler(async ({ data }) => {
    const { submitAdminManualCardPayment } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return submitAdminManualCardPayment(userId, data);
  });

export const applyAdminManualFeeRecord = createServerFn({ method: "POST" })
  .inputValidator((input: AdminManualFeeInput) => input)
  .handler(async ({ data }) => {
    const { applyAdminManualFee } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return applyAdminManualFee(userId, data);
  });

export const createAdminAltaCardAdjustmentWithAuditRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateAltaCardAdjustmentInput & { reason: string }) => input)
  .handler(async ({ data }) => {
    const { createAdminAdjustmentWithAudit } = await import("@/server/alta-card-admin.service");
    const userId = await actorId();
    return createAdminAdjustmentWithAudit(userId, data);
  });

export const unfreezeEmployeeCardRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { employeeCardId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { unfreezeEmployeeCard } = await import("@/server/alta-card-admin.service");
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    return unfreezeEmployeeCard(user.id, data.employeeCardId, data.reason);
  });

export const fetchAltaCardRelationshipRecommendation = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string; companyId?: string | null }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { getAltaCardRelationshipRecommendation } = await import(
      "@/server/alta-card-relationship-pricing.service"
    );
    await requireOperator();
    return getAltaCardRelationshipRecommendation(data.userId, data.companyId);
  });
