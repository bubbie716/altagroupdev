import type {
  AltaCardApplicationStatus,
  AltaCardStatus,
  AltaCardTier,
  AltaCardTransactionStatus,
  AltaCardTransactionType,
  AltaCardType,
  Prisma,
} from "@prisma/client";
import type {
  AltaCardApplicationRow,
  AltaCardApplicationStatusCode,
  AltaCardDetail,
  AltaCardRow,
  AltaCardStatusCode,
  AltaCardTierCode,
  AltaCardTransactionRow,
  AltaCardTransactionStatusCode,
  AltaCardTransactionTypeCode,
  AltaCardTypeCode,
  AltaEmployeeCardRow,
} from "@/lib/bank/alta-card-types";

export const altaCardTransactionInclude = {
  merchantCompany: { select: { name: true } },
  createdBy: { select: { discordUsername: true } },
  altaEmployeeCard: {
    include: { authorizedUser: { select: { discordUsername: true, id: true } } },
  },
} satisfies Prisma.AltaCardTransactionInclude;

export const altaCardInclude = {
  owner: { select: { discordUsername: true } },
  company: { select: { name: true } },
  employeeCards: {
    include: {
      authorizedUser: { select: { discordUsername: true } },
      company: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.AltaCardInclude;

export const altaCardApplicationInclude = {
  applicant: { select: { discordUsername: true } },
  company: { select: { name: true } },
  card: { select: { id: true, status: true } },
  thread: { include: { assignedStaff: { select: { discordUsername: true } } } },
} satisfies Prisma.AltaCardApplicationInclude;

type DbAltaCard = Prisma.AltaCardGetPayload<{ include: typeof altaCardInclude }>;
type DbAltaCardApplication = Prisma.AltaCardApplicationGetPayload<{
  include: typeof altaCardApplicationInclude;
}>;

export function toAltaCardTypeCode(value: AltaCardType): AltaCardTypeCode {
  return value.toLowerCase() as AltaCardTypeCode;
}

export function toDbAltaCardType(value: AltaCardTypeCode): AltaCardType {
  return value.toUpperCase() as AltaCardType;
}

export function toAltaCardTierCode(value: AltaCardTier): AltaCardTierCode {
  return value.toLowerCase() as AltaCardTierCode;
}

export function toDbAltaCardTier(value: AltaCardTierCode): AltaCardTier {
  return value.toUpperCase() as AltaCardTier;
}

export function toAltaCardStatusCode(value: AltaCardStatus): AltaCardStatusCode {
  return value.toLowerCase() as AltaCardStatusCode;
}

export function toDbAltaCardStatus(value: AltaCardStatusCode): AltaCardStatus {
  return value.toUpperCase() as AltaCardStatus;
}

export function toAltaCardApplicationStatusCode(
  value: AltaCardApplicationStatus,
): AltaCardApplicationStatusCode {
  return value.toLowerCase() as AltaCardApplicationStatusCode;
}

export function toDbAltaCardApplicationStatus(
  value: AltaCardApplicationStatusCode,
): AltaCardApplicationStatus {
  return value.toUpperCase() as AltaCardApplicationStatus;
}

export function toAltaCardTransactionTypeCode(
  value: AltaCardTransactionType,
): AltaCardTransactionTypeCode {
  return value.toLowerCase() as AltaCardTransactionTypeCode;
}

export function toDbAltaCardTransactionType(
  value: AltaCardTransactionTypeCode,
): AltaCardTransactionType {
  return value.toUpperCase() as AltaCardTransactionType;
}

export function toAltaCardTransactionStatusCode(
  value: AltaCardTransactionStatus,
): AltaCardTransactionStatusCode {
  return value.toLowerCase() as AltaCardTransactionStatusCode;
}

export function toDbAltaCardTransactionStatus(
  value: AltaCardTransactionStatusCode,
): AltaCardTransactionStatus {
  return value.toUpperCase() as AltaCardTransactionStatus;
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

export function mapAltaEmployeeCardRow(
  row: Prisma.AltaEmployeeCardGetPayload<{
    include: {
      authorizedUser: { select: { discordUsername: true } };
      company: { select: { name: true } };
    };
  }>,
): AltaEmployeeCardRow {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    authorizedUserId: row.authorizedUserId,
    authorizedUsername: row.authorizedUser.discordUsername,
    parentBusinessCardId: row.parentBusinessCardId,
    status: toAltaCardStatusCode(row.status),
    employeeSpendLimit: decimalToNumber(row.employeeSpendLimit),
    employeeAvailableLimit: decimalToNumber(row.employeeAvailableLimit),
    employeeCurrentBalance: decimalToNumber(row.employeeCurrentBalance),
    cardLastFour: row.cardLastFour,
    openedAt: row.openedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAltaCardRow(row: DbAltaCard): AltaCardRow {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    ownerUsername: row.owner?.discordUsername ?? null,
    companyId: row.companyId,
    companyName: row.company?.name ?? null,
    applicationId: row.applicationId,
    tier: toAltaCardTierCode(row.tier),
    cardType: toAltaCardTypeCode(row.cardType),
    status: toAltaCardStatusCode(row.status),
    creditLimit: decimalToNumber(row.creditLimit),
    availableCredit: decimalToNumber(row.availableCredit),
    currentBalance: decimalToNumber(row.currentBalance),
    statementBalance: decimalToNumber(row.statementBalance),
    minimumPaymentDue: decimalToNumber(row.minimumPaymentDue),
    interestRate: decimalToNumber(row.interestRate),
    dueDate: row.dueDate?.toISOString() ?? null,
    currentBillingCycleStart: row.currentBillingCycleStart?.toISOString() ?? null,
    currentBillingCycleEnd: row.currentBillingCycleEnd?.toISOString() ?? null,
    currentStatementId: row.currentStatementId,
    lastStatementDate: row.lastStatementDate?.toISOString() ?? null,
    nextStatementDate: row.nextStatementDate?.toISOString() ?? null,
    paymentDueDate: row.paymentDueDate?.toISOString() ?? null,
    cardLastFour: row.cardLastFour,
    openedAt: row.openedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAltaCardDetail(
  row: DbAltaCard,
  recentTransactions: AltaCardTransactionRow[] = [],
): AltaCardDetail {
  return {
    ...mapAltaCardRow(row),
    employeeCards: row.employeeCards.map(mapAltaEmployeeCardRow),
    recentTransactions,
  };
}

type DbAltaCardTransaction = Prisma.AltaCardTransactionGetPayload<{
  include: typeof altaCardTransactionInclude;
}>;

export function mapAltaCardTransactionRow(row: DbAltaCardTransaction): AltaCardTransactionRow {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const spenderUserId =
    row.altaEmployeeCard?.authorizedUser.id ??
    (typeof metadata?.spenderUserId === "string" ? metadata.spenderUserId : row.createdByUserId);
  const spenderUsername =
    row.altaEmployeeCard?.authorizedUser.discordUsername ??
    row.createdBy?.discordUsername ??
    null;

  return {
    id: row.id,
    altaCardId: row.altaCardId,
    altaEmployeeCardId: row.altaEmployeeCardId,
    type: toAltaCardTransactionTypeCode(row.type),
    status: toAltaCardTransactionStatusCode(row.status),
    amount: decimalToNumber(row.amount),
    description: row.description,
    merchantCompanyId: row.merchantCompanyId,
    merchantCompanyName: row.merchantCompany?.name ?? null,
    relatedBankAccountId: row.relatedBankAccountId,
    relatedBankTransactionId: row.relatedBankTransactionId,
    relatedAltaPayPaymentId: row.relatedAltaPayPaymentId,
    referenceCode: row.referenceCode,
    createdByUserId: row.createdByUserId,
    createdByUsername: row.createdBy?.discordUsername ?? null,
    spenderUserId,
    spenderUsername,
    employeeCardLastFour: row.altaEmployeeCard?.cardLastFour ?? null,
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversesTransactionId: row.reversesTransactionId,
    metadata,
  };
}

export function mapAltaCardApplicationRow(row: DbAltaCardApplication): AltaCardApplicationRow {
  return {
    id: row.id,
    applicantUserId: row.applicantUserId,
    applicantUsername: row.applicant.discordUsername,
    companyId: row.companyId,
    companyName: row.company?.name ?? null,
    cardType: toAltaCardTypeCode(row.cardType),
    requestedTier: toAltaCardTierCode(row.requestedTier),
    status: toAltaCardApplicationStatusCode(row.status),
    requestedLimit: row.requestedLimit ? decimalToNumber(row.requestedLimit) : null,
    approvedTier: row.approvedTier ? toAltaCardTierCode(row.approvedTier) : null,
    approvedLimit: row.approvedLimit ? decimalToNumber(row.approvedLimit) : null,
    approvedInterestRate: row.approvedInterestRate ? decimalToNumber(row.approvedInterestRate) : null,
    billingCycleDay: row.billingCycleDay ?? null,
    purpose: row.purpose,
    paymentSourceAccountId: row.paymentSourceAccountId,
    expectedMonthlySpend: row.expectedMonthlySpend ? decimalToNumber(row.expectedMonthlySpend) : null,
    employeeCardsNeeded: row.employeeCardsNeeded,
    reviewNote: row.reviewNote,
    denialReason: row.denialReason,
    goldOverride: row.goldOverride,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    cardId: row.card?.id ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAltaCardApplicationDetail(row: DbAltaCardApplication): import("@/lib/bank/alta-card-types").AltaCardApplicationDetail {
  const base = mapAltaCardApplicationRow(row);
  const threadStatus = row.thread?.status
    ? (row.thread.status.toLowerCase() as import("@/lib/bank/alta-card-application-thread-types").AltaCardApplicationThreadStatusCode)
    : null;
  return {
    ...base,
    threadStatus,
    assignedStaffName: row.thread?.assignedStaff?.discordUsername ?? null,
  };
}
