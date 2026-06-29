import type {
  CompanyLendingOption,
  CreateLoanApplicationInput,
  InternalLoanApplicationRow,
  LendingAccountOption,
  LendingDeskStats,
  LoanApplicationRow,
} from "@/lib/bank/lending-types";
import { LOAN_TERM_MONTHS_MAX, LOAN_TERM_MONTHS_MIN } from "@/lib/bank/lending-types";
import { florin } from "@/lib/bank/api";
import { prisma } from "@/server/db";
import {
  bankAccountAccessWhere,
  companyIdsForBankAccess,
  loadAltaUserOrThrow,
} from "@/server/bank-account-access.service";
import {
  loanApplicationInclude,
  mapInternalLoanApplicationRow,
  mapLoanApplicationRow,
  toDbLoanProductType,
} from "@/server/lending-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  canManageBusinessTreasury,
  isPrivateClient,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";

export {
  approveLoanApplication,
  denyLoanApplication,
  makeLoanPayment,
  accrueInterestForLoan,
  accrueInterestForDueLoans,
  accrueInterestCatchUpForLoan,
  backfillLegacyLoanInterest,
  getUserLoans,
  getLoanDetail,
  getLoanPaymentContext,
  freezeLoan,
  unfreezeLoan,
  markLoanPaidOff,
  adminAdjustLoanBalance,
  listInternalLoansByStatus,
} from "@/server/loan.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

async function getUserCompanyIds(userId: string): Promise<Set<string>> {
  const user = await loadAltaUserOrThrow(userId);
  return new Set(companyIdsForBankAccess(user, "manage"));
}

function companyIdsWithTreasuryAccess(user: AltaUser): Set<string> {
  return new Set(
    user.companyMemberships
      .filter((m) => canManageBusinessTreasury(user, { companyId: m.companyId }))
      .map((m) => m.companyId),
  );
}

async function assertAccountAccessible(
  userId: string,
  accountId: string,
  companyId?: string,
): Promise<void> {
  const user = await loadAltaUserOrThrow(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...bankAccountAccessWhere(user, "manage") },
  });
  if (!account) badRequest("Linked bank account not found or not accessible");
  if (account.status !== "ACTIVE") badRequest("Linked bank account must be active");
  if (companyId && account.companyId !== companyId) {
    badRequest("Linked bank account must belong to the selected company");
  }
  if (!companyId && account.companyId) {
    badRequest("Personal loans must link to a personal Alta account");
  }
}

function validateProductEligibility(user: AltaUser, input: CreateLoanApplicationInput): void {
  if (input.productType === "personal_credit_line") {
    if (input.companyId) badRequest("Personal credit lines cannot be tied to a company");
    return;
  }
  if (input.productType === "business_credit_line") {
    if (!input.companyId) badRequest("Business credit lines require a verified company");
    const membership = user.companyMemberships.find((m) => m.companyId === input.companyId);
    if (!membership) forbidden();
    if (!canManageBusinessTreasury(user, { companyId: input.companyId })) {
      badRequest("You need Owner, Executive, or Finance Manager access to apply for business credit");
    }
    if (membership.companyVerificationStatus !== "Verified") {
      badRequest("Company must be verified before applying for business credit");
    }
    return;
  }
  if (input.productType === "private_liquidity_line") {
    if (!isPrivateClient(user)) badRequest("Private liquidity lines require Alta Private client status");
    if (input.companyId) badRequest("Private liquidity lines are issued to individuals, not companies");
  }
}

export async function getLendingFormContext(userId: string): Promise<{
  accounts: LendingAccountOption[];
  companies: CompanyLendingOption[];
}> {
  const user = await getAltaUser(userId);
  const companyIds = companyIdsWithTreasuryAccess(user);

  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ userId }, ...(companyIds.size ? [{ companyId: { in: [...companyIds] } }] : [])],
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { accountName: "asc" },
  });

  const verifiedCompanies = user.companyMemberships.filter(
    (m) =>
      m.companyVerificationStatus === "Verified" &&
      canManageBusinessTreasury(user, { companyId: m.companyId }),
  );

  const companyAccounts = await prisma.bankAccount.findMany({
    where: {
      companyId: { in: verifiedCompanies.map((c) => c.companyId) },
      status: "ACTIVE",
      accountType: "BUSINESS_OPERATING",
    },
    select: { id: true, companyId: true },
  });
  const operatingByCompany = new Map(
    companyAccounts.map((a) => [a.companyId, a.id] as const),
  );

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      label: a.accountName,
      accountNumber: a.accountNumber,
      companyId: a.companyId,
      companyName: a.company?.name ?? null,
    })),
    companies: verifiedCompanies.map((c) => ({
      companyId: c.companyId,
      companyName: c.companyName,
      operatingAccountId: operatingByCompany.get(c.companyId) ?? null,
    })),
  };
}

export async function createLoanApplication(
  userId: string,
  input: CreateLoanApplicationInput,
): Promise<LoanApplicationRow & { threadId: string }> {
  const { assertCreditDeskAcceptingApplications } = await import("@/server/platform-settings.service");
  await assertCreditDeskAcceptingApplications();

  const user = await getAltaUser(userId);
  if (input.requestedAmount <= 0) badRequest("Requested amount must be greater than zero");
  if (
    !Number.isInteger(input.termMonths) ||
    input.termMonths < LOAN_TERM_MONTHS_MIN ||
    input.termMonths > LOAN_TERM_MONTHS_MAX
  ) {
    badRequest(`Loan term must be between ${LOAN_TERM_MONTHS_MIN} and ${LOAN_TERM_MONTHS_MAX} months`);
  }
  if (!input.purpose.trim()) badRequest("Purpose is required");
  if (!input.repaymentPlan.trim()) badRequest("Repayment plan is required");

  validateProductEligibility(user, input);

  if (input.linkedBankAccountId) {
    await assertAccountAccessible(userId, input.linkedBankAccountId, input.companyId);
  }

  const record = await prisma.loanApplication.create({
    data: {
      applicantUserId: userId,
      companyId: input.companyId ?? null,
      productType: toDbLoanProductType(input.productType),
      requestedAmount: input.requestedAmount,
      termMonths: input.termMonths,
      purpose: input.purpose.trim(),
      repaymentPlan: input.repaymentPlan.trim(),
      collateralDescription: input.collateralDescription?.trim() || null,
      notes: input.notes?.trim() || null,
      linkedBankAccountId: input.linkedBankAccountId ?? null,
      status: "PENDING",
    },
    include: loanApplicationInclude,
  });

  const { createThreadForLoanApplication } = await import("@/server/loan-application-thread.service");
  const { threadId } = await createThreadForLoanApplication(userId, record.id);

  const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
  if (record.companyId) {
    const { recordCompanyTimelineEventIfBusiness } = await import(
      "@/server/company-relationship-timeline.service"
    );
    await recordCompanyTimelineEventIfBusiness(record.companyId, {
      eventType: "LOAN_APPLICATION_SUBMITTED",
      title: "Business lending application submitted",
      description: `Requested ${florin(Number(record.requestedAmount.toString()))}.`,
      occurredAt: record.createdAt,
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: record.id,
      dedupeKey: `loan-app:submitted:${record.id}`,
    });
  } else {
    await recordRelationshipTimelineEvent({
      userId,
      eventType: "LOAN_APPLICATION_SUBMITTED",
      title: "Lending application submitted",
      description: `Requested ${florin(Number(record.requestedAmount.toString()))}.`,
      occurredAt: record.createdAt,
      relatedEntityType: "LOAN_APPLICATION",
      relatedEntityId: record.id,
    });
  }

  return { ...mapLoanApplicationRow(record), threadId };
}

export async function listUserLoanApplications(userId: string): Promise<LoanApplicationRow[]> {
  const user = await getAltaUser(userId);
  const treasuryCompanyIds = [...companyIdsWithTreasuryAccess(user)];

  const records = await prisma.loanApplication.findMany({
    where: {
      OR: [{ applicantUserId: userId }, { companyId: { in: treasuryCompanyIds } }],
    },
    include: loanApplicationInclude,
    orderBy: { createdAt: "desc" },
  });

  return records.map(mapLoanApplicationRow);
}

export async function countPendingLoanApplications(): Promise<number> {
  return prisma.loanApplication.count({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
}

async function computeAvgStaffResponseHours(): Promise<number | null> {
  const threads = await prisma.loanApplicationThread.findMany({
    select: {
      createdAt: true,
      messages: {
        where: { senderRole: "ALTA_STAFF" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const responseHours = threads
    .filter((thread) => thread.messages.length > 0)
    .map((thread) => {
      const firstStaffReply = thread.messages[0]!.createdAt.getTime();
      return (firstStaffReply - thread.createdAt.getTime()) / (1000 * 60 * 60);
    });

  if (responseHours.length === 0) return null;
  return responseHours.reduce((sum, hours) => sum + hours, 0) / responseHours.length;
}

export async function getLendingDeskStats(): Promise<LendingDeskStats> {
  const [officersOnDesk, activeFacilities, pendingReview, avgResponseHours] = await Promise.all([
    prisma.user.count({
      where: { tags: { some: { tag: { in: ["ADMIN", "OPERATOR"] } } } },
    }),
    prisma.loan.count({ where: { status: "ACTIVE" } }),
    countPendingLoanApplications(),
    computeAvgStaffResponseHours(),
  ]);

  return {
    officersOnDesk,
    activeFacilities,
    pendingReview,
    avgResponseHours,
  };
}

export async function listInternalLoanApplications(): Promise<InternalLoanApplicationRow[]> {
  const records = await prisma.loanApplication.findMany({
    include: loanApplicationInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return records.map(mapInternalLoanApplicationRow);
}

export async function getInternalLoanApplicationById(
  applicationId: string,
): Promise<InternalLoanApplicationRow | null> {
  const record = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: loanApplicationInclude,
  });
  return record ? mapInternalLoanApplicationRow(record) : null;
}

export async function markLoanApplicationUnderReview(
  adminId: string,
  applicationId: string,
  reviewNote?: string,
): Promise<void> {
  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { loan: { select: { id: true } } },
  });
  if (!application) notFound();
  if (!["PENDING", "UNDER_REVIEW"].includes(application.status)) {
    badRequest("Application is no longer open for review");
  }
  if (application.loan) badRequest("A loan already exists for this application");
  if (application.status === "UNDER_REVIEW") return;

  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: {
      status: "UNDER_REVIEW",
      reviewedById: adminId,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || application.reviewNote,
    },
  });
}
