import type { PaginatedResult, TransactionDetail, TransactionExplorerRow } from "@/lib/internal/ops-types";
import { isAdjustmentReversalNote, adjustmentReversalNote } from "@/lib/bank/adjustment-reversal";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";
import type { Prisma } from "@prisma/client";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function mapTxRow(
  tx: Prisma.BankTransactionGetPayload<{
    include: { bankAccount: { include: { user: true; company: true } }; reviewedBy: true };
  }>,
): TransactionExplorerRow {
  const holder = tx.bankAccount.company?.name ?? tx.bankAccount.user.discordUsername;
  return {
    id: tx.id,
    referenceCode: tx.referenceCode,
    type: tx.type,
    status: tx.status,
    amount: decimalToNumber(tx.amount),
    accountNumber: tx.bankAccount.accountNumber,
    holder,
    description: tx.description,
    createdAt: tx.createdAt.toISOString(),
  };
}

export type TransactionSearchFilters = {
  q?: string;
  accountId?: string;
  userId?: string;
  companyId?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function searchTransactions(
  filters: TransactionSearchFilters = {},
): Promise<PaginatedResult<TransactionExplorerRow>> {
  await requireOperator();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  const and: Prisma.BankTransactionWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { referenceCode: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { memo: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.accountId) and.push({ bankAccountId: filters.accountId });
  if (filters.userId) and.push({ bankAccount: { userId: filters.userId } });
  if (filters.companyId) and.push({ bankAccount: { companyId: filters.companyId } });
  if (filters.type) and.push({ type: filters.type.toUpperCase() as Prisma.EnumBankTransactionTypeFilter["equals"] });
  if (filters.status) and.push({ status: filters.status.toUpperCase() as Prisma.EnumBankTransactionStatusFilter["equals"] });
  if (filters.from) and.push({ createdAt: { gte: new Date(filters.from) } });
  if (filters.to) and.push({ createdAt: { lte: new Date(filters.to) } });

  const where = and.length > 0 ? { AND: and } : {};

  const [total, rows] = await Promise.all([
    prisma.bankTransaction.count({ where }),
    prisma.bankTransaction.findMany({
      where,
      include: {
        bankAccount: { include: { user: true, company: true } },
        reviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    items: rows.map(mapTxRow),
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  };
}

export async function getTransactionDetail(transactionId: string): Promise<TransactionDetail> {
  await requireOperator();
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: {
      bankAccount: { include: { user: true, company: true } },
      reviewedBy: true,
      loanPayment: { select: { loanId: true } },
    },
  });
  if (!tx) throw new Error("NOT_FOUND");

  const base = mapTxRow(tx);
  let linkedTransactions: TransactionExplorerRow[] = [];
  const refBase = tx.referenceCode.replace(/-OUT$|-IN$/, "");
  if (refBase.includes("-")) {
    const linked = await prisma.bankTransaction.findMany({
      where: {
        OR: [
          { referenceCode: `${refBase}-OUT` },
          { referenceCode: `${refBase}-IN` },
          { referenceCode: refBase },
        ],
        NOT: { id: tx.id },
      },
      include: { bankAccount: { include: { user: true, company: true } }, reviewedBy: true },
    });
    linkedTransactions = linked.map(mapTxRow);
  }

  const priorTxs = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: tx.bankAccountId,
      status: "APPROVED",
      createdAt: { lt: tx.createdAt },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const balanceBefore = priorTxs[0]
    ? null
    : null;

  const isCredit = ["DEPOSIT", "INTEREST_CREDIT", "ADJUSTMENT"].includes(tx.type) && tx.status === "APPROVED";
  const isDebit = ["WITHDRAWAL", "LOAN_PAYMENT", "INTEREST_CHARGE"].includes(tx.type) && tx.status === "APPROVED";
  let balanceAfter: number | null = null;
  if (tx.status === "APPROVED") {
    const account = await prisma.bankAccount.findUnique({ where: { id: tx.bankAccountId } });
    balanceAfter = account ? decimalToNumber(account.balance) : null;
  }

  const relatedAltaPayRef = tx.referenceCode.startsWith("PAY-")
    ? tx.referenceCode.replace(/-OUT$|-IN$/, "")
    : null;

  let canReverseAdjustment = false;
  if (tx.type === "ADJUSTMENT" && tx.status === "APPROVED" && !isAdjustmentReversalNote(tx.reviewNote)) {
    const existingReversal = await prisma.bankTransaction.findFirst({
      where: {
        bankAccountId: tx.bankAccountId,
        type: "ADJUSTMENT",
        status: "APPROVED",
        reviewNote: { contains: adjustmentReversalNote(tx.referenceCode) },
      },
      select: { id: true },
    });
    canReverseAdjustment = !existingReversal;
  }

  return {
    ...base,
    accountId: tx.bankAccountId,
    balanceBefore,
    balanceAfter: isCredit || isDebit ? balanceAfter : null,
    memo: tx.memo,
    reviewNote: tx.reviewNote,
    reviewedByLabel: tx.reviewedBy?.discordUsername ?? null,
    reviewedAt: tx.reviewedAt?.toISOString() ?? null,
    proofImageUrl: tx.proofImageUrl,
    linkedTransactions,
    relatedLoanId: tx.loanPayment?.loanId ?? null,
    relatedAltaPayRef,
    relatedStatementId: null,
    canReverseAdjustment,
  };
}
