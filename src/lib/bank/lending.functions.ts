import { createServerFn } from "@tanstack/react-start";
import type {
  AdminAdjustLoanInput,
  ApproveLoanApplicationInput,
  CreateLoanApplicationInput,
  DenyLoanApplicationInput,
  MakeLoanPaymentInput,
} from "@/lib/bank/lending-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

export const fetchLendingFormContext = createServerFn({ method: "GET" }).handler(async () => {
  const { getLendingFormContext } = await import("@/server/lending.service");
  const userId = await actorId();
  return getLendingFormContext(userId);
});

export const submitLoanApplication = createServerFn({ method: "POST" })
  .validator((input: CreateLoanApplicationInput) => input)
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
  .validator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { getLoanPaymentContext } = await import("@/server/loan.service");
    const userId = await actorId();
    return getLoanPaymentContext(userId, loanId);
  });

export const submitLoanPayment = createServerFn({ method: "POST" })
  .validator((input: MakeLoanPaymentInput) => input)
  .handler(async ({ data }) => {
    const { makeLoanPayment } = await import("@/server/loan.service");
    const userId = await actorId();
    await makeLoanPayment(userId, data);
    return { ok: true as const };
  });

export const setLoanAutoPayRecord = createServerFn({ method: "POST" })
  .validator((input: import("@/lib/bank/lending-types").SetLoanAutoPayInput) => input)
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

export const markLoanApplicationUnderReviewRecord = createServerFn({ method: "POST" })
  .validator((input: { applicationId: string; reviewNote?: string }) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { markLoanApplicationUnderReview } = await import("@/server/lending.service");
    const admin = await requireOperator();
    await markLoanApplicationUnderReview(admin.id, data.applicationId, data.reviewNote);
    return { ok: true as const };
  });

export const approveLoanApplicationRecord = createServerFn({ method: "POST" })
  .validator((input: ApproveLoanApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { approveLoanApplication } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await approveLoanApplication(admin.id, data);
    return { ok: true as const };
  });

export const denyLoanApplicationRecord = createServerFn({ method: "POST" })
  .validator((input: DenyLoanApplicationInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { denyLoanApplication } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await denyLoanApplication(admin.id, data);
    return { ok: true as const };
  });

export const accrueLoanInterestRecord = createServerFn({ method: "POST" })
  .validator((loanId: string) => loanId)
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
  .validator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { freezeLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await freezeLoan(admin.id, loanId);
    return { ok: true as const };
  });

export const unfreezeLoanRecord = createServerFn({ method: "POST" })
  .validator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { unfreezeLoan } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await unfreezeLoan(admin.id, loanId);
    return { ok: true as const };
  });

export const markLoanPaidOffRecord = createServerFn({ method: "POST" })
  .validator((loanId: string) => loanId)
  .handler(async ({ data: loanId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { markLoanPaidOff } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await markLoanPaidOff(admin.id, loanId);
    return { ok: true as const };
  });

export const adminAdjustLoanRecord = createServerFn({ method: "POST" })
  .validator((input: AdminAdjustLoanInput) => input)
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { adminAdjustLoanBalance } = await import("@/server/loan.service");
    const admin = await requireOperator();
    await adminAdjustLoanBalance(admin.id, data);
    return { ok: true as const };
  });

/** @deprecated use fetchInternalLendingOps */
export const fetchInternalLendingQueue = fetchInternalLendingOps;
