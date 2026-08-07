/**
 * Accounting Tracker — corporate-admin-only cash-basis books.
 * Orgs are local AccountingOrg records (not Alta Company).
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
  AccountingCounterpartyDto,
  AccountingLedgerEntryDto,
  AccountingOrgOption,
  AccountingWorkspaceDto,
} from "@/lib/accounting/types";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth.service";
import {
  clearAccountingOrgCookie,
  readAccountingOrgIdFromRequest,
  setAccountingOrgCookie,
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
      "Accounting Tracker is limited to corporate administrators.",
      403,
    );
  }
  return user;
}

export async function listAccountingOrgs(): Promise<AccountingOrgOption[]> {
  await requireAccountingAdmin();
  const rows = await prisma.accountingOrg.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 500,
  });
  return rows;
}

export async function getAccountingWorkspace(): Promise<AccountingWorkspaceDto> {
  const orgs = await listAccountingOrgs();
  let orgId = readAccountingOrgIdFromRequest();
  if (orgId && !orgs.some((o) => o.id === orgId)) {
    clearAccountingOrgCookie();
    orgId = null;
  }
  if (!orgId && orgs.length === 1) {
    orgId = orgs[0]!.id;
    setAccountingOrgCookie(orgId);
  }
  const org = orgs.find((o) => o.id === orgId) ?? null;
  return {
    orgId: org?.id ?? null,
    orgName: org?.name ?? null,
    orgs,
  };
}

export async function setActiveAccountingOrg(orgId: string): Promise<AccountingWorkspaceDto> {
  await requireAccountingAdmin();
  const org = await prisma.accountingOrg.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new AccountingAccessError("Organization not found.", 404);
  }
  setAccountingOrgCookie(org.id);
  const orgs = await listAccountingOrgs();
  return {
    orgId: org.id,
    orgName: org.name,
    orgs,
  };
}

export async function createAccountingOrg(name: string): Promise<AccountingWorkspaceDto> {
  const user = await requireAccountingAdmin();
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new AccountingAccessError("Organization name must be at least 2 characters.", 400);
  }
  const org = await prisma.accountingOrg.create({
    data: {
      name: trimmed.slice(0, 120),
      createdByUserId: user.id,
    },
    select: { id: true, name: true },
  });
  setAccountingOrgCookie(org.id);
  const orgs = await listAccountingOrgs();
  return {
    orgId: org.id,
    orgName: org.name,
    orgs,
  };
}

async function requireActiveOrgId(): Promise<string> {
  await requireAccountingAdmin();
  const orgId = readAccountingOrgIdFromRequest();
  if (!orgId) {
    throw new AccountingAccessError("Select or create an organization first.", 400);
  }
  const exists = await prisma.accountingOrg.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!exists) {
    clearAccountingOrgCookie();
    throw new AccountingAccessError("Selected organization is no longer available.", 400);
  }
  return orgId;
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
  const orgId = await requireActiveOrgId();
  if (month !== "all" && !/^\d{4}-\d{2}$/.test(month)) {
    throw new AccountingAccessError("month must be YYYY-MM or 'all'", 400);
  }

  const where =
    month === "all"
      ? { orgId }
      : (() => {
          const [year, m] = month.split("-").map(Number);
          const start = new Date(year!, m! - 1, 1);
          const end = new Date(year!, m!, 0);
          return {
            orgId,
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
  const orgId = await requireActiveOrgId();
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
    where: { id: input.categoryId, orgId },
  });
  if (!category) throw new AccountingAccessError("Category not found", 404);

  let counterpartyId: string | null = input.counterpartyId?.trim() || null;
  if (counterpartyId) {
    const cp = await prisma.accountingCounterparty.findFirst({
      where: { id: counterpartyId, orgId },
    });
    if (!cp) throw new AccountingAccessError("Counterparty not found", 404);
  }

  const row = await prisma.accountingLedgerEntry.create({
    data: {
      orgId,
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
  const orgId = await requireActiveOrgId();
  const existing = await prisma.accountingLedgerEntry.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw new AccountingAccessError("Entry not found", 404);
  await prisma.accountingLedgerEntry.delete({ where: { id } });
  return { ok: true };
}

export async function listCategories(): Promise<AccountingCategoryDto[]> {
  const orgId = await requireActiveOrgId();
  return prisma.accountingCategory.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
}

export async function createCategory(input: {
  name: string;
  kind: string;
}): Promise<AccountingCategoryDto> {
  const orgId = await requireActiveOrgId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_CATEGORY_KINDS.includes(input.kind as AccountingCategoryKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  try {
    return await prisma.accountingCategory.create({
      data: { orgId, name, kind: input.kind },
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
  const orgId = await requireActiveOrgId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_CATEGORY_KINDS.includes(input.kind as AccountingCategoryKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  const existing = await prisma.accountingCategory.findFirst({
    where: { id: input.id, orgId },
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
  const orgId = await requireActiveOrgId();
  const existing = await prisma.accountingCategory.findFirst({
    where: { id, orgId },
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
  const orgId = await requireActiveOrgId();
  return prisma.accountingCounterparty.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
}

export async function createCounterparty(input: {
  name: string;
  kind: string;
}): Promise<AccountingCounterpartyDto> {
  const orgId = await requireActiveOrgId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_COUNTERPARTY_KINDS.includes(input.kind as AccountingCounterpartyKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  try {
    return await prisma.accountingCounterparty.create({
      data: { orgId, name, kind: input.kind },
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
  const orgId = await requireActiveOrgId();
  const name = input.name.trim();
  if (!name) throw new AccountingAccessError("Name required", 400);
  if (!ACCOUNTING_COUNTERPARTY_KINDS.includes(input.kind as AccountingCounterpartyKind)) {
    throw new AccountingAccessError("Invalid kind", 400);
  }
  const existing = await prisma.accountingCounterparty.findFirst({
    where: { id: input.id, orgId },
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
  const orgId = await requireActiveOrgId();
  const existing = await prisma.accountingCounterparty.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw new AccountingAccessError("Counterparty not found", 404);
  await prisma.accountingCounterparty.delete({ where: { id } });
  return { ok: true };
}

export async function seedDefaultCategories(): Promise<{ ok: true; created: number }> {
  const orgId = await requireActiveOrgId();
  let created = 0;
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.accountingCategory.upsert({
      where: { orgId_name: { orgId, name } },
      update: {},
      create: { orgId, name, kind: "expense" },
    });
    created += 1;
  }
  for (const name of DEFAULT_INCOME_CATEGORIES) {
    await prisma.accountingCategory.upsert({
      where: { orgId_name: { orgId, name } },
      update: {},
      create: { orgId, name, kind: "income" },
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
    month === "all" ? "accounting-tracker-all.csv" : `accounting-tracker-${month}.csv`;
  return { filename, csv: lines.join("\n") };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
