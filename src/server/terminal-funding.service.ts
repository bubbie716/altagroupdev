/**
 * Authoritative Alta Bank ↔ Alta Terminal funding transfers.
 * Moves Alta-owned internal balances only — never TSE custody.
 */
import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import type {
  SubmitTerminalFundingTransferInput,
  TerminalFundingEligibility,
  TerminalFundingReceipt,
  TerminalFundingTransferRow,
} from "@/lib/terminal/terminal-funding-types";
import { emitTerminalFundingDomainEvent } from "@/lib/terminal/terminal-funding-events";
import { prisma } from "@/server/db";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function forbidden(message = "Not authorized"): never {
  throw new Error(`FORBIDDEN:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function generateFundingReferenceCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TFD-${date}-${suffix}`;
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    badRequest("Enter an amount greater than zero.");
  }
  const normalized = Math.round(amount * 100) / 100;
  if (Math.abs(amount - normalized) > 1e-9) {
    badRequest("Amount must use at most two decimal places.");
  }
  if (normalized > 50_000_000) {
    badRequest("Amount exceeds the maximum allowed for a single transfer.");
  }
  return normalized;
}

function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  const last = digits.slice(-4) || accountNumber.slice(-4);
  return `····${last}`;
}

function accountLabel(account: { accountName: string; accountNumber: string }): string {
  return `${account.accountName} · ${account.accountNumber}`;
}

async function lockTerminalCashAccount(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], portfolioId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalPortfolioCashAccount" WHERE "portfolioId" = ${portfolioId} FOR UPDATE`;
}

function ownersMatch(account: {
  ownershipType: "PERSONAL" | "COMPANY";
  userId: string;
  companyId: string | null;
}, portfolio: {
  ownerType: "PERSONAL" | "COMPANY";
  ownerUserId: string | null;
  ownerCompanyId: string | null;
}): boolean {
  if (account.ownershipType === "PERSONAL" && portfolio.ownerType === "PERSONAL") {
    return account.userId === portfolio.ownerUserId && !account.companyId && !portfolio.ownerCompanyId;
  }
  if (account.ownershipType === "COMPANY" && portfolio.ownerType === "COMPANY") {
    return Boolean(
      account.companyId &&
        portfolio.ownerCompanyId &&
        account.companyId === portfolio.ownerCompanyId,
    );
  }
  return false;
}

export async function listTerminalFundingEligibility(
  user: AltaUser,
): Promise<TerminalFundingEligibility> {
  const { bankAccountAccessWhere } = await import("@/server/bank-account-access.service");
  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  const { listAccessibleTerminalPortfolios } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );

  const accounts = await prisma.bankAccount.findMany({
    where: bankAccountAccessWhere(user, "manage"),
    orderBy: { createdAt: "asc" },
  });

  const accountRows = await Promise.all(
    accounts.map(async (account) => {
      const available = await getAccountAvailableBalance(account.id);
      let blockedReason: string | null = null;
      let canDebit = true;
      let canCredit = true;
      if (account.status !== "ACTIVE") {
        blockedReason = "This account is not active.";
        canDebit = false;
        canCredit = false;
      } else {
        if (account.restrictWithdrawals || account.restrictTransfers) {
          canDebit = false;
          blockedReason = blockedReason ?? "Withdrawals or transfers are restricted on this account.";
        }
        if (account.restrictDeposits) {
          canCredit = false;
          blockedReason = blockedReason ?? "Deposits are restricted on this account.";
        }
      }
      return {
        id: account.id,
        label: accountLabel(account),
        accountNumber: account.accountNumber,
        availableBalance: available,
        ownershipType: account.ownershipType,
        companyId: account.companyId,
        canDebit,
        canCredit,
        blockedReason,
      };
    }),
  );

  const portfolios = await listAccessibleTerminalPortfolios(user);
  const portfolioRows = await Promise.all(
    portfolios.map(async (p) => {
      const cash = await prisma.terminalPortfolioCashAccount.findUnique({
        where: { portfolioId: p.id },
        select: { availableCash: true },
      });
      const canFund = p.status === "active" && p.capabilities.canTrade;
      return {
        id: p.id,
        name: p.name,
        ownerType: p.ownerType,
        ownerCompanyId: p.ownerCompanyId,
        ownerUserId: p.ownerUserId,
        availableCash: cash ? decimalToNumber(cash.availableCash) : 0,
        canFund,
        blockedReason: canFund
          ? null
          : p.status !== "active"
            ? "This portfolio is archived."
            : "You are not authorized to fund this portfolio.",
      };
    }),
  );

  return { accounts: accountRows, portfolios: portfolioRows };
}

export async function submitTerminalFundingTransfer(
  user: AltaUser,
  input: SubmitTerminalFundingTransferInput,
): Promise<TerminalFundingReceipt> {
  const { beginFinancialIdempotency } = await import("@/server/financial-idempotency.service");
  const amount = normalizeAmount(input.amount);

  return beginFinancialIdempotency({
    userId: user.id,
    scope: "terminal_funding",
    idempotencyKey: input.idempotencyKey,
    payload: {
      direction: input.direction,
      bankAccountId: input.bankAccountId,
      portfolioId: input.portfolioId,
      amount,
      memo: input.memo?.trim() ?? null,
    },
    execute: () => executeTerminalFundingTransfer(user, { ...input, amount }),
  });
}

async function executeTerminalFundingTransfer(
  user: AltaUser,
  input: SubmitTerminalFundingTransferInput & { amount: number },
): Promise<TerminalFundingReceipt> {
  const { findAccessibleBankAccount } = await import("@/server/bank-account-access.service");
  const {
    getTerminalPortfolioRecordIncludingArchived,
    assertCanTradePortfolio,
    listAccessibleTerminalPortfolios,
  } = await import("@/lib/terminal/terminal-portfolio.service");

  if (input.direction !== "BANK_TO_TERMINAL" && input.direction !== "TERMINAL_TO_BANK") {
    badRequest("Choose a transfer direction.");
  }

  const bankAccount = await findAccessibleBankAccount(user.id, input.bankAccountId, "manage");
  if (!bankAccount) {
    forbidden("Bank account not found or access denied.");
  }
  const portfolioRecord = await getTerminalPortfolioRecordIncludingArchived(user, input.portfolioId);
  if (!portfolioRecord) {
    forbidden("Portfolio not found or access denied.");
  }
  if (portfolioRecord.status !== "active") {
    badRequest("This portfolio is archived and cannot receive or send funding.");
  }

  const summaries = await listAccessibleTerminalPortfolios(user);
  const portfolioSummary = summaries.find((p) => p.id === input.portfolioId);
  if (!portfolioSummary) {
    forbidden("Portfolio not found or access denied.");
  }
  assertCanTradePortfolio(user, portfolioSummary);

  if (
    !ownersMatch(
      {
        ownershipType: bankAccount.ownershipType,
        userId: bankAccount.userId,
        companyId: bankAccount.companyId,
      },
      {
        ownerType: portfolioRecord.ownerType === "personal" ? "PERSONAL" : "COMPANY",
        ownerUserId: portfolioRecord.ownerUserId,
        ownerCompanyId: portfolioRecord.ownerCompanyId,
      },
    )
  ) {
    badRequest("The Bank account and Terminal portfolio must belong to the same personal or company owner.");
  }

  if (bankAccount.status !== "ACTIVE") {
    badRequest("This transfer couldn't be completed because the Bank account is not active.");
  }

  if (input.direction === "BANK_TO_TERMINAL") {
    if (bankAccount.restrictWithdrawals || bankAccount.restrictTransfers) {
      badRequest("This transfer couldn't be completed because withdrawals or transfers are restricted on this Bank account.");
    }
  } else if (bankAccount.restrictDeposits) {
    badRequest("This transfer couldn't be completed because deposits are restricted on this Bank account.");
  }

  const referenceCode = generateFundingReferenceCode();
  const memo = input.memo?.trim() || null;
  const amount = input.amount;
  const now = new Date();

  let receipt: TerminalFundingReceipt;

  try {
    receipt = await prisma.$transaction(async (tx) => {
      const {
        assertAccountAvailableForDebitInTx,
        lockBankAccountRow,
        creditBankAccountInTx,
      } = await import("@/server/financial-integrity.service");

      await lockBankAccountRow(tx, bankAccount.id);

      // Ensure cash account exists, then lock it.
      let cashAccount = await tx.terminalPortfolioCashAccount.findUnique({
        where: { portfolioId: input.portfolioId },
      });
      if (!cashAccount) {
        cashAccount = await tx.terminalPortfolioCashAccount.create({
          data: {
            portfolioId: input.portfolioId,
            availableCash: 0,
            reservedCash: 0,
            currency: "FLORIN",
          },
        });
      }
      await lockTerminalCashAccount(tx, input.portfolioId);
      cashAccount = await tx.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: input.portfolioId },
      });

      const availableCash = decimalToNumber(cashAccount.availableCash);
      const reservedCash = decimalToNumber(cashAccount.reservedCash);

      let resultingBankAvailable: number | null = null;
      let resultingTerminalCash: number;

      if (input.direction === "BANK_TO_TERMINAL") {
        const available = await assertAccountAvailableForDebitInTx(tx, bankAccount.id, amount, {
          message:
            "This transfer couldn't be completed because your available Bank balance is insufficient.",
        });
        resultingBankAvailable = available - amount;
        resultingTerminalCash = availableCash + amount;

        await tx.bankAccount.update({
          where: { id: bankAccount.id },
          data: { balance: { decrement: amount } },
        });
      } else {
        if (amount > availableCash) {
          badRequest(
            "This transfer couldn't be completed because your Terminal portfolio available cash is insufficient.",
          );
        }
        // Never withdraw reserved cash; availableCash already excludes it.
        void reservedCash;
        resultingTerminalCash = availableCash - amount;
        await creditBankAccountInTx(tx, bankAccount.id, amount);
        const { getAccountAvailableBalanceInTx } = await import(
          "@/server/financial-integrity.service"
        );
        resultingBankAvailable = await getAccountAvailableBalanceInTx(tx, bankAccount.id);
      }

      const bankDescription =
        input.direction === "BANK_TO_TERMINAL"
          ? `Transfer to Alta Terminal · ${portfolioRecord.name}`
          : `Transfer from Alta Terminal · ${portfolioRecord.name}`;

      const bankTxType = input.direction === "BANK_TO_TERMINAL" ? "WITHDRAWAL" : "DEPOSIT";
      const ledgerRole = input.direction === "BANK_TO_TERMINAL" ? "DEBIT" : "CREDIT";

      const transferGroup = await tx.transferGroup.create({
        data: {
          groupType: "TERMINAL_FUNDING",
          status: "COMPLETED",
          referenceCode,
          completedAt: now,
          metadata: {
            direction: input.direction,
            portfolioId: input.portfolioId,
            bankAccountId: bankAccount.id,
          },
        },
      });

      const bankTx = await tx.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          type: bankTxType,
          amount,
          status: "APPROVED",
          description: bankDescription,
          memo,
          referenceCode,
          transferGroupId: transferGroup.id,
          ledgerRole,
          reviewedAt: now,
        },
      });

      const terminalKind =
        input.direction === "BANK_TO_TERMINAL" ? "CASH_DEPOSIT" : "CASH_WITHDRAWAL";
      const terminalSignedAmount =
        input.direction === "BANK_TO_TERMINAL" ? amount : -amount;
      const terminalDescription =
        input.direction === "BANK_TO_TERMINAL"
          ? "Transfer from Alta Bank"
          : "Transfer to Alta Bank";

      await tx.terminalPortfolioCashAccount.update({
        where: { id: cashAccount.id },
        data: {
          availableCash: resultingTerminalCash,
          version: { increment: 1 },
        },
      });

      const ledgerEntry = await tx.terminalCashLedgerEntry.create({
        data: {
          portfolioId: input.portfolioId,
          cashAccountId: cashAccount.id,
          amount: terminalSignedAmount,
          availableCashAfter: resultingTerminalCash,
          reservedCashAfter: reservedCash,
          kind: terminalKind,
          status: "POSTED",
          description: terminalDescription,
          externalReference: referenceCode,
          idempotencyKey: `funding:${referenceCode}`,
          actorUserId: user.id,
          source: "bank_terminal_funding",
        },
      });

      const activity = await tx.terminalPortfolioActivity.create({
        data: {
          portfolioId: input.portfolioId,
          kind: terminalKind,
          occurredAt: now,
          amount: terminalSignedAmount,
          description: terminalDescription,
          cashAfter: resultingTerminalCash,
        },
      });

      const funding = await tx.terminalFundingTransfer.create({
        data: {
          referenceCode,
          direction: input.direction,
          status: "COMPLETED",
          amount,
          currency: "FLR",
          bankAccountId: bankAccount.id,
          portfolioId: input.portfolioId,
          ownerUserId: portfolioRecord.ownerUserId,
          ownerCompanyId: portfolioRecord.ownerCompanyId,
          initiatedByUserId: user.id,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          bankTransactionId: bankTx.id,
          transferGroupId: transferGroup.id,
          terminalLedgerEntryId: ledgerEntry.id,
          terminalActivityId: activity.id,
          completedAt: now,
        },
      });

      return {
        id: funding.id,
        referenceCode,
        direction: input.direction,
        status: "COMPLETED" as const,
        amount,
        currency: "FLR",
        bankAccountId: bankAccount.id,
        bankAccountLabel: accountLabel(bankAccount),
        portfolioId: input.portfolioId,
        portfolioName: portfolioRecord.name,
        bankTransactionId: bankTx.id,
        bankTransactionReference: bankTx.referenceCode,
        resultingBankAvailable,
        resultingTerminalCash,
        createdAt: funding.createdAt.toISOString(),
        completedAt: now.toISOString(),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safe =
      message.startsWith("BAD_REQUEST:")
        ? message.slice("BAD_REQUEST:".length)
        : message.startsWith("FORBIDDEN:")
          ? message.slice("FORBIDDEN:".length)
          : "This transfer couldn't be completed. Your entries were preserved.";

    // Best-effort failed audit outside the aborted transaction
    try {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId: user.id,
        action: "TERMINAL_FUNDING_TRANSFER_FAILED",
        entityType: "TERMINAL_FUNDING_TRANSFER",
        description: `Terminal funding transfer failed: ${safe}`,
        targetUserId: portfolioRecord.ownerUserId ?? user.id,
        targetAccountId: bankAccount.id,
        targetCompanyId: portfolioRecord.ownerCompanyId ?? undefined,
        metadata: {
          source: "CUSTOMER",
          direction: input.direction,
          amount,
          portfolioId: input.portfolioId,
          failureMessage: safe,
        },
      });
    } catch {
      /* ignore */
    }

    emitTerminalFundingDomainEvent({
      name: "terminal_funding.failed",
      transferId: "none",
      referenceCode: "none",
      direction: input.direction,
      amount,
      bankAccountId: bankAccount.id,
      portfolioId: input.portfolioId,
      ownerUserId: portfolioRecord.ownerUserId,
      ownerCompanyId: portfolioRecord.ownerCompanyId,
      occurredAt: new Date().toISOString(),
    });

    throw error;
  }

  // After-commit audit + notifications + domain events
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: user.id,
      action: "TERMINAL_FUNDING_TRANSFER_COMPLETED",
      entityType: "TERMINAL_FUNDING_TRANSFER",
      entityId: receipt.id,
      description:
        input.direction === "BANK_TO_TERMINAL"
          ? `Bank to Terminal funding ${receipt.referenceCode}`
          : `Terminal to Bank funding ${receipt.referenceCode}`,
      targetUserId: portfolioRecord.ownerUserId ?? user.id,
      targetAccountId: bankAccount.id,
      targetCompanyId: portfolioRecord.ownerCompanyId ?? undefined,
      targetTransactionId: receipt.bankTransactionId ?? undefined,
      metadata: {
        source: "CUSTOMER",
        direction: input.direction,
        amount,
        portfolioId: input.portfolioId,
        referenceCode: receipt.referenceCode,
      },
    });
  } catch {
    /* ignore */
  }

  try {
    const { notifyTransferCompleted } = await import("@/server/banking-notification.service");
    const fromName =
      input.direction === "BANK_TO_TERMINAL" ? bankAccount.accountName : portfolioRecord.name;
    const toName =
      input.direction === "BANK_TO_TERMINAL" ? portfolioRecord.name : bankAccount.accountName;
    await notifyTransferCompleted(
      user.id,
      amount,
      receipt.referenceCode,
      fromName,
      toName,
    );
  } catch {
    /* ignore */
  }

  const sideEvents =
    input.direction === "BANK_TO_TERMINAL"
      ? (["terminal_funding.bank_debit", "terminal_funding.terminal_credit"] as const)
      : (["terminal_funding.terminal_debit", "terminal_funding.bank_credit"] as const);

  for (const name of sideEvents) {
    emitTerminalFundingDomainEvent({
      name,
      transferId: receipt.id,
      referenceCode: receipt.referenceCode,
      direction: input.direction,
      amount,
      bankAccountId: bankAccount.id,
      portfolioId: input.portfolioId,
      ownerUserId: portfolioRecord.ownerUserId,
      ownerCompanyId: portfolioRecord.ownerCompanyId,
      occurredAt: receipt.completedAt ?? receipt.createdAt,
    });
  }
  emitTerminalFundingDomainEvent({
    name: "terminal_funding.completed",
    transferId: receipt.id,
    referenceCode: receipt.referenceCode,
    direction: input.direction,
    amount,
    bankAccountId: bankAccount.id,
    portfolioId: input.portfolioId,
    ownerUserId: portfolioRecord.ownerUserId,
    ownerCompanyId: portfolioRecord.ownerCompanyId,
    occurredAt: receipt.completedAt ?? receipt.createdAt,
  });

  return receipt;
}

function mapFundingRow(
  row: {
    id: string;
    referenceCode: string;
    direction: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
    status: "PENDING" | "COMPLETED" | "FAILED";
    amount: { toString(): string };
    currency: string;
    bankAccountId: string;
    portfolioId: string;
    ownerUserId: string | null;
    ownerCompanyId: string | null;
    bankTransactionId: string | null;
    failureMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
    failedAt: Date | null;
    bankAccount: { accountName: string; accountNumber: string };
    portfolio: { name: string };
    bankTransaction: { referenceCode: string } | null;
    ownerUser: { discordUsername: string; minecraftUsername: string | null } | null;
    ownerCompany: { name: string } | null;
  },
  options?: { maskBank?: boolean },
): TerminalFundingTransferRow {
  const ownerLabel =
    row.ownerCompany?.name ??
    row.ownerUser?.minecraftUsername?.trim() ??
    row.ownerUser?.discordUsername ??
    "Owner";
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    direction: row.direction,
    status: row.status,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    bankAccountId: row.bankAccountId,
    bankAccountLabel: options?.maskBank
      ? maskAccountNumber(row.bankAccount.accountNumber)
      : accountLabel(row.bankAccount),
    bankAccountMasked: maskAccountNumber(row.bankAccount.accountNumber),
    portfolioId: row.portfolioId,
    portfolioName: row.portfolio.name,
    ownerUserId: row.ownerUserId,
    ownerCompanyId: row.ownerCompanyId,
    ownerLabel,
    bankTransactionId: row.bankTransactionId,
    bankTransactionReference: row.bankTransaction?.referenceCode ?? null,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
  };
}

const fundingInclude = {
  bankAccount: { select: { accountName: true, accountNumber: true } },
  portfolio: { select: { name: true } },
  bankTransaction: { select: { referenceCode: true } },
  ownerUser: { select: { discordUsername: true, minecraftUsername: true } },
  ownerCompany: { select: { name: true } },
} as const;

export async function listCustomerTerminalFundingTransfers(
  user: AltaUser,
  limit = 40,
): Promise<TerminalFundingTransferRow[]> {
  const { bankAccountAccessWhere } = await import("@/server/bank-account-access.service");
  const { listAccessibleTerminalPortfolios } = await import(
    "@/lib/terminal/terminal-portfolio.service"
  );
  const portfolios = await listAccessibleTerminalPortfolios(user);
  const portfolioIds = portfolios.map((p) => p.id);
  const accounts = await prisma.bankAccount.findMany({
    where: bankAccountAccessWhere(user, "view"),
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);

  const rows = await prisma.terminalFundingTransfer.findMany({
    where: {
      OR: [
        { bankAccountId: { in: accountIds } },
        { portfolioId: { in: portfolioIds } },
        { initiatedByUserId: user.id },
      ],
    },
    include: fundingInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map((row) => mapFundingRow(row));
}

export async function getCustomerTerminalFundingTransfer(
  user: AltaUser,
  transferId: string,
): Promise<TerminalFundingTransferRow | null> {
  const rows = await listCustomerTerminalFundingTransfers(user, 100);
  return rows.find((r) => r.id === transferId) ?? null;
}

export async function listInternalTerminalFundingTransfers(filters: {
  direction?: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
  status?: "PENDING" | "COMPLETED" | "FAILED";
  q?: string;
  limit?: number;
  maskBankForTerminalStaff?: boolean;
}): Promise<TerminalFundingTransferRow[]> {
  const { requireAuth } = await import("@/server/auth.service");
  const { canAccessBankInternal, canAccessTerminalInternal } = await import(
    "@/lib/auth/permissions"
  );
  const actor = await requireAuth();
  if (!canAccessBankInternal(actor) && !canAccessTerminalInternal(actor)) {
    throw new Error("FORBIDDEN");
  }
  const maskBank =
    filters.maskBankForTerminalStaff === true ||
    (canAccessTerminalInternal(actor) && !canAccessBankInternal(actor));

  const q = filters.q?.trim();
  const rows = await prisma.terminalFundingTransfer.findMany({
    where: {
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(q
        ? {
            OR: [
              { referenceCode: { contains: q, mode: "insensitive" } },
              { bankAccount: { accountNumber: { contains: q, mode: "insensitive" } } },
              { portfolio: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: fundingInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filters.limit ?? 50, 1), 200),
  });

  return rows.map((row) => mapFundingRow(row, { maskBank }));
}

export async function getInternalTerminalFundingTransfer(
  transferId: string,
  options?: { maskBankForTerminalStaff?: boolean },
): Promise<TerminalFundingTransferRow | null> {
  const row = await prisma.terminalFundingTransfer.findUnique({
    where: { id: transferId },
    include: fundingInclude,
  });
  if (!row) return null;
  return mapFundingRow(row, { maskBank: options?.maskBankForTerminalStaff });
}

export async function listPortfolioFundingTransfersForOps(
  portfolioId: string,
  options?: { maskBank?: boolean; limit?: number },
): Promise<TerminalFundingTransferRow[]> {
  const rows = await prisma.terminalFundingTransfer.findMany({
    where: { portfolioId },
    include: fundingInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options?.limit ?? 30, 1), 100),
  });
  return rows.map((row) => mapFundingRow(row, { maskBank: options?.maskBank }));
}
