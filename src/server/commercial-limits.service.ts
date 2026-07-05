import type { CommercialPlanSettings } from "@/lib/bank/commercial-banking-types";
import { prisma } from "@/server/db";
import { getCommercialPlatformSettings } from "@/server/commercial-platform-settings.service";
import { loadCommercialPlanSettings } from "@/server/commercial-plan.service";

export function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function isCommercialProActive(plan: CommercialPlanSettings): boolean {
  return plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE";
}

export function commercialLimitMessage(feature: string, limit: number, unit: string): string {
  return `Alta Commercial Core allows up to ${limit} ${unit}. Upgrade to Pro in Commercial settings for unlimited ${feature}.`;
}

export function commercialLimitError(feature: string, limit: number, unit: string): never {
  throw new Error(`BAD_REQUEST:${commercialLimitMessage(feature, limit, unit)}`);
}

export async function countInvoicesThisMonth(companyId: string): Promise<number> {
  return prisma.merchantInvoice.count({
    where: {
      merchantCompanyId: companyId,
      createdAt: { gte: startOfUtcMonth() },
    },
  });
}

export async function countPaymentLinksThisMonth(companyId: string): Promise<number> {
  return prisma.paymentLink.count({
    where: {
      merchantCompanyId: companyId,
      createdAt: { gte: startOfUtcMonth() },
    },
  });
}

export async function countCompanyTeamMembers(companyId: string): Promise<number> {
  return prisma.companyMembership.count({ where: { companyId } });
}

export async function assertCommercialInvoiceLimit(companyId: string): Promise<void> {
  const plan = await loadCommercialPlanSettings(companyId);
  if (isCommercialProActive(plan)) return;

  const limits = await getCommercialPlatformSettings();
  const count = await countInvoicesThisMonth(companyId);
  if (count >= limits.coreInvoiceMonthlyLimit) {
    commercialLimitError("invoices", limits.coreInvoiceMonthlyLimit, "invoices per month");
  }
}

export async function assertCommercialPaymentLinkLimit(companyId: string): Promise<void> {
  const plan = await loadCommercialPlanSettings(companyId);
  if (isCommercialProActive(plan)) return;

  const limits = await getCommercialPlatformSettings();
  const count = await countPaymentLinksThisMonth(companyId);
  if (count >= limits.corePaymentLinkMonthlyLimit) {
    commercialLimitError(
      "payment links",
      limits.corePaymentLinkMonthlyLimit,
      "payment links created per month",
    );
  }
}

export async function assertCommercialTeamMemberLimit(companyId: string): Promise<void> {
  const plan = await loadCommercialPlanSettings(companyId);
  if (isCommercialProActive(plan)) return;

  const limits = await getCommercialPlatformSettings();
  const count = await countCompanyTeamMembers(companyId);
  if (count >= limits.coreTeamMemberLimit) {
    commercialLimitError("team members", limits.coreTeamMemberLimit, "company team members");
  }
}

export async function getCommercialUsageSummary(companyId: string): Promise<{
  invoicesThisMonth: number;
  paymentLinksThisMonth: number;
  teamMembers: number;
  limits: Awaited<ReturnType<typeof getCommercialPlatformSettings>>;
  isPro: boolean;
}> {
  const [plan, limits, invoicesThisMonth, paymentLinksThisMonth, teamMembers] = await Promise.all([
    loadCommercialPlanSettings(companyId),
    getCommercialPlatformSettings(),
    countInvoicesThisMonth(companyId),
    countPaymentLinksThisMonth(companyId),
    countCompanyTeamMembers(companyId),
  ]);

  return {
    invoicesThisMonth,
    paymentLinksThisMonth,
    teamMembers,
    limits,
    isPro: isCommercialProActive(plan),
  };
}
