import type {
  CommercialBillingStatus,
  CommercialFeatureKey,
  CommercialPlan,
  CommercialPlanSettings,
  CommercialPlanStatus,
  CommercialBankingContext,
} from "@/lib/bank/commercial-banking-types";
import { DEFAULT_COMMERCIAL_FEATURES } from "@/lib/bank/commercial-banking-types";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManageCompany,
  canManageMerchantInvoices,
  canViewMerchantInvoices,
} from "@/lib/auth/permissions";
import { prisma } from "@/server/db";

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

export type CommercialBankingContextVerification =
  | "verified"
  | "pending"
  | "unverified"
  | "rejected";

export function mapVerificationStatus(status: string): CommercialBankingContextVerification {
  switch (status) {
    case "VERIFIED":
      return "verified";
    case "PENDING":
      return "pending";
    case "REJECTED":
      return "rejected";
    default:
      return "unverified";
  }
}

export function mapCommercialPlanSettings(company: {
  commercialPlan: CommercialPlan;
  planStatus: CommercialPlanStatus;
  billingStatus: CommercialBillingStatus;
  commercialMonthlyFee: { toString(): string } | null;
  commercialEnabledFeatures: unknown;
}): CommercialPlanSettings {
  const storedFeatures = Array.isArray(company.commercialEnabledFeatures)
    ? (company.commercialEnabledFeatures as CommercialFeatureKey[])
    : null;

  return {
    commercialPlan: company.commercialPlan,
    planStatus: company.planStatus,
    billingStatus: company.billingStatus,
    monthlyFee: decimalToNumber(company.commercialMonthlyFee),
    enabledFeatures: storedFeatures ?? DEFAULT_COMMERCIAL_FEATURES[company.commercialPlan],
  };
}

export function companyHasCommercialFeature(
  plan: CommercialPlanSettings,
  feature: CommercialFeatureKey,
): boolean {
  if (plan.planStatus !== "ACTIVE") return false;
  return plan.enabledFeatures.includes(feature);
}

export function isCommercialProActive(plan: CommercialPlanSettings): boolean {
  return plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE";
}

export function canAccessAdvancedMerchantAnalytics(plan: CommercialPlanSettings): boolean {
  return isCommercialProActive(plan) && companyHasCommercialFeature(plan, "merchant_analytics");
}

export function canAccessCommercialPayroll(plan: CommercialPlanSettings): boolean {
  return isCommercialProActive(plan) && companyHasCommercialFeature(plan, "payroll");
}

export function canAccessBasicMerchantAnalytics(plan: CommercialPlanSettings): boolean {
  return plan.planStatus === "ACTIVE";
}

export function canAccessMerchantAnalytics(plan: CommercialPlanSettings): boolean {
  return canAccessAdvancedMerchantAnalytics(plan);
}

export function canViewCommercialAnalytics(user: AltaUser, companyId: string): boolean {
  return canViewMerchantInvoices(user, { companyId });
}

export function canManageCommercialPlan(user: AltaUser, companyId: string): boolean {
  return canManageMerchantInvoices(user, { companyId });
}

export function canPurchaseCommercialPro(user: AltaUser, companyId: string): boolean {
  return canManageCompany(user, { companyId });
}

export async function loadCommercialPlanSettings(companyId: string): Promise<CommercialPlanSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      commercialPlan: true,
      planStatus: true,
      billingStatus: true,
      commercialMonthlyFee: true,
      commercialEnabledFeatures: true,
    },
  });
  if (!company) throw new Error("NOT_FOUND");
  return mapCommercialPlanSettings(company);
}

export async function updateCommercialPlanSettings(
  actorUserId: string,
  companyId: string,
  input: {
    commercialPlan?: CommercialPlan;
    planStatus?: CommercialPlanStatus;
    billingStatus?: CommercialBillingStatus;
    monthlyFee?: number | null;
    enabledFeatures?: CommercialFeatureKey[];
  },
  source = "website",
  options?: { allowPlanChange?: boolean },
): Promise<CommercialPlanSettings> {
  const existing = await prisma.company.findUnique({ where: { id: companyId } });
  if (!existing) throw new Error("NOT_FOUND");

  if (input.commercialPlan && input.commercialPlan !== existing.commercialPlan) {
    if (!options?.allowPlanChange) {
      throw new Error("BAD_REQUEST:Use the Commercial Pro purchase flow to change plans.");
    }
  }

  const enabledFeatures =
    input.enabledFeatures ??
    (input.commercialPlan ? DEFAULT_COMMERCIAL_FEATURES[input.commercialPlan] : undefined);

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(input.commercialPlan ? { commercialPlan: input.commercialPlan } : {}),
      ...(input.planStatus ? { planStatus: input.planStatus } : {}),
      ...(input.billingStatus ? { billingStatus: input.billingStatus } : {}),
      ...(input.monthlyFee !== undefined ? { commercialMonthlyFee: input.monthlyFee } : {}),
      ...(enabledFeatures ? { commercialEnabledFeatures: enabledFeatures } : {}),
    },
    select: {
      commercialPlan: true,
      planStatus: true,
      billingStatus: true,
      commercialMonthlyFee: true,
      commercialEnabledFeatures: true,
    },
  });

  const { recordCommercialPlanChangedAudit, recordCommercialFeatureTogglesAudit } = await import(
    "@/server/commercial-audit.service"
  );

  if (input.commercialPlan && input.commercialPlan !== existing.commercialPlan) {
    await recordCommercialPlanChangedAudit({
      actorUserId,
      companyId,
      previousPlan: existing.commercialPlan,
      nextPlan: input.commercialPlan,
      source,
    });
  }

  if (enabledFeatures) {
    const before = mapCommercialPlanSettings(existing).enabledFeatures;
    const after = enabledFeatures;
    const enabled = after.filter((feature) => !before.includes(feature));
    const disabled = before.filter((feature) => !after.includes(feature));
    await recordCommercialFeatureTogglesAudit({
      actorUserId,
      companyId,
      enabled,
      disabled,
      source,
    });
  }

  return mapCommercialPlanSettings(updated);
}

export async function assertAdvancedMerchantAnalyticsAccess(
  user: AltaUser,
  companyId: string,
): Promise<CommercialPlanSettings> {
  if (!canViewCommercialAnalytics(user, companyId)) throw new Error("FORBIDDEN");
  const plan = await loadCommercialPlanSettings(companyId);
  if (!canAccessAdvancedMerchantAnalytics(plan)) {
    throw new Error("BAD_REQUEST:Advanced merchant analytics requires Alta Commercial Pro.");
  }
  return plan;
}

export async function assertCommercialPayrollAccess(
  user: AltaUser,
  companyId: string,
): Promise<CommercialPlanSettings> {
  const { canViewBusinessTreasury } = await import("@/lib/auth/permissions");
  if (!canViewBusinessTreasury(user, { companyId })) throw new Error("FORBIDDEN");
  const plan = await loadCommercialPlanSettings(companyId);
  if (!canAccessCommercialPayroll(plan)) {
    throw new Error("BAD_REQUEST:Payroll requires Alta Commercial Pro.");
  }
  return plan;
}

/** @deprecated Use assertAdvancedMerchantAnalyticsAccess */
export async function assertMerchantAnalyticsAccess(
  user: AltaUser,
  companyId: string,
): Promise<CommercialPlanSettings> {
  return assertAdvancedMerchantAnalyticsAccess(user, companyId);
}

export async function assertBasicMerchantAnalyticsAccess(
  user: AltaUser,
  companyId: string,
): Promise<CommercialPlanSettings> {
  if (!canViewCommercialAnalytics(user, companyId)) throw new Error("FORBIDDEN");
  const plan = await loadCommercialPlanSettings(companyId);
  if (!canAccessBasicMerchantAnalytics(plan)) {
    throw new Error("BAD_REQUEST:Commercial analytics are unavailable for this plan.");
  }
  return plan;
}

export async function resolveCommercialBankingContext(
  user: AltaUser,
  companyId: string,
): Promise<CommercialBankingContext> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company) throw new Error("NOT_FOUND");

  if (!canViewMerchantInvoices(user, { companyId })) {
    throw new Error("FORBIDDEN");
  }

  const verificationStatus = mapVerificationStatus(company.verificationStatus);
  const isVerified = verificationStatus === "verified";
  const plan = mapCommercialPlanSettings(company);

  return {
    companyId: company.id,
    companyName: company.name,
    accountId: company.bankAccounts[0]?.id ?? null,
    verificationStatus,
    isVerified,
    canManage: canManageMerchantInvoices(user, { companyId }),
    canViewAnalytics:
      canViewCommercialAnalytics(user, companyId) && canAccessBasicMerchantAnalytics(plan),
    plan,
  };
}
