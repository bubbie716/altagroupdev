import type {
  CompanyLendingOption,
  CreateLoanApplicationInput,
  InternalLoanApplicationRow,
  LendingAccountOption,
  LoanApplicationRow,
} from "@/lib/bank/lending-types";
import { LOAN_TERM_MONTHS_MAX, LOAN_TERM_MONTHS_MIN } from "@/lib/bank/lending-types";
import { prisma } from "@/server/db";
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
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return new Set(memberships.map((m) => m.companyId));
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
  const companyIds = await getUserCompanyIds(userId);
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: accountId,
      OR: [{ userId }, { companyId: { in: [...companyIds] } }],
    },
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
): Promise<LoanApplicationRow> {
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

  return mapLoanApplicationRow(record);
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

export async function listInternalLoanApplications(): Promise<InternalLoanApplicationRow[]> {
  const records = await prisma.loanApplication.findMany({
    include: loanApplicationInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return records.map(mapInternalLoanApplicationRow);
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
