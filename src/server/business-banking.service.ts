import type { AltaUser } from "@/lib/auth/types";
import {
  canManageBusinessTreasury,
  canViewBusinessTreasury,
  findCompanyMembership,
} from "@/lib/auth/permissions";
import type {
  BusinessBankingOverview,
  BusinessRepresentativeRow,
  CreatePayrollEmployeeInput,
  CreatePayrollRunInput,
  CreateScheduledPaymentInput,
  PayrollEmployeeRow,
  PayrollRunRow,
  ScheduledPaymentRow,
  UpdatePayrollEmployeeInput,
} from "@/lib/bank/business-banking-types";
import { isValidAltaAccountNumber } from "@/lib/bank/account-number";
import {
  computeNextPayDate,
  getDefaultPayDay,
  isValidPayDay,
} from "@/lib/bank/payroll-pay-day";
import { resolveScheduledInputDateTime } from "@/lib/scheduled-datetime";
import { prisma } from "@/server/db";
import {
  mapPayrollEmployee,
  mapPayrollRun,
  mapRepresentative,
  mapScheduledPayment,
  mapTreasuryCompany,
  toDbPaymentFrequency,
  toDbPaymentType,
} from "@/server/business-banking-mapper";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function requireTreasuryView(user: AltaUser, companyId: string) {
  if (!canViewBusinessTreasury(user, { companyId })) forbidden();
  const membership = findCompanyMembership(user, { companyId });
  if (!membership) forbidden();
  await assertVerifiedCompanyWithOperatingAccount(companyId);
  return membership;
}

async function requireTreasuryManage(user: AltaUser, companyId: string) {
  if (!canManageBusinessTreasury(user, { companyId })) forbidden();
  const membership = findCompanyMembership(user, { companyId });
  if (!membership) forbidden();
  await assertVerifiedCompanyWithOperatingAccount(companyId);
  return membership;
}

async function assertVerifiedCompanyWithOperatingAccount(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company) notFound();
  if (company.verificationStatus !== "VERIFIED") {
    badRequest("Company must be verified to access Business Banking.");
  }
  if (company.bankAccounts.length === 0) {
    badRequest("An active Business Operating Account is required.");
  }
  return { company, operatingAccount: company.bankAccounts[0]! };
}

async function assertOperatingAccount(companyId: string, bankAccountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: bankAccountId,
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
  });
  if (!account) badRequest("Invalid business operating account.");
  return account;
}

export async function getBusinessBankingOverview(
  user: AltaUser,
  selectedCompanyId?: string,
): Promise<BusinessBankingOverview> {
  const eligible = await listEligibleTreasuryCompanies(user);
  const selected =
    selectedCompanyId && eligible.some((c) => c.companyId === selectedCompanyId)
      ? selectedCompanyId
      : eligible[0]?.companyId ?? null;

  return { companies: eligible, selectedCompanyId: selected };
}

async function listEligibleTreasuryCompanies(user: AltaUser) {
  const memberships = user.companyMemberships.filter((m) => m.role !== "viewer");
  if (memberships.length === 0) return [];

  const companyIds = memberships.map((m) => m.companyId);
  const companies = await prisma.company.findMany({
    where: {
      id: { in: companyIds },
      verificationStatus: "VERIFIED",
    },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });

  return companies
    .filter((c) => c.bankAccounts.length > 0)
    .map((company) => {
      const membership = memberships.find((m) => m.companyId === company.id)!;
      return mapTreasuryCompany(company, company.bankAccounts[0]!, membership.role);
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function listScheduledPayments(
  user: AltaUser,
  companyId: string,
): Promise<ScheduledPaymentRow[]> {
  await requireTreasuryView(user, companyId);
  const rows = await prisma.scheduledPayment.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapScheduledPayment);
}

export async function createScheduledPayment(
  user: AltaUser,
  input: CreateScheduledPaymentInput,
): Promise<ScheduledPaymentRow> {
  await requireTreasuryManage(user, input.companyId);
  await assertOperatingAccount(input.companyId, input.bankAccountId);

  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (!input.recipientName.trim()) {
    badRequest("Recipient name is required.");
  }
  if (!input.recipientAccountNumber?.trim()) {
    badRequest("Recipient Alta account number is required.");
  }
  if (!isValidAltaAccountNumber(input.recipientAccountNumber.trim())) {
    badRequest("Enter a valid Alta Bank account number (AB-####-######).");
  }

  const scheduledDate = resolveScheduledInputDateTime(input.scheduledDate, input.scheduledTime);
  if (input.paymentType === "one_time" || input.paymentType === "scheduled") {
    if (!scheduledDate) {
      badRequest("Scheduled date and time are required.");
    }
  }

  if (input.paymentType === "recurring" && !input.frequency) {
    badRequest("Frequency is required for recurring payments.");
  }

  if (input.paymentType === "recurring" && !scheduledDate) {
    badRequest("First run date and time are required.");
  }

  const row = await prisma.scheduledPayment.create({
    data: {
      companyId: input.companyId,
      bankAccountId: input.bankAccountId,
      createdByUserId: user.id,
      transferScope: "INTRABANK",
      paymentType: toDbPaymentType(input.paymentType),
      label: input.recipientName.trim(),
      recipientName: input.recipientName.trim(),
      recipientAccountNumber: input.recipientAccountNumber?.trim() || null,
      amount: input.amount,
      frequency: input.frequency ? toDbPaymentFrequency(input.frequency) : null,
      scheduledDate,
      nextRunDate: input.paymentType === "recurring" ? scheduledDate : null,
      memo: input.memo?.trim() || null,
      status: "APPROVED",
    },
  });

  return mapScheduledPayment(row);
}

export async function cancelScheduledPayment(
  user: AltaUser,
  companyId: string,
  paymentId: string,
): Promise<ScheduledPaymentRow> {
  await requireTreasuryManage(user, companyId);
  const existing = await prisma.scheduledPayment.findFirst({
    where: { id: paymentId, companyId },
  });
  if (!existing) notFound();
  if (existing.status === "EXECUTED" || existing.status === "CANCELLED" || existing.status === "FAILED") {
    badRequest("This payment cannot be cancelled.");
  }

  const row = await prisma.scheduledPayment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED" },
  });
  return mapScheduledPayment(row);
}

export async function listPayrollEmployees(
  user: AltaUser,
  companyId: string,
): Promise<PayrollEmployeeRow[]> {
  await requireTreasuryView(user, companyId);
  const rows = await prisma.payrollEmployee.findMany({
    where: { companyId },
    orderBy: { displayName: "asc" },
  });
  return rows.map(mapPayrollEmployee);
}

export async function createPayrollEmployee(
  user: AltaUser,
  input: CreatePayrollEmployeeInput,
): Promise<PayrollEmployeeRow> {
  await requireTreasuryManage(user, input.companyId);
  if (!input.displayName.trim()) badRequest("Employee name is required.");
  if (input.payAmount <= 0) badRequest("Pay amount must be greater than zero.");
  const accountNumber = input.accountNumber?.trim();
  if (!accountNumber) badRequest("Employee Alta account number is required.");
  if (!isValidAltaAccountNumber(accountNumber)) {
    badRequest("Enter a valid Alta Bank account number (AB-####-######).");
  }
  if (!isValidPayDay(input.payFrequency, input.payDay)) {
    badRequest("Select a valid pay day for this frequency.");
  }

  const now = new Date();
  const nextPayDate = computeNextPayDate(input.payFrequency, input.payDay, now, false, now);

  const row = await prisma.payrollEmployee.create({
    data: {
      companyId: input.companyId,
      displayName: input.displayName.trim(),
      title: input.title?.trim() || null,
      accountNumber,
      payAmount: input.payAmount,
      payFrequency: toDbPaymentFrequency(input.payFrequency),
      payDay: input.payDay,
      nextPayDate,
      status: "ACTIVE",
    },
  });
  return mapPayrollEmployee(row);
}

export async function updatePayrollEmployee(
  user: AltaUser,
  input: UpdatePayrollEmployeeInput,
): Promise<PayrollEmployeeRow> {
  await requireTreasuryManage(user, input.companyId);

  const existing = await prisma.payrollEmployee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
  });
  if (!existing) notFound();

  if (!input.displayName.trim()) badRequest("Employee name is required.");
  if (input.payAmount <= 0) badRequest("Pay amount must be greater than zero.");
  const accountNumber = input.accountNumber.trim();
  if (!accountNumber) badRequest("Employee Alta account number is required.");
  if (!isValidAltaAccountNumber(accountNumber)) {
    badRequest("Enter a valid Alta Bank account number (AB-####-######).");
  }
  if (!isValidPayDay(input.payFrequency, input.payDay)) {
    badRequest("Select a valid pay day for this frequency.");
  }

  const payFrequency = toDbPaymentFrequency(input.payFrequency);
  const scheduleChanged =
    payFrequency !== existing.payFrequency || input.payDay !== existing.payDay;

  const updateData: {
    displayName: string;
    title: string | null;
    accountNumber: string;
    payAmount: number;
    payFrequency: typeof payFrequency;
    payDay: string;
    nextPayDate?: Date;
  } = {
    displayName: input.displayName.trim(),
    title: input.title?.trim() || null,
    accountNumber,
    payAmount: input.payAmount,
    payFrequency,
    payDay: input.payDay,
  };

  if (scheduleChanged || !existing.nextPayDate) {
    const now = new Date();
    updateData.nextPayDate = computeNextPayDate(
      input.payFrequency,
      input.payDay,
      now,
      Boolean(existing.lastPaidAt),
      existing.lastPaidAt ?? existing.createdAt,
    );
  }

  const row = await prisma.payrollEmployee.update({
    where: { id: input.employeeId },
    data: updateData,
  });
  return mapPayrollEmployee(row);
}

export async function deactivatePayrollEmployee(
  user: AltaUser,
  companyId: string,
  employeeId: string,
): Promise<PayrollEmployeeRow> {
  await requireTreasuryManage(user, companyId);
  const existing = await prisma.payrollEmployee.findFirst({
    where: { id: employeeId, companyId },
  });
  if (!existing) notFound();

  const row = await prisma.payrollEmployee.update({
    where: { id: employeeId },
    data: { status: "INACTIVE" },
  });
  return mapPayrollEmployee(row);
}

export async function listPayrollRuns(
  user: AltaUser,
  companyId: string,
): Promise<PayrollRunRow[]> {
  await requireTreasuryView(user, companyId);
  const rows = await prisma.payrollRun.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapPayrollRun);
}

export async function createPayrollRun(
  user: AltaUser,
  input: CreatePayrollRunInput,
): Promise<PayrollRunRow> {
  await requireTreasuryManage(user, input.companyId);
  await assertOperatingAccount(input.companyId, input.bankAccountId);

  if (!input.label.trim()) badRequest("Batch label is required.");
  if (input.employeeIds.length === 0) badRequest("Select at least one employee.");

  const payDate = resolveScheduledInputDateTime(input.payDate);
  if (!payDate) badRequest("Valid pay date is required.");

  const employees = await prisma.payrollEmployee.findMany({
    where: {
      companyId: input.companyId,
      id: { in: input.employeeIds },
      status: "ACTIVE",
    },
  });
  if (employees.length !== input.employeeIds.length) {
    badRequest("One or more selected employees are invalid or inactive.");
  }

  for (const employee of employees) {
    const accountNumber = employee.accountNumber?.trim();
    if (!accountNumber || !isValidAltaAccountNumber(accountNumber)) {
      badRequest(`${employee.displayName} needs a valid Alta account number before payroll can run.`);
    }
  }

  const lineItems = employees.map((e) => ({
    employeeId: e.id,
    displayName: e.displayName,
    amount: Number(e.payAmount.toString()),
    accountNumber: e.accountNumber!.trim(),
  }));
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const row = await prisma.payrollRun.create({
    data: {
      companyId: input.companyId,
      bankAccountId: input.bankAccountId,
      createdByUserId: user.id,
      label: input.label.trim(),
      totalAmount,
      payDate,
      lineItems,
      memo: input.memo?.trim() || null,
      status: "APPROVED",
    },
  });

  return mapPayrollRun(row);
}

export async function listBusinessRepresentatives(
  user: AltaUser,
  companyId: string,
): Promise<BusinessRepresentativeRow[]> {
  await requireTreasuryView(user, companyId);
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const priority = ["OWNER", "EXECUTIVE", "FINANCE_MANAGER", "COMPLIANCE_CONTACT", "VIEWER"] as const;
  return memberships
    .sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role))
    .map(mapRepresentative);
}

export async function getTreasuryCompanyContext(user: AltaUser, companyId: string) {
  await requireTreasuryView(user, companyId);
  const { company, operatingAccount } = await assertVerifiedCompanyWithOperatingAccount(companyId);
  const membership = findCompanyMembership(user, { companyId })!;
  return mapTreasuryCompany(company, operatingAccount, membership.role);
}
