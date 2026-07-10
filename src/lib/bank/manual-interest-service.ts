import { randomBytes } from "node:crypto";
import type { BankAccount, BankAccountType, Prisma } from "@prisma/client";
import type { BankAccountStatusCode, BankAccountTypeCode } from "@/lib/bank/backend-types";
import {
  formatBankAccountTypeLabel,
} from "@/lib/bank/backend-types";
import { roundCurrency } from "@/lib/bank/account-interest-service";
import {
  accountInterestPaymentDescription,
  type InterestPaymentBasis,
} from "@/lib/bank/customer-transaction-copy";
import type {
  ManualInterestApplicationInput,
  ManualInterestApplyAccountResult,
  ManualInterestApplyResult,
  ManualInterestCategoryCode,
  ManualInterestPreviewAccountRow,
  ManualInterestPreviewResult,
} from "@/lib/bank/manual-interest-types";
import { MANUAL_INTEREST_CATEGORY_OPTIONS } from "@/lib/bank/manual-interest-types";
import { fromDbBankAccountStatus, fromDbBankAccountType, toDbBankAccountType } from "@/server/bank-mapper";
import { prisma } from "@/server/db";

const ALL_ELIGIBLE_TYPES: BankAccountTypeCode[] = [
  "alta_access",
  "checking",
  "savings",
  "money_market",
  "business_operating",
  "reserve",
  "private",
];

type AccountRecord = BankAccount & {
  user: { discordUsername: string };
  company: { name: string } | null;
};

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function formatStatusLabel(status: BankAccountStatusCode): string {
  if (status === "pending") return "Pending Review";
  if (status === "active") return "Active";
  if (status === "frozen") return "Frozen";
  return "Closed";
}

function ownerLabelForAccount(account: AccountRecord): string {
  return account.company?.name
    ? `${account.user.discordUsername} · ${account.company.name}`
    : account.user.discordUsername;
}

export function generateManualInterestBatchReference(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `MI-${date}-${suffix}`;
}

function generateManualInterestTransactionReference(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INT-${date}-${suffix}`;
}

function resolveSelectedTypes(input: ManualInterestApplicationInput): BankAccountTypeCode[] {
  if (input.accountTypes.includes("all")) {
    return ALL_ELIGIBLE_TYPES;
  }
  return input.accountTypes.filter((type): type is BankAccountTypeCode => type !== "all");
}

function selectedCategoryLabels(input: ManualInterestApplicationInput): string[] {
  if (input.accountTypes.includes("all")) {
    return ["All Categories"];
  }
  return input.accountTypes
    .filter((type): type is BankAccountTypeCode => type !== "all")
    .map((type) => formatBankAccountTypeLabel(type));
}

function validateInput(input: ManualInterestApplicationInput): void {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new Error("BAD_REQUEST:Reason is required");
  }

  if (!input.accountTypes.length) {
    throw new Error("BAD_REQUEST:Select at least one account category");
  }

  if (input.mode === "PERCENTAGE") {
    if (input.percentageRate == null || input.percentageRate <= 0) {
      throw new Error("BAD_REQUEST:Percentage rate must be greater than zero");
    }
  } else if (input.mode === "FIXED_AMOUNT") {
    if (input.fixedAmount == null || input.fixedAmount <= 0) {
      throw new Error("BAD_REQUEST:Fixed amount must be greater than zero");
    }
  } else {
    throw new Error("BAD_REQUEST:Invalid application mode");
  }
}

function splitFixedAmountAmongAccounts(totalAmount: number, recipientCount: number): number[] {
  if (recipientCount <= 0) return [];

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / recipientCount);
  const remainderCents = totalCents - baseCents * recipientCount;

  return Array.from({ length: recipientCount }, (_, index) =>
    (baseCents + (index < remainderCents ? 1 : 0)) / 100,
  );
}

function evaluateAccount(
  account: AccountRecord,
  input: ManualInterestApplicationInput,
): ManualInterestPreviewAccountRow {
  const accountType = fromDbBankAccountType(account.accountType);
  const status = fromDbBankAccountStatus(account.status);
  const currentBalance = decimalToNumber(account.balance);

  let eligible = true;
  let skipReason: string | undefined;

  if (status !== "active") {
    eligible = false;
    skipReason = `Account status is ${formatStatusLabel(status)}`;
  } else if (currentBalance <= 0) {
    eligible = false;
    skipReason = "Balance must be greater than zero";
  }

  let interestCredit = 0;
  if (eligible && input.mode === "PERCENTAGE") {
    interestCredit = roundCurrency(currentBalance * ((input.percentageRate ?? 0) / 100));
    if (interestCredit <= 0) {
      eligible = false;
      skipReason = "Calculated interest is zero";
      interestCredit = 0;
    }
  }

  return {
    accountId: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ownerLabel: ownerLabelForAccount(account),
    accountType,
    accountTypeLabel: formatBankAccountTypeLabel(accountType),
    status,
    statusLabel: formatStatusLabel(status),
    currentBalance,
    interestCredit,
    projectedBalance: roundCurrency(currentBalance + interestCredit),
    eligible,
    skipReason,
  };
}

function finalizeFixedAmountCredits(
  rows: ManualInterestPreviewAccountRow[],
  totalFixedAmount: number,
): ManualInterestPreviewAccountRow[] {
  const eligibleRows = rows.filter((row) => row.eligible);
  const splits = splitFixedAmountAmongAccounts(totalFixedAmount, eligibleRows.length);
  let splitIndex = 0;

  return rows.map((row) => {
    if (!row.eligible) return row;

    const interestCredit = splits[splitIndex] ?? 0;
    splitIndex += 1;

    if (interestCredit <= 0) {
      return {
        ...row,
        eligible: false,
        skipReason: "Allocated share is zero",
        interestCredit: 0,
        projectedBalance: row.currentBalance,
      };
    }

    return {
      ...row,
      interestCredit,
      projectedBalance: roundCurrency(row.currentBalance + interestCredit),
    };
  });
}

function buildPreviewRows(
  accounts: AccountRecord[],
  input: ManualInterestApplicationInput,
): ManualInterestPreviewAccountRow[] {
  const evaluated = accounts.map((account) => evaluateAccount(account, input));
  if (input.mode === "FIXED_AMOUNT") {
    return finalizeFixedAmountCredits(evaluated, input.fixedAmount ?? 0);
  }
  return evaluated;
}

async function fetchCandidateAccounts(
  input: ManualInterestApplicationInput,
): Promise<AccountRecord[]> {
  const selectedTypes = resolveSelectedTypes(input);
  const dbTypes = selectedTypes.map((type) => toDbBankAccountType(type));

  return prisma.bankAccount.findMany({
    where: {
      accountType: { in: dbTypes as BankAccountType[] },
      status: "ACTIVE",
    },
    include: {
      user: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
    orderBy: [{ accountType: "asc" }, { accountName: "asc" }],
  });
}

export async function previewManualInterestApplication(
  input: ManualInterestApplicationInput,
): Promise<ManualInterestPreviewResult> {
  validateInput(input);

  const accounts = await fetchCandidateAccounts(input);
  const evaluated = buildPreviewRows(accounts, input);
  const eligibleRows = evaluated.filter((row) => row.eligible);
  const skippedRows = evaluated.filter((row) => !row.eligible);

  const totalBalancesAffected = roundCurrency(
    eligibleRows.reduce((sum, row) => sum + row.currentBalance, 0),
  );
  const totalInterestToCredit = roundCurrency(
    eligibleRows.reduce((sum, row) => sum + row.interestCredit, 0),
  );

  return {
    mode: input.mode,
    selectedCategoryLabels: selectedCategoryLabels(input),
    affectedAccountCount: eligibleRows.length,
    skippedAccountCount: skippedRows.length,
    totalBalancesAffected,
    totalInterestToCredit,
    estimatedAverageCredit:
      eligibleRows.length > 0
        ? roundCurrency(totalInterestToCredit / eligibleRows.length)
        : 0,
    accounts: eligibleRows,
    skippedAccounts: skippedRows,
  };
}

async function findExistingBatch(idempotencyKey: string): Promise<ManualInterestApplyResult | null> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "MANUAL_INTEREST_APPLIED",
      entityId: idempotencyKey,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!existing?.metadata || typeof existing.metadata !== "object") return null;

  const metadata = existing.metadata as Record<string, unknown>;
  if (typeof metadata.batchReferenceId !== "string") return null;

  return {
    batchReferenceId: metadata.batchReferenceId,
    processedCount: Number(metadata.processedCount ?? 0),
    skippedCount: Number(metadata.skippedCount ?? 0),
    failedCount: Number(metadata.failedCount ?? 0),
    totalInterestCredited: Number(metadata.totalInterestCredited ?? 0),
    results: Array.isArray(metadata.results)
      ? (metadata.results as ManualInterestApplyAccountResult[])
      : [],
    idempotentReplay: true,
  };
}

function buildTransactionDescription(
  accountTypeLabel: string,
  input: ManualInterestApplicationInput,
): string {
  const basis: InterestPaymentBasis =
    input.mode === "FIXED_AMOUNT"
      ? { mode: "fixed" }
      : { mode: "percentage", ratePercent: input.percentageRate ?? 0 };
  return accountInterestPaymentDescription(accountTypeLabel, basis);
}

function buildTransactionMemo(
  batchReferenceId: string,
  input: ManualInterestApplicationInput,
): string {
  const parts = [`Batch: ${batchReferenceId}`, `Reason: ${input.reason.trim()}`];
  const note = input.internalNote?.trim();
  if (note) parts.push(`Note: ${note}`);
  return parts.join(" | ");
}

export async function applyManualInterestApplication(
  input: ManualInterestApplicationInput,
  actorUserId: string,
): Promise<ManualInterestApplyResult> {
  validateInput(input);

  if (input.idempotencyKey) {
    const existing = await findExistingBatch(input.idempotencyKey);
    if (existing) return existing;
  }

  const preview = await previewManualInterestApplication(input);
  const batchReferenceId = generateManualInterestBatchReference();
  const memo = buildTransactionMemo(batchReferenceId, input);
  const now = new Date();

  const results: ManualInterestApplyAccountResult[] = [];
  let processedCount = 0;
  const skippedCount = preview.skippedAccountCount;
  let failedCount = 0;
  let totalInterestCredited = 0;

  for (const skipped of preview.skippedAccounts) {
    results.push({
      accountId: skipped.accountId,
      accountNumber: skipped.accountNumber,
      status: "skipped",
      reason: skipped.skipReason,
    });
  }

  for (const row of preview.accounts) {
    const referenceCode = generateManualInterestTransactionReference();
    const credit = row.interestCredit;
    try {
      const account = await prisma.bankAccount.findUnique({
        where: { id: row.accountId },
        include: {
          user: { select: { discordUsername: true } },
          company: { select: { name: true } },
        },
      });
      if (!account) {
        failedCount += 1;
        results.push({
          accountId: row.accountId,
          accountNumber: row.accountNumber,
          status: "failed",
          reason: "Account not found during apply",
        });
        continue;
      }

      const transaction = await prisma.$transaction(async (tx) => {
        const current = await tx.bankAccount.findUnique({ where: { id: row.accountId } });
        if (!current || current.status !== "ACTIVE") {
          throw new Error("INELIGIBLE");
        }

        const balance = decimalToNumber(current.balance);
        if (credit <= 0) throw new Error("ZERO_CREDIT");
        if (balance <= 0) throw new Error("INELIGIBLE");

        if (input.mode === "PERCENTAGE") {
          const expected = roundCurrency(balance * ((input.percentageRate ?? 0) / 100));
          if (expected !== credit) throw new Error("CREDIT_CHANGED");
        }

        const created = await tx.bankTransaction.create({
          data: {
            bankAccountId: row.accountId,
            type: "INTEREST_CREDIT",
            amount: credit,
            status: "APPROVED",
            description: buildTransactionDescription(row.accountTypeLabel, input),
            memo,
            referenceCode,
            reviewedById: actorUserId,
            reviewedAt: now,
            reviewNote: input.reason.trim(),
          },
        });

        await tx.bankAccount.update({
          where: { id: row.accountId },
          data: { balance: { increment: credit } },
        });

        return created;
      });

      processedCount += 1;
      totalInterestCredited = roundCurrency(totalInterestCredited + row.interestCredit);
      results.push({
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        status: "processed",
        interestAmount: row.interestCredit,
        transactionId: transaction.id,
        referenceCode: transaction.referenceCode,
      });

      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId,
        action: "MANUAL_INTEREST_ACCOUNT_CREDITED",
        entityType: "BANK_ACCOUNT",
        entityId: row.accountId,
        targetUserId: account.userId,
        targetAccountId: row.accountId,
        targetTransactionId: transaction.id,
        description: `Manual interest credit ${row.interestCredit} on ${row.accountNumber}`,
        metadata: {
          batchReferenceId,
          mode: input.mode,
          percentageRate: input.percentageRate ?? null,
          interestAmount: row.interestCredit,
          referenceCode: transaction.referenceCode,
          reason: input.reason.trim(),
        },
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        accountId: row.accountId,
        accountNumber: row.accountNumber,
        status: "failed",
        reason: error instanceof Error ? error.message : "Apply failed",
      });
    }
  }

  totalInterestCredited = roundCurrency(totalInterestCredited);

  const applyResult: ManualInterestApplyResult = {
    batchReferenceId,
    processedCount,
    skippedCount,
    failedCount,
    totalInterestCredited,
    results,
  };

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "MANUAL_INTEREST_APPLIED",
    entityType: "BANK_TRANSACTION",
    entityId: input.idempotencyKey ?? batchReferenceId,
    description: `Manual interest batch ${batchReferenceId} credited ${totalInterestCredited} across ${processedCount} account(s)`,
    metadata: {
      batchReferenceId,
      mode: input.mode,
      selectedAccountCategories: selectedCategoryLabels(input),
      percentageRate: input.percentageRate ?? null,
      fixedAmount: input.fixedAmount ?? null,
      affectedAccountCount: processedCount,
      skippedCount,
      failedCount,
      totalInterestCredited,
      reason: input.reason.trim(),
      internalNote: input.internalNote?.trim() ?? null,
      results: results.slice(0, 200),
    } satisfies Prisma.JsonObject,
  });

  return applyResult;
}

export async function logManualInterestPreviewed(
  actorUserId: string,
  input: ManualInterestApplicationInput,
  preview: ManualInterestPreviewResult,
): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "MANUAL_INTEREST_PREVIEWED",
    entityType: "BANK_ACCOUNT",
    description: `Previewed manual interest for ${preview.affectedAccountCount} account(s)`,
    metadata: {
      mode: input.mode,
      selectedAccountCategories: preview.selectedCategoryLabels,
      percentageRate: input.percentageRate ?? null,
      fixedAmount: input.fixedAmount ?? null,
      affectedAccountCount: preview.affectedAccountCount,
      skippedAccountCount: preview.skippedAccountCount,
      totalInterestToCredit: preview.totalInterestToCredit,
      reason: input.reason.trim(),
    },
  });
}

export { MANUAL_INTEREST_CATEGORY_OPTIONS };
