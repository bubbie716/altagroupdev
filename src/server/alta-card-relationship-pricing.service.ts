import {
  formatAltaCardCurrency,
  type AltaCardTierCode,
  type AltaCardRelationshipRecommendation,
  type RelationshipFactor,
} from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_CONFIG,
  getTierDefaultLimit,
  getTierDefaultRate,
} from "@/lib/bank/alta-card-tier-config";
import { isPrivateClient } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

export type { AltaCardRelationshipRecommendation, RelationshipFactor };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function tierFromScore(score: number, isPrivate: boolean): AltaCardTierCode {
  if (isPrivate && score >= 70) return "gold";
  if (score >= 65) return "black";
  if (score >= 40) return "navy";
  return "white";
}

export async function getAltaCardRelationshipRecommendation(
  userId: string,
  companyId?: string | null,
): Promise<AltaCardRelationshipRecommendation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) throw new Error("NOT_FOUND");

  const altaUser = mapDbUserToAltaUser(user);
  const isPrivate = isPrivateClient(altaUser);
  const isBusiness = Boolean(companyId);
  const factors: RelationshipFactor[] = [];
  let score = 20;
  let balanceForBoost = 0;
  let oldestRelationshipAccount: Date | null = null;

  if (!isBusiness) {
    const personalAccounts = await prisma.bankAccount.findMany({
      where: { userId, companyId: null, status: "ACTIVE" },
      select: { balance: true, createdAt: true },
    });
    const personalBalance = personalAccounts.reduce((s, a) => s + Number(a.balance), 0);
    balanceForBoost = personalBalance;
    factors.push({
      key: "personal_bank_balance",
      label: "Personal bank balances",
      value: formatAltaCardCurrency(personalBalance),
      impact: personalBalance >= 200_000 ? 25 : personalBalance >= 50_000 ? 15 : personalBalance >= 10_000 ? 8 : 0,
    });
    score += factors[factors.length - 1].impact;

    oldestRelationshipAccount = personalAccounts.reduce<Date | null>((min, a) => {
      if (!min || a.createdAt < min) return a.createdAt;
      return min;
    }, null);
  }

  const depositCount = await prisma.bankTransaction.count({
    where: {
      type: "DEPOSIT",
      status: "APPROVED",
      bankAccount: isBusiness
        ? { companyId: companyId!, accountType: "BUSINESS_OPERATING", status: "ACTIVE" }
        : { userId, companyId: null, status: "ACTIVE" },
    },
  });
  factors.push({
    key: "deposit_activity",
    label: "Deposit activity",
    value: String(depositCount),
    impact: depositCount >= 20 ? 8 : depositCount >= 5 ? 4 : 0,
  });
  score += factors[factors.length - 1].impact;

  const activeLoans = await prisma.loan.count({
    where: isBusiness
      ? { companyId: companyId!, status: { in: ["ACTIVE", "FROZEN"] } }
      : {
          borrowerUserId: userId,
          companyId: null,
          status: { in: ["ACTIVE", "FROZEN"] },
        },
  });
  const paidLoans = await prisma.loan.count({
    where: isBusiness
      ? { companyId: companyId!, status: "PAID_OFF" }
      : { borrowerUserId: userId, companyId: null, status: "PAID_OFF" },
  });
  const delinquentLoans = await prisma.loan.count({
    where: isBusiness
      ? { companyId: companyId!, status: "DEFAULTED" }
      : { borrowerUserId: userId, companyId: null, status: "DEFAULTED" },
  });

  factors.push({
    key: "active_loans",
    label: "Active loans",
    value: String(activeLoans),
    impact: activeLoans > 0 ? 5 : 0,
  });
  score += factors[factors.length - 1].impact;

  factors.push({
    key: "paid_loans",
    label: "Paid-off loans",
    value: String(paidLoans),
    impact: paidLoans >= 2 ? 10 : paidLoans >= 1 ? 5 : 0,
  });
  score += factors[factors.length - 1].impact;

  if (delinquentLoans > 0) {
    factors.push({
      key: "delinquent_loans",
      label: "Delinquent loans",
      value: String(delinquentLoans),
      impact: -25,
    });
    score += -25;
  }

  if (isBusiness) {
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { verificationStatus: true, createdAt: true },
    });
    if (company?.verificationStatus === "VERIFIED") {
      factors.push({
        key: "company_verified",
        label: "Company verified",
        value: "Yes",
        impact: 10,
      });
      score += 10;
    }

    const businessAccounts = await prisma.bankAccount.findMany({
      where: { companyId: companyId!, accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
      select: { balance: true, createdAt: true },
    });
    const businessBalance = businessAccounts.reduce((s, a) => s + Number(a.balance), 0);
    balanceForBoost = businessBalance;
    factors.push({
      key: "company_bank_balance",
      label: "Business account balances",
      value: formatAltaCardCurrency(businessBalance),
      impact: businessBalance >= 100_000 ? 15 : businessBalance >= 25_000 ? 8 : 0,
    });
    score += factors[factors.length - 1].impact;

    oldestRelationshipAccount = businessAccounts.reduce<Date | null>((min, a) => {
      if (!min || a.createdAt < min) return a.createdAt;
      return min;
    }, null);
  }

  if (isPrivate) {
    factors.push({
      key: "private_client",
      label: "Alta Private client",
      value: "Yes",
      impact: 20,
    });
    score += 20;
  }

  if (oldestRelationshipAccount) {
    const months =
      (Date.now() - oldestRelationshipAccount.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (months >= 12) {
      factors.push({
        key: "account_age",
        label: isBusiness ? "Business banking relationship" : "Banking relationship",
        value: `${Math.floor(months)} months`,
        impact: 5,
      });
      score += 5;
    }
  }

  // TODO: Alta Pay volume when centralized pay analytics are exposed per user/company.
  factors.push({
    key: "alta_pay_volume",
    label: "Alta Pay volume",
    value: "Not yet available",
    impact: 0,
  });

  score = Math.max(0, Math.min(100, score));

  const recommendedTier = tierFromScore(score, isPrivate);
  const tierLimit = getTierDefaultLimit(recommendedTier);
  const tierRate = getTierDefaultRate(recommendedTier);

  const balanceBoost = Math.min(balanceForBoost * 0.5, 25_000);
  const recommendedCreditLimit = roundMoney(
    tierLimit != null ? Math.max(tierLimit, tierLimit + balanceBoost * 0.1) : Math.max(100_000, balanceBoost),
  );

  const rateDiscount = Math.min(score / 100, 0.15);
  const baseRate = tierRate ?? 12.99;
  const recommendedInterestRate = roundMoney(baseRate * (1 - rateDiscount));

  return {
    recommendedTier,
    recommendedCreditLimit,
    recommendedInterestRate,
    relationshipScore: score,
    relationshipFactors: factors,
  };
}

export function getTierConfigForCode(tier: AltaCardTierCode) {
  return ALTA_CARD_TIER_CONFIG[tier];
}
