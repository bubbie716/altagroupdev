import type { RelationshipTier as DbRelationshipTier, Prisma } from "@prisma/client";
import type {
  CalculatedRelationshipProfile,
  CustomerRelationshipView,
  RelationshipFactor,
  RelationshipIntelligenceDashboard,
  RelationshipProductsHeld,
  RelationshipProfileRow,
  RelationshipProfileSnapshotRow,
  RelationshipProfileSummary,
  RelationshipTierCode,
} from "@/lib/bank/relationship-intelligence-types";
import {
  RELATIONSHIP_SCORE_BASE,
  RELATIONSHIP_SCORE_MAX,
  RELATIONSHIP_SCORE_WEIGHTS,
  RELATIONSHIP_TIER_LABELS,
  computePrivateBankingEligible,
  relationshipTierFromScore,
} from "@/lib/bank/relationship-intelligence-config";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { countVerifiedOwnedCompanies, resolveOwnedCompanyIds } from "@/lib/bank/relationship-owner-policy";
import { capNegativeMagnitude, capPositive } from "@/lib/bank/relationship-scoring-utils";
import {
  pruneRelationshipProfileSnapshots,
  shouldWriteRelationshipSnapshot,
} from "@/lib/bank/relationship-snapshot-policy";
import { isPrivateClient } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireAuth } from "@/server/auth.service";
import { requireOperator } from "@/server/permissions.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function tierToCode(tier: DbRelationshipTier): RelationshipTierCode {
  return tier as RelationshipTierCode;
}

function tierToDb(tier: RelationshipTierCode): DbRelationshipTier {
  return tier as DbRelationshipTier;
}

function factorImpactType(impact: number): RelationshipFactor["impactType"] {
  if (impact > 0) return "positive";
  if (impact < 0) return "negative";
  return "neutral";
}

type AggregatedInputs = {
  relationshipSince: Date;
  totalBankAssets: number;
  totalInvestments: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestEarned: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  lifetimeLoanPayments: number;
  lifetimeCardPayments: number;
  activeLoanBalance: number;
  activeCardBalance: number;
  productsHeld: RelationshipProductsHeld;
  delinquentCards: number;
  defaultedLoans: number;
  overdueInstallments: number;
  failedAutopayCards: number;
  restrictedAccounts: number;
  negativeUserStatus: boolean;
  relationshipMonths: number;
  hasBusinessAccounts: boolean;
};

async function resolveUserAccountIds(userId: string, ownedCompanyIds: string[]): Promise<string[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ userId, companyId: null }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
    },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

async function aggregateRelationshipInputs(userId: string): Promise<AggregatedInputs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tags: true,
      companyMemberships: { include: { company: { select: { id: true, verificationStatus: true } } } },
    },
  });
  if (!user) throw new Error("NOT_FOUND");

  const ownedCompanyIds = resolveOwnedCompanyIds(user.companyMemberships);
  const verifiedCompanies = countVerifiedOwnedCompanies(user.companyMemberships);
  const accountIds = await resolveUserAccountIds(userId, ownedCompanyIds);

  const [
    bankAccounts,
    depositAgg,
    withdrawalAgg,
    interestEarnedAgg,
    altaPayAgg,
    loans,
    loanPaymentAgg,
    loanInterestPaidAgg,
    cards,
    cardPaymentAgg,
    cardInterestAgg,
    applications,
    earliestAccount,
    earliestLoan,
    earliestCard,
    earliestApp,
    overdueInstallments,
    failedAutopayCount,
    restrictedPersonalAccounts,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { userId, companyId: null },
          ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : []),
        ],
      },
      select: { balance: true, accountType: true, companyId: true, createdAt: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { bankAccountId: { in: accountIds }, type: "DEPOSIT", status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { bankAccountId: { in: accountIds }, type: "WITHDRAWAL", status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { bankAccountId: { in: accountIds }, type: "INTEREST_CREDIT", status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: {
        bankAccountId: { in: accountIds },
        description: { contains: "Alta Pay", mode: "insensitive" },
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.loan.findMany({
      where: {
        OR: [
          { borrowerUserId: userId },
          ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : []),
        ],
      },
      select: {
        status: true,
        outstandingBalance: true,
        accruedInterest: true,
        principalOutstanding: true,
        createdAt: true,
      },
    }),
    prisma.loanPayment.aggregate({
      where: {
        status: "COMPLETED",
        loan: {
          OR: [{ borrowerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
        },
      },
      _sum: { amount: true },
    }),
    prisma.loanPayment.aggregate({
      where: {
        status: "COMPLETED",
        loan: {
          OR: [{ borrowerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
        },
      },
      _sum: { appliedToInterest: true },
    }),
    prisma.altaCard.findMany({
      where: {
        OR: [{ ownerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
      },
      select: {
        status: true,
        currentBalance: true,
        autopayLastStatus: true,
        createdAt: true,
      },
    }),
    prisma.altaCardTransaction.aggregate({
      where: {
        type: "PAYMENT",
        altaCard: {
          OR: [{ ownerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
        },
      },
      _sum: { amount: true },
    }),
    prisma.altaCardStatement.aggregate({
      where: {
        altaCard: {
          OR: [{ ownerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
        },
      },
      _sum: { interestCharged: true },
    }),
    prisma.altaCardApplication.findMany({
      where: { applicantUserId: userId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 1,
    }),
    prisma.bankAccount.findFirst({
      where: {
        OR: [{ userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loan.findFirst({
      where: {
        OR: [{ borrowerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.altaCard.findFirst({
      where: {
        OR: [{ ownerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loanApplication.findFirst({
      where: { applicantUserId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loanPaymentScheduleItem.count({
      where: {
        status: "OVERDUE",
        loan: {
          OR: [{ borrowerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
        },
      },
    }),
    prisma.altaCard.count({
      where: {
        autopayLastStatus: "FAILED",
        OR: [{ ownerUserId: userId }, ...(ownedCompanyIds.length ? [{ companyId: { in: ownedCompanyIds } }] : [])],
      },
    }),
    prisma.bankAccount.count({
      where: {
        userId,
        companyId: null,
        OR: [
          { status: "FROZEN" },
          { restrictDeposits: true },
          { restrictWithdrawals: true },
          { restrictTransfers: true },
        ],
      },
    }),
  ]);

  const totalBankAssets = roundMoney(
    bankAccounts.reduce((sum, account) => sum + decimalToNumber(account.balance), 0),
  );
  const totalInvestments = 0;
  const lifetimeDeposits = roundMoney(decimalToNumber(depositAgg._sum.amount));
  const lifetimeWithdrawals = roundMoney(Math.abs(decimalToNumber(withdrawalAgg._sum.amount)));
  const lifetimeInterestEarned = roundMoney(decimalToNumber(interestEarnedAgg._sum.amount));
  const lifetimeAltaPayVolume = roundMoney(Math.abs(decimalToNumber(altaPayAgg._sum.amount)));
  const lifetimeLoanPayments = roundMoney(decimalToNumber(loanPaymentAgg._sum.amount));
  const lifetimeCardPayments = roundMoney(Math.abs(decimalToNumber(cardPaymentAgg._sum.amount)));
  const loanInterestPaid = roundMoney(decimalToNumber(loanInterestPaidAgg._sum.appliedToInterest));
  const cardInterestPaid = roundMoney(decimalToNumber(cardInterestAgg._sum.interestCharged));
  const lifetimeInterestPaid = roundMoney(loanInterestPaid + cardInterestPaid);

  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE" || loan.status === "FROZEN");
  const paidOffLoans = loans.filter((loan) => loan.status === "PAID_OFF");
  const defaultedLoans = loans.filter((loan) => loan.status === "DEFAULTED");
  const activeLoanBalance = roundMoney(
    activeLoans.reduce(
      (sum, loan) => sum + decimalToNumber(loan.outstandingBalance) + decimalToNumber(loan.accruedInterest),
      0,
    ),
  );

  const activeCards = cards.filter((card) => card.status === "ACTIVE" || card.status === "FROZEN");
  const delinquentCards = cards.filter((card) => card.status === "DELINQUENT");
  const activeCardBalance = roundMoney(
    activeCards.concat(delinquentCards).reduce((sum, card) => sum + decimalToNumber(card.currentBalance), 0),
  );

  const hasBusinessAccounts = bankAccounts.some((account) => account.companyId != null);
  const privateClient = user.tags.some((assignment) => assignment.tag === "PRIVATE_CLIENT");

  const productsHeld: RelationshipProductsHeld = {
    activeBankAccounts: bankAccounts.length,
    activeAltaCards: activeCards.length + delinquentCards.length,
    activeLoans: activeLoans.length,
    paidOffLoans: paidOffLoans.length,
    businessCompanies: ownedCompanyIds.length,
    verifiedCompanies,
    isPrivateClient: privateClient,
  };

  const relationshipDates = [
    user.createdAt,
    earliestAccount?.createdAt,
    earliestLoan?.createdAt,
    earliestCard?.createdAt,
    earliestApp?.createdAt,
    applications[0]?.createdAt,
  ].filter((value): value is Date => value != null);

  const relationshipSince = relationshipDates.reduce(
    (min, date) => (date < min ? date : min),
    relationshipDates[0] ?? user.createdAt,
  );
  const relationshipMonths =
    (Date.now() - relationshipSince.getTime()) / (1000 * 60 * 60 * 24 * 30);

  return {
    relationshipSince,
    totalBankAssets,
    totalInvestments,
    lifetimeDeposits,
    lifetimeWithdrawals,
    lifetimeInterestEarned,
    lifetimeInterestPaid,
    lifetimeAltaPayVolume,
    lifetimeLoanPayments,
    lifetimeCardPayments,
    activeLoanBalance,
    activeCardBalance,
    productsHeld,
    delinquentCards: delinquentCards.length,
    defaultedLoans: defaultedLoans.length,
    overdueInstallments,
    failedAutopayCards: failedAutopayCount,
    restrictedAccounts: restrictedPersonalAccounts,
    negativeUserStatus: user.accountStatus !== "ACTIVE",
    relationshipMonths,
    hasBusinessAccounts,
  };
}

function computeScoreFromInputs(
  inputs: AggregatedInputs,
  isPrivateClientFlag: boolean,
): { score: number; factors: RelationshipFactor[] } {
  const factors: RelationshipFactor[] = [];
  let score = RELATIONSHIP_SCORE_BASE;
  const totalAltaAssets = inputs.totalBankAssets + inputs.totalInvestments;

  const assetsImpact = capPositive(
    Math.floor(totalAltaAssets / 10_000) * RELATIONSHIP_SCORE_WEIGHTS.assetsPer10k,
    RELATIONSHIP_SCORE_WEIGHTS.assetsCap,
  );
  factors.push({
    key: "total_alta_assets",
    label: "Total Alta assets",
    value: formatAltaCardCurrency(totalAltaAssets),
    impact: assetsImpact,
    impactType: factorImpactType(assetsImpact),
  });
  score += assetsImpact;

  const depositImpact = capPositive(
    Math.floor(inputs.lifetimeDeposits / 10_000) * RELATIONSHIP_SCORE_WEIGHTS.lifetimeDepositsPer10k,
    RELATIONSHIP_SCORE_WEIGHTS.lifetimeDepositsCap,
  );
  factors.push({
    key: "lifetime_deposits",
    label: "Lifetime deposits",
    value: formatAltaCardCurrency(inputs.lifetimeDeposits),
    impact: depositImpact,
    impactType: factorImpactType(depositImpact),
  });
  score += depositImpact;

  const altaPayImpact = capPositive(
    Math.floor(inputs.lifetimeAltaPayVolume / 5_000) * RELATIONSHIP_SCORE_WEIGHTS.altaPayPer5k,
    RELATIONSHIP_SCORE_WEIGHTS.altaPayCap,
  );
  factors.push({
    key: "alta_pay_volume",
    label: "Alta Pay volume",
    value: formatAltaCardCurrency(inputs.lifetimeAltaPayVolume),
    impact: altaPayImpact,
    impactType: factorImpactType(altaPayImpact),
  });
  score += altaPayImpact;

  const productCount =
    (inputs.productsHeld.activeBankAccounts > 0 ? 1 : 0) +
    (inputs.productsHeld.activeAltaCards > 0 ? 1 : 0) +
    (inputs.productsHeld.activeLoans > 0 ? 1 : 0) +
    (inputs.productsHeld.paidOffLoans > 0 ? 1 : 0) +
    (inputs.productsHeld.businessCompanies > 0 ? 1 : 0);
  const productsImpact = capPositive(
    productCount * RELATIONSHIP_SCORE_WEIGHTS.productHeld,
    RELATIONSHIP_SCORE_WEIGHTS.productsCap,
  );
  factors.push({
    key: "products_held",
    label: "Products held",
    value: String(productCount),
    impact: productsImpact,
    impactType: factorImpactType(productsImpact),
  });
  score += productsImpact;

  const paidLoanImpact = capPositive(
    inputs.productsHeld.paidOffLoans * RELATIONSHIP_SCORE_WEIGHTS.paidLoan,
    RELATIONSHIP_SCORE_WEIGHTS.paidLoansCap,
  );
  factors.push({
    key: "paid_loans",
    label: "Paid-off loans",
    value: String(inputs.productsHeld.paidOffLoans),
    impact: paidLoanImpact,
    impactType: factorImpactType(paidLoanImpact),
  });
  score += paidLoanImpact;

  if (inputs.productsHeld.activeLoans > 0) {
    factors.push({
      key: "active_loans",
      label: "Active loans",
      value: String(inputs.productsHeld.activeLoans),
      impact: RELATIONSHIP_SCORE_WEIGHTS.activeLoanBonus,
      impactType: "positive",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.activeLoanBonus;
  }

  const ageImpact = capPositive(
    Math.floor(inputs.relationshipMonths / 12) * RELATIONSHIP_SCORE_WEIGHTS.relationshipYear,
    RELATIONSHIP_SCORE_WEIGHTS.relationshipYearsCap,
  );
  if (ageImpact > 0) {
    factors.push({
      key: "relationship_age",
      label: "Relationship age",
      value: `${Math.floor(inputs.relationshipMonths)} months`,
      impact: ageImpact,
      impactType: "positive",
    });
    score += ageImpact;
  }

  if (inputs.hasBusinessAccounts) {
    factors.push({
      key: "business_banking",
      label: "Business banking",
      value: "Yes",
      impact: RELATIONSHIP_SCORE_WEIGHTS.businessAccountOwnership,
      impactType: "positive",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.businessAccountOwnership;
  }

  if (inputs.productsHeld.verifiedCompanies > 0) {
    factors.push({
      key: "verified_companies",
      label: "Verified companies",
      value: String(inputs.productsHeld.verifiedCompanies),
      impact: RELATIONSHIP_SCORE_WEIGHTS.verifiedCompany,
      impactType: "positive",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.verifiedCompany;
  }

  if (isPrivateClientFlag) {
    factors.push({
      key: "private_client",
      label: "Alta Private client",
      value: "Yes",
      impact: RELATIONSHIP_SCORE_WEIGHTS.privateClientBonus,
      impactType: "positive",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.privateClientBonus;
  }

  if (inputs.delinquentCards > 0) {
    factors.push({
      key: "delinquent_cards",
      label: "Delinquent Alta Cards",
      value: String(inputs.delinquentCards),
      impact: RELATIONSHIP_SCORE_WEIGHTS.delinquentCard,
      impactType: "negative",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.delinquentCard;
  }

  if (inputs.defaultedLoans > 0) {
    factors.push({
      key: "defaulted_loans",
      label: "Defaulted loans",
      value: String(inputs.defaultedLoans),
      impact: RELATIONSHIP_SCORE_WEIGHTS.defaultedLoan,
      impactType: "negative",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.defaultedLoan;
  }

  if (inputs.overdueInstallments > 0) {
    const overdueImpact = capNegativeMagnitude(
      inputs.overdueInstallments * RELATIONSHIP_SCORE_WEIGHTS.overdueInstallment,
      Math.abs(RELATIONSHIP_SCORE_WEIGHTS.overdueInstallmentsCap),
    );
    factors.push({
      key: "overdue_loan_installments",
      label: "Overdue loan installments",
      value: String(inputs.overdueInstallments),
      impact: -overdueImpact,
      impactType: "negative",
    });
    score -= overdueImpact;
  }

  if (inputs.failedAutopayCards > 0) {
    factors.push({
      key: "failed_autopay",
      label: "Failed card autopay",
      value: String(inputs.failedAutopayCards),
      impact: RELATIONSHIP_SCORE_WEIGHTS.failedAutopay,
      impactType: "negative",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.failedAutopay;
  }

  if (inputs.restrictedAccounts > 0) {
    factors.push({
      key: "restricted_accounts",
      label: "Restricted accounts",
      value: String(inputs.restrictedAccounts),
      impact: RELATIONSHIP_SCORE_WEIGHTS.restrictedAccount,
      impactType: "negative",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.restrictedAccount;
  }

  if (inputs.negativeUserStatus) {
    factors.push({
      key: "account_status",
      label: "User account status",
      value: "Not active",
      impact: RELATIONSHIP_SCORE_WEIGHTS.negativeAccountStatus,
      impactType: "negative",
    });
    score += RELATIONSHIP_SCORE_WEIGHTS.negativeAccountStatus;
  }

  score = Math.max(0, Math.min(RELATIONSHIP_SCORE_MAX, Math.round(score)));
  return { score, factors };
}

function mapProfileRow(
  row: Prisma.RelationshipProfileGetPayload<object>,
  productsHeld: RelationshipProductsHeld,
): RelationshipProfileRow {
  return {
    id: row.id,
    userId: row.userId,
    relationshipSince: row.relationshipSince.toISOString(),
    relationshipScore: row.relationshipScore,
    relationshipTier: tierToCode(row.relationshipTier),
    privateBankingEligible: row.privateBankingEligible,
    privateBankingClient: row.privateBankingClient,
    totalBankAssets: decimalToNumber(row.totalBankAssets),
    totalInvestments: decimalToNumber(row.totalInvestments),
    totalAltaAssets: decimalToNumber(row.totalAltaAssets),
    lifetimeDeposits: decimalToNumber(row.lifetimeDeposits),
    lifetimeWithdrawals: decimalToNumber(row.lifetimeWithdrawals),
    lifetimeInterestEarned: decimalToNumber(row.lifetimeInterestEarned),
    lifetimeInterestPaid: decimalToNumber(row.lifetimeInterestPaid),
    lifetimeAltaPayVolume: decimalToNumber(row.lifetimeAltaPayVolume),
    lifetimeLoanPayments: decimalToNumber(row.lifetimeLoanPayments),
    lifetimeCardPayments: decimalToNumber(row.lifetimeCardPayments),
    activeLoanBalance: decimalToNumber(row.activeLoanBalance),
    activeCardBalance: decimalToNumber(row.activeCardBalance),
    currentCreditExposure: decimalToNumber(row.currentCreditExposure),
    productsHeld,
    lastCalculatedAt: row.lastCalculatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function calculateRelationshipProfile(userId: string): Promise<CalculatedRelationshipProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) throw new Error("NOT_FOUND");

  const altaUser = mapDbUserToAltaUser(user);
  const privateClient = isPrivateClient(altaUser);
  const inputs = await aggregateRelationshipInputs(userId);
  const { score, factors } = computeScoreFromInputs(inputs, privateClient);
  const totalAltaAssets = roundMoney(inputs.totalBankAssets + inputs.totalInvestments);
  const currentCreditExposure = roundMoney(inputs.activeLoanBalance + inputs.activeCardBalance);
  const relationshipTier = relationshipTierFromScore(score, privateClient);
  const privateBankingEligible = computePrivateBankingEligible(score, totalAltaAssets, privateClient);

  return {
    relationshipSince: inputs.relationshipSince.toISOString(),
    relationshipScore: score,
    relationshipTier,
    privateBankingEligible,
    privateBankingClient: privateClient,
    totalBankAssets: inputs.totalBankAssets,
    totalInvestments: inputs.totalInvestments,
    totalAltaAssets,
    lifetimeDeposits: inputs.lifetimeDeposits,
    lifetimeWithdrawals: inputs.lifetimeWithdrawals,
    lifetimeInterestEarned: inputs.lifetimeInterestEarned,
    lifetimeInterestPaid: inputs.lifetimeInterestPaid,
    lifetimeAltaPayVolume: inputs.lifetimeAltaPayVolume,
    lifetimeLoanPayments: inputs.lifetimeLoanPayments,
    lifetimeCardPayments: inputs.lifetimeCardPayments,
    activeLoanBalance: inputs.activeLoanBalance,
    activeCardBalance: inputs.activeCardBalance,
    currentCreditExposure,
    productsHeld: inputs.productsHeld,
    factors,
  };
}

export async function getRelationshipFactors(userId: string): Promise<RelationshipFactor[]> {
  const auth = await requireAuth();
  if (auth.id !== userId) await requireOperator();

  const calculated = await calculateRelationshipProfile(userId);
  return calculated.factors;
}

export async function getRelationshipProfile(userId: string): Promise<RelationshipProfileRow | null> {
  const row = await prisma.relationshipProfile.findUnique({ where: { userId } });
  if (!row) return null;

  const snapshot = await prisma.relationshipProfileSnapshot.findFirst({
    where: { userId },
    orderBy: { calculatedAt: "desc" },
  });
  let productsHeld: RelationshipProductsHeld = {
    activeBankAccounts: 0,
    activeAltaCards: 0,
    activeLoans: 0,
    paidOffLoans: 0,
    businessCompanies: 0,
    verifiedCompanies: 0,
    isPrivateClient: row.privateBankingClient,
  };
  if (
    snapshot?.metadata &&
    typeof snapshot.metadata === "object" &&
    !Array.isArray(snapshot.metadata) &&
    "productsHeld" in snapshot.metadata
  ) {
    productsHeld = snapshot.metadata.productsHeld as RelationshipProductsHeld;
  } else {
    const calculated = await calculateRelationshipProfile(userId);
    productsHeld = calculated.productsHeld;
  }

  return mapProfileRow(row, productsHeld);
}

export async function getRelationshipSnapshot(userId: string): Promise<RelationshipProfileSnapshotRow | null> {
  const snapshot = await prisma.relationshipProfileSnapshot.findFirst({
    where: { userId },
    orderBy: { calculatedAt: "desc" },
  });
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    profileId: snapshot.profileId,
    relationshipScore: snapshot.relationshipScore,
    relationshipTier: tierToCode(snapshot.relationshipTier),
    totalBankAssets: decimalToNumber(snapshot.totalBankAssets),
    totalAltaAssets: decimalToNumber(snapshot.totalAltaAssets),
    currentCreditExposure: decimalToNumber(snapshot.currentCreditExposure),
    privateBankingEligible: snapshot.privateBankingEligible,
    calculatedAt: snapshot.calculatedAt.toISOString(),
    metadata:
      snapshot.metadata && typeof snapshot.metadata === "object" && !Array.isArray(snapshot.metadata)
        ? (snapshot.metadata as Record<string, unknown>)
        : null,
  };
}

async function resolveAuditActorId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const systemUser = await prisma.user.findFirst({
    where: { tags: { some: { tag: "SYSTEM" } } },
    select: { id: true },
  });
  if (systemUser) return systemUser.id;
  const admin = await prisma.user.findFirst({
    where: { tags: { some: { tag: "ADMIN" } } },
    select: { id: true },
  });
  if (!admin) throw new Error("NO_SYSTEM_ACTOR");
  return admin.id;
}

export async function refreshRelationshipProfile(
  userId: string,
  actorUserId?: string,
  options?: { skipRecommendations?: boolean },
): Promise<RelationshipProfileRow> {
  const calculated = await calculateRelationshipProfile(userId);
  const existing = await prisma.relationshipProfile.findUnique({ where: { userId } });
  const actor = await resolveAuditActorId(actorUserId);
  const now = new Date();

  const data = {
    relationshipSince: new Date(calculated.relationshipSince),
    relationshipScore: calculated.relationshipScore,
    relationshipTier: tierToDb(calculated.relationshipTier),
    privateBankingEligible: calculated.privateBankingEligible,
    privateBankingClient: calculated.privateBankingClient,
    totalBankAssets: calculated.totalBankAssets,
    totalInvestments: calculated.totalInvestments,
    totalAltaAssets: calculated.totalAltaAssets,
    lifetimeDeposits: calculated.lifetimeDeposits,
    lifetimeWithdrawals: calculated.lifetimeWithdrawals,
    lifetimeInterestEarned: calculated.lifetimeInterestEarned,
    lifetimeInterestPaid: calculated.lifetimeInterestPaid,
    lifetimeAltaPayVolume: calculated.lifetimeAltaPayVolume,
    lifetimeLoanPayments: calculated.lifetimeLoanPayments,
    lifetimeCardPayments: calculated.lifetimeCardPayments,
    activeLoanBalance: calculated.activeLoanBalance,
    activeCardBalance: calculated.activeCardBalance,
    currentCreditExposure: calculated.currentCreditExposure,
    lastCalculatedAt: now,
  };

  const profile = existing
    ? await prisma.relationshipProfile.update({ where: { userId }, data })
    : await prisma.relationshipProfile.create({ data: { userId, ...data } });

  if (
    shouldWriteRelationshipSnapshot({
      oldScore: existing?.relationshipScore ?? null,
      newScore: calculated.relationshipScore,
      oldTier: existing ? tierToCode(existing.relationshipTier) : null,
      newTier: calculated.relationshipTier,
      oldTotalAssets: existing ? decimalToNumber(existing.totalAltaAssets) : null,
      newTotalAssets: calculated.totalAltaAssets,
      oldCreditExposure: existing ? decimalToNumber(existing.currentCreditExposure) : null,
      newCreditExposure: calculated.currentCreditExposure,
      oldPrivateEligible: existing?.privateBankingEligible ?? null,
      newPrivateEligible: calculated.privateBankingEligible,
    })
  ) {
    await prisma.relationshipProfileSnapshot.create({
      data: {
        userId,
        profileId: profile.id,
        relationshipScore: calculated.relationshipScore,
        relationshipTier: tierToDb(calculated.relationshipTier),
        totalBankAssets: calculated.totalBankAssets,
        totalAltaAssets: calculated.totalAltaAssets,
        currentCreditExposure: calculated.currentCreditExposure,
        privateBankingEligible: calculated.privateBankingEligible,
        metadata: {
          factorCount: calculated.factors.length,
          productsHeld: calculated.productsHeld,
          oldScore: existing?.relationshipScore ?? null,
          oldTier: existing ? tierToCode(existing.relationshipTier) : null,
        },
      },
    });
    await pruneRelationshipProfileSnapshots(prisma, { userId });
  }

  if (!existing) {
    await writeAuditLog({
      actorUserId: actor,
      targetUserId: userId,
      action: "RELATIONSHIP_PROFILE_CREATED",
      entityType: "USER",
      entityId: profile.id,
      description: "Relationship profile created",
      metadata: {
        userId,
        newScore: calculated.relationshipScore,
        newTier: calculated.relationshipTier,
        actorUserId: actorUserId ?? "SYSTEM",
      },
    });
  }

  await writeAuditLog({
    actorUserId: actor,
    targetUserId: userId,
    action: "RELATIONSHIP_PROFILE_REFRESHED",
    entityType: "USER",
    entityId: profile.id,
    description: "Relationship profile refreshed",
    metadata: {
      userId,
      oldScore: existing?.relationshipScore ?? null,
      newScore: calculated.relationshipScore,
      oldTier: existing ? tierToCode(existing.relationshipTier) : null,
      newTier: calculated.relationshipTier,
      actorUserId: actorUserId ?? "SYSTEM",
    },
  });

  if (existing && existing.relationshipScore !== calculated.relationshipScore) {
    await writeAuditLog({
      actorUserId: actor,
      targetUserId: userId,
      action: "RELATIONSHIP_SCORE_CHANGED",
      entityType: "USER",
      entityId: profile.id,
      description: "Relationship score changed",
      metadata: {
        userId,
        oldScore: existing.relationshipScore,
        newScore: calculated.relationshipScore,
        actorUserId: actorUserId ?? "SYSTEM",
      },
    });
  }

  if (existing && existing.relationshipTier !== tierToDb(calculated.relationshipTier)) {
    await writeAuditLog({
      actorUserId: actor,
      targetUserId: userId,
      action: "RELATIONSHIP_TIER_CHANGED",
      entityType: "USER",
      entityId: profile.id,
      description: "Relationship tier changed",
      metadata: {
        userId,
        oldTier: tierToCode(existing.relationshipTier),
        newTier: calculated.relationshipTier,
        actorUserId: actorUserId ?? "SYSTEM",
      },
    });
  }

  if (
    existing &&
    existing.privateBankingEligible !== calculated.privateBankingEligible
  ) {
    await writeAuditLog({
      actorUserId: actor,
      targetUserId: userId,
      action: "PRIVATE_BANKING_ELIGIBILITY_CHANGED",
      entityType: "USER",
      entityId: profile.id,
      description: "Private banking eligibility changed",
      metadata: {
        userId,
        oldEligible: existing.privateBankingEligible,
        newEligible: calculated.privateBankingEligible,
        actorUserId: actorUserId ?? "SYSTEM",
      },
    });
  }

  if (!options?.skipRecommendations) {
    try {
      const { generateRelationshipRecommendations } = await import(
        "@/server/relationship-intelligence-recommendation.service"
      );
      await generateRelationshipRecommendations(userId, actor, { profileRow: mapProfileRow(profile, calculated.productsHeld) });
    } catch {
      // Recommendations are best-effort after profile refresh.
    }
  }

  try {
    const { syncRelationshipProfileTimelineEvents } = await import(
      "@/server/relationship-timeline.service"
    );
    await syncRelationshipProfileTimelineEvents({
      userId,
      actorUserId: actor,
      oldScore: existing?.relationshipScore ?? null,
      newScore: calculated.relationshipScore,
      oldTier: existing ? tierToCode(existing.relationshipTier) : null,
      newTier: calculated.relationshipTier,
      oldPrivateEligible: existing?.privateBankingEligible ?? false,
      newPrivateEligible: calculated.privateBankingEligible,
    });
  } catch {
    // Timeline sync is best-effort after profile refresh.
  }

  return mapProfileRow(profile, calculated.productsHeld);
}

export async function refreshAllRelationshipProfiles(actorUserId?: string): Promise<{
  processed: number;
  refreshed: number;
  failed: number;
}> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let refreshed = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await refreshRelationshipProfile(user.id, actorUserId, { skipRecommendations: true });
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: users.length, refreshed, failed };
}

export async function refreshAllRelationshipProfilesAdmin(actorUserId: string): Promise<{
  processed: number;
  refreshed: number;
  failed: number;
}> {
  await requireOperator();
  return refreshAllRelationshipProfiles(actorUserId);
}

export async function getCustomerRelationshipView(userId: string): Promise<CustomerRelationshipView> {
  const auth = await requireAuth();
  if (auth.id !== userId) await requireOperator();

  const calculated = await calculateRelationshipProfile(userId);
  const { getCustomerRelationshipOpportunities } = await import(
    "@/server/relationship-intelligence-recommendation.service"
  );
  const opportunities = await getCustomerRelationshipOpportunities(userId);
  const { ensureRelationshipTimelineBackfilled, getCustomerRelationshipTimeline } = await import(
    "@/server/relationship-timeline.service"
  );
  const { refreshUserRelationshipProfileBestEffort } = await import(
    "@/server/relationship-refresh-hooks.service"
  );
  try {
    await ensureRelationshipTimelineBackfilled(userId);
  } catch {
    // Timeline backfill is best-effort on customer view load.
  }
  try {
    const { refreshStoredPersonalTimelineCopy } = await import(
      "@/server/relationship-timeline-customer-enrichment.service"
    );
    await refreshStoredPersonalTimelineCopy(userId);
  } catch {
    // Legacy copy refresh is best-effort on customer view load.
  }
  try {
    const { reconcileRelationshipTimelineDates } = await import(
      "@/server/relationship-timeline.service"
    );
    await reconcileRelationshipTimelineDates(userId);
  } catch {
    // Date reconciliation is best-effort on customer view load.
  }
  try {
    await refreshUserRelationshipProfileBestEffort(userId, "customer-relationship-view");
  } catch {
    // Profile refresh is best-effort on customer view load.
  }
  const timeline = await getCustomerRelationshipTimeline(userId);

  const { computeCustomerRelationshipProgress } = await import(
    "@/lib/bank/customer-relationship-display"
  );

  return {
    relationshipSince: calculated.relationshipSince,
    relationshipTier: calculated.relationshipTier,
    relationshipTierLabel: RELATIONSHIP_TIER_LABELS[calculated.relationshipTier],
    relationshipProgress: computeCustomerRelationshipProgress(
      calculated.relationshipScore,
      calculated.relationshipTier,
    ),
    totalAltaAssets: calculated.totalAltaAssets,
    lifetimeDeposits: calculated.lifetimeDeposits,
    lifetimeWithdrawals: calculated.lifetimeWithdrawals,
    lifetimeInterestEarned: calculated.lifetimeInterestEarned,
    lifetimeInterestPaid: calculated.lifetimeInterestPaid,
    lifetimeAltaPayVolume: calculated.lifetimeAltaPayVolume,
    productsHeld: calculated.productsHeld,
    privateBankingEligible: calculated.privateBankingEligible,
    privateBankingClient: calculated.privateBankingClient,
    opportunities,
    timeline,
  };
}

export async function getRelationshipProfileSummary(userId: string): Promise<RelationshipProfileSummary | null> {
  await requireOperator();
  const calculated = await calculateRelationshipProfile(userId);
  const profile = await getRelationshipProfile(userId);
  return {
    userId,
    relationshipSince: calculated.relationshipSince,
    relationshipScore: calculated.relationshipScore,
    relationshipTier: calculated.relationshipTier,
    privateBankingEligible: calculated.privateBankingEligible,
    privateBankingClient: calculated.privateBankingClient,
    totalAltaAssets: calculated.totalAltaAssets,
    productsHeld: calculated.productsHeld,
    lastCalculatedAt: profile?.lastCalculatedAt ?? calculated.lastCalculatedAt,
  };
}

export async function getRelationshipProfileSummariesForUsers(
  userIds: string[],
): Promise<Record<string, RelationshipProfileSummary>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const summaries = await Promise.all(unique.map((id) => getRelationshipProfileSummary(id)));
  const byUserId: Record<string, RelationshipProfileSummary> = {};
  for (const summary of summaries) {
    if (summary) byUserId[summary.userId] = summary;
  }
  return byUserId;
}

export async function getRelationshipIntelligenceDashboard(): Promise<RelationshipIntelligenceDashboard> {
  await requireOperator();

  const [totalProfiles, privateEligibleCount, preferredOrPremierCount, topByAssets, recentSnapshots] =
    await Promise.all([
      prisma.relationshipProfile.count(),
      prisma.relationshipProfile.count({ where: { privateBankingEligible: true } }),
      prisma.relationshipProfile.count({
        where: { relationshipTier: { in: ["PREFERRED", "PREMIER", "PRIVATE_ELIGIBLE"] } },
      }),
      prisma.relationshipProfile.findMany({
        orderBy: { totalAltaAssets: "desc" },
        take: 10,
        include: { user: { select: { id: true, discordUsername: true } } },
      }),
      prisma.relationshipProfileSnapshot.findMany({
        orderBy: { calculatedAt: "desc" },
        take: 40,
        include: { user: { select: { id: true, discordUsername: true } } },
      }),
    ]);

  const recentlyChanged: RelationshipIntelligenceDashboard["recentlyChanged"] = [];
  const seenUsers = new Set<string>();

  for (const snapshot of recentSnapshots) {
    if (seenUsers.has(snapshot.userId)) continue;
    const metadata = snapshot.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
    const oldScore = (metadata as Record<string, unknown>).oldScore;
    const oldTier = (metadata as Record<string, unknown>).oldTier;
    if (typeof oldScore !== "number" || typeof oldTier !== "string") continue;
    if (oldScore === snapshot.relationshipScore && oldTier === snapshot.relationshipTier) continue;
    recentlyChanged.push({
      userId: snapshot.userId,
      discordUsername: snapshot.user.discordUsername,
      oldScore,
      newScore: snapshot.relationshipScore,
      oldTier: oldTier as RelationshipTierCode,
      newTier: tierToCode(snapshot.relationshipTier),
      calculatedAt: snapshot.calculatedAt.toISOString(),
    });
    seenUsers.add(snapshot.userId);
    if (recentlyChanged.length >= 8) break;
  }

  return {
    totalProfiles,
    privateEligibleCount,
    preferredOrPremierCount,
    topByAssets: topByAssets.map((row) => ({
      userId: row.userId,
      discordUsername: row.user.discordUsername,
      relationshipScore: row.relationshipScore,
      relationshipTier: tierToCode(row.relationshipTier),
      totalAltaAssets: decimalToNumber(row.totalAltaAssets),
    })),
    recentlyChanged,
  };
}

export async function getAdminRelationshipDetail(userId: string): Promise<{
  profile: RelationshipProfileRow | null;
  calculated: CalculatedRelationshipProfile;
  user: { id: string; discordUsername: string };
  timelineSummary: import("@/lib/bank/relationship-intelligence-types").RelationshipTimelineSummary;
}> {
  await requireOperator();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, discordUsername: true },
  });
  if (!user) throw new Error("NOT_FOUND");

  const { getRelationshipTimelineSummary } = await import("@/server/relationship-timeline.service");

  const [profile, calculated, timelineSummary] = await Promise.all([
    getRelationshipProfile(userId),
    calculateRelationshipProfile(userId),
    getRelationshipTimelineSummary(userId),
  ]);

  return { profile, calculated, user, timelineSummary };
}
