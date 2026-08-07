/**
 * Alta Accounting — corporate-admin-only cash-basis books (company-scoped).
 */
import type { AltaUser } from "@/lib/auth/types";
import { isCorporateAdmin } from "@/lib/auth/permissions";
import {
  ACCOUNTING_CATEGORY_KINDS,
  ACCOUNTING_COUNTERPARTY_KINDS,
  ACCOUNTING_ENTRY_TYPES,
  ACCOUNTING_PAYMENT_METHODS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type AccountingCategoryKind,
  type AccountingCounterpartyKind,
  type AccountingEntryType,
  type AccountingPaymentMethod,
} from "@/lib/accounting/defaults";
import type {
  AccountingCategoryDto,
  AccountingCompanyOption,
  AccountingCounterpartyDto,
  AccountingLedgerEntryDto,
  AccountingWorkspaceDto,
} from "@/lib/accounting/types";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth.service";
import {
  clearAccountingCompanyCookie,
  readAccountingCompanyIdFromRequest,
  setAccountingCompanyCookie,
} from "@/server/accounting/company-context";

export class AccountingAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccountingAccessError";
    this.status = status;
  }
}

export async function requireAccountingAdmin(): Promise<AltaUser> {
  const user = await requireAuth();
  if (!isCorporateAdmin(user)) {
    throw new AccountingAccessError(
      "Alta Accounting is limited to corporate administrators.",
      403,
    );
  }
  return user;
}

export async function listAccountingCompanies(): Promise<AccountingCompanyOption[]> {
  await requireAccountingAdmin();
  const rows = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
  }));
}

export async function getAccountingWorkspace(): Promise<AccountingWorkspaceDto> {
  const companies = await listAccountingCompanies();
  let companyId = readAccountingCompanyIdFromRequest();
  if (companyId && !companies.some((c) => c.id === companyId)) {
    clearAccountingCompanyCookie();
    companyId = null;
  }
  if (!companyId && companies.length === 1) {
    companyId = companies[0]!.id;
    setAccountingCompanyCookie(companyId);
  }
  const company = companies.find((c) => c.id === companyId) ?? null;
  return {
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companies,
  };
}

export async function setActiveAccountingCompany(companyId: string): Promise<AccountingWorkspaceDto> {
  await requireAccountingAdmin();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    throw new AccountingAccessError("Company not found.", 404);
  }
  setAccountingCompanyCookie(company.id);
  const companies = await listAccountingCompanies();
  return {
    companyId: company.id,
    companyName: company.name,
    companies,
  };
}

async function requireActiveCompanyId(): Promise<string> {
  await requireAccountingAdmin();
  const companyId = readAccountingCompanyIdFromRequest();
  if (!companyId) {
    throw new AccountingAccessError("Select a company to manage books.", 400);
  }
  const exists = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!exists) {
    clearAccountingCompanyCookie();
    throw new AccountingAccessError("Selected company is no longer available.", 400);
  }
  return companyId;
}

function mapEntry(row: {
  id: string;
  date: string;
  type: string;
  amountCents: number;
  paymentMethod: string;
  note: string | null;
  category: { id: string; name: string; kind: string };
  counterparty: { id: string; name: string; kind: string } | null;
}): AccountingLedgerEntryDto {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    amountCents: row.amountCents,
    paymentMethod: row.paymentMethod,
    note: row.note,
    category: row.category,
    counterparty: row.counterparty,
  };
}

export async function listLedgerEntries(month: string): Promise<AccountingLedgerEntryDto[]> {
  const companyId = await requireActiveCompanyId();
  if (month !== "all" && !/^\d{4}-\d{2}$/.test(month)) {
    throw new AccountingAccessError("month must be YYYY-MM or 'all'", 400);
  }

  const where =
    month === "all"
      ? { companyId }
      : (() => {
          const [year, m] = month.split("-").map(Number);
          const start = new Date(year!, m! - 1, 1);
          const end = new Date(year!, m!, 0);
          return {
            companyId,
            date: {
              gte: start.toISOString().slice(0, 10),
              lte: end.toISOString().slice(0, 10),
            },
          };
        })();

  const rows = await prisma.accountingLedgerEntry.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, kind: true } },
      counterparty: { select: { id: true, name: true, kind: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapEntry);
}

export async function createLedgerEntry(input: {
  date: string;
  type: string;
  amountCents: number;
  categoryId: string;
  counterpartyId?: string | null;
  paymentMethod: string;
  note?: string | null;
}): Promise<AccountingLedgerEntryDto> {
  const companyId = await requireActiveCompanyId();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new AccountingAccessError("date must be YYYY-MM-DD", 400);
  }
  if (!ACCOUNTING_ENTRY_TYPES.includes(input.type as AccountingEntryType)) {
    throw new AccountingAccessError("Invalid entry type", 400);
  }
  if (
    !ACCOUNTING_PAYMENT_METHODS.includes(input.paymentMethod as AccountingPaymentMethod)
  ) {
    throw new AccountingAccessError("Invalid payment method", 400);
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new AccountingAccessError("amountCents must be a positive integer", 400);
  }

  const category = await prisma.accountingCategory.findFirst({
    where: { id: input.categoryId, companyId },
  });
  if (!category) throw new AccountingAccessError("Category not found", 404);

  let counterpartyId: string | null = input.counterpartyId?.trim() || null;
  if (counterpartyId) {
    const cp = await prisma.accountingCounterparty.findFirst({
      where: { id: counterpartyId, companyId },
    });
    if (!cp) throw new AccountingAccessError("Counterparty not found", 404);
  }

  const row = await prisma.accountingLedgerEntry.create({
    data: {
      companyId,
      date: input.date,
      type: input.type,
      amountCents: Math.round(input.amountCents),
      categoryId: input.categoryId,
      counterpartyId,
      paymentMethod: input.paymentMethod,
      note: input.note?.trim() || null,
    },
    include: {
      category: { select: { id: true, name: true, kind: true } },
      counterparty: { select: { id: true, name: true, kind: true } },
    },
  });
  return mapEntry(row);
}

export async function deleteLedgerEntry(id: string): Promise<{ ok: true }> {
  const companyId = await requireActiveCompanyId();
  const existing = await prisma.accountingLedgerEntry.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) throw new AccountingAccessError("Entry not found", 404);
  await prisma.accountingLedgerEntry.delete({ where: { id } });
  return { ok: true };
}

export async function listCategories(): Promise<AccountingCategoryDto[]> {
  const companyId = await requireActiveCompanyId();
  const rows = await prisma.accountingCategory.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
  return rows;
}

export async function createCategory(input: {
  name: string;
  kind: string;
}): Promise<AccountingCategoryDto> {
  const companyId = await requireActiveCompanyId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_CATEGORY_KINDS.includes(input.kind as AccountingCategoryKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  try {
    return await prisma.accountingCategory.create({
      data: { companyId, name, kind: input.kind },
      select: { id: true, name: true, kind: true },
    });
  } catch {
    throw new AccountingAccessError("Category already exists", 409);
  }
}

export async function updateCategory(input: {
  id: string;
  name: string;
  kind: string;
}): Promise<AccountingCategoryDto> {
  const companyId = await requireActiveCompanyId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_CATEGORY_KINDS.includes(input.kind as AccountingCategoryKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  const existing = await prisma.accountingCategory.findFirst({
    where: { id: input.id, companyId },
  });
  if (!existing) throw new AccountingAccessError("Category not found", 404);
  try {
    return await prisma.accountingCategory.update({
      where: { id: input.id },
      data: { name, kind: input.kind },
      select: { id: true, name: true, kind: true },
    });
  } catch {
    throw new AccountingAccessError("Category name already in use", 409);
  }
}

export async function deleteCategory(id: string): Promise<{ ok: true }> {
  const companyId = await requireActiveCompanyId();
  const existing = await prisma.accountingCategory.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) throw new AccountingAccessError("Category not found", 404);
  try {
    await prisma.accountingCategory.delete({ where: { id } });
  } catch {
    throw new AccountingAccessError("Category is in use by ledger entries", 409);
  }
  return { ok: true };
}

export async function listCounterparties(): Promise<AccountingCounterpartyDto[]> {
  const companyId = await requireActiveCompanyId();
  return prisma.accountingCounterparty.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
}

export async function createCounterparty(input: {
  name: string;
  kind: string;
}): Promise<AccountingCounterpartyDto> {
  const companyId = await requireActiveCompanyId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_COUNTERPARTY_KINDS.includes(input.kind as AccountingCounterpartyKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  try {
    return await prisma.accountingCounterparty.create({
      data: { companyId, name, kind: input.kind },
      select: { id: true, name: true, kind: true },
    });
  } catch {
    throw new AccountingAccessError("Counterparty already exists", 409);
  }
}

export async function updateCounterparty(input: {
  id: string;
  name: string;
  kind: string;
}): Promise<AccountingCounterpartyDto> {
  const companyId = await requireActiveCompanyId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_COUNTERPARTY_KINDS.includes(input.kind as AccountingCounterpartyKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  const existing = await prisma.accountingCounterparty.findFirst({
    where: { id: input.id, companyId },
  });
  if (!existing) throw new AccountingAccessError("Counterparty not found", 404);
  try {
    return await prisma.accountingCounterparty.update({
      where: { id: input.id },
      data: { name, kind: input.kind },
      select: { id: true, name: true, kind: true },
    });
  } catch {
    throw new AccountingAccessError("Counterparty name already in use", 409);
  }
}

export async function deleteCounterparty(id: string): Promise<{ ok: true }> {
  const companyId = await requireActiveCompanyId();
  const existing = await prisma.accountingCounterparty.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing) throw new AccountingAccessError("Counterparty not found", 404);
  await prisma.accountingCounterparty.delete({ where: { id } });
  return { ok: true };
}

export async function seedDefaultCategories(): Promise<{ ok: true; created: number }> {
  const companyId = await requireActiveCompanyId();
  let created = 0;
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const result = await prisma.accountingCategory.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, kind: "expense" },
    });
    if (result) created += 1;
  }
  for (const name of DEFAULT_INCOME_CATEGORIES) {
    await prisma.accountingCategory.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name, kind: "income" },
    });
    created += 1;
  }
  return { ok: true, created };
}

export async function buildLedgerCsv(month: string): Promise<{
  filename: string;
  csv: string;
}> {
  const entries = await listLedgerEntries(month);
  const header = [
    "Date",
    "Type",
    "Amount (ƒ)",
    "Category",
    "Counterparty",
    "Payment Method",
    "Note",
  ];
  const lines = [
    header.join(","),
    ...entries.map((e) =>
      [
        e.date,
        e.type,
        (e.amountCents / 100).toFixed(2),
        csvEscape(e.category.name),
        csvEscape(e.counterparty?.name ?? ""),
        e.paymentMethod,
        csvEscape(e.note ?? ""),
      ].join(","),
    ),
  ];
  const filename =
    month === "all" ? "alta-accounting-all.csv" : `alta-accounting-${month}.csv`;
  return { filename, csv: lines.join("\n") };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
