import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canManageCompany } from "@/lib/auth/permissions";
import type {
  AdminCommercialDowngradeResult,
  AdminCommercialProGrantResult,
  CommercialBillingAccountOption,
  CommercialBillingPreview,
  CommercialDowngradeInput,
  CommercialDowngradeMode,
  CommercialDowngradePreview,
  CommercialDowngradeResult,
  CommercialPurchaseResult,
} from "@/lib/bank/commercial-billing-types";
import { DEFAULT_COMMERCIAL_FEATURES } from "@/lib/bank/commercial-banking-types";
import { prisma } from "@/server/db";
import { getCommercialPlatformSettings } from "@/server/commercial-platform-settings.service";
import { loadCommercialPlanSettings } from "@/server/commercial-plan.service";
import { getAccountAvailableBalance } from "@/server/account-balance.service";
import { requireOperator } from "@/server/permissions.service";
import {
  executeCommercialSubscriptionChargeInTx,
  initialPurchaseBillingPeriod,
  lockCompanyRowForBilling,
  newCommercialBillingCycleId,
  renewalBillingPeriod,
} from "@/server/commercial-subscription-charge.service";

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

export function addBillingMonths(date: Date, months = 1): Date {
  if (!Number.isFinite(months)) {
    throw new Error("BAD_REQUEST:Billing month offset must be a finite number.");
  }

  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const sourceDay = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  // Absolute month index avoids JS Date month overflow (Jan 31 + 1 → Mar).
  const absoluteMonth = sourceYear * 12 + sourceMonth + Math.trunc(months);
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(sourceDay, daysInTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, milliseconds),
  );
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

function resolvePeriodEndAt(company: {
  commercialNextBillingAt: Date | null;
  commercialProExpiresAt: Date | null;
}): Date | null {
  return company.commercialNextBillingAt ?? company.commercialProExpiresAt ?? null;
}

function cleanupWouldCancelItems(cleanup: {
  payrollRunsCancelled: number;
  paymentLinksCancelled: number;
  invoicesCancelled: number;
}): boolean {
  return (
    cleanup.payrollRunsCancelled > 0 ||
    cleanup.paymentLinksCancelled > 0 ||
    cleanup.invoicesCancelled > 0
  );
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
  const actor = await requireOperator();
  if (actor.id !== actorUserId) forbidden();
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
      commercialBillingCycleId: null,
      commercialDowngradeScheduledAt: null,
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
  const actor = await requireOperator();
  if (actor.id !== actorUserId) forbidden();
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

  await downgradeCommercialProToCore(input.companyId, actorUserId, reason, source, {
    cancelReceivables: true,
  });

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

export type CommercialRenewalResult = {
  status: "billed" | "reconciled";
  transactionId: string;
  referenceCode: string;
  amount: number;
  billingAccountId: string;
  nextBillingAt: Date;
  billingPeriod: string;
  billingCycleId: string;
};

export async function purchaseCommercialPro(
  user: AltaUser,
  input: { companyId: string; billingAccountId: string },
  source = "website",
): Promise<CommercialPurchaseResult> {
  if (!canPurchaseCommercialPro(user, input.companyId)) forbidden();

  await assertCompanyVerified(input.companyId);
  await assertUserCanAccessBillingAccount(user, input.companyId, input.billingAccountId);

  const platformSettings = await getCommercialPlatformSettings();
  const monthlyFee = platformSettings.proMonthlyFee;
  const now = new Date();

  const {
    recordCommercialProPurchaseFailedAudit,
    recordCommercialProPurchasedAudit,
  } = await import("@/server/commercial-audit.service");
  const { notifyCommercialProActivated } = await import("@/server/banking-notification.service");

  let purchase: CommercialPurchaseResult & { reconciled: boolean };
  try {
    purchase = await prisma.$transaction(async (tx) => {
      await lockCompanyRowForBilling(tx, input.companyId);

      const company = await tx.company.findUnique({ where: { id: input.companyId } });
      if (!company) notFound();

      if (company.commercialPlan === "PRO" && company.planStatus === "ACTIVE") {
        const cycleId = company.commercialBillingCycleId;
        if (cycleId) {
          const existing = await tx.commercialSubscriptionCharge.findUnique({
            where: {
              companyId_billingPeriod_chargeType: {
                companyId: input.companyId,
                billingPeriod: initialPurchaseBillingPeriod(cycleId),
                chargeType: "INITIAL_PURCHASE",
              },
            },
          });
          if (
            existing?.status === "SUCCEEDED" &&
            existing.bankTransactionId &&
            existing.referenceCode &&
            company.commercialNextBillingAt
          ) {
            return {
              commercialPlan: "PRO" as const,
              billingStatus: "CURRENT" as const,
              monthlyFee: company.commercialMonthlyFee
                ? Number(company.commercialMonthlyFee.toString())
                : monthlyFee,
              billingAccountId:
                company.commercialBillingAccountId ?? input.billingAccountId,
              nextBillingAt: company.commercialNextBillingAt.toISOString(),
              transactionId: existing.bankTransactionId,
              referenceCode: existing.referenceCode,
              reconciled: true,
            };
          }
        }
        badRequest("This company is already on Alta Commercial Pro.");
      }

      const cycleId = newCommercialBillingCycleId();
      const billingPeriod = initialPurchaseBillingPeriod(cycleId);
      const nextBillingAt = addBillingMonths(now, 1);

      const charge = await executeCommercialSubscriptionChargeInTx(tx, {
        companyId: input.companyId,
        billingAccountId: input.billingAccountId,
        amount: monthlyFee,
        description: "Alta Commercial Pro · First month",
        chargeType: "INITIAL_PURCHASE",
        billingPeriod,
        billingCycleId: cycleId,
      });

      const resolvedNextBillingAt =
        charge.reconciled && company.commercialNextBillingAt
          ? company.commercialNextBillingAt
          : nextBillingAt;

      await tx.company.update({
        where: { id: input.companyId },
        data: {
          commercialPlan: "PRO",
          planStatus: "ACTIVE",
          billingStatus: "CURRENT",
          commercialMonthlyFee: monthlyFee,
          commercialEnabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
          commercialBillingAccountId: input.billingAccountId,
          commercialNextBillingAt: resolvedNextBillingAt,
          commercialPastDueAt: null,
          commercialProSubscribedAt: company.commercialProSubscribedAt ?? now,
          commercialProGrantSource: "PURCHASED",
          commercialProExpiresAt: null,
          commercialBillingCycleId: cycleId,
          commercialDowngradeScheduledAt: null,
        },
      });

      return {
        commercialPlan: "PRO" as const,
        billingStatus: "CURRENT" as const,
        monthlyFee,
        billingAccountId: input.billingAccountId,
        nextBillingAt: resolvedNextBillingAt.toISOString(),
        transactionId: charge.transactionId,
        referenceCode: charge.referenceCode,
        reconciled: charge.reconciled,
      };
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!reason.includes("already on Alta Commercial Pro")) {
      await recordCommercialProPurchaseFailedAudit({
        actorUserId: user.id,
        companyId: input.companyId,
        billingAccountId: input.billingAccountId,
        amount: monthlyFee,
        reason,
        source,
      });
    }
    throw error;
  }

  if (!purchase.reconciled) {
    await recordCommercialProPurchasedAudit({
      actorUserId: user.id,
      companyId: input.companyId,
      billingAccountId: purchase.billingAccountId,
      amount: purchase.monthlyFee,
      transactionId: purchase.transactionId,
      referenceCode: purchase.referenceCode,
      nextBillingAt: purchase.nextBillingAt,
      source,
    });

    await runCommercialCustomerNotifications("pro activated", () =>
      notifyCommercialProActivated({
        companyId: input.companyId,
        monthlyFee: purchase.monthlyFee,
        nextBillingAt: purchase.nextBillingAt,
        billingAccountId: purchase.billingAccountId,
      }),
    );
  }

  const { reconciled: _reconciled, ...result } = purchase;
  return result;
}

export async function renewCommercialProSubscription(input: {
  companyId: string;
  now?: Date;
}): Promise<CommercialRenewalResult> {
  const now = input.now ?? new Date();
  const platformSettings = await getCommercialPlatformSettings();

  return prisma.$transaction(async (tx) => {
    await lockCompanyRowForBilling(tx, input.companyId);

    const company = await tx.company.findUnique({ where: { id: input.companyId } });
    if (!company || company.commercialPlan !== "PRO") {
      badRequest("Company is not on Alta Commercial Pro.");
    }
    if (company.commercialDowngradeScheduledAt) {
      badRequest("A Pro downgrade is already scheduled; renewal is skipped.");
    }
    if (company.commercialProGrantSource === "ADMIN_GRANT") {
      badRequest("Admin-granted Commercial Pro is not billed.");
    }

    const billingAccountId = company.commercialBillingAccountId;
    if (!billingAccountId) {
      badRequest("Missing billing account for Commercial Pro renewal.");
    }

    const amount = company.commercialMonthlyFee
      ? Number(company.commercialMonthlyFee.toString())
      : platformSettings.proMonthlyFee;

    const cycleId = company.commercialBillingCycleId ?? newCommercialBillingCycleId();

    // Concurrent renewals: the first caller advances commercialNextBillingAt past `now`.
    // The second must reconcile that result instead of billing the newly advanced period.
    if (
      company.commercialNextBillingAt &&
      company.commercialNextBillingAt.getTime() > now.getTime()
    ) {
      const latestRenewal = await tx.commercialSubscriptionCharge.findFirst({
        where: {
          companyId: input.companyId,
          chargeType: "MONTHLY_RENEWAL",
          status: "SUCCEEDED",
          ...(company.commercialBillingCycleId
            ? { billingCycleId: company.commercialBillingCycleId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      if (
        latestRenewal?.bankTransactionId &&
        latestRenewal.referenceCode &&
        company.commercialNextBillingAt
      ) {
        return {
          status: "reconciled" as const,
          transactionId: latestRenewal.bankTransactionId,
          referenceCode: latestRenewal.referenceCode,
          amount: Number(latestRenewal.amount.toString()),
          billingAccountId: latestRenewal.billingAccountId,
          nextBillingAt: company.commercialNextBillingAt,
          billingPeriod: latestRenewal.billingPeriod,
          billingCycleId: latestRenewal.billingCycleId ?? cycleId,
        };
      }
      badRequest("Commercial Pro renewal is not due yet.");
    }

    const dueAt = company.commercialNextBillingAt ?? now;
    const billingPeriod = renewalBillingPeriod(cycleId, dueAt);

    const charge = await executeCommercialSubscriptionChargeInTx(tx, {
      companyId: input.companyId,
      billingAccountId,
      amount,
      description: "Alta Commercial Pro · Monthly subscription",
      chargeType: "MONTHLY_RENEWAL",
      billingPeriod,
      billingCycleId: cycleId,
    });

    const advancedNextBillingAt = addBillingMonths(dueAt, 1);
    const nextBillingAt =
      charge.reconciled &&
      company.commercialNextBillingAt &&
      company.commercialNextBillingAt.getTime() > dueAt.getTime()
        ? company.commercialNextBillingAt
        : advancedNextBillingAt;

    await tx.company.update({
      where: { id: input.companyId },
      data: {
        billingStatus: "CURRENT",
        commercialPastDueAt: null,
        commercialNextBillingAt: nextBillingAt,
        commercialMonthlyFee: amount,
        commercialBillingCycleId: cycleId,
      },
    });

    return {
      status: charge.reconciled ? ("reconciled" as const) : ("billed" as const),
      transactionId: charge.transactionId,
      referenceCode: charge.referenceCode,
      amount,
      billingAccountId,
      nextBillingAt,
      billingPeriod,
      billingCycleId: cycleId,
    };
  });
}

export async function markCommercialProPastDue(
  companyId: string,
  pastDueAt = new Date(),
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { commercialPastDueAt: true },
  });
  if (!company) return;

  await prisma.company.update({
    where: { id: companyId },
    data: {
      billingStatus: "PAST_DUE",
      commercialPastDueAt: company.commercialPastDueAt ?? pastDueAt,
    },
  });
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
  const periodEndAt = resolvePeriodEndAt(company);

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
    periodEndAt: periodEndAt?.toISOString() ?? null,
    downgradeAlreadyScheduled: Boolean(company.commercialDowngradeScheduledAt),
    scheduledDowngradeAt: company.commercialDowngradeScheduledAt?.toISOString() ?? null,
    cleanup,
    coreLimits: {
      coreInvoiceMonthlyLimit: platformSettings.coreInvoiceMonthlyLimit,
      corePaymentLinkMonthlyLimit: platformSettings.corePaymentLinkMonthlyLimit,
      coreTeamMemberLimit: platformSettings.coreTeamMemberLimit,
    },
  };
}

export async function scheduleCommercialProDowngrade(
  user: AltaUser,
  companyId: string,
  _source = "website",
): Promise<CommercialDowngradeResult> {
  if (!canDowngradeCommercialPro(user, companyId)) forbidden();

  const company = await assertCompanyVerified(companyId);
  if (company.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }

  const { previewCommercialCoreDowngradeCleanup } = await import(
    "@/server/commercial-downgrade-cleanup.service"
  );
  const cleanupPreview = await previewCommercialCoreDowngradeCleanup(companyId);

  if (company.commercialDowngradeScheduledAt) {
    return {
      companyId: company.id,
      companyName: company.name,
      commercialPlan: "PRO",
      mode: "period_end",
      effectiveAt: company.commercialDowngradeScheduledAt.toISOString(),
      cleanup: cleanupPreview,
    };
  }

  const periodEndAt = resolvePeriodEndAt(company);
  if (!periodEndAt) {
    badRequest("No billing period end date is available to schedule a downgrade.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { commercialDowngradeScheduledAt: periodEndAt },
  });

  return {
    companyId: company.id,
    companyName: company.name,
    commercialPlan: "PRO",
    mode: "period_end",
    effectiveAt: periodEndAt.toISOString(),
    cleanup: cleanupPreview,
  };
}

export async function cancelScheduledCommercialProDowngrade(
  user: AltaUser,
  companyId: string,
  _source = "website",
): Promise<{ companyId: string; cancelled: boolean }> {
  if (!canDowngradeCommercialPro(user, companyId)) forbidden();

  const company = await assertCompanyVerified(companyId);
  if (company.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }
  if (!company.commercialDowngradeScheduledAt) {
    return { companyId, cancelled: false };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { commercialDowngradeScheduledAt: null },
  });

  return { companyId, cancelled: true };
}

export async function downgradeCommercialProByCustomer(
  user: AltaUser,
  input: CommercialDowngradeInput,
  source = "website",
): Promise<CommercialDowngradeResult> {
  if (!canDowngradeCommercialPro(user, input.companyId)) forbidden();

  const mode: CommercialDowngradeMode = input.mode ?? "period_end";
  const company = await assertCompanyVerified(input.companyId);
  if (company.commercialPlan !== "PRO") {
    badRequest("This company is not on Alta Commercial Pro.");
  }

  if (mode === "period_end") {
    return scheduleCommercialProDowngrade(user, input.companyId, source);
  }

  const { previewCommercialCoreDowngradeCleanup } = await import(
    "@/server/commercial-downgrade-cleanup.service"
  );
  const cleanupPreview = await previewCommercialCoreDowngradeCleanup(input.companyId);

  if (
    cleanupWouldCancelItems(cleanupPreview) &&
    input.acknowledgeImmediateCleanup !== true
  ) {
    badRequest(
      "Immediate downgrade would cancel payroll or receivables. Pass acknowledgeImmediateCleanup to confirm.",
    );
  }

  const now = new Date();
  await downgradeCommercialProToCore(
    input.companyId,
    user.id,
    "Downgraded from Commercial settings.",
    source,
    { cancelReceivables: true },
  );

  return {
    companyId: company.id,
    companyName: company.name,
    commercialPlan: "CORE",
    mode: "immediate",
    effectiveAt: now.toISOString(),
    cleanup: cleanupPreview,
  };
}

export async function downgradeCommercialProToCore(
  companyId: string,
  actorUserId: string,
  reason: string,
  source = "system",
  options?: { cancelReceivables?: boolean },
): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.commercialPlan !== "PRO") return;

  const cancelReceivables = options?.cancelReceivables !== false;
  const cleanupModule = await import("@/server/commercial-downgrade-cleanup.service");
  const cleanup = cancelReceivables
    ? await cleanupModule.applyCommercialCoreDowngradeCleanup(companyId, actorUserId, source)
    : await cleanupModule.applyCommercialCoreDowngradePayrollOnly(companyId);

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
      commercialBillingCycleId: null,
      commercialDowngradeScheduledAt: null,
    },
  });

  const { recordCommercialProDowngradedAudit } = await import("@/server/commercial-audit.service");
  const { notifyCommercialProDowngraded } = await import("@/server/banking-notification.service");

  await recordCommercialProDowngradedAudit({
    actorUserId,
    companyId,
    reason,
    source,
    cleanup: {
      payrollRunsCancelled: cleanup.payrollRunsCancelled,
      paymentLinksCancelled: cleanup.paymentLinksCancelled,
      invoicesCancelled: cleanup.invoicesCancelled,
    },
  });

  await runCommercialCustomerNotifications("pro downgraded", () =>
    notifyCommercialProDowngraded({ companyId, reason }),
  );
}
