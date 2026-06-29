import { createServerFn } from "@tanstack/react-start";
import type {
  AdminAdjustLoanInput,
  ApproveLoanApplicationInput,
  CreateLoanApplicationInput,
  DenyLoanApplicationInput,
  LendingDeskStats,
  MakeLoanPaymentInput,
} from "@/lib/bank/lending-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

const emptyLendingDeskStats: LendingDeskStats = {
  officersOnDesk: 0,
  avgResponseHours: null,
  activeFacilities: 0,
  pendingReview: 0,
};

export const fetchLendingDeskStats = createServerFn({ method: "GET" }).handler(async () => {
  const { isDatabaseConfigured } = await import("@/server/db");
  if (!isDatabaseConfigured()) return emptyLendingDeskStats;

  try {
    const { getLendingDeskStats } = await import("@/server/lending.service");
    return getLendingDeskStats();
  } catch {
    return emptyLendingDeskStats;
  }
});

export const fetchLendingFormContext = createServerFn({ method: "GET" }).handler(async () => {
  const { getLendingFormContext } = await import("@/server/lending.service");
  const userId = await actorId();
  return getLendingFormContext(userId);
});

export const submitLoanApplication = createServerFn({ method: "POST" })
  .inputValidator((input: CreateLoanApplicationInput) => input)
  .handler(async ({ data }) => {
    const { createLoanApplication } = await import("@/server/lending.service");
    const userId = await actorId();
    return createLoanApplication(userId, data);
  });

export const fetchUserLoanApplications = createServerFn({ method: "GET" }).handler(async () => {
  const { listUserLoanApplications } = await import("@/server/lending.service");
  const userId = await actorId();
  return listUserLoanApplications(userId);
});

export const fetchUserLoans = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserLoans } = await import("@/server/loan.service");
  const userId = await actorId();
  return getUserLoans(userId);
});

export const fetchLoanPaymentContext = createServerFn({ method: "GET" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { getLoanPaymentContext } = await import("@/server/loan.service");
    const userId = await actorId();
    return getLoanPaymentContext(userId, loanId);
  });

export const submitLoanPayment = createServerFn({ method: "POST" })
  .inputValidator((input: MakeLoanPaymentInput) => input)
  .handler(async ({ data }) => {
    const { makeLoanPayment } = await import("@/server/loan.service");
    const userId = await actorId();
    await makeLoanPayment(userId, data);
    return { ok: true as const };
  });

export const setLoanAutoPayRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/lending-types").SetLoanAutoPayInput) => input)
  .handler(async ({ data }) => {
    const { setLoanAutoPay } = await import("@/server/loan.service");
    const userId = await actorId();
    await setLoanAutoPay(userId, data);
    return { ok: true as const };
  });

export const executeDueLoanAutoPaymentsRecord = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { executeDueLoanAutoPayments } = await import("@/server/loan.service");
  await requireOperator();
  return executeDueLoanAutoPayments();
});

export const fetchInternalLendingOps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { listInternalLoanApplications } = await import("@/server/lending.service");
  const { listInternalLoansByStatus } = await import("@/server/loan.service");
  await requireOperator();
  const [applications, activeLoans, paidOffLoans, frozenLoans] = await Promise.all([
    listInternalLoanApplications(),
    listInternalLoansByStatus(["ACTIVE"]),
    listInternalLoansByStatus(["PAID_OFF"]),
    listInternalLoansByStatus(["FROZEN"]),
  ]);
  return { applications, activeLoans, paidOffLoans, frozenLoans };
});

export const fetchInternalLoanApplicationDetail = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { getInternalLoanApplicationById } = await import("@/server/lending.service");
    await requireOperator();
    const application = await getInternalLoanApplicationById(applicationId);
    if (!application) throw new Error("NOT_FOUND");
    return application;
  });

export const markLoanApplicationUnderReviewRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { applicationId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { markLoanApplicationUnderReview } = await import("@/server/lending.service");
    const admin = await requireOperator();
    await markLoanApplicationUnderReview(admin.id, data.applicationId, data.reviewNote);
    return { ok: true as const };
  });

export const approveLoanApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: ApproveLoanApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveLoanApplication } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await approveLoanApplication(admin.id, data);
    return { ok: true as const };
  });

export const denyLoanApplicationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: DenyLoanApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyLoanApplication } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await denyLoanApplication(admin.id, data);
    return { ok: true as const };
  });

export const accrueLoanInterestRecord = createServerFn({ method: "POST" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { accrueInterestForLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    return accrueInterestForLoan(loanId, admin.id, true);
  });

export const accrueDueLoanInterestRecord = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { accrueInterestForDueLoans } = await import("@/server/loan.service");
  const admin = await requireOperator();
  return accrueInterestForDueLoans(admin.id);
});

export const backfillLegacyLoanInterestRecord = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { backfillLegacyLoanInterest } = await import("@/server/loan.service");
  const admin = await requireOperator();
  return backfillLegacyLoanInterest(admin.id);
});

export const freezeLoanRecord = createServerFn({ method: "POST" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { freezeLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await freezeLoan(admin.id, loanId);
    return { ok: true as const };
  });

export const unfreezeLoanRecord = createServerFn({ method: "POST" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { unfreezeLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await unfreezeLoan(admin.id, loanId);
    return { ok: true as const };
  });

export const waivePendingLoanInterestRecord = createServerFn({ method: "POST" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { waivePendingInterestForLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    const waived = await waivePendingInterestForLoan(admin.id, loanId);
    return { waived };
  });

export const markLoanPaidOffRecord = createServerFn({ method: "POST" })
  .inputValidator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { markLoanPaidOff } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await markLoanPaidOff(admin.id, loanId);
    return { ok: true as const };
  });

export const adminAdjustLoanRecord = createServerFn({ method: "POST" })
  .inputValidator((input: AdminAdjustLoanInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { adminAdjustLoanBalance } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await adminAdjustLoanBalance(admin.id, data);
    return { ok: true as const };
  });

/** @deprecated use fetchInternalLendingOps */
export const fetchInternalLendingQueue = fetchInternalLendingOps;

export type InternalLegacyDealRoomRedirect =
  | {
      to: "/internal/lending/applications/$applicationId";
      params: { applicationId: string };
      search: { tab: "thread" };
    }
  | {
      to: "/internal/users/$userId";
      params: { userId: string };
      search: Record<string, never>;
    }
  | {
      to: "/internal/queues/deal-rooms";
      params: Record<string, never>;
      search: Record<string, never>;
    };

/** Resolve legacy Prisma DealRoom URLs to the current lending workspace routes. */
export const resolveInternalLegacyDealRoomRedirect = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }): Promise<InternalLegacyDealRoomRedirect> => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { prisma } = await import("@/server/db");
    await requireOperator();

    const room = await prisma.dealRoom.findUnique({
      where: { id: dealRoomId },
      select: { loanApplicationId: true, borrowerUserId: true },
    });

    if (room?.loanApplicationId) {
      return {
        to: "/internal/lending/applications/$applicationId",
        params: { applicationId: room.loanApplicationId },
        search: { tab: "thread" },
      };
    }

    if (room?.borrowerUserId) {
      return {
        to: "/internal/users/$userId",
        params: { userId: room.borrowerUserId },
        search: {},
      };
    }

    return { to: "/internal/queues/deal-rooms", params: {}, search: {} };
  });
