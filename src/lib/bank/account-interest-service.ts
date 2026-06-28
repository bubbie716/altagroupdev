import { randomBytes } from "node:crypto";
import type { BankAccount, BankAccountStatus, BankAccountType, InterestRatePeriod } from "@prisma/client";
import type { BankAccountTypeCode, AccountInterestInfo } from "@/lib/bank/backend-types";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import {
  accountInterestPaymentDescription,
  monthlyDecimalRateToPercent,
  type InterestPaymentBasis,
} from "@/lib/bank/customer-transaction-copy";
import { fromDbBankAccountType } from "@/server/bank-mapper";
import { prisma } from "@/server/db";

export interface DefaultInterestSettings {
  interestAccrualEnabled: boolean;
  interestRate: number;
  interestRatePeriod: InterestRatePeriod | null;
}

export interface AccountInterestPreview {
  accountId: string;
  accountNumber: string;
  balance: number;
  interestRate: number;
  rateLabel: string;
  estimatedInterest: number;
  nextInterestAccrualAt: string | null;
  eligible: boolean;
  ineligibleReason?: string;
}

export interface AccountInterestDueRow {
  accountId: string;
  accountNumber: string;
  accountName: string;
  holder: string;
  balance: number;
  interestRate: number;
  rateLabel: string;
  nextInterestAccrualAt: string;
  estimatedInterest: number;
}

export interface AccountInterestOpsSummary {
  dueAccountCount: number;
  interestBearingActiveCount: number;
  estimatedTotalInterestDue: number;
  lastInterestRunAt: string | null;
  totalInterestCreditedThisMonth: number;
  dueAccounts: AccountInterestDueRow[];
}

export interface AccountInterestAccrualResult {
  status: "processed" | "skipped" | "failed";
  accountId: string;
  interestAmount?: number;
  transactionId?: string;
  referenceCode?: string;
  reason?: string;
}

export interface AccountInterestBatchResult {
  eligibleCount: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  totalInterestCredited: number;
  results: AccountInterestAccrualResult[];
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatMonthlyInterestRateLabel(rate: number): string {
  const percent = rate * 100;
  const formatted =
    percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}% monthly`;
}

export function getDefaultInterestSettingsForAccountType(
  accountType: BankAccountTypeCode,
): DefaultInterestSettings {
  switch (accountType) {
    case "savings":
      return { interestAccrualEnabled: true, interestRate: 0.005, interestRatePeriod: "MONTHLY" };
    case "money_market":
      return { interestAccrualEnabled: true, interestRate: 0.0085, interestRatePeriod: "MONTHLY" };
    case "private":
      return { interestAccrualEnabled: true, interestRate: 0.011, interestRatePeriod: "MONTHLY" };
    default:
      return { interestAccrualEnabled: false, interestRate: 0, interestRatePeriod: null };
  }
}

export function buildInterestInitializationData(
  accountType: BankAccountTypeCode,
  status: BankAccountStatus,
  createdAt: Date,
): {
  interestRate: number;
  interestRatePeriod: InterestRatePeriod | null;
  interestAccrualEnabled: boolean;
  nextInterestAccrualAt: Date | null;
} {
  const settings = getDefaultInterestSettingsForAccountType(accountType);
  return {
    interestRate: settings.interestRate,
    interestRatePeriod: settings.interestRatePeriod,
    interestAccrualEnabled: settings.interestAccrualEnabled,
    nextInterestAccrualAt:
      settings.interestAccrualEnabled && status === "ACTIVE"
        ? addMonths(createdAt, 1)
        : null,
  };
}

export function initializeInterestSettingsForAccount(account: {
  accountType: BankAccountType;
  status: BankAccountStatus;
  createdAt: Date;
}): ReturnType<typeof buildInterestInitializationData> {
  const accountType = fromDbBankAccountType(account.accountType);
  return buildInterestInitializationData(accountType, account.status, account.createdAt);
}

export function calculateInterestAmount(balance: number, monthlyRate: number): number {
  return roundCurrency(balance * monthlyRate);
}

function generateInterestReferenceCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INT-${date}-${suffix}`;
}

function validateAccountForAccrual(account: BankAccount): { ok: true } | { ok: false; reason: string } {
  if (account.status !== "ACTIVE") {
    return { ok: false, reason: "Account must be active" };
  }
  if (!account.interestAccrualEnabled) {
    return { ok: false, reason: "Interest accrual is not enabled for this account" };
  }
  if (decimalToNumber(account.balance) <= 0) {
    return { ok: false, reason: "Account balance must be greater than zero" };
  }
  if (!account.nextInterestAccrualAt) {
    return { ok: false, reason: "No interest accrual date scheduled" };
  }
  if (account.nextInterestAccrualAt > new Date()) {
    return { ok: false, reason: "Interest is not yet due" };
  }
  return { ok: true };
}

export async function previewInterestForAccount(accountId: string): Promise<AccountInterestPreview> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { user: true, company: true },
  });
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  const balance = decimalToNumber(account.balance);
  const rate = decimalToNumber(account.interestRate);
  const validation = validateAccountForAccrual(account);

  return {
    accountId: account.id,
    accountNumber: account.accountNumber,
    balance,
    interestRate: rate,
    rateLabel: formatMonthlyInterestRateLabel(rate),
    estimatedInterest: calculateInterestAmount(balance, rate),
    nextInterestAccrualAt: account.nextInterestAccrualAt?.toISOString() ?? null,
    eligible: validation.ok,
    ineligibleReason: validation.ok ? undefined : validation.reason,
  };
}

export async function getInterestEligibleAccounts(): Promise<BankAccount[]> {
  const now = new Date();
  return prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      interestAccrualEnabled: true,
      balance: { gt: 0 },
      nextInterestAccrualAt: { lte: now },
    },
    include: { user: true, company: true },
    orderBy: { nextInterestAccrualAt: "asc" },
  });
}

function mapDueRow(account: BankAccount & { user: { discordUsername: string }; company: { name: string } | null }): AccountInterestDueRow {
  const balance = decimalToNumber(account.balance);
  const rate = decimalToNumber(account.interestRate);
  return {
    accountId: account.id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    holder: account.company?.name ?? account.user.discordUsername,
    balance,
    interestRate: rate,
    rateLabel: formatMonthlyInterestRateLabel(rate),
    nextInterestAccrualAt: account.nextInterestAccrualAt!.toISOString(),
    estimatedInterest: calculateInterestAmount(balance, rate),
  };
}

export async function getAccountInterestOpsSummary(): Promise<AccountInterestOpsSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dueAccounts, interestBearingActiveCount, lastRun, monthCredits] = await Promise.all([
    getInterestEligibleAccounts(),
    prisma.bankAccount.count({
      where: { status: "ACTIVE", interestAccrualEnabled: true },
    }),
    prisma.bankInterestAccrual.findFirst({
      where: { status: "PROCESSED", processedAt: { not: null } },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    prisma.bankInterestAccrual.aggregate({
      where: {
        status: "PROCESSED",
        processedAt: { gte: monthStart },
      },
      _sum: { interestAmount: true },
    }),
  ]);

  const dueRows = dueAccounts.map(mapDueRow);
  const estimatedTotalInterestDue = dueRows.reduce((sum, row) => sum + row.estimatedInterest, 0);

  return {
    dueAccountCount: dueRows.length,
    interestBearingActiveCount,
    estimatedTotalInterestDue,
    lastInterestRunAt: lastRun?.processedAt?.toISOString() ?? null,
    totalInterestCreditedThisMonth: monthCredits._sum.interestAmount
      ? decimalToNumber(monthCredits._sum.interestAmount)
      : 0,
    dueAccounts: dueRows,
  };
}

export function buildAccountInterestInfo(
  account: BankAccount,
  lastInterestCredit?: { createdAt: Date; amount: { toString(): string } } | null,
): AccountInterestInfo {
  if (!account.interestAccrualEnabled) {
    return { applicable: false };
  }

  return {
    applicable: true,
    lastInterestDate: lastInterestCredit?.createdAt.toISOString() ?? null,
    lastInterestAmount: lastInterestCredit ? decimalToNumber(lastInterestCredit.amount) : null,
  };
}

export async function accrueInterestForAccount(
  accountId: string,
  actorUserId?: string,
): Promise<AccountInterestAccrualResult> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    return { status: "failed", accountId, reason: "Account not found" };
  }

  const validation = validateAccountForAccrual(account);
  if (!validation.ok) {
    return { status: "skipped", accountId, reason: validation.reason };
  }

  const balance = decimalToNumber(account.balance);
  const rate = decimalToNumber(account.interestRate);
  const periodEnd = account.nextInterestAccrualAt!;
  const periodStart = account.lastInterestAccruedAt ?? account.createdAt;
  const interestAmount = calculateInterestAmount(balance, rate);

  if (interestAmount <= 0) {
    return { status: "skipped", accountId, reason: "Calculated interest is zero" };
  }

  const existing = await prisma.bankInterestAccrual.findUnique({
    where: {
      bankAccountId_periodStart_periodEnd: {
        bankAccountId: accountId,
        periodStart,
        periodEnd,
      },
    },
  });
  if (existing?.status === "PROCESSED") {
    return { status: "skipped", accountId, reason: "Interest already accrued for this period" };
  }

  const referenceCode = generateInterestReferenceCode();
  const processedAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.bankInterestAccrual.findUnique({
        where: {
          bankAccountId_periodStart_periodEnd: {
            bankAccountId: accountId,
            periodStart,
            periodEnd,
          },
        },
      });
      if (duplicate?.status === "PROCESSED") {
        throw new Error("DUPLICATE_PERIOD");
      }

      const accrual =
        duplicate ??
        (await tx.bankInterestAccrual.create({
          data: {
            bankAccountId: accountId,
            periodStart,
            periodEnd,
            interestRate: rate,
            openingBalance: balance,
            interestAmount: 0,
            status: "PENDING",
          },
        }));

      const transaction = await tx.bankTransaction.create({
        data: {
          bankAccountId: accountId,
          type: "INTEREST_CREDIT",
          amount: interestAmount,
          status: "APPROVED",
          description: accountInterestPaymentDescription(
            formatBankAccountTypeLabel(fromDbBankAccountType(account.accountType)),
            {
              mode: "percentage",
              ratePercent: monthlyDecimalRateToPercent(rate),
            },
          ),
          referenceCode,
          reviewedById: actorUserId ?? null,
          reviewedAt: processedAt,
        },
      });

      await tx.bankAccount.update({
        where: { id: accountId },
        data: {
          balance: { increment: interestAmount },
          lastInterestAccruedAt: periodEnd,
          nextInterestAccrualAt: addMonths(periodEnd, 1),
        },
      });

      await tx.bankInterestAccrual.update({
        where: { id: accrual.id },
        data: {
          status: "PROCESSED",
          interestAmount,
          openingBalance: balance,
          interestRate: rate,
          bankTransactionId: transaction.id,
          processedAt,
          processedById: actorUserId ?? null,
          failureReason: null,
        },
      });

      return { transactionId: transaction.id, referenceCode };
    });

    if (actorUserId) {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId,
        action: "ACCOUNT_INTEREST_ACCRUED",
        entityType: "BANK_ACCOUNT",
        entityId: accountId,
        targetUserId: account.userId,
        targetAccountId: accountId,
        targetTransactionId: result.transactionId,
        description: `Credited ${interestAmount} interest on account ${account.accountNumber}`,
        metadata: {
          interestAmount,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          referenceCode: result.referenceCode,
        },
      });
    }

    return {
      status: "processed",
      accountId,
      interestAmount,
      transactionId: result.transactionId,
      referenceCode: result.referenceCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accrual failed";
    if (message === "DUPLICATE_PERIOD") {
      return { status: "skipped", accountId, reason: "Interest already accrued for this period" };
    }

    await prisma.bankInterestAccrual.upsert({
      where: {
        bankAccountId_periodStart_periodEnd: {
          bankAccountId: accountId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        bankAccountId: accountId,
        periodStart,
        periodEnd,
        interestRate: rate,
        openingBalance: balance,
        interestAmount: 0,
        status: "FAILED",
        processedAt: new Date(),
        processedById: actorUserId ?? null,
        failureReason: message,
      },
      update: {
        status: "FAILED",
        processedAt: new Date(),
        processedById: actorUserId ?? null,
        failureReason: message,
      },
    });

    return { status: "failed", accountId, reason: message };
  }
}

export async function accrueInterestForDueAccounts(
  actorUserId?: string,
): Promise<AccountInterestBatchResult> {
  const eligible = await getInterestEligibleAccounts();
  const results: AccountInterestAccrualResult[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalInterestCredited = 0;

  for (const account of eligible) {
    const result = await accrueInterestForAccount(account.id, actorUserId);
    results.push(result);
    if (result.status === "processed") {
      processedCount += 1;
      totalInterestCredited += result.interestAmount ?? 0;
    } else if (result.status === "skipped") {
      skippedCount += 1;
    } else {
      failedCount += 1;
    }
  }

  if (actorUserId && (processedCount > 0 || failedCount > 0)) {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId,
      action: "ACCOUNT_INTEREST_BATCH_RUN",
      entityType: "BANK_ACCOUNT",
      description: `Batch interest accrual: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed`,
      metadata: {
        eligibleCount: eligible.length,
        processedCount,
        skippedCount,
        failedCount,
        totalInterestCredited,
      },
    });
  }

  return {
    eligibleCount: eligible.length,
    processedCount,
    skippedCount,
    failedCount,
    totalInterestCredited,
    results,
  };
}

export async function ensureInterestScheduleOnActivation(accountId: string): Promise<void> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.status !== "ACTIVE" || !account.interestAccrualEnabled) return;
  if (account.nextInterestAccrualAt) return;

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: { nextInterestAccrualAt: addMonths(new Date(), 1) },
  });
}
