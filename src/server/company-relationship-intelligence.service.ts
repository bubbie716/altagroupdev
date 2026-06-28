import type { CompanyRelationshipTier as DbCompanyRelationshipTier, Prisma } from "@prisma/client";
import type {
  AdminCompanyRelationshipDetail,
  CalculatedCompanyRelationshipProfile,
  CompanyProductHoldings,
  CompanyRelationshipFactor,
  CompanyRelationshipProfileRow,
  CompanyRelationshipProfileSummary,
  CompanyRelationshipTierCode,
  CustomerCompanyRelationshipView,
  CompanyRelationshipIntelligenceDashboard,
} from "@/lib/bank/company-relationship-intelligence-types";
import {
  COMPANY_RELATIONSHIP_SCORE_BASE,
  COMPANY_RELATIONSHIP_SCORE_MAX,
  COMPANY_RELATIONSHIP_SCORE_WEIGHTS,
  COMPANY_RELATIONSHIP_TIER_LABELS,
  companyRelationshipTierFromScore,
  computeCommercialBankingEligible,
} from "@/lib/bank/company-relationship-intelligence-config";
import {
  pruneRelationshipProfileSnapshots,
  shouldWriteRelationshipSnapshot,
} from "@/lib/bank/relationship-snapshot-policy";
import {
  capNegativeMagnitude,
  capPositive,
} from "@/lib/bank/relationship-scoring-utils";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { requireAuth } from "@/server/auth.service";
import { requireOperator } from "@/server/permissions.service";

function decimalToNumber(value: Prisma.Decimal | { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function factorImpactType(impact: number): CompanyRelationshipFactor["impactType"] {
  if (impact > 0) return "positive";
  if (impact < 0) return "negative";
  return "neutral";
}

function tierToCode(tier: DbCompanyRelationshipTier): CompanyRelationshipTierCode {
  return tier as CompanyRelationshipTierCode;
}

function tierToDb(tier: CompanyRelationshipTierCode): DbCompanyRelationshipTier {
  return tier as DbCompanyRelationshipTier;
}

type AggregatedCompanyInputs = {
  relationshipSince: Date;
  totalBusinessAssets: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lifetimeInterestEarned: number;
  lifetimeInterestPaid: number;
  lifetimeAltaPayVolume: number;
  lifetimeLoanPayments: number;
  lifetimeCardPayments: number;
  activeLoanBalance: number;
  activeCardBalance: number;
  productHoldings: CompanyProductHoldings;
  delinquentCards: number;
  defaultedLoans: number;
  overdueInstallments: number;
  failedAutopayCards: number;
  companySuspended: boolean;
  isVerified: boolean;
  relationshipMonths: number;
};

async function resolveCompanyAccountIds(companyId: string): Promise<string[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

async function aggregateCompanyRelationshipInputs(companyId: string): Promise<AggregatedCompanyInputs> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("NOT_FOUND");

  const accountIds = await resolveCompanyAccountIds(companyId);

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
    cardApplications,
    earliestAccount,
    earliestLoan,
    earliestCard,
    earliestApplication,
    overdueInstallments,
    failedAutopayCount,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { balance: true, createdAt: true },
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
      where: { companyId },
      select: {
        status: true,
        outstandingBalance: true,
        accruedInterest: true,
        principalOutstanding: true,
        createdAt: true,
      },
    }),
    prisma.loanPayment.aggregate({
      where: { status: "COMPLETED", loan: { companyId } },
      _sum: { amount: true },
    }),
    prisma.loanPayment.aggregate({
      where: { status: "COMPLETED", loan: { companyId } },
      _sum: { appliedToInterest: true },
    }),
    prisma.altaCard.findMany({
      where: { companyId },
      select: {
        status: true,
        currentBalance: true,
        autopayLastStatus: true,
        createdAt: true,
      },
    }),
    prisma.altaCardTransaction.aggregate({
      where: { type: "PAYMENT", altaCard: { companyId } },
      _sum: { amount: true },
    }),
    prisma.altaCardStatement.aggregate({
      where: { altaCard: { companyId } },
      _sum: { interestCharged: true },
    }),
    prisma.altaCardApplication.count({
      where: { companyId },
    }),
    prisma.bankAccount.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loan.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.altaCard.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.altaCardApplication.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.loanPaymentScheduleItem.count({
      where: { status: "OVERDUE", loan: { companyId } },
    }),
    prisma.altaCard.count({
      where: { companyId, autopayLastStatus: "FAILED" },
    }),
  ]);

  const activeLoans = loans.filter((l) => ["ACTIVE", "FROZEN", "DELINQUENT"].includes(l.status));
  const paidOffLoans = loans.filter((l) => l.status === "PAID_OFF");
  const defaultedLoans = loans.filter((l) => l.status === "DEFAULTED");
  const activeCards = cards.filter((c) => ["ACTIVE", "FROZEN"].includes(c.status));
  const delinquentCards = cards.filter((c) => c.status === "DELINQUENT");

  const totalBusinessAssets = roundMoney(
    bankAccounts.reduce((sum, account) => sum + decimalToNumber(account.balance), 0),
  );
  const lifetimeDeposits = roundMoney(decimalToNumber(depositAgg._sum.amount));
  const lifetimeWithdrawals = roundMoney(Math.abs(decimalToNumber(withdrawalAgg._sum.amount)));
  const lifetimeInterestEarned = roundMoney(decimalToNumber(interestEarnedAgg._sum.amount));
  const lifetimeAltaPayVolume = roundMoney(Math.abs(decimalToNumber(altaPayAgg._sum.amount)));
  const lifetimeLoanPayments = roundMoney(decimalToNumber(loanPaymentAgg._sum.amount));
  const lifetimeCardPayments = roundMoney(Math.abs(decimalToNumber(cardPaymentAgg._sum.amount)));
  const loanInterestPaid = roundMoney(decimalToNumber(loanInterestPaidAgg._sum.appliedToInterest));
  const cardInterestPaid = roundMoney(decimalToNumber(cardInterestAgg._sum.interestCharged));
  const lifetimeInterestPaid = roundMoney(loanInterestPaid + cardInterestPaid);

  const activeLoanBalance = roundMoney(
    activeLoans.reduce(
      (sum, loan) =>
        sum + decimalToNumber(loan.outstandingBalance) + decimalToNumber(loan.accruedInterest),
      0,
    ),
  );
  const activeCardBalance = roundMoney(
    activeCards.reduce((sum, card) => sum + decimalToNumber(card.currentBalance), 0) +
      delinquentCards.reduce((sum, card) => sum + decimalToNumber(card.currentBalance), 0),
  );

  const productHoldings: CompanyProductHoldings = {
    activeBusinessAccounts: bankAccounts.length,
    activeBusinessLoans: activeLoans.length,
    activeBusinessCards: activeCards.length + delinquentCards.length,
    paidOffBusinessLoans: paidOffLoans.length,
    businessCardApplications: cardApplications,
    treasuryPlaceholder: true,
    exchangePlaceholder: true,
  };

  const relationshipDates = [
    company.createdAt,
    earliestAccount?.createdAt,
    earliestLoan?.createdAt,
    earliestCard?.createdAt,
    earliestApplication?.createdAt,
  ].filter((value): value is Date => value != null);

  const relationshipSince = relationshipDates.reduce(
    (min, date) => (date < min ? date : min),
    relationshipDates[0] ?? company.createdAt,
  );
  const relationshipMonths =
    (Date.now() - relationshipSince.getTime()) / (1000 * 60 * 60 * 24 * 30);

  return {
    relationshipSince,
    totalBusinessAssets,
    lifetimeDeposits,
    lifetimeWithdrawals,
    lifetimeInterestEarned,
    lifetimeInterestPaid,
    lifetimeAltaPayVolume,
    lifetimeLoanPayments,
    lifetimeCardPayments,
    activeLoanBalance,
    activeCardBalance,
    productHoldings,
    delinquentCards: delinquentCards.length,
    defaultedLoans: defaultedLoans.length,
    overdueInstallments,
    failedAutopayCards: failedAutopayCount,
    companySuspended: company.status === "SUSPENDED" || company.status === "REJECTED",
    isVerified: company.verificationStatus === "VERIFIED",
    relationshipMonths,
  };
}

function computeCompanyScoreFromInputs(inputs: AggregatedCompanyInputs): {
  score: number;
  factors: CompanyRelationshipFactor[];
} {
  const factors: CompanyRelationshipFactor[] = [];
  let score = COMPANY_RELATIONSHIP_SCORE_BASE;
  const weights = COMPANY_RELATIONSHIP_SCORE_WEIGHTS;

  const assetsImpact = capPositive(
    Math.floor(inputs.totalBusinessAssets / 10_000) * weights.assetsPer10k,
    weights.assetsCap,
  );
  factors.push({
    key: "total_business_assets",
    label: "Total business assets",
    value: formatAltaCardCurrency(inputs.totalBusinessAssets),
    impact: assetsImpact,
    impactType: factorImpactType(assetsImpact),
  });
  score += assetsImpact;

  const depositsImpact = capPositive(
    Math.floor(inputs.lifetimeDeposits / 10_000) * weights.lifetimeDepositsPer10k,
    weights.lifetimeDepositsCap,
  );
  factors.push({
    key: "lifetime_deposits",
    label: "Lifetime business deposits",
    value: formatAltaCardCurrency(inputs.lifetimeDeposits),
    impact: depositsImpact,
    impactType: factorImpactType(depositsImpact),
  });
  score += depositsImpact;

  const altaPayImpact = capPositive(
    Math.floor(inputs.lifetimeAltaPayVolume / 5_000) * weights.altaPayPer5k,
    weights.altaPayCap,
  );
  if (altaPayImpact > 0) {
    factors.push({
      key: "alta_pay_volume",
      label: "Business Alta Pay volume",
      value: formatAltaCardCurrency(inputs.lifetimeAltaPayVolume),
      impact: altaPayImpact,
      impactType: "positive",
    });
    score += altaPayImpact;
  }

  const productCount =
    (inputs.productHoldings.activeBusinessAccounts > 0 ? 1 : 0) +
    (inputs.productHoldings.activeBusinessCards > 0 ? 1 : 0) +
    (inputs.productHoldings.activeBusinessLoans > 0 ? 1 : 0) +
    (inputs.productHoldings.paidOffBusinessLoans > 0 ? 1 : 0);
  const productsImpact = capPositive(productCount * weights.productHeld, weights.productsCap);
  factors.push({
    key: "business_products",
    label: "Active business products",
    value: String(productCount),
    impact: productsImpact,
    impactType: factorImpactType(productsImpact),
  });
  score += productsImpact;

  const paidLoanImpact = capPositive(
    inputs.productHoldings.paidOffBusinessLoans * weights.paidLoan,
    weights.paidLoansCap,
  );
  if (paidLoanImpact > 0) {
    factors.push({
      key: "paid_business_loans",
      label: "Paid-off business loans",
      value: String(inputs.productHoldings.paidOffBusinessLoans),
      impact: paidLoanImpact,
      impactType: "positive",
    });
    score += paidLoanImpact;
  }

  if (inputs.productHoldings.activeBusinessLoans > 0) {
    factors.push({
      key: "active_business_loans",
      label: "Active business loans",
      value: String(inputs.productHoldings.activeBusinessLoans),
      impact: weights.activeLoanBonus,
      impactType: "positive",
    });
    score += weights.activeLoanBonus;
  }

  const ageImpact = capPositive(
    Math.floor(inputs.relationshipMonths / 12) * weights.relationshipYear,
    weights.relationshipYearsCap,
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

  if (inputs.isVerified) {
    factors.push({
      key: "verified_company",
      label: "Verified company",
      value: "Yes",
      impact: weights.verifiedCompany,
      impactType: "positive",
    });
    score += weights.verifiedCompany;
  }

  if (inputs.delinquentCards > 0) {
    factors.push({
      key: "delinquent_business_cards",
      label: "Delinquent business cards",
      value: String(inputs.delinquentCards),
      impact: weights.delinquentCard,
      impactType: "negative",
    });
    score += weights.delinquentCard;
  }

  if (inputs.defaultedLoans > 0) {
    factors.push({
      key: "defaulted_business_loans",
      label: "Defaulted business loans",
      value: String(inputs.defaultedLoans),
      impact: weights.defaultedLoan,
      impactType: "negative",
    });
    score += weights.defaultedLoan;
  }

  if (inputs.overdueInstallments > 0) {
    const overdueImpact = capNegativeMagnitude(
      inputs.overdueInstallments * weights.overdueInstallment,
      Math.abs(weights.overdueInstallmentsCap),
    );
    factors.push({
      key: "overdue_installments",
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
      impact: weights.failedAutopay * inputs.failedAutopayCards,
      impactType: "negative",
    });
    score += weights.failedAutopay * inputs.failedAutopayCards;
  }

  if (inputs.companySuspended) {
    factors.push({
      key: "company_status",
      label: "Company status",
      value: "Suspended or rejected",
      impact: weights.suspendedCompany,
      impactType: "negative",
    });
    score += weights.suspendedCompany;
  }

  return { score: Math.max(0, Math.min(COMPANY_RELATIONSHIP_SCORE_MAX, score)), factors };
}

function mapProfileRow(
  row: {
    id: string;
    companyId: string;
    relationshipSince: Date;
    relationshipScore: number;
    relationshipTier: DbCompanyRelationshipTier;
    commercialBankingEligible: boolean;
    totalBusinessAssets: Prisma.Decimal;
    lifetimeDeposits: Prisma.Decimal;
    lifetimeWithdrawals: Prisma.Decimal;
    lifetimeInterestEarned: Prisma.Decimal;
    lifetimeInterestPaid: Prisma.Decimal;
    lifetimeAltaPayVolume: Prisma.Decimal;
    lifetimeLoanPayments: Prisma.Decimal;
    lifetimeCardPayments: Prisma.Decimal;
    activeLoanBalance: Prisma.Decimal;
    activeCardBalance: Prisma.Decimal;
    currentCreditExposure: Prisma.Decimal;
    activeBusinessAccounts: number;
    activeBusinessLoans: number;
    activeBusinessCards: number;
    paidOffBusinessLoans: number;
    lastCalculatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  productHoldings: CompanyProductHoldings,
): CompanyRelationshipProfileRow {
  return {
    id: row.id,
    companyId: row.companyId,
    relationshipSince: row.relationshipSince.toISOString(),
    relationshipScore: row.relationshipScore,
    relationshipTier: tierToCode(row.relationshipTier),
    commercialBankingEligible: row.commercialBankingEligible,
    totalBusinessAssets: decimalToNumber(row.totalBusinessAssets),
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
    productHoldings,
    lastCalculatedAt: row.lastCalculatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function calculateCompanyRelationshipProfile(
  companyId: string,
): Promise<CalculatedCompanyRelationshipProfile> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("NOT_FOUND");
  if (company.verificationStatus !== "VERIFIED") {
    throw new Error("BAD_REQUEST:Company must be verified for relationship profile");
  }

  const inputs = await aggregateCompanyRelationshipInputs(companyId);
  const { score, factors } = computeCompanyScoreFromInputs(inputs);
  const currentCreditExposure = roundMoney(inputs.activeLoanBalance + inputs.activeCardBalance);
  const relationshipTier = companyRelationshipTierFromScore(score);
  const commercialBankingEligible = computeCommercialBankingEligible(score, inputs.totalBusinessAssets);

  return {
    relationshipSince: inputs.relationshipSince.toISOString(),
    relationshipScore: score,
    relationshipTier,
    commercialBankingEligible,
    totalBusinessAssets: inputs.totalBusinessAssets,
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
    productHoldings: inputs.productHoldings,
    lastCalculatedAt: new Date().toISOString(),
    factors,
  };
}

export async function getCompanyRelationshipProfile(
  companyId: string,
): Promise<CompanyRelationshipProfileRow | null> {
  const row = await prisma.companyRelationshipProfile.findUnique({ where: { companyId } });
  if (!row) return null;

  const productHoldings: CompanyProductHoldings = {
    activeBusinessAccounts: row.activeBusinessAccounts,
    activeBusinessLoans: row.activeBusinessLoans,
    activeBusinessCards: row.activeBusinessCards,
    paidOffBusinessLoans: row.paidOffBusinessLoans,
    businessCardApplications: 0,
    treasuryPlaceholder: true,
    exchangePlaceholder: true,
  };

  return mapProfileRow(row, productHoldings);
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

export async function refreshCompanyRelationshipProfile(
  companyId: string,
  actorUserId?: string,
  options?: { allowSystemRefresh?: boolean; skipRecommendations?: boolean },
): Promise<CompanyRelationshipProfileRow> {
  if (!options?.allowSystemRefresh) {
    await requireOperator();
  }
  const calculated = await calculateCompanyRelationshipProfile(companyId);
  const existing = await prisma.companyRelationshipProfile.findUnique({ where: { companyId } });
  const actor = await resolveAuditActorId(actorUserId);

  const profile = await prisma.companyRelationshipProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      relationshipSince: new Date(calculated.relationshipSince),
      relationshipScore: calculated.relationshipScore,
      relationshipTier: tierToDb(calculated.relationshipTier),
      commercialBankingEligible: calculated.commercialBankingEligible,
      totalBusinessAssets: calculated.totalBusinessAssets,
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
      activeBusinessAccounts: calculated.productHoldings.activeBusinessAccounts,
      activeBusinessLoans: calculated.productHoldings.activeBusinessLoans,
      activeBusinessCards: calculated.productHoldings.activeBusinessCards,
      paidOffBusinessLoans: calculated.productHoldings.paidOffBusinessLoans,
    },
    update: {
      relationshipSince: new Date(calculated.relationshipSince),
      relationshipScore: calculated.relationshipScore,
      relationshipTier: tierToDb(calculated.relationshipTier),
      commercialBankingEligible: calculated.commercialBankingEligible,
      totalBusinessAssets: calculated.totalBusinessAssets,
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
      activeBusinessAccounts: calculated.productHoldings.activeBusinessAccounts,
      activeBusinessLoans: calculated.productHoldings.activeBusinessLoans,
      activeBusinessCards: calculated.productHoldings.activeBusinessCards,
      paidOffBusinessLoans: calculated.productHoldings.paidOffBusinessLoans,
      lastCalculatedAt: new Date(),
    },
  });

  if (
    shouldWriteRelationshipSnapshot({
      oldScore: existing?.relationshipScore ?? null,
      newScore: calculated.relationshipScore,
      oldTier: existing ? tierToCode(existing.relationshipTier) : null,
      newTier: calculated.relationshipTier,
      oldTotalAssets: existing ? decimalToNumber(existing.totalBusinessAssets) : null,
      newTotalAssets: calculated.totalBusinessAssets,
      oldCreditExposure: existing ? decimalToNumber(existing.currentCreditExposure) : null,
      newCreditExposure: calculated.currentCreditExposure,
      oldCommercialEligible: existing?.commercialBankingEligible ?? null,
      newCommercialEligible: calculated.commercialBankingEligible,
    })
  ) {
    await prisma.companyRelationshipProfileSnapshot.create({
      data: {
        companyId,
        profileId: profile.id,
        relationshipScore: calculated.relationshipScore,
        relationshipTier: tierToDb(calculated.relationshipTier),
        totalBusinessAssets: calculated.totalBusinessAssets,
        currentCreditExposure: calculated.currentCreditExposure,
        commercialBankingEligible: calculated.commercialBankingEligible,
        metadata: { productHoldings: calculated.productHoldings, factorCount: calculated.factors.length },
      },
    });
    await pruneRelationshipProfileSnapshots(prisma, { companyId });
  }

  const action = existing ? "COMPANY_RELATIONSHIP_PROFILE_REFRESHED" : "COMPANY_RELATIONSHIP_PROFILE_CREATED";
  await writeAuditLog({
    actorUserId: actor,
    targetCompanyId: companyId,
    action,
    entityType: "COMPANY",
    entityId: profile.id,
    description: existing ? "Company relationship profile refreshed" : "Company relationship profile created",
    metadata: {
      companyId,
      newScore: calculated.relationshipScore,
      newTier: calculated.relationshipTier,
      actorUserId: actorUserId ?? "SYSTEM",
    },
  });

  if (existing && existing.relationshipScore !== calculated.relationshipScore) {
    await writeAuditLog({
      actorUserId: actor,
      targetCompanyId: companyId,
      action: "COMPANY_RELATIONSHIP_SCORE_CHANGED",
      entityType: "COMPANY",
      entityId: profile.id,
      description: "Company relationship score changed",
      metadata: {
        companyId,
        oldScore: existing.relationshipScore,
        newScore: calculated.relationshipScore,
      },
    });
  }

  if (existing && existing.relationshipTier !== tierToDb(calculated.relationshipTier)) {
    await writeAuditLog({
      actorUserId: actor,
      targetCompanyId: companyId,
      action: "COMPANY_RELATIONSHIP_TIER_CHANGED",
      entityType: "COMPANY",
      entityId: profile.id,
      description: "Company relationship tier changed",
      metadata: {
        companyId,
        oldTier: tierToCode(existing.relationshipTier),
        newTier: calculated.relationshipTier,
      },
    });
  }

  if (
    existing &&
    existing.commercialBankingEligible !== calculated.commercialBankingEligible
  ) {
    await writeAuditLog({
      actorUserId: actor,
      targetCompanyId: companyId,
      action: "COMPANY_COMMERCIAL_BANKING_ELIGIBILITY_CHANGED",
      entityType: "COMPANY",
      entityId: profile.id,
      description: "Company commercial banking eligibility changed",
      metadata: {
        companyId,
        eligible: calculated.commercialBankingEligible,
      },
    });
  }

  if (!options?.skipRecommendations) {
    try {
      const { generateCompanyRelationshipRecommendations } = await import(
        "@/server/company-relationship-recommendation.service"
      );
      await generateCompanyRelationshipRecommendations(companyId, actor, {
        allowSystemRefresh: options?.allowSystemRefresh,
        profileRow: mapProfileRow(profile, calculated.productHoldings),
      });
    } catch {
      // Recommendations are best-effort after profile refresh.
    }
  }

  try {
    const { syncCompanyRelationshipProfileTimelineEvents } = await import(
      "@/server/company-relationship-timeline.service"
    );
    await syncCompanyRelationshipProfileTimelineEvents({
      companyId,
      actorUserId: actor,
      oldScore: existing?.relationshipScore ?? null,
      newScore: calculated.relationshipScore,
      oldTier: existing ? tierToCode(existing.relationshipTier) : null,
      newTier: calculated.relationshipTier,
      oldCommercialEligible: existing?.commercialBankingEligible ?? false,
      newCommercialEligible: calculated.commercialBankingEligible,
    });
  } catch {
    // Timeline sync is best-effort after profile refresh.
  }

  return mapProfileRow(profile, calculated.productHoldings);
}

async function requireCompanyMemberOrOperator(companyId: string, userId: string): Promise<void> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (membership) return;
  await requireOperator();
}

export async function getCustomerCompanyRelationshipView(
  companyId: string,
  userId: string,
): Promise<CustomerCompanyRelationshipView> {
  await requireCompanyMemberOrOperator(companyId, userId);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("NOT_FOUND");

  const unverifiedCompanyProfile = (): CalculatedCompanyRelationshipProfile => ({
    relationshipSince: company.createdAt.toISOString(),
    relationshipScore: 0,
    relationshipTier: "NEW",
    commercialBankingEligible: false,
    totalBusinessAssets: 0,
    lifetimeDeposits: 0,
    lifetimeWithdrawals: 0,
    lifetimeInterestEarned: 0,
    lifetimeInterestPaid: 0,
    lifetimeAltaPayVolume: 0,
    lifetimeLoanPayments: 0,
    lifetimeCardPayments: 0,
    activeLoanBalance: 0,
    activeCardBalance: 0,
    currentCreditExposure: 0,
    productHoldings: {
      activeBusinessAccounts: 0,
      activeBusinessLoans: 0,
      activeBusinessCards: 0,
      paidOffBusinessLoans: 0,
      businessCardApplications: 0,
      treasuryPlaceholder: true,
      exchangePlaceholder: true,
    },
    lastCalculatedAt: new Date().toISOString(),
    factors: [],
  });

  let calculated: CalculatedCompanyRelationshipProfile;
  try {
    calculated =
      company.verificationStatus === "VERIFIED"
        ? await calculateCompanyRelationshipProfile(companyId)
        : unverifiedCompanyProfile();
  } catch {
    calculated = unverifiedCompanyProfile();
  }

  try {
    const { refreshCompanyRelationshipProfileBestEffort } = await import(
      "@/server/relationship-refresh-hooks.service"
    );
    if (company.verificationStatus === "VERIFIED") {
      await refreshCompanyRelationshipProfileBestEffort(companyId, "customer-company-relationship-view");
    }
  } catch {
    // Profile refresh is best-effort on customer view load.
  }

  const { getCustomerCompanyRelationshipOpportunities } = await import(
    "@/server/company-relationship-recommendation.service"
  );
  const opportunities = await getCustomerCompanyRelationshipOpportunities(companyId);

  const {
    ensureCompanyRelationshipTimelineBackfilled,
    getCustomerCompanyRelationshipTimeline,
    reconcileCompanyRelationshipTimelineDates,
  } = await import("@/server/company-relationship-timeline.service");
  try {
    await ensureCompanyRelationshipTimelineBackfilled(companyId);
  } catch {
    // Timeline backfill is best-effort on customer view load.
  }
  try {
    await reconcileCompanyRelationshipTimelineDates(companyId);
  } catch {
    // Date reconciliation is best-effort on customer view load.
  }
  const timeline = await getCustomerCompanyRelationshipTimeline(companyId);

  const { computeCompanyRelationshipProgress } = await import(
    "@/lib/bank/customer-relationship-display"
  );

  return {
    companyId,
    companyName: company.name,
    relationshipSince: calculated.relationshipSince,
    relationshipTier: calculated.relationshipTier,
    relationshipTierLabel: COMPANY_RELATIONSHIP_TIER_LABELS[calculated.relationshipTier],
    relationshipProgress: computeCompanyRelationshipProgress(
      calculated.relationshipScore,
      calculated.relationshipTier,
    ),
    totalBusinessAssets: calculated.totalBusinessAssets,
    lifetimeDeposits: calculated.lifetimeDeposits,
    lifetimeWithdrawals: calculated.lifetimeWithdrawals,
    lifetimeInterestEarned: calculated.lifetimeInterestEarned,
    lifetimeInterestPaid: calculated.lifetimeInterestPaid,
    lifetimeAltaPayVolume: calculated.lifetimeAltaPayVolume,
    activeBusinessLoans: calculated.productHoldings.activeBusinessLoans,
    activeBusinessCards: calculated.productHoldings.activeBusinessCards,
    productHoldings: calculated.productHoldings,
    commercialBankingEligible: calculated.commercialBankingEligible,
    opportunities,
    timeline,
  };
}

export async function getAdminCompanyRelationshipDetail(
  companyId: string,
): Promise<AdminCompanyRelationshipDetail> {
  await requireOperator();

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("NOT_FOUND");

  const profile = await getCompanyRelationshipProfile(companyId);
  let calculated: CalculatedCompanyRelationshipProfile;
  try {
    calculated =
      company.verificationStatus === "VERIFIED"
        ? await calculateCompanyRelationshipProfile(companyId)
        : {
            relationshipSince: company.createdAt.toISOString(),
            relationshipScore: 0,
            relationshipTier: "NEW",
            commercialBankingEligible: false,
            totalBusinessAssets: 0,
            lifetimeDeposits: 0,
            lifetimeWithdrawals: 0,
            lifetimeInterestEarned: 0,
            lifetimeInterestPaid: 0,
            lifetimeAltaPayVolume: 0,
            lifetimeLoanPayments: 0,
            lifetimeCardPayments: 0,
            activeLoanBalance: 0,
            activeCardBalance: 0,
            currentCreditExposure: 0,
            productHoldings: {
              activeBusinessAccounts: 0,
              activeBusinessLoans: 0,
              activeBusinessCards: 0,
              paidOffBusinessLoans: 0,
              businessCardApplications: 0,
              treasuryPlaceholder: true,
              exchangePlaceholder: true,
            },
            lastCalculatedAt: new Date().toISOString(),
            factors: [],
          };
  } catch {
    calculated = profile
      ? {
          relationshipSince: profile.relationshipSince,
          relationshipScore: profile.relationshipScore,
          relationshipTier: profile.relationshipTier,
          commercialBankingEligible: profile.commercialBankingEligible,
          totalBusinessAssets: profile.totalBusinessAssets,
          lifetimeDeposits: profile.lifetimeDeposits,
          lifetimeWithdrawals: profile.lifetimeWithdrawals,
          lifetimeInterestEarned: profile.lifetimeInterestEarned,
          lifetimeInterestPaid: profile.lifetimeInterestPaid,
          lifetimeAltaPayVolume: profile.lifetimeAltaPayVolume,
          lifetimeLoanPayments: profile.lifetimeLoanPayments,
          lifetimeCardPayments: profile.lifetimeCardPayments,
          activeLoanBalance: profile.activeLoanBalance,
          activeCardBalance: profile.activeCardBalance,
          currentCreditExposure: profile.currentCreditExposure,
          productHoldings: profile.productHoldings,
          lastCalculatedAt: profile.lastCalculatedAt,
          factors: [],
        }
      : {
          relationshipSince: company.createdAt.toISOString(),
          relationshipScore: 0,
          relationshipTier: "NEW",
          commercialBankingEligible: false,
          totalBusinessAssets: 0,
          lifetimeDeposits: 0,
          lifetimeWithdrawals: 0,
          lifetimeInterestEarned: 0,
          lifetimeInterestPaid: 0,
          lifetimeAltaPayVolume: 0,
          lifetimeLoanPayments: 0,
          lifetimeCardPayments: 0,
          activeLoanBalance: 0,
          activeCardBalance: 0,
          currentCreditExposure: 0,
          productHoldings: {
            activeBusinessAccounts: 0,
            activeBusinessLoans: 0,
            activeBusinessCards: 0,
            paidOffBusinessLoans: 0,
            businessCardApplications: 0,
            treasuryPlaceholder: true,
            exchangePlaceholder: true,
          },
          lastCalculatedAt: new Date().toISOString(),
          factors: [],
        };
  }

  const timelineCount = await prisma.companyRelationshipTimelineEvent.count({ where: { companyId } });
  const firstEvent = await prisma.companyRelationshipTimelineEvent.findFirst({
    where: { companyId },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
  });
  const latestEvent = await prisma.companyRelationshipTimelineEvent.findFirst({
    where: { companyId },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      verificationStatus: company.verificationStatus,
    },
    profile,
    calculated,
    timelineSummary: {
      totalEvents: timelineCount,
      firstEventAt: firstEvent?.occurredAt.toISOString() ?? null,
      latestEventAt: latestEvent?.occurredAt.toISOString() ?? null,
    },
  };
}

export async function getCompanyRelationshipProfileSummary(
  companyId: string,
): Promise<CompanyRelationshipProfileSummary | null> {
  await requireOperator();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.verificationStatus !== "VERIFIED") return null;

  const [calculated, profile] = await Promise.all([
    calculateCompanyRelationshipProfile(companyId),
    getCompanyRelationshipProfile(companyId),
  ]);

  return {
    companyId,
    relationshipSince: calculated.relationshipSince,
    relationshipScore: calculated.relationshipScore,
    relationshipTier: calculated.relationshipTier,
    commercialBankingEligible: calculated.commercialBankingEligible,
    totalBusinessAssets: calculated.totalBusinessAssets,
    productHoldings: calculated.productHoldings,
    lastCalculatedAt: profile?.lastCalculatedAt ?? calculated.lastCalculatedAt,
  };
}

export async function getCompanyRelationshipProfileSummariesForCompanies(
  companyIds: string[],
): Promise<Record<string, CompanyRelationshipProfileSummary>> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const summaries = await Promise.all(unique.map((id) => getCompanyRelationshipProfileSummary(id)));
  const byCompanyId: Record<string, CompanyRelationshipProfileSummary> = {};
  for (const summary of summaries) {
    if (summary) byCompanyId[summary.companyId] = summary;
  }
  return byCompanyId;
}

export async function getCompanyRelationshipIntelligenceDashboard(): Promise<CompanyRelationshipIntelligenceDashboard> {
  await requireOperator();

  const [totalProfiles, commercialEligibleCount, preferredOrPremierCount, topByAssets] = await Promise.all([
    prisma.companyRelationshipProfile.count(),
    prisma.companyRelationshipProfile.count({ where: { commercialBankingEligible: true } }),
    prisma.companyRelationshipProfile.count({
      where: { relationshipTier: { in: ["PREFERRED", "PREMIER", "COMMERCIAL_ELIGIBLE"] } },
    }),
    prisma.companyRelationshipProfile.findMany({
      orderBy: { totalBusinessAssets: "desc" },
      take: 10,
      include: { company: { select: { name: true } } },
    }),
  ]);

  return {
    totalProfiles,
    commercialEligibleCount,
    preferredOrPremierCount,
    topByAssets: topByAssets.map((row) => ({
      companyId: row.companyId,
      companyName: row.company.name,
      totalBusinessAssets: decimalToNumber(row.totalBusinessAssets),
      relationshipScore: row.relationshipScore,
    })),
  };
}

export async function refreshAllCompanyRelationshipProfiles(
  actorUserId?: string,
  options?: { allowSystemRefresh?: boolean },
): Promise<{
  processed: number;
  refreshed: number;
  failed: number;
}> {
  const companies = await prisma.company.findMany({
    where: { verificationStatus: "VERIFIED" },
    select: { id: true },
  });
  let refreshed = 0;
  let failed = 0;

  for (const company of companies) {
    try {
      await refreshCompanyRelationshipProfile(company.id, actorUserId, {
        allowSystemRefresh: options?.allowSystemRefresh,
        skipRecommendations: true,
      });
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: companies.length, refreshed, failed };
}
