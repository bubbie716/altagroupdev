import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canViewAltaPayReceived } from "@/lib/auth/permissions";
import type {
  AltaPayPaymentRow,
  AltaPayReceivedSummary,
  AltaPayVolumeSummary,
  PayableCompany,
  SubmitAltaPayInput,
  SubmitAltaPayResult,
} from "@/lib/bank/alta-pay-types";
import { ALTA_PAY_REFERENCE_PREFIX } from "@/lib/bank/alta-pay-types";
import { prisma } from "@/server/db";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function generatePayReferenceBase(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${ALTA_PAY_REFERENCE_PREFIX}${date}-${suffix}`;
}

async function getAvailableBalance(accountId: string): Promise<number> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) notFound();

  const balance = decimalToNumber(account.balance);
  const pendingWithdrawals = await prisma.bankTransaction.aggregate({
    where: { bankAccountId: accountId, type: "WITHDRAWAL", status: "PENDING" },
    _sum: { amount: true },
  });
  const reserved = pendingWithdrawals._sum.amount
    ? decimalToNumber(pendingWithdrawals._sum.amount)
    : 0;
  return balance - reserved;
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function mapPayRow(
  tx: {
    id: string;
    referenceCode: string;
    amount: { toString(): string };
    memo: string | null;
    createdAt: Date;
    description: string;
    bankAccount?: { accountName: string };
  },
  direction: "sent" | "received",
  payerLabel: string,
  payeeLabel: string,
  sourceAccountName: string | null,
): AltaPayPaymentRow {
  const baseRef = tx.referenceCode.replace(/-(OUT|IN)$/, "");
  return {
    id: tx.id,
    referenceCode: baseRef,
    amount: decimalToNumber(tx.amount),
    memo: tx.memo,
    createdAt: tx.createdAt.toISOString(),
    direction,
    payerLabel,
    payeeLabel,
    sourceAccountName,
  };
}

export async function searchPayableCompanies(query: string): Promise<PayableCompany[]> {
  const q = query.trim();

  const companies = await prisma.company.findMany({
    where: {
      verificationStatus: "VERIFIED",
      bankAccounts: {
        some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
      },
      ...(q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sector: { contains: q, mode: "insensitive" } },
              { ticker: { contains: q.toUpperCase(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return companies.map((company) => {
    const account = company.bankAccounts[0]!;
    return {
      id: company.id,
      name: company.name,
      sector: company.sector,
      ticker: company.ticker,
      verificationStatus: "verified" as const,
      destinationAccountName: account.accountName,
      destinationLabel: `${company.name} · Business Operating Account`,
    };
  });
}

export async function listPaySourceAccounts(user: AltaUser) {
  const manageCompanyIds = user.companyMemberships
    .filter((m) => canManageBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);

  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { userId: user.id, companyId: null },
        ...(manageCompanyIds.length > 0
          ? [
              {
                companyId: { in: manageCompanyIds },
                accountType: "BUSINESS_OPERATING" as const,
              },
            ]
          : []),
      ],
    },
    include: {
      company: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ companyId: "asc" }, { createdAt: "asc" }],
  });

  const { mapUserBankAccount } = await import("@/server/bank-mapper");
  return accounts.map((a) => mapUserBankAccount(a));
}

/** @deprecated Use listPaySourceAccounts */
export async function listPersonalPaySourceAccounts(userId: string) {
  const { mapDbUserToAltaUser, userWithMembershipsInclude } = await import("@/server/user-mapper");
  const record = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!record) notFound();
  return listPaySourceAccounts(mapDbUserToAltaUser(record));
}

async function resolvePaySourceAccount(user: AltaUser, fromAccountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: fromAccountId },
    include: { user: true, company: true },
  });
  if (!account) badRequest("Select a valid Alta Bank account.");
  if (account.status !== "ACTIVE") {
    badRequest("Source account must be active to send Alta Pay payments.");
  }

  if (account.companyId === null) {
    if (account.userId !== user.id) forbidden();
    return { account, payerLabel: account.user.discordUsername };
  }

  if (account.accountType !== "BUSINESS_OPERATING") {
    badRequest("Alta Pay may only be funded from personal accounts or Business Operating Accounts.");
  }
  if (!canManageBusinessTreasury(user, { companyId: account.companyId })) {
    forbidden();
  }

  return { account, payerLabel: account.company?.name ?? account.accountName };
}

async function listPaySourceAccountIds(user: AltaUser): Promise<string[]> {
  const accounts = await listPaySourceAccounts(user);
  return accounts.map((a) => a.id);
}

/**
 * Submit Alta Pay — instant intrabank settlement to a verified company's operating account.
 *
 * TODO: business payment links — shareable URLs that prefill payee + amount
 * TODO: QR codes — scan-to-pay at in-game storefronts
 * TODO: invoices — structured payment requests with line items
 * TODO: refunds — operator or merchant-initiated reversal flow
 * TODO: customer receipts — email/PDF receipt after payment
 * TODO: Discord payment notifications — webhook on PAY settlement
 */
export async function submitAltaPayPayment(
  user: AltaUser,
  input: SubmitAltaPayInput,
): Promise<SubmitAltaPayResult> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");

  const { account: sourceAccount, payerLabel } = await resolvePaySourceAccount(
    user,
    input.fromAccountId,
  );

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Company is not available for Alta Pay.");
  }
  const destination = company.bankAccounts[0];
  if (!destination) {
    badRequest("This company does not have an active Business Operating Account.");
  }
  if (destination.id === sourceAccount.id) {
    badRequest("Cannot pay your own account through Alta Pay.");
  }
  if (sourceAccount.companyId && sourceAccount.companyId === company.id) {
    badRequest("Cannot pay your own company through Alta Pay from its operating account.");
  }

  const available = await getAvailableBalance(sourceAccount.id);
  if (input.amount > available) badRequest("Insufficient balance for this payment.");

  const referenceBase = generatePayReferenceBase();
  const outReference = `${referenceBase}-OUT`;
  const inReference = `${referenceBase}-IN`;
  const memo = input.memo?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.bankAccount.update({
      where: { id: sourceAccount.id },
      data: { balance: { decrement: input.amount } },
    });
    await tx.bankAccount.update({
      where: { id: destination.id },
      data: { balance: { increment: input.amount } },
    });

    await tx.bankTransaction.create({
      data: {
        bankAccountId: sourceAccount.id,
        type: "WITHDRAWAL",
        amount: input.amount,
        status: "APPROVED",
        description: `Alta Pay business payment to ${company.name}`,
        memo,
        referenceCode: outReference,
        proofImageUrl: null,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankAccountId: destination.id,
        type: "DEPOSIT",
        amount: input.amount,
        status: "APPROVED",
        description: `Alta Pay business payment from ${payerLabel}`,
        memo,
        referenceCode: inReference,
        proofImageUrl: null,
      },
    });
  });

  return {
    referenceCode: referenceBase,
    amount: input.amount,
    companyName: company.name,
  };
}

export async function listUserAltaPaySent(user: AltaUser, limit = 25): Promise<AltaPayPaymentRow[]> {
  const sourceAccountIds = await listPaySourceAccountIds(user);
  if (sourceAccountIds.length === 0) return [];

  const txs = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: { in: sourceAccountIds },
      type: "WITHDRAWAL",
      status: "APPROVED",
      referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-OUT" },
    },
    include: { bankAccount: { include: { company: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return txs.map((tx) => {
    const payee = tx.description.replace(/^Alta Pay business payment to /, "");
    const payer =
      tx.bankAccount.companyId && tx.bankAccount.company
        ? tx.bankAccount.company.name
        : "You";
    return mapPayRow(tx, "sent", payer, payee, tx.bankAccount.accountName);
  });
}

export async function listCompanyAltaPayReceived(
  user: AltaUser,
  companyId: string,
): Promise<AltaPayReceivedSummary> {
  if (!canViewAltaPayReceived(user, { companyId })) forbidden();

  const operating = await prisma.bankAccount.findFirst({
    where: { companyId, accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
  });
  if (!operating) {
    return { totalThisMonth: 0, paymentCountThisMonth: 0, recentPayments: [] };
  }

  const monthStart = startOfUtcMonth();
  const received = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: operating.id,
      type: "DEPOSIT",
      status: "APPROVED",
      referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-IN" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const monthReceived = received.filter((tx) => tx.createdAt >= monthStart);
  const totalThisMonth = monthReceived.reduce((sum, tx) => sum + decimalToNumber(tx.amount), 0);

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const recentPayments = received.slice(0, 20).map((tx) => {
    const payer = tx.description.replace(/^Alta Pay business payment from /, "");
    return mapPayRow(
      tx,
      "received",
      payer,
      company?.name ?? "Company",
      null,
    );
  });

  return {
    totalThisMonth,
    paymentCountThisMonth: monthReceived.length,
    recentPayments,
  };
}

export async function getAltaPayVolumeSummary(): Promise<AltaPayVolumeSummary> {
  const monthStart = startOfUtcMonth();
  const txs = await prisma.bankTransaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "APPROVED",
      referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-IN" },
      createdAt: { gte: monthStart },
    },
    select: { amount: true },
  });

  return {
    countThisMonth: txs.length,
    volumeThisMonth: txs.reduce((sum, tx) => sum + decimalToNumber(tx.amount), 0),
  };
}
