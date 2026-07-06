import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canManageCompany } from "@/lib/auth/permissions";
import type {
  AdminCommercialDowngradeResult,
  AdminCommercialProGrantResult,
  CommercialBillingAccountOption,
  CommercialBillingPreview,
  CommercialDowngradePreview,
  CommercialDowngradeResult,
  CommercialPurchaseResult,
} from "@/lib/bank/commercial-billing-types";
import { DEFAULT_COMMERCIAL_FEATURES } from "@/lib/bank/commercial-banking-types";
import { prisma } from "@/server/db";
import { debitBankAccountInTx } from "@/server/financial-integrity.service";
import { getCommercialPlatformSettings } from "@/server/commercial-platform-settings.service";
import { loadCommercialPlanSettings } from "@/server/commercial-plan.service";
import { getAccountAvailableBalance } from "@/server/account-balance.service";
import { requireAdmin } from "@/server/permissions.service";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

async function runCommercialCustomerNotifications(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  void fn().catch((error) => {
    console.error(`[commercial-billing] ${label} notification failed`, error);
  });
}

function generateCommercialBillingReference(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CMP-${date}-${suffix}`;
}

export function addBillingMonths(date: Date, months = 1): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function isPastGracePeriod(
  pastDueAt: Date | null,
  gracePeriodDays: number,
  now = new Date(),
): boolean {
  if (!pastDueAt || gracePeriodDays <= 0) return Boolean(pastDueAt);
  const graceEndsAt = pastDueAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000;
  return now.getTime() >= graceEndsAt;
}

export function canPurchaseCommercialPro(user: AltaUser, companyId: string): boolean {
  return canManageCompany(user, { companyId });
}

export function canDowngradeCommercialPro(user: AltaUser, companyId: string): boolean {
  return canManageCompany(user, { companyId });
}

export function canManageCommercialBillingAccount(user: AltaUser, companyId: string): boolean {
  return canManageCompany(user, { companyId }) || canManageBusinessTreasury(user, { companyId });
}

async function assertCompanyVerified(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();
  if (company.verificationStatus !== "VERIFIED") {
    badRequest("Company verification is required for Alta Commercial Pro.");
  }
  return company;
}

async function loadBillingAccountForCompany(companyId: string, billingAccountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: billingAccountId,
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
  });
  if (!account) badRequest("Select an active business operating account for billing.");
  return account;
}

async function assertUserCanAccessBillingAccount(
  user: AltaUser,
  companyId: string,
  billingAccountId: string,
) {
  if (!canManageBusinessTreasury(user, { companyId })) forbidden();
  return loadBillingAccountForCompany(companyId, billingAccountId);
}

export function resolveAdminGrantExpiresAt(input: {
  now: Date;
  months: number;
  currentExpiresAt?: Date | null;
  isActiveAdminGrant?: boolean;
}): Date {
  if (
    input.isActiveAdminGrant &&
    input.currentExpiresAt &&
    input.currentExpiresAt.getTime() > input.now.getTime()
  ) {
    return addBillingMonths(input.currentExpiresAt, input.months);
  }
  return addBillingMonths(input.now, input.months);
}

export async function adminGrantCommercialPro(
  actorUserId: string,
  input: { companyId: string; months: number; reason: string },
  source = "internal-admin",
): Promise<AdminCommercialProGrantResult> {
  await requireAdmin();
  const reason = input.reason.trim();
  if (!reason) badRequest("Reason is required.");
  if (!Number.isInteger(input.months) || input.months < 1) {
    badRequest("Duration must be at least 1 month.");
  }
  if (input.months > 120) badRequest("Duration cannot exceed 120 months.");

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
      memberships: { select: { userId: true } },
    },
  });
  if (!company) notFound();

  const now = new Date();
  const expiresAt = resolveAdminGrantExpiresAt({
    now,
    months: input.months,
    currentExpiresAt: company.commercialProExpiresAt,
    isActiveAdminGrant:
      company.commercialPlan === "PRO" &&
      company.commercialProGrantSource === "ADMIN_GRANT",
  });

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "NOT_BILLED",
      commercialMonthlyFee: null,
      commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
      commercialProGrantSource: "ADMIN_GRANT",
      commercialProExpiresAt: expiresAt,
      commercialProSubscribedAt: company.commercialProSubscribedAt ?? now,
      commercialBillingAccountId: null,
      commercialNextBillingAt: null,
      commercialPastDueAt: null,
    },
  });

  const { recordCommercialProAdminGrantedAudit } = await import("@/server/commercial-audit.service");
  const { notifyCommercialProAdminGranted } = await import("@/server/banking-notification.service");

  await recordCommercialProAdminGrantedAudit({
    actorUserId,
    companyId: company.id,
    companyName: company.name,
    months: input.months,
    expiresAt: expiresAt.toISOString(),
    reason,
    source,
  });

  const accountId = company.bankAccounts[0]?.id;
  const linkUrl = accountId
    ? `/bank/account/${accountId}/commercial/settings`
    : "/bank/business";

  await runCommercialCustomerNotifications("admin grant", () =>
    notifyCommercialProAdminGranted({
      companyId: company.id,
      companyName: company.name,
      months: input.months,
      expiresAt: expiresAt.toISOString(),
      linkUrl,
    }),
  );

  return {
    companyId: company.id,
    companyName: company.name,
    monthsGranted: input.months,
    expiresAt: expiresAt.toISOString(),
    memberCount: company.memberships.length,
  };
}

export async function adminDowngradeCommercialProToCore(
  actorUserId: string,
  input: { companyId: string; reason: string },
  source = "internal-admin",
): Promise<AdminCommercialDowngradeResult> {
  await requireAdmin();
  const reason = input.reason.trim();
  if (!reason) badRequest("Reason is required.");

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: { memberships: { select: { userId: true } } },
  });
  if (!company) notFound();
  if (company.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }

  await downgradeCommercialProToCore(input.companyId, actorUserId, reason, source);

  return {
    companyId: company.id,
    companyName: company.name,
    memberCount: company.memberships.length,
  };
}

export async function listCommercialBillingAccounts(
  user: AltaUser,
  companyId: string,
): Promise<CommercialBillingAccountOption[]> {
  if (!canManageCommercialBillingAccount(user, companyId)) forbidden();
  await assertCompanyVerified(companyId);

  const accounts = await prisma.bankAccount.findMany({
    where: {
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
  });

  const options = await Promise.all(
    accounts.map(async (account) => ({
      id: account.id,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      availableBalance: await getAccountAvailableBalance(account.id),
    })),
  );

  return options;
}

export async function getCommercialBillingPreview(
  user: AltaUser,
  companyId: string,
  billingAccountId?: string,
): Promise<CommercialBillingPreview> {
  if (!canPurchaseCommercialPro(user, companyId)) forbidden();

  const company = await assertCompanyVerified(companyId);
  const plan = await loadCommercialPlanSettings(companyId);
  const platformSettings = await getCommercialPlatformSettings();
  const monthlyFee = platformSettings.proMonthlyFee;

  const accounts = await listCommercialBillingAccounts(user, companyId);
  const selectedAccountId =
    billingAccountId ??
    company.commercialBillingAccountId ??
    accounts[0]?.id ??
    null;

  let billingAccount: CommercialBillingAccountOption | null = null;
  if (selectedAccountId) {
    billingAccount = accounts.find((row) => row.id === selectedAccountId) ?? null;
  }

  const now = new Date();
  const nextBillingAt = addBillingMonths(now, 1);

  return {
    companyId,
    companyName: company.name,
    currentPlan: plan.commercialPlan,
    targetPlan: "PRO",
    monthlyFee,
    billingAccount,
    billingAccounts: accounts,
    nextBillingDate: nextBillingAt.toISOString(),
    canPurchase: plan.commercialPlan !== "PRO",
  };
}

type ChargeResult = {
  transactionId: string;
  referenceCode: string;
};

export async function chargeCommercialProFee(input: {
  companyId: string;
  billingAccountId: string;
  amount: number;
  description: string;
}): Promise<ChargeResult> {
  if (input.amount <= 0) badRequest("Billing amount must be greater than zero.");

  const account = await loadBillingAccountForCompany(input.companyId, input.billingAccountId);
  const referenceCode = generateCommercialBillingReference();

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      await debitBankAccountInTx(tx, account.id, input.amount, {
        message: input.description,
      });
      return tx.bankTransaction.create({
        data: {
          bankAccountId: account.id,
          type: "ADJUSTMENT",
          amount: input.amount,
          status: "APPROVED",
          description: input.description,
          referenceCode,
          reviewedAt: new Date(),
          reviewNote: "Alta Commercial Pro subscription",
        },
      });
    });
    return { transactionId: transaction.id, referenceCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("INSUFFICIENT") || message.includes("available balance")) {
      badRequest(
        "Insufficient funds in the selected billing account. Add funds and try again.",
      );
    }
    throw error;
  }
}

export async function purchaseCommercialPro(
  user: AltaUser,
  input: { companyId: string; billingAccountId: string },
  source = "website",
): Promise<CommercialPurchaseResult> {
  if (!canPurchaseCommercialPro(user, input.companyId)) forbidden();

  const company = await assertCompanyVerified(input.companyId);
  const plan = await loadCommercialPlanSettings(input.companyId);
  if (plan.commercialPlan === "PRO" && plan.planStatus === "ACTIVE") {
    badRequest("This company is already on Alta Commercial Pro.");
  }

  await assertUserCanAccessBillingAccount(user, input.companyId, input.billingAccountId);
  const platformSettings = await getCommercialPlatformSettings();
  const monthlyFee = platformSettings.proMonthlyFee;
  const now = new Date();
  const nextBillingAt = addBillingMonths(now, 1);

  const {
    recordCommercialProPurchaseFailedAudit,
    recordCommercialProPurchasedAudit,
  } = await import("@/server/commercial-audit.service");
  const { notifyCommercialProActivated } = await import("@/server/banking-notification.service");

  let charge: ChargeResult;
  try {
    charge = await chargeCommercialProFee({
      companyId: input.companyId,
      billingAccountId: input.billingAccountId,
      amount: monthlyFee,
      description: `Alta Commercial Pro · First month`,
    });
  } catch (error) {
    await recordCommercialProPurchaseFailedAudit({
      actorUserId: user.id,
      companyId: input.companyId,
      billingAccountId: input.billingAccountId,
      amount: monthlyFee,
      reason: error instanceof Error ? error.message : String(error),
      source,
    });
    throw error;
  }

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "CURRENT",
      commercialMonthlyFee: monthlyFee,
      commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
      commercialBillingAccountId: input.billingAccountId,
      commercialNextBillingAt: nextBillingAt,
      commercialPastDueAt: null,
      commercialProSubscribedAt: now,
      commercialProGrantSource: "PURCHASED",
      commercialProExpiresAt: null,
    },
  });

  await recordCommercialProPurchasedAudit({
    actorUserId: user.id,
    companyId: input.companyId,
    billingAccountId: input.billingAccountId,
    amount: monthlyFee,
    transactionId: charge.transactionId,
    referenceCode: charge.referenceCode,
    nextBillingAt: nextBillingAt.toISOString(),
    source,
  });

  await runCommercialCustomerNotifications("pro activated", () =>
    notifyCommercialProActivated({
      companyId: input.companyId,
      monthlyFee,
      nextBillingAt: nextBillingAt.toISOString(),
      billingAccountId: input.billingAccountId,
    }),
  );

  return {
    commercialPlan: "PRO",
    billingStatus: "CURRENT",
    monthlyFee,
    billingAccountId: input.billingAccountId,
    nextBillingAt: nextBillingAt.toISOString(),
    transactionId: charge.transactionId,
    referenceCode: charge.referenceCode,
  };
}

export async function updateCommercialBillingAccount(
  user: AltaUser,
  input: { companyId: string; billingAccountId: string },
  source = "website",
): Promise<{ billingAccountId: string }> {
  if (!canManageCommercialBillingAccount(user, input.companyId)) forbidden();

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) notFound();
  if (company.commercialPlan !== "PRO") {
    badRequest("Billing account changes require an active Alta Commercial Pro subscription.");
  }

  await assertUserCanAccessBillingAccount(user, input.companyId, input.billingAccountId);
  const previousBillingAccountId = company.commercialBillingAccountId;

  await prisma.company.update({
    where: { id: input.companyId },
    data: { commercialBillingAccountId: input.billingAccountId },
  });

  const { recordCommercialBillingAccountChangedAudit } = await import(
    "@/server/commercial-audit.service"
  );
  const { notifyCommercialBillingAccountChanged } = await import(
    "@/server/banking-notification.service"
  );

  await recordCommercialBillingAccountChangedAudit({
    actorUserId: user.id,
    companyId: input.companyId,
    previousBillingAccountId,
    nextBillingAccountId: input.billingAccountId,
    source,
  });

  await runCommercialCustomerNotifications("billing account changed", () =>
    notifyCommercialBillingAccountChanged({
      companyId: input.companyId,
      billingAccountId: input.billingAccountId,
    }),
  );

  return { billingAccountId: input.billingAccountId };
}

export async function getCommercialDowngradePreview(
  user: AltaUser,
  companyId: string,
): Promise<CommercialDowngradePreview> {
  if (!canDowngradeCommercialPro(user, companyId)) forbidden();

  const company = await assertCompanyVerified(companyId);
  const plan = await loadCommercialPlanSettings(companyId);
  if (plan.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }

  const { previewCommercialCoreDowngradeCleanup } = await import(
    "@/server/commercial-downgrade-cleanup.service"
  );
  const platformSettings = await getCommercialPlatformSettings();
  const cleanup = await previewCommercialCoreDowngradeCleanup(companyId);

  return {
    companyId,
    companyName: company.name,
    currentPlan: "PRO",
    targetPlan: "CORE",
    grantSource: company.commercialProGrantSource,
    monthlyFee: company.commercialMonthlyFee
      ? Number(company.commercialMonthlyFee.toString())
      : null,
    canDowngrade: true,
    cleanup,
    coreLimits: {
      coreInvoiceMonthlyLimit: platformSettings.coreInvoiceMonthlyLimit,
      corePaymentLinkMonthlyLimit: platformSettings.corePaymentLinkMonthlyLimit,
      coreTeamMemberLimit: platformSettings.coreTeamMemberLimit,
    },
  };
}

export async function downgradeCommercialProByCustomer(
  user: AltaUser,
  input: { companyId: string },
  source = "website",
): Promise<CommercialDowngradeResult> {
  if (!canDowngradeCommercialPro(user, input.companyId)) forbidden();

  const company = await assertCompanyVerified(input.companyId);
  if (company.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }

  const { previewCommercialCoreDowngradeCleanup } = await import(
    "@/server/commercial-downgrade-cleanup.service"
  );
  const cleanupPreview = await previewCommercialCoreDowngradeCleanup(input.companyId);

  await downgradeCommercialProToCore(
    input.companyId,
    user.id,
    "Downgraded from Commercial settings.",
    source,
  );

  return {
    companyId: company.id,
    companyName: company.name,
    commercialPlan: "CORE",
    cleanup: cleanupPreview,
  };
}

export async function downgradeCommercialProToCore(
  companyId: string,
  actorUserId: string,
  reason: string,
  source = "system",
): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.commercialPlan !== "PRO") return;

  const { applyCommercialCoreDowngradeCleanup } = await import(
    "@/server/commercial-downgrade-cleanup.service"
  );
  const cleanup = await applyCommercialCoreDowngradeCleanup(companyId, actorUserId, source);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      commercialPlan: "CORE",
      planStatus: "ACTIVE",
      billingStatus: "NOT_BILLED",
      commercialMonthlyFee: null,
      commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.CORE,
      commercialBillingAccountId: null,
      commercialNextBillingAt: null,
      commercialPastDueAt: null,
      commercialProGrantSource: null,
      commercialProExpiresAt: null,
    },
  });

  const { recordCommercialProDowngradedAudit } = await import("@/server/commercial-audit.service");
  const { notifyCommercialProDowngraded } = await import("@/server/banking-notification.service");

  await recordCommercialProDowngradedAudit({
    actorUserId,
    companyId,
    reason,
    source,
    cleanup,
  });

  await runCommercialCustomerNotifications("pro downgraded", () =>
    notifyCommercialProDowngraded({ companyId, reason }),
  );
}
