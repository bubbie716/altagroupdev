import type { AltaCardAutopayStatus, AltaCardAutopayType, AltaCardStatementStatus } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canManageCompanyAltaCard, isAdmin, isOperator } from "@/lib/auth/permissions";
import {
  calculateAltaCardMinimumPayment,
  calculateRemainingStatementBalance,
  roundMoney,
} from "@/lib/bank/alta-card-minimum-payment";
import { startOfUtcDay } from "@/lib/bank/alta-card-billing-cycle";
import type {
  AltaCardAutopaySettings,
  AltaCardAutopayStatusCode,
  AltaCardAutopayTypeCode,
  UpdateAltaCardAutopayInput,
} from "@/lib/bank/alta-card-autopay-types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { submitCardAutopayPayment } from "@/server/alta-card-transaction.service";
import { toAltaCardAutopayStatusCode, toAltaCardAutopayTypeCode } from "@/server/alta-card-autopay-mapper";

const UNPAID_STATUSES: AltaCardStatementStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const AUTOPAY_ELIGIBLE_CARD_STATUSES = ["ACTIVE", "FROZEN", "DELINQUENT"] as const;

const AUTOPAY_RUN_ACTIONS = [
  "ALTA_CARD_AUTOPAY_SUCCESS",
  "ALTA_CARD_AUTOPAY_FAILED",
  "ALTA_CARD_AUTOPAY_SKIPPED",
] as const;

function notFound(): never {
  throw new Error("NOT_FOUND");
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function accountLabel(account: { accountName: string; accountNumber: string } | null | undefined): string | null {
  if (!account) return null;
  return `${account.accountName} · ${account.accountNumber}`;
}

function toDbAutopayType(type: AltaCardAutopayTypeCode): AltaCardAutopayType {
  return type.toUpperCase() as AltaCardAutopayType;
}

function calculateRemainingMinimumDue(statementBalance: number, amountPaid: number): number {
  const remainingBalance = calculateRemainingStatementBalance(statementBalance, amountPaid);
  if (remainingBalance <= 0) return 0;
  const minimumRequired = calculateAltaCardMinimumPayment(statementBalance);
  if (amountPaid >= minimumRequired) return 0;
  return roundMoney(Math.min(minimumRequired - amountPaid, remainingBalance));
}

export async function calculateAltaCardAutopayAmount(
  cardId: string,
  statementId: string,
): Promise<number> {
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();

  const statement = await prisma.altaCardStatement.findUnique({ where: { id: statementId } });
  if (!statement || statement.altaCardId !== cardId) {
    badRequest("Statement not found for this card");
  }

  const statementBalance = decimalToNumber(statement.statementBalance);
  const amountPaid = decimalToNumber(statement.amountPaid);
  const remainingBalance = calculateRemainingStatementBalance(statementBalance, amountPaid);
  if (remainingBalance <= 0) return 0;

  if (!card.autopayType) {
    badRequest("Autopay type is not configured");
  }

  switch (card.autopayType) {
    case "MINIMUM_PAYMENT":
      return calculateRemainingMinimumDue(statementBalance, amountPaid);
    case "STATEMENT_BALANCE":
      return remainingBalance;
    case "FIXED_AMOUNT": {
      const fixedAmount = decimalToNumber(card.autopayFixedAmount);
      if (fixedAmount <= 0) badRequest("Fixed autopay amount must be greater than zero");
      return roundMoney(Math.min(fixedAmount, remainingBalance));
    }
    default:
      badRequest("Invalid autopay settings");
  }
}

export const calculateAutopayAmount = calculateAltaCardAutopayAmount;

async function assertCanManageAutopay(user: AltaUser, card: {
  cardType: string;
  ownerUserId: string | null;
  companyId: string | null;
}): Promise<void> {
  if (isAdmin(user) || isOperator(user)) return;
  if (card.cardType === "PERSONAL" && card.ownerUserId === user.id) return;
  if (card.cardType === "BUSINESS" && card.companyId && canManageCompanyAltaCard(user, card.companyId)) {
    return;
  }
  forbidden();
}

async function assertCanViewAutopay(user: AltaUser, card: {
  cardType: string;
  ownerUserId: string | null;
  companyId: string | null;
}): Promise<void> {
  if (isAdmin(user) || isOperator(user)) return;
  if (card.cardType === "PERSONAL" && card.ownerUserId === user.id) return;
  if (card.cardType === "BUSINESS" && card.companyId) {
    const { assertCardAccess } = await import("@/server/alta-card.service");
    await assertCardAccess(user.id, card);
    return;
  }
  forbidden();
}

async function validateAutopaySourceAccount(
  card: { cardType: string; ownerUserId: string | null; companyId: string | null },
  accountId: string,
): Promise<void> {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) badRequest("Source account not found");
  if (account.status !== "ACTIVE") badRequest("Source account is not active");
  if (account.restrictWithdrawals) badRequest("Withdrawals are restricted on the source account");

  if (card.cardType === "PERSONAL") {
    if (account.userId !== card.ownerUserId || account.companyId !== null) {
      badRequest("Source account must belong to the card owner");
    }
    return;
  }

  if (card.cardType === "BUSINESS") {
    if (account.companyId !== card.companyId || account.accountType !== "BUSINESS_OPERATING") {
      badRequest("Source account must be a company business operating account");
    }
    return;
  }

  badRequest("Autopay is not available for this card type");
}

export async function validateAutopaySourceAccountForCard(
  card: { cardType: string; ownerUserId: string | null; companyId: string | null },
  accountId: string,
): Promise<void> {
  return validateAutopaySourceAccount(card, accountId);
}

export async function getAutopayContext(
  cardId: string,
  actorUserId: string,
): Promise<import("@/lib/bank/alta-card-autopay-types").AltaCardAutopayContext> {
  const settings = await getAutopaySettings(cardId, actorUserId);
  const { getCardPaymentContext } = await import("@/server/alta-card-transaction.service");
  const paymentContext = await getCardPaymentContext(actorUserId, cardId);

  return {
    settings,
    sourceAccounts: paymentContext.sourceAccounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      availableBalance: account.availableBalance,
    })),
  };
}

function mapAutopaySettings(
  card: {
    autopayEnabled: boolean;
    autopaySourceAccountId: string | null;
    autopayType: AltaCardAutopayType | null;
    autopayFixedAmount: { toString(): string } | null;
    autopayLastRunAt: Date | null;
    autopayLastStatus: AltaCardAutopayStatus;
    autopayFailureReason: string | null;
    autopaySourceAccount?: { accountName: string; accountNumber: string } | null;
  },
  options?: { canManage?: boolean },
): AltaCardAutopaySettings {
  return {
    enabled: card.autopayEnabled,
    sourceAccountId: card.autopaySourceAccountId,
    sourceAccountLabel: accountLabel(card.autopaySourceAccount),
    type: card.autopayType ? toAltaCardAutopayTypeCode(card.autopayType) : null,
    fixedAmount: card.autopayFixedAmount ? decimalToNumber(card.autopayFixedAmount) : null,
    lastRunAt: card.autopayLastRunAt?.toISOString() ?? null,
    lastStatus: toAltaCardAutopayStatusCode(card.autopayLastStatus),
    failureReason: card.autopayFailureReason,
    canManage: options?.canManage ?? false,
  };
}

export function mapAutopaySettingsForCard(
  card: Parameters<typeof mapAutopaySettings>[0],
  options?: { canManage?: boolean },
): AltaCardAutopaySettings {
  return mapAutopaySettings(card, options);
}

export async function getAutopaySettings(
  cardId: string,
  actorUserId: string,
): Promise<AltaCardAutopaySettings> {
  const user = await getAltaUser(actorUserId);
  const card = await prisma.altaCard.findUnique({
    where: { id: cardId },
    include: { autopaySourceAccount: { select: { accountName: true, accountNumber: true } } },
  });
  if (!card) notFound();

  await assertCanViewAutopay(user, card);

  let canManage = false;
  try {
    await assertCanManageAutopay(user, card);
    canManage = card.cardType !== "EMPLOYEE";
  } catch {
    canManage = false;
  }

  return mapAutopaySettings(card, { canManage });
}

export async function updateAutopaySettings(
  cardId: string,
  input: UpdateAltaCardAutopayInput,
  actorUserId: string,
): Promise<AltaCardAutopaySettings> {
  const user = await getAltaUser(actorUserId);
  const card = await prisma.altaCard.findUnique({
    where: { id: cardId },
    include: { autopaySourceAccount: { select: { accountName: true, accountNumber: true } } },
  });
  if (!card) notFound();
  if (card.cardType === "EMPLOYEE") badRequest("Employee cards use the parent business card autopay settings");
  await assertCanManageAutopay(user, card);

  if (!AUTOPAY_ELIGIBLE_CARD_STATUSES.includes(card.status as (typeof AUTOPAY_ELIGIBLE_CARD_STATUSES)[number])) {
    badRequest("Autopay is not available for this card status");
  }

  const enabling = input.enabled ?? card.autopayEnabled;
  const nextType = input.type ?? (card.autopayType ? toAltaCardAutopayTypeCode(card.autopayType) : null);
  const nextSourceAccountId = input.sourceAccountId ?? card.autopaySourceAccountId;
  const nextFixedAmount = input.fixedAmount ?? decimalToNumber(card.autopayFixedAmount);

  if (!enabling) {
    const updated = await prisma.altaCard.update({
      where: { id: cardId },
      data: { autopayEnabled: false },
      include: { autopaySourceAccount: { select: { accountName: true, accountNumber: true } } },
    });

    await writeAuditLog({
      actorUserId,
      action: card.autopayEnabled ? "ALTA_CARD_AUTOPAY_DISABLED" : "ALTA_CARD_AUTOPAY_SETTINGS_UPDATED",
      entityType: "ALTA_CARD",
      entityId: cardId,
      description: "Autopay disabled for Alta Card",
      targetUserId: card.ownerUserId ?? undefined,
      targetCompanyId: card.companyId ?? undefined,
      metadata: {
        cardId,
        actorUserId,
        enabled: false,
      },
    });

    return mapAutopaySettings(updated, { canManage: true });
  }

  if (!nextSourceAccountId) badRequest("Select a source account for automatic payments");
  if (!nextType) badRequest("Select an autopay payment type");
  if (nextType === "fixed_amount" && nextFixedAmount <= 0) {
    badRequest("Fixed autopay amount must be greater than zero");
  }

  await validateAutopaySourceAccount(card, nextSourceAccountId);

  const wasEnabled = card.autopayEnabled;
  const updated = await prisma.altaCard.update({
    where: { id: cardId },
    data: {
      autopayEnabled: true,
      autopaySourceAccountId: nextSourceAccountId,
      autopayType: toDbAutopayType(nextType),
      autopayFixedAmount: nextType === "fixed_amount" ? nextFixedAmount : null,
      autopayFailureReason: null,
    },
    include: { autopaySourceAccount: { select: { accountName: true, accountNumber: true } } },
  });

  await writeAuditLog({
    actorUserId,
    action: wasEnabled ? "ALTA_CARD_AUTOPAY_SETTINGS_UPDATED" : "ALTA_CARD_AUTOPAY_ENABLED",
    entityType: "ALTA_CARD",
    entityId: cardId,
    description: wasEnabled ? "Autopay settings updated" : "Autopay enabled for Alta Card",
    targetUserId: card.ownerUserId ?? undefined,
    targetCompanyId: card.companyId ?? undefined,
    metadata: {
      cardId,
      actorUserId,
      sourceAccountId: nextSourceAccountId,
      autopayType: nextType,
      fixedAmount: nextType === "fixed_amount" ? nextFixedAmount : null,
      enabled: true,
    },
  });

  return mapAutopaySettings(updated, { canManage: true });
}

async function resolveAutopayActorUserId(): Promise<string> {
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

function isStatementDueForAutopay(dueDate: Date, now: Date): boolean {
  return startOfUtcDay(now).getTime() >= startOfUtcDay(dueDate).getTime();
}

async function hasAutopayRunForStatementToday(cardId: string, statementId: string): Promise<boolean> {
  const start = startOfUtcDay(new Date());
  const logs = await prisma.auditLog.findMany({
    where: {
      entityId: cardId,
      action: { in: [...AUTOPAY_RUN_ACTIONS] },
      createdAt: { gte: start },
    },
    select: { metadata: true },
  });

  return logs.some((entry) => {
    if (!entry.metadata || typeof entry.metadata !== "object") return false;
    return (entry.metadata as Record<string, unknown>).statementId === statementId;
  });
}

function paymentKindForAutopayType(type: AltaCardAutopayType): "minimum" | "statement" | "custom" {
  switch (type) {
    case "MINIMUM_PAYMENT":
      return "minimum";
    case "STATEMENT_BALANCE":
      return "statement";
    case "FIXED_AMOUNT":
      return "custom";
  }
}

async function recordAutopayRun(
  cardId: string,
  actorUserId: string,
  status: AltaCardAutopayStatus,
  metadata: Record<string, unknown>,
  failureReason?: string | null,
): Promise<void> {
  const card = await prisma.altaCard.findUnique({
    where: { id: cardId },
    select: { ownerUserId: true },
  });

  await prisma.altaCard.update({
    where: { id: cardId },
    data: {
      autopayLastRunAt: new Date(),
      autopayLastStatus: status,
      autopayFailureReason: failureReason ?? null,
    },
  });

  const action =
    status === "SUCCESS"
      ? "ALTA_CARD_AUTOPAY_SUCCESS"
      : status === "SKIPPED"
        ? "ALTA_CARD_AUTOPAY_SKIPPED"
        : "ALTA_CARD_AUTOPAY_FAILED";

  await writeAuditLog({
    actorUserId,
    action,
    entityType: "ALTA_CARD",
    entityId: cardId,
    description:
      status === "SUCCESS"
        ? "Autopay payment succeeded"
        : status === "SKIPPED"
          ? "Autopay skipped"
          : "Autopay payment failed",
    metadata: { cardId, actorUserId, ...metadata },
  });

  if (!card?.ownerUserId) return;

  try {
    const {
      notifyAltaCardAutopaySucceededBestEffort,
      notifyAltaCardAutopayFailedBestEffort,
    } = await import("@/server/banking-notification.service");
    const amount = typeof metadata.amount === "number" ? metadata.amount : 0;
    const referenceCode =
      typeof metadata.referenceCode === "string"
        ? metadata.referenceCode
        : typeof metadata.paymentReferenceCode === "string"
          ? metadata.paymentReferenceCode
          : null;

    if (status === "SUCCESS") {
      await notifyAltaCardAutopaySucceededBestEffort(card.ownerUserId, {
        cardId,
        amount,
        referenceCode,
      });
    } else if (status === "FAILED") {
      await notifyAltaCardAutopayFailedBestEffort(card.ownerUserId, {
        cardId,
        amount,
        reason: failureReason ?? "Autopay could not be completed.",
      });
    }
  } catch (error) {
    console.error("[alta-card-autopay] notification failed", error);
  }
}

export type RunAutopayForCardResult = {
  status: AltaCardAutopayStatusCode;
  amount: number;
  statementId: string | null;
  failureReason: string | null;
  paymentReferenceCode: string | null;
};

export async function runAutopayForCard(
  cardId: string,
  actorUserId?: string,
  options?: { force?: boolean; manualReason?: string },
): Promise<RunAutopayForCardResult> {
  const card = await prisma.altaCard.findUnique({ where: { id: cardId } });
  if (!card) notFound();

  const resolvedActorUserId = actorUserId ?? (await resolveAutopayActorUserId());
  const now = new Date();

  await writeAuditLog({
    actorUserId: resolvedActorUserId,
    action: "ALTA_CARD_AUTOPAY_RUN",
    entityType: "ALTA_CARD",
    entityId: cardId,
    description: options?.manualReason?.trim() || "Autopay run started",
    metadata: {
      cardId,
      actorUserId: resolvedActorUserId,
      manual: Boolean(options?.manualReason),
      reason: options?.manualReason ?? null,
    },
  });

  if (!card.autopayEnabled) {
    const reason = "Autopay is not enabled";
    await recordAutopayRun(cardId, resolvedActorUserId, "FAILED", { failureReason: reason }, reason);
    return { status: "failed", amount: 0, statementId: null, failureReason: reason, paymentReferenceCode: null };
  }

  if (!card.autopaySourceAccountId || !card.autopayType) {
    const reason = "Invalid autopay settings";
    await recordAutopayRun(cardId, resolvedActorUserId, "FAILED", { failureReason: reason }, reason);
    return { status: "failed", amount: 0, statementId: null, failureReason: reason, paymentReferenceCode: null };
  }

  if (!AUTOPAY_ELIGIBLE_CARD_STATUSES.includes(card.status as (typeof AUTOPAY_ELIGIBLE_CARD_STATUSES)[number])) {
    const reason = "Card is not active";
    await recordAutopayRun(cardId, resolvedActorUserId, "FAILED", { failureReason: reason }, reason);
    return { status: "failed", amount: 0, statementId: null, failureReason: reason, paymentReferenceCode: null };
  }

  const dueStatement = await prisma.altaCardStatement.findFirst({
    where: {
      altaCardId: cardId,
      status: { in: UNPAID_STATUSES },
      remainingBalance: { gt: 0 },
    },
    orderBy: { statementNumber: "asc" },
  });

  if (!dueStatement) {
    const reason = "No unpaid statement";
    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "SKIPPED",
      { failureReason: reason, autopayType: card.autopayType, sourceAccountId: card.autopaySourceAccountId },
      reason,
    );
    return { status: "skipped", amount: 0, statementId: null, failureReason: reason, paymentReferenceCode: null };
  }

  if (!options?.force && !isStatementDueForAutopay(dueStatement.dueDate, now)) {
    const reason = "Statement payment is not due yet";
    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "SKIPPED",
      {
        statementId: dueStatement.id,
        failureReason: reason,
        autopayType: card.autopayType,
        sourceAccountId: card.autopaySourceAccountId,
      },
      reason,
    );
    return {
      status: "skipped",
      amount: 0,
      statementId: dueStatement.id,
      failureReason: reason,
      paymentReferenceCode: null,
    };
  }

  if (!options?.force && (await hasAutopayRunForStatementToday(cardId, dueStatement.id))) {
    const reason = "Autopay already attempted for this statement today";
    return {
      status: toAltaCardAutopayStatusCode(card.autopayLastStatus),
      amount: 0,
      statementId: dueStatement.id,
      failureReason: reason,
      paymentReferenceCode: null,
    };
  }

  let amount = 0;
  try {
    amount = await calculateAltaCardAutopayAmount(cardId, dueStatement.id);
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Invalid autopay settings";
    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "FAILED",
      {
        statementId: dueStatement.id,
        autopayType: card.autopayType,
        sourceAccountId: card.autopaySourceAccountId,
        failureReason: reason,
      },
      reason,
    );
    return {
      status: "failed",
      amount: 0,
      statementId: dueStatement.id,
      failureReason: reason,
      paymentReferenceCode: null,
    };
  }

  if (amount <= 0) {
    const reason = "No payment due";
    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "SKIPPED",
      {
        statementId: dueStatement.id,
        amount: 0,
        autopayType: card.autopayType,
        sourceAccountId: card.autopaySourceAccountId,
        failureReason: reason,
      },
      reason,
    );
    return {
      status: "skipped",
      amount: 0,
      statementId: dueStatement.id,
      failureReason: reason,
      paymentReferenceCode: null,
    };
  }

  try {
    await validateAutopaySourceAccount(card, card.autopaySourceAccountId);
    const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
    const available = await getAccountAvailableBalance(card.autopaySourceAccountId);
    if (amount > available) {
      throw new Error("Insufficient funds in source account");
    }

    const payment = await submitCardAutopayPayment(resolvedActorUserId, {
      cardId,
      sourceAccountId: card.autopaySourceAccountId,
      amount,
      paymentKind: paymentKindForAutopayType(card.autopayType),
      memo: `Autopay · statement #${dueStatement.statementNumber}`,
      statementId: dueStatement.id,
      autopayType: card.autopayType,
    });

    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "SUCCESS",
      {
        statementId: dueStatement.id,
        sourceAccountId: card.autopaySourceAccountId,
        autopayType: card.autopayType,
        amount: payment.amountPaid,
        referenceCode: payment.referenceCode,
      },
      null,
    );

    return {
      status: "success",
      amount: payment.amountPaid,
      statementId: dueStatement.id,
      failureReason: null,
      paymentReferenceCode: payment.referenceCode,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Payment service failed";
    await recordAutopayRun(
      cardId,
      resolvedActorUserId,
      "FAILED",
      {
        statementId: dueStatement.id,
        sourceAccountId: card.autopaySourceAccountId,
        autopayType: card.autopayType,
        amount,
        failureReason: reason,
      },
      reason,
    );
    return {
      status: "failed",
      amount,
      statementId: dueStatement.id,
      failureReason: reason,
      paymentReferenceCode: null,
    };
  }
}

export type RunAutopayForDueStatementsResult = {
  dueCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
};

export async function runAutopayForDueStatements(
  actorUserId?: string,
  now = new Date(),
): Promise<RunAutopayForDueStatementsResult> {
  const cards = await prisma.altaCard.findMany({
    where: {
      autopayEnabled: true,
      autopaySourceAccountId: { not: null },
      autopayType: { not: null },
      cardType: { in: ["PERSONAL", "BUSINESS"] },
      status: { in: [...AUTOPAY_ELIGIBLE_CARD_STATUSES] },
    },
    select: { id: true },
  });

  const cardIds = cards.map((c) => c.id);
  const dueStatements =
    cardIds.length === 0
      ? []
      : await prisma.altaCardStatement.findMany({
          where: {
            altaCardId: { in: cardIds },
            status: { in: UNPAID_STATUSES },
            remainingBalance: { gt: 0 },
          },
          orderBy: [{ altaCardId: "asc" }, { statementNumber: "asc" }],
        });

  const dueByCard = new Map<string, (typeof dueStatements)[number]>();
  for (const statement of dueStatements) {
    if (!dueByCard.has(statement.altaCardId)) {
      dueByCard.set(statement.altaCardId, statement);
    }
  }

  let dueCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const card of cards) {
    const dueStatement = dueByCard.get(card.id);
    if (!dueStatement || !isStatementDueForAutopay(dueStatement.dueDate, now)) continue;

    dueCount += 1;
    const result = await runAutopayForCard(card.id, actorUserId);
    if (result.status === "success") successCount += 1;
    else if (result.status === "failed") failedCount += 1;
    else skippedCount += 1;
  }

  // TODO: payment due reminder notification for cards with unpaid statements due soon

  return { dueCount, successCount, failedCount, skippedCount };
}

export async function listAutopayAuditHistory(cardId: string, limit = 20) {
  return prisma.auditLog.findMany({
    where: {
      entityId: cardId,
      action: {
        in: [
          "ALTA_CARD_AUTOPAY_ENABLED",
          "ALTA_CARD_AUTOPAY_DISABLED",
          "ALTA_CARD_AUTOPAY_SETTINGS_UPDATED",
          "ALTA_CARD_AUTOPAY_RUN",
          "ALTA_CARD_AUTOPAY_SUCCESS",
          "ALTA_CARD_AUTOPAY_FAILED",
          "ALTA_CARD_AUTOPAY_SKIPPED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { discordUsername: true } } },
  });
}
