import { randomBytes } from "node:crypto";
import {
  Prisma,
  type AltaCardTransactionStatus,
  type AltaCardTransactionType,
  type AltaCardStatus,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type {
  AltaCardTransactionRow,
  AltaCardTransactionStatusCode,
  AltaCardTransactionTypeCode,
  CardPaymentContext,
  CashAdvanceContext,
  CreateAltaCardAdjustmentInput,
  EmployeeCashAdvanceContext,
  SubmitCardPaymentInput,
  SubmitCashAdvanceInput,
  SubmitEmployeeCashAdvanceInput,
} from "@/lib/bank/alta-card-types";
import {
  altaCardAdjustmentDescription,
  altaCardCashAdvanceBankDescription,
  altaCardCashAdvanceCardDescription,
  altaCardPaymentDescription,
  altaCardReversalDescription,
  altaPayToDescription,
} from "@/lib/bank/customer-transaction-copy";
import { canAccessBankInternal, canManageCompanyAltaCard, canUseBusinessAltaCardLineForAltaPay, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import {
  mapAltaCardRow,
  mapAltaCardTransactionRow,
  altaCardTransactionInclude,
  toDbAltaCardTransactionType,
} from "@/server/alta-card-mapper";
import { altaCardInclude } from "@/server/alta-card-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

const CHARGEABLE_STATUSES: AltaCardStatus[] = ["ACTIVE"];
const PAYMENT_ALLOWED_STATUSES: AltaCardStatus[] = ["ACTIVE", "FROZEN", "DELINQUENT"];
const BLOCKED_STATUSES: AltaCardStatus[] = ["CLOSED", "LOST", "EXPIRED", "PENDING"];

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateCardTxReference(prefix: string): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ACARD-${prefix}-${date}-${suffix}`;
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function assertOperatorOrAdmin(user: AltaUser): void {
  if (!canAccessBankInternal(user)) forbidden();
}

function assertCardChargeable(status: AltaCardStatus, adminOverride = false): void {
  if (adminOverride) return;
  if (BLOCKED_STATUSES.includes(status)) {
    badRequest("Card cannot be used while frozen, closed, or inactive");
  }
  if (!CHARGEABLE_STATUSES.includes(status)) {
    badRequest("Card must be active to transact");
  }
}

function recalculateAvailable(creditLimit: number, currentBalance: number): number {
  return roundMoney(Math.max(0, creditLimit - currentBalance));
}

const EMPLOYEE_CREDIT_RESERVE_STATUSES: AltaCardStatus[] = [
  "ACTIVE",
  "FROZEN",
  "DELINQUENT",
  "PENDING",
];

async function sumEmployeeReservedCredit(
  db: Prisma.TransactionClient | typeof prisma,
  parentBusinessCardId: string,
): Promise<number> {
  const employees = await db.altaEmployeeCard.findMany({
    where: {
      parentBusinessCardId,
      status: { in: EMPLOYEE_CREDIT_RESERVE_STATUSES },
    },
    select: { employeeAvailableLimit: true },
  });

  return roundMoney(
    employees.reduce((sum, row) => sum + decimalToNumber(row.employeeAvailableLimit), 0),
  );
}

/** Business lines reserve unspent employee limits against parent available credit. */
export async function syncBusinessCardAvailableCredit(
  db: Prisma.TransactionClient | typeof prisma,
  cardId: string,
): Promise<void> {
  const card = await db.altaCard.findUnique({ where: { id: cardId } });
  if (!card || card.cardType !== "BUSINESS") return;

  const reserved = await sumEmployeeReservedCredit(db, cardId);
  const creditLimit = decimalToNumber(card.creditLimit);
  const currentBalance = decimalToNumber(card.currentBalance);
  const availableCredit = roundMoney(Math.max(0, creditLimit - currentBalance - reserved));

  await db.altaCard.update({
    where: { id: cardId },
    data: { availableCredit: toDecimal(availableCredit) },
  });
}

function applyTransactionToLedgerBalance(
  balance: number,
  type: AltaCardTransactionType,
  amount: number,
): number {
  switch (type) {
    case "PURCHASE":
    case "ALTA_PAY":
    case "CASH_ADVANCE":
    case "ADJUSTMENT_DEBIT":
    case "INTEREST":
    case "FEE":
      return balance + amount;
    case "PAYMENT":
    case "ADJUSTMENT_CREDIT":
    case "REVERSAL":
      return balance - amount;
    default:
      return balance;
  }
}

async function computeLedgerBalanceFromTransactions(
  db: Prisma.TransactionClient | typeof prisma,
  filter: { altaCardId?: string; altaEmployeeCardId?: string },
): Promise<number> {
  const txs = await db.altaCardTransaction.findMany({
    where: {
      status: "COMPLETED",
      ...(filter.altaCardId ? { altaCardId: filter.altaCardId } : {}),
      ...(filter.altaEmployeeCardId ? { altaEmployeeCardId: filter.altaEmployeeCardId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  let balance = 0;
  for (const tx of txs) {
    balance = applyTransactionToLedgerBalance(balance, tx.type, decimalToNumber(tx.amount));
  }

  return roundMoney(Math.max(0, balance));
}

/** Repair stored balances from completed transaction history (handles legacy drift). */
export async function reconcileBusinessCardLedger(
  db: Prisma.TransactionClient | typeof prisma,
  cardId: string,
): Promise<void> {
  const card = await db.altaCard.findUnique({ where: { id: cardId } });
  if (!card || card.cardType !== "BUSINESS") return;

  const ledgerBalance = await computeLedgerBalanceFromTransactions(db, { altaCardId: cardId });
  const storedBalance = decimalToNumber(card.currentBalance);

  if (Math.abs(ledgerBalance - storedBalance) >= 0.01) {
    await db.altaCard.update({
      where: { id: cardId },
      data: { currentBalance: toDecimal(ledgerBalance) },
    });
  }

  const employees = await db.altaEmployeeCard.findMany({
    where: {
      parentBusinessCardId: cardId,
      status: { in: EMPLOYEE_CREDIT_RESERVE_STATUSES },
    },
  });

  for (const employee of employees) {
    const empLedger = await computeLedgerBalanceFromTransactions(db, {
      altaEmployeeCardId: employee.id,
    });
    const empStored = decimalToNumber(employee.employeeCurrentBalance);
    if (Math.abs(empLedger - empStored) >= 0.01) {
      const spendLimit = decimalToNumber(employee.employeeSpendLimit);
      await db.altaEmployeeCard.update({
        where: { id: employee.id },
        data: {
          employeeCurrentBalance: toDecimal(empLedger),
          employeeAvailableLimit: toDecimal(roundMoney(Math.max(0, spendLimit - empLedger))),
        },
      });
    }
  }

  await syncBusinessCardAvailableCredit(db, cardId);
}

export async function listCompanyBusinessCardTransactions(
  companyId: string,
  limit = 100,
): Promise<AltaCardTransactionRow[]> {
  const businessCards = await prisma.altaCard.findMany({
    where: { companyId, cardType: "BUSINESS", status: { not: "CLOSED" } },
    select: { id: true },
  });
  if (businessCards.length === 0) return [];

  const txs = await prisma.altaCardTransaction.findMany({
    where: { altaCardId: { in: businessCards.map((card) => card.id) } },
    include: altaCardTransactionInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return txs.map(mapAltaCardTransactionRow);
}

async function auditTxEvent(
  actorUserId: string,
  action: string,
  description: string,
  cardId: string,
  transactionId: string,
  metadata: Record<string, unknown>,
  targetUserId?: string | null,
  targetCompanyId?: string | null,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "ALTA_CARD",
    entityId: cardId,
    description,
    targetUserId: targetUserId ?? undefined,
    targetCompanyId: targetCompanyId ?? undefined,
    metadata: { cardId, transactionId, ...metadata },
  });
}

type DbCard = Prisma.AltaCardGetPayload<{ include: typeof altaCardInclude }>;
type DbEmployeeCard = Prisma.AltaEmployeeCardGetPayload<{
  include: {
    parentBusinessCard: true;
    company: { select: { name: true } };
    authorizedUser: { select: { id: true; discordUsername: true } };
  };
}>;

async function loadCard(cardId: string): Promise<DbCard> {
  const card = await prisma.altaCard.findUnique({ where: { id: cardId }, include: altaCardInclude });
  if (!card) notFound();
  return card;
}

async function loadEmployeeCard(employeeCardId: string): Promise<DbEmployeeCard> {
  const card = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    include: {
      parentBusinessCard: true,
      company: { select: { name: true } },
      authorizedUser: { select: { id: true, discordUsername: true } },
    },
  });
  if (!card) notFound();
  return card;
}

async function assertPersonalCardAccess(userId: string, card: DbCard): Promise<AltaUser> {
  const user = await getAltaUser(userId);
  if (canAccessBankInternal(user)) return user;
  if (card.cardType === "PERSONAL" && card.ownerUserId === userId) return user;
  if (card.cardType === "BUSINESS" && card.companyId && canManageCompanyAltaCard(user, card.companyId)) {
    return user;
  }
  forbidden();
}

type LinkedBankAccount = {
  id: string;
  accountName: string;
  accountNumber: string;
  restrictDeposits: boolean;
  restrictWithdrawals: boolean;
};

async function listPersonalBankAccounts(userId: string): Promise<LinkedBankAccount[]> {
  return prisma.bankAccount.findMany({
    where: { userId, companyId: null, status: "ACTIVE" },
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
      restrictDeposits: true,
      restrictWithdrawals: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function getPersonalBankAccount(
  userId: string,
  accountId: string,
  purpose: "cash_advance",
): Promise<LinkedBankAccount> {
  const accounts = await listPersonalBankAccounts(userId);
  const account = accounts.find((entry) => entry.id === accountId);
  if (!account) badRequest("Select a valid personal Alta account");
  if (purpose === "cash_advance" && account.restrictDeposits) {
    badRequest("Deposits are restricted on this account");
  }
  return account;
}

async function assertEmployeeCardHolderAccess(userId: string, employeeCard: DbEmployeeCard): Promise<void> {
  if (employeeCard.authorizedUserId !== userId) forbidden();
}

async function listBusinessOperatingAccounts(companyId: string): Promise<LinkedBankAccount[]> {
  return prisma.bankAccount.findMany({
    where: {
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
      restrictDeposits: true,
      restrictWithdrawals: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function listCardLinkedBankAccounts(
  userId: string,
  card: DbCard,
  purpose: "payment" | "cash_advance" = "payment",
): Promise<LinkedBankAccount[]> {
  if (card.cardType === "BUSINESS") {
    if (!card.companyId) badRequest("Business card is missing a company");
    const businessAccounts = await listBusinessOperatingAccounts(card.companyId);
    if (purpose === "payment") return businessAccounts;

    const personalAccounts = await listPersonalBankAccounts(userId);
    const byId = new Map<string, LinkedBankAccount>();
    for (const account of [...personalAccounts, ...businessAccounts]) {
      byId.set(account.id, account);
    }
    return [...byId.values()];
  }

  return listPersonalBankAccounts(userId);
}

async function getLinkedBankAccount(
  userId: string,
  card: DbCard,
  accountId: string,
  purpose: "payment" | "cash_advance",
): Promise<LinkedBankAccount> {
  const accounts = await listCardLinkedBankAccounts(userId, card, purpose);
  const account = accounts.find((entry) => entry.id === accountId);
  if (!account) {
    badRequest(
      card.cardType === "BUSINESS" && purpose === "payment"
        ? "Select a valid business operating account"
        : "Select a valid destination account",
    );
  }
  if (purpose === "payment" && account.restrictWithdrawals) {
    badRequest("Withdrawals are restricted on this account");
  }
  if (purpose === "cash_advance" && account.restrictDeposits) {
    badRequest("Deposits are restricted on this account");
  }
  return account;
}

export async function applyChargeInTx(
  tx: Prisma.TransactionClient,
  card: { id: string; creditLimit: Prisma.Decimal; currentBalance: Prisma.Decimal; availableCredit: Prisma.Decimal; status: AltaCardStatus },
  amount: number,
  employeeCard?: {
    id: string;
    employeeSpendLimit: Prisma.Decimal;
    employeeCurrentBalance: Prisma.Decimal;
    employeeAvailableLimit: Prisma.Decimal;
    status: AltaCardStatus;
  } | null,
  adminOverride = false,
): Promise<{ newBalance: number; newAvailable: number }> {
  assertCardChargeable(card.status, adminOverride);
  if (amount <= 0) badRequest("Amount must be greater than zero");

  const creditLimit = decimalToNumber(card.creditLimit);
  const currentBalance = decimalToNumber(card.currentBalance);
  const availableCredit = decimalToNumber(card.availableCredit);

  if (amount > availableCredit) badRequest("Insufficient available credit");

  if (employeeCard) {
    assertCardChargeable(employeeCard.status, adminOverride);
    const empAvailable = decimalToNumber(employeeCard.employeeAvailableLimit);
    if (amount > empAvailable) badRequest("Exceeds employee spend limit");

    const newEmpBalance = roundMoney(decimalToNumber(employeeCard.employeeCurrentBalance) + amount);
    const newEmpAvailable = roundMoney(decimalToNumber(employeeCard.employeeSpendLimit) - newEmpBalance);
    if (newEmpAvailable < 0) badRequest("Exceeds employee spend limit");

    await tx.altaEmployeeCard.update({
      where: { id: employeeCard.id },
      data: {
        employeeCurrentBalance: toDecimal(newEmpBalance),
        employeeAvailableLimit: toDecimal(newEmpAvailable),
      },
    });
  }

  const newBalance = roundMoney(currentBalance + amount);
  const newAvailable = recalculateAvailable(creditLimit, newBalance);

  if (newBalance < 0) badRequest("Balance cannot be negative");
  if (newAvailable > creditLimit) badRequest("Available credit exceeds limit");

  const cardMeta = await tx.altaCard.findUnique({
    where: { id: card.id },
    select: { cardType: true },
  });

  if (cardMeta?.cardType === "BUSINESS") {
    await tx.altaCard.update({
      where: { id: card.id },
      data: { currentBalance: toDecimal(newBalance) },
    });
    await syncBusinessCardAvailableCredit(tx, card.id);
    const refreshed = await tx.altaCard.findUnique({ where: { id: card.id } });
    return {
      newBalance,
      newAvailable: refreshed ? decimalToNumber(refreshed.availableCredit) : newAvailable,
    };
  }

  await tx.altaCard.update({
    where: { id: card.id },
    data: {
      currentBalance: toDecimal(newBalance),
      availableCredit: toDecimal(newAvailable),
    },
  });

  return { newBalance, newAvailable };
}

export async function applyPaymentInTx(
  tx: Prisma.TransactionClient,
  card: { id: string; creditLimit: Prisma.Decimal; currentBalance: Prisma.Decimal },
  amount: number,
): Promise<{ newBalance: number; newAvailable: number }> {
  if (amount <= 0) badRequest("Amount must be greater than zero");

  const creditLimit = decimalToNumber(card.creditLimit);
  const currentBalance = decimalToNumber(card.currentBalance);
  const paymentAmount = Math.min(amount, currentBalance);
  if (paymentAmount <= 0) badRequest("No balance due on this card");

  const newBalance = roundMoney(currentBalance - paymentAmount);
  const newAvailable = recalculateAvailable(creditLimit, newBalance);

  const cardMeta = await tx.altaCard.findUnique({
    where: { id: card.id },
    select: { cardType: true },
  });

  if (cardMeta?.cardType === "BUSINESS") {
    await tx.altaCard.update({
      where: { id: card.id },
      data: { currentBalance: toDecimal(newBalance) },
    });
    await syncBusinessCardAvailableCredit(tx, card.id);
    const refreshed = await tx.altaCard.findUnique({ where: { id: card.id } });
    return {
      newBalance,
      newAvailable: refreshed ? decimalToNumber(refreshed.availableCredit) : newAvailable,
    };
  }

  await tx.altaCard.update({
    where: { id: card.id },
    data: {
      currentBalance: toDecimal(newBalance),
      availableCredit: toDecimal(newAvailable),
    },
  });

  return { newBalance, newAvailable };
}

async function applyCreditAdjustmentInTx(
  tx: Prisma.TransactionClient,
  card: { id: string; creditLimit: Prisma.Decimal; currentBalance: Prisma.Decimal },
  amount: number,
): Promise<void> {
  const creditLimit = decimalToNumber(card.creditLimit);
  const currentBalance = decimalToNumber(card.currentBalance);
  const newBalance = roundMoney(Math.max(0, currentBalance - amount));
  const newAvailable = recalculateAvailable(creditLimit, newBalance);

  await tx.altaCard.update({
    where: { id: card.id },
    data: {
      currentBalance: toDecimal(newBalance),
      availableCredit: toDecimal(newAvailable),
    },
  });
}

async function applyDebitAdjustmentInTx(
  tx: Prisma.TransactionClient,
  card: { id: string; creditLimit: Prisma.Decimal; currentBalance: Prisma.Decimal; availableCredit: Prisma.Decimal; status: AltaCardStatus },
  amount: number,
  adminOverride = true,
): Promise<void> {
  await applyChargeInTx(tx, card, amount, null, adminOverride);
}

export async function listAltaCardTransactions(
  cardId: string,
  options: { employeeCardId?: string; limit?: number } = {},
): Promise<AltaCardTransactionRow[]> {
  const txs = await prisma.altaCardTransaction.findMany({
    where: {
      altaCardId: cardId,
      ...(options.employeeCardId ? { altaEmployeeCardId: options.employeeCardId } : {}),
    },
    include: altaCardTransactionInclude,
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
  return txs.map(mapAltaCardTransactionRow);
}

export async function listEmployeeCardTransactions(
  employeeCardId: string,
  limit = 50,
): Promise<AltaCardTransactionRow[]> {
  const employeeCard = await prisma.altaEmployeeCard.findUnique({
    where: { id: employeeCardId },
    select: { parentBusinessCardId: true },
  });
  if (!employeeCard) notFound();
  return listAltaCardTransactions(employeeCard.parentBusinessCardId, { employeeCardId, limit });
}

export type ChargeAltaCardParams = {
  cardId: string;
  employeeCardId?: string;
  type: AltaCardTransactionTypeCode;
  amount: number;
  description: string;
  actorUserId: string;
  merchantCompanyId?: string;
  relatedBankAccountId?: string;
  relatedBankTransactionId?: string;
  relatedAltaPayPaymentId?: string;
  referenceCode?: string;
  metadata?: Record<string, unknown>;
  adminOverride?: boolean;
};

export async function chargeAltaCardInTransaction(
  tx: Prisma.TransactionClient,
  params: ChargeAltaCardParams,
): Promise<AltaCardTransactionRow> {
  const { lockAltaCardRow } = await import("@/server/financial-integrity.service");
  await lockAltaCardRow(tx, params.cardId);

  const card = await tx.altaCard.findUnique({ where: { id: params.cardId } });
  if (!card) notFound();

  let employeeCard = null;
  if (params.employeeCardId) {
    employeeCard = await tx.altaEmployeeCard.findUnique({ where: { id: params.employeeCardId } });
    if (!employeeCard || employeeCard.parentBusinessCardId !== card.id) {
      badRequest("Invalid employee card");
    }
  }

  await applyChargeInTx(tx, card, params.amount, employeeCard, params.adminOverride);

  const created = await tx.altaCardTransaction.create({
    data: {
      altaCardId: card.id,
      altaEmployeeCardId: params.employeeCardId ?? null,
      type: toDbAltaCardTransactionType(params.type),
      status: "COMPLETED",
      amount: toDecimal(params.amount),
      description: params.description,
      merchantCompanyId: params.merchantCompanyId ?? null,
      relatedBankAccountId: params.relatedBankAccountId ?? null,
      relatedBankTransactionId: params.relatedBankTransactionId ?? null,
      relatedAltaPayPaymentId: params.relatedAltaPayPaymentId ?? null,
      referenceCode: params.referenceCode ?? generateCardTxReference(params.type.toUpperCase()),
      createdByUserId: params.actorUserId,
      settledAt: new Date(),
      metadata: params.metadata ?? undefined,
    },
    include: altaCardTransactionInclude,
  });

  return mapAltaCardTransactionRow(created);
}

export async function submitCashAdvance(
  userId: string,
  input: SubmitCashAdvanceInput,
): Promise<{ transaction: AltaCardTransactionRow; bankTransactionId: string; referenceCode: string }> {
  const card = await loadCard(input.cardId);
  await assertPersonalCardAccess(userId, card);
  assertCardChargeable(card.status);
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const destination = await getLinkedBankAccount(userId, card, input.destinationAccountId, "cash_advance");

  const referenceCode = generateCardTxReference("CASH");
  const memo = input.memo?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const cardTx = await chargeAltaCardInTransaction(tx, {
      cardId: card.id,
      type: "cash_advance",
      amount: input.amount,
      description: altaCardCashAdvanceCardDescription(card.cardLastFour),
      actorUserId: userId,
      relatedBankAccountId: destination.id,
      referenceCode,
      metadata: { memo },
    });

    await tx.bankAccount.update({
      where: { id: destination.id },
      data: { balance: { increment: input.amount } },
    });

    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: destination.id,
        type: "DEPOSIT",
        amount: input.amount,
        status: "APPROVED",
        description: altaCardCashAdvanceBankDescription(card.cardLastFour),
        memo,
        referenceCode: `${referenceCode}-DEP`,
        proofImageUrl: null,
      },
    });

    await tx.altaCardTransaction.update({
      where: { id: cardTx.id },
      data: { relatedBankTransactionId: bankTx.id },
    });

    return { cardTx, bankTx };
  });

  await auditTxEvent(
    userId,
    "ALTA_CARD_CASH_ADVANCE_CREATED",
    `Cash advance of ${input.amount} to ${destination.accountName}`,
    card.id,
    result.cardTx.id,
    {
      amount: input.amount,
      type: "cash_advance",
      actorUserId: userId,
      relatedBankTransactionId: result.bankTx.id,
    },
    card.ownerUserId,
    card.companyId,
  );

  return {
    transaction: { ...result.cardTx, relatedBankTransactionId: result.bankTx.id },
    bankTransactionId: result.bankTx.id,
    referenceCode,
  };
}

export async function getEmployeeCashAdvanceContext(
  userId: string,
  employeeCardId: string,
): Promise<EmployeeCashAdvanceContext> {
  const employeeCard = await loadEmployeeCard(employeeCardId);
  await assertEmployeeCardHolderAccess(userId, employeeCard);
  assertCardChargeable(employeeCard.status);
  assertCardChargeable(employeeCard.parentBusinessCard.status);

  const accounts = await listPersonalBankAccounts(userId);

  return {
    employeeCardId: employeeCard.id,
    companyName: employeeCard.company?.name ?? "Company",
    cardLastFour: employeeCard.cardLastFour,
    destinationAccounts: accounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
    })),
    availableCredit: decimalToNumber(employeeCard.employeeAvailableLimit),
    currentBalance: decimalToNumber(employeeCard.employeeCurrentBalance),
  };
}

export async function submitEmployeeCashAdvance(
  userId: string,
  input: SubmitEmployeeCashAdvanceInput,
): Promise<{ transaction: AltaCardTransactionRow; bankTransactionId: string; referenceCode: string }> {
  const employeeCard = await loadEmployeeCard(input.employeeCardId);
  await assertEmployeeCardHolderAccess(userId, employeeCard);
  assertCardChargeable(employeeCard.status);
  assertCardChargeable(employeeCard.parentBusinessCard.status);
  if (input.amount <= 0) badRequest("Amount must be greater than zero");

  const destination = await getPersonalBankAccount(userId, input.destinationAccountId, "cash_advance");
  const parentCard = employeeCard.parentBusinessCard;

  const referenceCode = generateCardTxReference("CASH");
  const memo = input.memo?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const cardTx = await chargeAltaCardInTransaction(tx, {
      cardId: parentCard.id,
      employeeCardId: employeeCard.id,
      type: "cash_advance",
      amount: input.amount,
      description: altaCardCashAdvanceCardDescription(employeeCard.cardLastFour),
      actorUserId: userId,
      relatedBankAccountId: destination.id,
      referenceCode,
      metadata: {
        memo,
        fundingSource: `Employee Alta Card •••• ${employeeCard.cardLastFour}`,
        spenderUserId: userId,
      },
    });

    await tx.bankAccount.update({
      where: { id: destination.id },
      data: { balance: { increment: input.amount } },
    });

    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: destination.id,
        type: "DEPOSIT",
        amount: input.amount,
        status: "APPROVED",
        description: altaCardCashAdvanceBankDescription(employeeCard.cardLastFour),
        memo,
        referenceCode: `${referenceCode}-DEP`,
        proofImageUrl: null,
      },
    });

    await tx.altaCardTransaction.update({
      where: { id: cardTx.id },
      data: { relatedBankTransactionId: bankTx.id },
    });

    return { cardTx, bankTx };
  });

  await auditTxEvent(
    userId,
    "ALTA_CARD_CASH_ADVANCE_CREATED",
    `Employee cash advance of ${input.amount} to ${destination.accountName}`,
    parentCard.id,
    result.cardTx.id,
    {
      amount: input.amount,
      type: "cash_advance",
      actorUserId: userId,
      employeeCardId: employeeCard.id,
      relatedBankTransactionId: result.bankTx.id,
    },
    userId,
    parentCard.companyId,
  );

  return {
    transaction: { ...result.cardTx, relatedBankTransactionId: result.bankTx.id },
    bankTransactionId: result.bankTx.id,
    referenceCode,
  };
}

export async function submitCardPayment(
  userId: string,
  input: SubmitCardPaymentInput,
): Promise<{ transaction: AltaCardTransactionRow; bankTransactionId: string; referenceCode: string; amountPaid: number }> {
  const card = await loadCard(input.cardId);
  await assertPersonalCardAccess(userId, card);
  if (!PAYMENT_ALLOWED_STATUSES.includes(card.status)) {
    badRequest("Payments are not allowed for this card status");
  }

  const source = await getLinkedBankAccount(userId, card, input.sourceAccountId, "payment");

  const currentBalance = decimalToNumber(card.currentBalance);
  const paymentAmount = roundMoney(Math.min(input.amount, currentBalance));
  if (paymentAmount <= 0) badRequest("Payment amount must be greater than zero");

  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  const available = await getAccountAvailableBalance(source.id);
  if (paymentAmount > available) badRequest("Insufficient balance in source account");

  const referenceCode = generateCardTxReference("PAYMENT");
  const memo = input.memo?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const freshCard = await tx.altaCard.findUnique({ where: { id: card.id } });
    if (!freshCard) notFound();

    await applyPaymentInTx(tx, freshCard, paymentAmount);

    await tx.bankAccount.update({
      where: { id: source.id },
      data: { balance: { decrement: paymentAmount } },
    });

    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: source.id,
        type: "WITHDRAWAL",
        amount: paymentAmount,
        status: "APPROVED",
        description: altaCardPaymentDescription(card.cardLastFour),
        memo,
        referenceCode: `${referenceCode}-WD`,
        proofImageUrl: null,
      },
    });

    const cardTx = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        type: "PAYMENT",
        status: "COMPLETED",
        amount: toDecimal(paymentAmount),
        description: altaCardPaymentDescription(card.cardLastFour),
        relatedBankAccountId: source.id,
        relatedBankTransactionId: bankTx.id,
        referenceCode,
        createdByUserId: userId,
        settledAt: new Date(),
        metadata: { paymentKind: input.paymentKind, memo },
      },
      include: altaCardTransactionInclude,
    });

    const { allocatePaymentToStatements } = await import("@/server/alta-card-statement.service");
    const paidNumbers = await allocatePaymentToStatements(tx, card.id, paymentAmount, userId);

    return { cardTx: mapAltaCardTransactionRow(cardTx), bankTx, paidNumbers };
  });

  for (const num of result.paidNumbers) {
    await writeAuditLog({
      actorUserId: userId,
      action: "ALTA_CARD_STATEMENT_PAID",
      entityType: "ALTA_CARD",
      entityId: card.id,
      description: `Statement #${num} paid in full`,
      metadata: { cardId: card.id, statementNumber: num, amount: paymentAmount, actorUserId: userId },
    });
  }

  await auditTxEvent(
    userId,
    "ALTA_CARD_PAYMENT_MADE",
    `Card payment of ${paymentAmount}`,
    card.id,
    result.cardTx.id,
    {
      amount: paymentAmount,
      type: "payment",
      actorUserId: userId,
      relatedBankTransactionId: result.bankTx.id,
    },
    card.ownerUserId,
    card.companyId,
  );

  void (async () => {
    const { refreshFromAltaCardContextBestEffort } = await import("@/server/relationship-refresh-hooks.service");
    try {
      await refreshFromAltaCardContextBestEffort(
        { ownerUserId: card.ownerUserId, companyId: card.companyId },
        "alta-card-payment-made",
      );
    } catch (error) {
      console.error("[alta-card] relationship refresh failed", error);
    }
  })();

  void (async () => {
    try {
      const { notifyAltaCardPaymentMade } = await import("@/server/banking-notification.service");
      await notifyAltaCardPaymentMade(card.ownerUserId, {
        cardId: card.id,
        amount: paymentAmount,
        referenceCode,
        cardLastFour: card.cardLastFour,
      });
    } catch (error) {
      console.error("[alta-card] payment notification failed", error);
    }
  })();

  return {
    transaction: result.cardTx,
    bankTransactionId: result.bankTx.id,
    referenceCode,
    amountPaid: paymentAmount,
  };
}

export async function submitCardAutopayPayment(
  actorUserId: string,
  input: SubmitCardPaymentInput & {
    statementId?: string;
    autopayType?: string;
  },
): Promise<{ transaction: AltaCardTransactionRow; bankTransactionId: string; referenceCode: string; amountPaid: number }> {
  const card = await loadCard(input.cardId);
  if (!PAYMENT_ALLOWED_STATUSES.includes(card.status)) {
    badRequest("Payments are not allowed for this card status");
  }

  const { validateAutopaySourceAccountForCard } = await import("@/server/alta-card-autopay.service");
  await validateAutopaySourceAccountForCard(card, input.sourceAccountId);
  const source = await prisma.bankAccount.findUnique({
    where: { id: input.sourceAccountId },
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
      restrictDeposits: true,
      restrictWithdrawals: true,
    },
  });
  if (!source) badRequest("Source account not found");
  if (source.restrictWithdrawals) badRequest("Withdrawals are restricted on this account");

  const currentBalance = decimalToNumber(card.currentBalance);
  const paymentAmount = roundMoney(Math.min(input.amount, currentBalance));
  if (paymentAmount <= 0) badRequest("Payment amount must be greater than zero");

  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  const available = await getAccountAvailableBalance(source.id);
  if (paymentAmount > available) badRequest("Insufficient balance in source account");

  const referenceCode = generateCardTxReference("PAYMENT");
  const memo = input.memo?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const freshCard = await tx.altaCard.findUnique({ where: { id: card.id } });
    if (!freshCard) notFound();

    await applyPaymentInTx(tx, freshCard, paymentAmount);

    await tx.bankAccount.update({
      where: { id: source.id },
      data: { balance: { decrement: paymentAmount } },
    });

    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: source.id,
        type: "WITHDRAWAL",
        amount: paymentAmount,
        status: "APPROVED",
        description: altaCardPaymentDescription(card.cardLastFour),
        memo,
        referenceCode: `${referenceCode}-WD`,
        proofImageUrl: null,
      },
    });

    const cardTx = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        type: "PAYMENT",
        status: "COMPLETED",
        amount: toDecimal(paymentAmount),
        description: altaCardPaymentDescription(card.cardLastFour),
        relatedBankAccountId: source.id,
        relatedBankTransactionId: bankTx.id,
        referenceCode,
        createdByUserId: actorUserId,
        settledAt: new Date(),
        metadata: {
          paymentKind: input.paymentKind,
          memo,
          autopay: true,
          autopayType: input.autopayType ?? null,
          statementId: input.statementId ?? null,
        },
      },
      include: altaCardTransactionInclude,
    });

    const { allocatePaymentToStatements } = await import("@/server/alta-card-statement.service");
    const paidNumbers = await allocatePaymentToStatements(tx, card.id, paymentAmount, actorUserId);

    return { cardTx: mapAltaCardTransactionRow(cardTx), bankTx, paidNumbers };
  });

  for (const num of result.paidNumbers) {
    await writeAuditLog({
      actorUserId,
      action: "ALTA_CARD_STATEMENT_PAID",
      entityType: "ALTA_CARD",
      entityId: card.id,
      description: `Statement #${num} paid via autopay`,
      metadata: {
        cardId: card.id,
        statementNumber: num,
        amount: paymentAmount,
        actorUserId,
        autopay: true,
      },
    });
  }

  await auditTxEvent(
    actorUserId,
    "ALTA_CARD_PAYMENT_MADE",
    `Autopay payment of ${paymentAmount}`,
    card.id,
    result.cardTx.id,
    {
      amount: paymentAmount,
      type: "payment",
      actorUserId,
      autopay: true,
      relatedBankTransactionId: result.bankTx.id,
    },
    card.ownerUserId,
    card.companyId,
  );

  return {
    transaction: result.cardTx,
    bankTransactionId: result.bankTx.id,
    referenceCode,
    amountPaid: paymentAmount,
  };
}

export async function createAdminAltaCardAdjustment(
  adminUserId: string,
  input: CreateAltaCardAdjustmentInput,
): Promise<AltaCardTransactionRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);
  if (input.amount <= 0) badRequest("Amount must be greater than zero");
  if (!input.reason.trim()) badRequest("Reason is required");

  const card = await loadCard(input.cardId);
  const referenceCode = generateCardTxReference("ADJ");
  const type: AltaCardTransactionTypeCode =
    input.kind === "credit" ? "adjustment_credit" : "adjustment_debit";

  const row = await prisma.$transaction(async (tx) => {
    const freshCard = await tx.altaCard.findUnique({ where: { id: card.id } });
    if (!freshCard) notFound();

    if (input.kind === "credit") {
      await applyCreditAdjustmentInTx(tx, freshCard, input.amount);
    } else {
      await applyDebitAdjustmentInTx(tx, freshCard, input.amount, true);
    }

    const created = await tx.altaCardTransaction.create({
      data: {
        altaCardId: card.id,
        type: toDbAltaCardTransactionType(type),
        status: "COMPLETED",
        amount: toDecimal(input.amount),
        description: altaCardAdjustmentDescription(card.cardLastFour),
        referenceCode,
        createdByUserId: adminUserId,
        settledAt: new Date(),
        metadata: { reason: input.reason.trim(), kind: input.kind },
      },
      include: altaCardTransactionInclude,
    });

    return mapAltaCardTransactionRow(created);
  });

  await auditTxEvent(
    adminUserId,
    "ALTA_CARD_ADJUSTMENT_CREATED",
    `Admin ${input.kind} adjustment of ${input.amount}`,
    card.id,
    row.id,
    {
      amount: input.amount,
      type,
      actorUserId: adminUserId,
      reason: input.reason.trim(),
    },
    card.ownerUserId,
    card.companyId,
  );

  return row;
}

export async function reverseAltaCardTransaction(
  adminUserId: string,
  transactionId: string,
  reason?: string,
): Promise<AltaCardTransactionRow> {
  const admin = await getAltaUser(adminUserId);
  assertOperatorOrAdmin(admin);

  const original = await prisma.altaCardTransaction.findUnique({
    where: { id: transactionId },
    include: { altaCard: true, altaEmployeeCard: true },
  });
  if (!original || original.status !== "COMPLETED") notFound();
  if (original.type === "REVERSAL") badRequest("Cannot reverse a reversal");

  const amount = decimalToNumber(original.amount);
  const referenceCode = generateCardTxReference("REV");

  const reversal = await prisma.$transaction(async (tx) => {
    const card = await tx.altaCard.findUnique({ where: { id: original.altaCardId } });
    if (!card) notFound();

    const chargeTypes: AltaCardTransactionType[] = [
      "PURCHASE",
      "ALTA_PAY",
      "CASH_ADVANCE",
      "INTEREST",
      "FEE",
      "ADJUSTMENT_DEBIT",
    ];
    const creditTypes: AltaCardTransactionType[] = ["PAYMENT", "ADJUSTMENT_CREDIT"];

    if (chargeTypes.includes(original.type)) {
      if (original.altaEmployeeCardId && original.altaEmployeeCard) {
        const emp = original.altaEmployeeCard;
        const newEmpBalance = roundMoney(Math.max(0, decimalToNumber(emp.employeeCurrentBalance) - amount));
        const newEmpAvailable = roundMoney(decimalToNumber(emp.employeeSpendLimit) - newEmpBalance);
        await tx.altaEmployeeCard.update({
          where: { id: emp.id },
          data: {
            employeeCurrentBalance: toDecimal(newEmpBalance),
            employeeAvailableLimit: toDecimal(newEmpAvailable),
          },
        });
      }
      await applyPaymentInTx(tx, card, amount);
    } else if (creditTypes.includes(original.type)) {
      await applyChargeInTx(tx, card, amount, null, true);
    } else {
      badRequest("This transaction type cannot be reversed");
    }

    await tx.altaCardTransaction.update({
      where: { id: original.id },
      data: { status: "REVERSED", reversedAt: new Date() },
    });

    const created = await tx.altaCardTransaction.create({
      data: {
        altaCardId: original.altaCardId,
        altaEmployeeCardId: original.altaEmployeeCardId,
        type: "REVERSAL",
        status: "COMPLETED",
        amount: toDecimal(amount),
        description: altaCardReversalDescription(original.description),
        referenceCode,
        createdByUserId: adminUserId,
        settledAt: new Date(),
        reversesTransactionId: original.id,
        metadata: { reason: reason ?? null, originalType: original.type },
      },
      include: altaCardTransactionInclude,
    });

    return mapAltaCardTransactionRow(created);
  });

  await auditTxEvent(
    adminUserId,
    "ALTA_CARD_TRANSACTION_REVERSED",
    `Reversed transaction ${original.referenceCode}`,
    original.altaCardId,
    reversal.id,
    {
      amount,
      type: "reversal",
      actorUserId: adminUserId,
      originalTransactionId: original.id,
    },
    original.altaCard.ownerUserId,
    original.altaCard.companyId,
  );

  return reversal;
}

export async function getCashAdvanceContext(userId: string, cardId: string): Promise<CashAdvanceContext> {
  const card = await loadCard(cardId);
  await assertPersonalCardAccess(userId, card);

  const accounts = await listCardLinkedBankAccounts(userId, card, "cash_advance");

  return {
    card: mapAltaCardRow(card),
    destinationAccounts: accounts.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
    })),
    availableCredit: decimalToNumber(card.availableCredit),
  };
}

export async function getCardPaymentContext(userId: string, cardId: string): Promise<CardPaymentContext> {
  const card = await loadCard(cardId);
  await assertPersonalCardAccess(userId, card);
  if (!PAYMENT_ALLOWED_STATUSES.includes(card.status)) {
    badRequest("Payments are not allowed for this card status");
  }

  const accounts = await listCardLinkedBankAccounts(userId, card);

  const { getAvailableBalancesByAccountIds } = await import("@/server/account-balance.service");
  const availableByAccount = await getAvailableBalancesByAccountIds(accounts.map((a) => a.id));

  const sourceAccounts = accounts.map((a) => ({
    id: a.id,
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    availableBalance: availableByAccount.get(a.id) ?? 0,
  }));

  return {
    card: mapAltaCardRow(card),
    sourceAccounts,
    minimumPayment: decimalToNumber(card.minimumPaymentDue),
    statementBalance: decimalToNumber(card.statementBalance),
    currentBalance: decimalToNumber(card.currentBalance),
  };
}

export async function listAltaCardFundingSources(user: AltaUser): Promise<
  {
    kind: "alta_card";
    id: string;
    label: string;
    cardLastFour: string;
    availableBalance: number;
    tier: string;
  }[]
> {
  const personalCard = await prisma.altaCard.findFirst({
    where: {
      ownerUserId: user.id,
      cardType: "PERSONAL",
      status: "ACTIVE",
    },
  });

  const employeeCards = await prisma.altaEmployeeCard.findMany({
    where: {
      authorizedUserId: user.id,
      status: "ACTIVE",
    },
    include: {
      company: { select: { name: true } },
      parentBusinessCard: true,
    },
  });

  const businessLineCompanyIds = user.companyMemberships
    .filter((membership) => canUseBusinessAltaCardLineForAltaPay(user, membership.companyId))
    .map((membership) => membership.companyId);

  const businessCards =
    businessLineCompanyIds.length > 0
      ? await prisma.altaCard.findMany({
          where: {
            cardType: "BUSINESS",
            status: "ACTIVE",
            companyId: { in: businessLineCompanyIds },
          },
          include: { company: { select: { name: true } } },
        })
      : [];

  const sources: {
    kind: "alta_card";
    id: string;
    label: string;
    cardLastFour: string;
    availableBalance: number;
    tier: string;
    employerCompanyId?: string;
  }[] = [];

  if (personalCard) {
    sources.push({
      kind: "alta_card",
      id: personalCard.id,
      label: `Alta Card •••• ${personalCard.cardLastFour}`,
      cardLastFour: personalCard.cardLastFour,
      availableBalance: decimalToNumber(personalCard.availableCredit),
      tier: personalCard.tier.toLowerCase(),
    });
  }

  for (const businessCard of businessCards) {
    sources.push({
      kind: "alta_card",
      id: businessCard.id,
      label: `${businessCard.company?.name ?? "Business"} · Alta Card •••• ${businessCard.cardLastFour}`,
      cardLastFour: businessCard.cardLastFour,
      availableBalance: decimalToNumber(businessCard.availableCredit),
      tier: businessCard.tier.toLowerCase(),
      employerCompanyId: businessCard.companyId ?? undefined,
    });
  }

  for (const emp of employeeCards) {
    if (emp.parentBusinessCard.status !== "ACTIVE") continue;
    sources.push({
      kind: "alta_card",
      id: `employee:${emp.id}`,
      label: `${emp.company.name} Employee · •••• ${emp.cardLastFour}`,
      cardLastFour: emp.cardLastFour,
      availableBalance: decimalToNumber(emp.employeeAvailableLimit),
      tier: emp.parentBusinessCard.tier.toLowerCase(),
      employerCompanyId: emp.companyId,
    });
  }

  return sources;
}

export function parseAltaCardFundingId(
  fundingId: string,
): { kind: "personal"; cardId: string } | { kind: "employee"; employeeCardId: string } {
  if (fundingId.startsWith("employee:")) {
    return { kind: "employee", employeeCardId: fundingId.slice("employee:".length) };
  }
  return { kind: "personal", cardId: fundingId };
}

export async function chargeAltaCardForAltaPay(
  tx: Prisma.TransactionClient,
  params: {
    user: AltaUser;
    fundingId: string;
    amount: number;
    companyId: string;
    companyName: string;
    altaPayReference: string;
    memo?: string | null;
  },
): Promise<AltaCardTransactionRow> {
  const parsed = parseAltaCardFundingId(params.fundingId);

  if (parsed.kind === "personal") {
    const card = await tx.altaCard.findFirst({
      where: { id: parsed.cardId, status: "ACTIVE" },
    });
    if (!card) badRequest("Select a valid Alta Card");

    if (card.cardType === "PERSONAL") {
      if (card.ownerUserId !== params.user.id) badRequest("Select a valid Alta Card");
    } else if (card.cardType === "BUSINESS") {
      if (!card.companyId || !canUseBusinessAltaCardLineForAltaPay(params.user, card.companyId)) {
        badRequest("Company viewers may only pay with an employee Alta Card.");
      }
      if (card.companyId === params.companyId) {
        badRequest("You cannot use this Alta Card to pay the company it belongs to.");
      }
    } else {
      badRequest("Select a valid Alta Card");
    }

    const row = await chargeAltaCardInTransaction(tx, {
      cardId: card.id,
      type: "alta_pay",
      amount: params.amount,
      description: altaPayToDescription(params.companyName),
      actorUserId: params.user.id,
      merchantCompanyId: params.companyId,
      relatedAltaPayPaymentId: params.altaPayReference,
      referenceCode: `${params.altaPayReference}-CARD`,
      metadata: { memo: params.memo ?? null, fundingSource: `Alta Card •••• ${card.cardLastFour}` },
    });

    return row;
  }

  const employeeCard = await tx.altaEmployeeCard.findFirst({
    where: { id: parsed.employeeCardId, authorizedUserId: params.user.id, status: "ACTIVE" },
    include: { parentBusinessCard: true, company: { select: { name: true } } },
  });
  if (!employeeCard) badRequest("Select a valid employee Alta Card");
  if (employeeCard.parentBusinessCard.status !== "ACTIVE") {
    badRequest("Company Alta Card is not active");
  }
  if (employeeCard.companyId === params.companyId) {
    badRequest("You cannot use this Alta Card to pay the company it belongs to.");
  }

  const row = await chargeAltaCardInTransaction(tx, {
    cardId: employeeCard.parentBusinessCardId,
    employeeCardId: employeeCard.id,
    type: "alta_pay",
    amount: params.amount,
    description: altaPayToDescription(params.companyName),
    actorUserId: params.user.id,
    merchantCompanyId: params.companyId,
    relatedAltaPayPaymentId: params.altaPayReference,
    referenceCode: `${params.altaPayReference}-CARD`,
    metadata: {
      memo: params.memo ?? null,
      fundingSource: `Alta Card •••• ${employeeCard.cardLastFour}`,
      spenderUserId: params.user.id,
    },
  });

  return row;
}
