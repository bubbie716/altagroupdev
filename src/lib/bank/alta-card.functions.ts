import { createServerFn } from "@tanstack/react-start";
import type {
  ApproveAltaCardApplicationInput,
  ChangeAltaCardTierInput,
  CreateBusinessAltaCardApplicationInput,
  CreateEmployeeCardInput,
  CreatePersonalAltaCardApplicationInput,
  DenyAltaCardApplicationInput,
  InternalAltaCardFilters,
  UpdateAltaCardLimitInput,
  UpdateAltaCardRateInput,
  UpdateEmployeeCardLimitInput,
} from "@/lib/bank/alta-card-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

export const fetchUserAltaCard = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserAltaCard } = await import("@/server/alta-card.service");
  const userId = await actorId();
  return getUserAltaCard(userId);
});

export const fetchAltaCardDetail = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { getAltaCardDetail } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return getAltaCardDetail(userId, cardId);
  });

export const fetchCompanyAltaCards = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getCompanyAltaCards } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return getCompanyAltaCards(userId, companyId);
  });

export const fetchAltaCardApplyContext = createServerFn({ method: "GET" }).handler(async () => {
  const { getAltaCardApplyContext } = await import("@/server/alta-card.service");
  const userId = await actorId();
  return getAltaCardApplyContext(userId);
});

export const fetchUserBusinessAltaCardCompanies = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserBusinessAltaCardCompanies } = await import("@/server/alta-card.service");
  const userId = await actorId();
  return listUserBusinessAltaCardCompanies(userId);
});

export const fetchBusinessAltaCardHub = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserBusinessAltaCardCompanies, listUserEmployeeAltaCards } = await import(
    "@/server/alta-card.service"
  );
  const userId = await actorId();
  const [companies, employeeCards] = await Promise.all([
    listUserBusinessAltaCardCompanies(userId),
    listUserEmployeeAltaCards(userId),
  ]);
  return { companies, employeeCards };
});

export const fetchUserEmployeeAltaCardDetail = createServerFn({ method: "GET" })
  .inputValidator((employeeCardId: string) => employeeCardId)
  .handler(async ({ data: employeeCardId }) => {
    const { getUserEmployeeAltaCardDetail } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return getUserEmployeeAltaCardDetail(userId, employeeCardId);
  });

export const submitPersonalAltaCardApplication = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePersonalAltaCardApplicationInput) => input)
  .handler(async ({ data }) => {
    const { createPersonalAltaCardApplication } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return createPersonalAltaCardApplication(userId, data);
  });

export const submitBusinessAltaCardApplication = createServerFn({ method: "POST" })
  .inputValidator((input: CreateBusinessAltaCardApplicationInput) => input)
  .handler(async ({ data }) => {
    const { createBusinessAltaCardApplication } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return createBusinessAltaCardApplication(userId, data);
  });

export const activateAltaCardRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { activateAltaCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return activateAltaCard(userId, cardId);
  });

export const freezeAltaCardRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { freezeAltaCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return freezeAltaCard(userId, cardId);
  });

export const unfreezeAltaCardRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { unfreezeAltaCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return unfreezeAltaCard(userId, cardId);
  });

export const closeAltaCardRecord = createServerFn({ method: "POST" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { closeAltaCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return closeAltaCard(userId, cardId);
  });

export const createEmployeeCardRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateEmployeeCardInput) => input)
  .handler(async ({ data }) => {
    const { createEmployeeCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return createEmployeeCard(userId, data);
  });

export const updateEmployeeCardLimitRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateEmployeeCardLimitInput) => input)
  .handler(async ({ data }) => {
    const { updateEmployeeCardLimit } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return updateEmployeeCardLimit(userId, data);
  });

export const freezeEmployeeCardRecord = createServerFn({ method: "POST" })
  .inputValidator((employeeCardId: string) => employeeCardId)
  .handler(async ({ data: employeeCardId }) => {
    const { freezeEmployeeCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return freezeEmployeeCard(userId, employeeCardId);
  });

export const closeEmployeeCardRecord = createServerFn({ method: "POST" })
  .inputValidator((employeeCardId: string) => employeeCardId)
  .handler(async ({ data: employeeCardId }) => {
    const { closeEmployeeCard } = await import("@/server/alta-card.service");
    const userId = await actorId();
    return closeEmployeeCard(userId, employeeCardId);
  });

export const fetchInternalAltaCardOps = createServerFn({ method: "GET" })
  .inputValidator((filters: InternalAltaCardFilters) => filters)
  .handler(async ({ data: filters }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { listInternalAltaCards, listInternalAltaCardApplications } = await import(
      "@/server/alta-card.service"
    );
    await requireOperator();
    const [cards, applications] = await Promise.all([
      listInternalAltaCards(filters),
      listInternalAltaCardApplications(),
    ]);
    return { cards, applications };
  });

export const fetchInternalAltaCardApplications = createServerFn({ method: "GET" })
  .handler(async () => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { listInternalAltaCardApplications } = await import("@/server/alta-card.service");
    await requireOperator();
    return listInternalAltaCardApplications();
  });

export const approveAltaCardApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ApproveAltaCardApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveAltaCardApplication } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return approveAltaCardApplication(admin.id, data);
  });

export const denyAltaCardApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: DenyAltaCardApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyAltaCardApplication } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return denyAltaCardApplication(admin.id, data);
  });

export const updateAltaCardLimitRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateAltaCardLimitInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { updateAltaCardLimit } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return updateAltaCardLimit(admin.id, data);
  });

export const updateAltaCardRateRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateAltaCardRateInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { updateAltaCardRate } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return updateAltaCardRate(admin.id, data);
  });

export const changeAltaCardTierRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ChangeAltaCardTierInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { changeAltaCardTier } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return changeAltaCardTier(admin.id, data);
  });

export const fetchInternalAltaCardDetail = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { getAltaCardDetail } = await import("@/server/alta-card.service");
    const admin = await requireOperator();
    return getAltaCardDetail(admin.id, cardId);
  });

export const fetchAltaCardTransactions = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getAltaCardDetail } = await import("@/server/alta-card.service");
    const user = await requireAuth();
    const detail = await getAltaCardDetail(user.id, cardId);
    return detail.recentTransactions;
  });

export const fetchCashAdvanceContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCashAdvanceContext } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return getCashAdvanceContext(user.id, cardId);
  });

export const fetchEmployeeCashAdvanceContext = createServerFn({ method: "GET" })
  .inputValidator((employeeCardId: string) => employeeCardId)
  .handler(async ({ data: employeeCardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getEmployeeCashAdvanceContext } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return getEmployeeCashAdvanceContext(user.id, employeeCardId);
  });

export const fetchCardPaymentContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCardPaymentContext } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return getCardPaymentContext(user.id, cardId);
  });

export const submitCashAdvanceRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/alta-card-types").SubmitCashAdvanceInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { submitCashAdvance } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return submitCashAdvance(user.id, data);
  });

export const submitEmployeeCashAdvanceRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/alta-card-types").SubmitEmployeeCashAdvanceInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { submitEmployeeCashAdvance } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return submitEmployeeCashAdvance(user.id, data);
  });

export const submitCardPaymentRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/alta-card-types").SubmitCardPaymentInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { submitCardPayment } = await import("@/server/alta-card-transaction.service");
    const user = await requireAuth();
    return submitCardPayment(user.id, data);
  });

export const createAdminAltaCardAdjustmentRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/alta-card-types").CreateAltaCardAdjustmentInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { createAdminAltaCardAdjustment } = await import("@/server/alta-card-transaction.service");
    const admin = await requireOperator();
    return createAdminAltaCardAdjustment(admin.id, data);
  });

export const reverseAltaCardTransactionRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { reverseAltaCardTransaction } = await import("@/server/alta-card-transaction.service");
    const admin = await requireOperator();
    return reverseAltaCardTransaction(admin.id, data.transactionId, data.reason);
  });

export const fetchEmployeeCardTransactions = createServerFn({ method: "GET" })
  .inputValidator((employeeCardId: string) => employeeCardId)
  .handler(async ({ data: employeeCardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { listEmployeeCardTransactions } = await import("@/server/alta-card-transaction.service");
    const { prisma } = await import("@/server/db");
    const user = await requireAuth();
    const emp = await prisma.altaEmployeeCard.findUnique({
      where: { id: employeeCardId },
      include: { parentBusinessCard: true },
    });
    if (!emp) throw new Error("NOT_FOUND");
    const { canManageBusinessTreasury } = await import("@/lib/auth/permissions");
    const { mapDbUserToAltaUser, userWithMembershipsInclude } = await import("@/server/user-mapper");
    const record = await prisma.user.findUnique({ where: { id: user.id }, include: userWithMembershipsInclude });
    if (!record) throw new Error("NOT_FOUND");
    const altaUser = mapDbUserToAltaUser(record);
    const allowed =
      emp.authorizedUserId === user.id ||
      canManageBusinessTreasury(altaUser, { companyId: emp.companyId });
    if (!allowed) throw new Error("FORBIDDEN");
    return listEmployeeCardTransactions(employeeCardId);
  });
