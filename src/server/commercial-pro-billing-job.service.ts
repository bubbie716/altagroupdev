import {
  downgradeCommercialProToCore,
  isPastGracePeriod,
  markCommercialProPastDue,
  renewCommercialProSubscription,
} from "@/server/commercial-billing.service";
import { prisma } from "@/server/db";
import { getCommercialPlatformSettings } from "@/server/commercial-platform-settings.service";

export const COMMERCIAL_PRO_BILLING_JOB_KEY = "commercial-pro-billing";
const COMMERCIAL_PRO_BILLING_JOB_LABEL = "Commercial Pro billing";

export type CommercialProBillingJobResult = {
  ok: boolean;
  processedCount: number;
  billedCount: number;
  failedCount: number;
  downgradedCount: number;
  remindersSent: number;
  pastDueMarked: number;
  scheduledDowngradesApplied: number;
  adminGrantsExpired: number;
  failures: Array<{ companyId: string; error: string }>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveSystemActorUserId(): Promise<string> {
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

async function processRenewalReminders(now: Date): Promise<number> {
  const reminderStart = new Date(now.getTime() + 3 * 86_400_000);
  const reminderEnd = new Date(now.getTime() + 4 * 86_400_000);

  const companies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      commercialNextBillingAt: { gte: reminderStart, lt: reminderEnd },
      commercialProGrantSource: { not: "ADMIN_GRANT" },
      commercialBillingAccountId: { not: null },
      commercialDowngradeScheduledAt: null,
    },
    select: {
      id: true,
      commercialBillingAccountId: true,
      commercialMonthlyFee: true,
      commercialNextBillingAt: true,
      commercialBillingAccount: {
        select: { accountName: true, accountNumber: true },
      },
    },
  });

  const platformSettings = await getCommercialPlatformSettings();
  let sent = 0;

  for (const company of companies) {
    if (!company.commercialBillingAccountId || !company.commercialNextBillingAt) continue;
    const amount = company.commercialMonthlyFee
      ? Number(company.commercialMonthlyFee.toString())
      : platformSettings.proMonthlyFee;
    const billingAccountLabel = company.commercialBillingAccount
      ? `${company.commercialBillingAccount.accountName} · ${company.commercialBillingAccount.accountNumber.slice(-4)}`
      : "billing account";

    const { notifyCommercialProRenewalReminderBestEffort } = await import(
      "@/server/commercial-notification.service"
    );
    await notifyCommercialProRenewalReminderBestEffort({
      companyId: company.id,
      amount,
      billingAccountLabel,
      renewalDate: company.commercialNextBillingAt.toISOString(),
      billingAccountId: company.commercialBillingAccountId,
    });
    sent += 1;
  }

  return sent;
}

async function maybeWarnLowBillingBalance(input: {
  companyId: string;
  billingAccountId: string;
  requiredAmount: number;
  context: string;
}): Promise<void> {
  try {
    const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
    const account = await prisma.bankAccount.findUnique({
      where: { id: input.billingAccountId },
      select: { accountName: true, accountNumber: true },
    });
    if (!account) return;

    const availableBalance = await getAccountAvailableBalance(input.billingAccountId);
    if (availableBalance >= input.requiredAmount) return;

    const { notifyCommercialBillingLowBalanceWarningBestEffort } = await import(
      "@/server/commercial-notification.service"
    );
    await notifyCommercialBillingLowBalanceWarningBestEffort({
      companyId: input.companyId,
      billingAccountId: input.billingAccountId,
      billingAccountLabel: `${account.accountName} · ${account.accountNumber.slice(-4)}`,
      requiredAmount: input.requiredAmount,
      availableBalance,
      context: input.context,
    });
  } catch (error) {
    console.error("[commercial-pro-billing] low balance warning failed", error);
  }
}

async function processDueBilling(
  company: {
    id: string;
    commercialBillingAccountId: string | null;
    commercialMonthlyFee: { toString(): string } | null;
    commercialNextBillingAt: Date | null;
  },
  actorUserId: string,
  now: Date,
): Promise<"billed" | "reconciled" | "failed"> {
  const billingAccountId = company.commercialBillingAccountId;
  if (!billingAccountId) {
    throw new Error("Missing billing account");
  }

  const amount = company.commercialMonthlyFee
    ? Number(company.commercialMonthlyFee.toString())
    : (await getCommercialPlatformSettings()).proMonthlyFee;

  await maybeWarnLowBillingBalance({
    companyId: company.id,
    billingAccountId,
    requiredAmount: amount,
    context: "Commercial Pro renewal",
  });

  const {
    recordCommercialProBillingFailedAudit,
    recordCommercialProBillingSucceededAudit,
    recordCommercialProPastDueAudit,
  } = await import("@/server/commercial-audit.service");
  const {
    notifyCommercialProBillingFailed,
    notifyCommercialProBillingSucceeded,
    notifyCommercialProPastDue,
  } = await import("@/server/banking-notification.service");

  try {
    const renewal = await renewCommercialProSubscription({
      companyId: company.id,
      now,
    });

    if (renewal.status === "reconciled") {
      return "reconciled";
    }

    await recordCommercialProBillingSucceededAudit({
      actorUserId,
      companyId: company.id,
      billingAccountId: renewal.billingAccountId,
      amount: renewal.amount,
      transactionId: renewal.transactionId,
      referenceCode: renewal.referenceCode,
      nextBillingAt: renewal.nextBillingAt.toISOString(),
      source: "cron",
    });

    await notifyCommercialProBillingSucceeded({
      companyId: company.id,
      amount: renewal.amount,
      nextBillingAt: renewal.nextBillingAt.toISOString(),
      billingAccountId: renewal.billingAccountId,
    });

    return "billed";
  } catch (error) {
    const reason = errorMessage(error);
    const pastDueAt = now;

    await markCommercialProPastDue(company.id, pastDueAt);

    await recordCommercialProBillingFailedAudit({
      actorUserId,
      companyId: company.id,
      billingAccountId,
      amount,
      reason,
      source: "cron",
    });

    await recordCommercialProPastDueAudit({
      actorUserId,
      companyId: company.id,
      billingAccountId,
      amount,
      pastDueAt: pastDueAt.toISOString(),
      source: "cron",
    });

    await notifyCommercialProBillingFailed({
      companyId: company.id,
      amount,
      reason,
      billingAccountId,
    });
    await notifyCommercialProPastDue({
      companyId: company.id,
      amount,
      billingAccountId,
    });

    return "failed";
  }
}

async function processGraceDowngrades(
  actorUserId: string,
  gracePeriodDays: number,
  now: Date,
): Promise<number> {
  const pastDueCompanies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      billingStatus: "PAST_DUE",
      commercialPastDueAt: { not: null },
      commercialDowngradeScheduledAt: null,
    },
    select: {
      id: true,
      commercialPastDueAt: true,
    },
  });

  let downgradedCount = 0;
  for (const company of pastDueCompanies) {
    if (!isPastGracePeriod(company.commercialPastDueAt, gracePeriodDays, now)) continue;
    await downgradeCommercialProToCore(
      company.id,
      actorUserId,
      `Pro billing unpaid for ${gracePeriodDays} days`,
      "cron",
      { cancelReceivables: true },
    );
    downgradedCount += 1;
  }
  return downgradedCount;
}

async function processScheduledDowngrades(actorUserId: string, now: Date): Promise<number> {
  const companies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      commercialDowngradeScheduledAt: { lte: now },
    },
    select: { id: true },
  });

  let applied = 0;
  for (const company of companies) {
    await downgradeCommercialProToCore(
      company.id,
      actorUserId,
      "Scheduled Commercial Pro downgrade at period end",
      "cron",
      { cancelReceivables: false },
    );
    applied += 1;
  }
  return applied;
}

async function processExpiredAdminGrants(actorUserId: string, now: Date): Promise<number> {
  const expired = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      commercialProGrantSource: "ADMIN_GRANT",
      commercialProExpiresAt: { lte: now },
    },
    select: { id: true },
  });

  let downgradedCount = 0;
  for (const company of expired) {
    await downgradeCommercialProToCore(
      company.id,
      actorUserId,
      "Admin-granted Commercial Pro expired",
      "cron",
      { cancelReceivables: true },
    );
    downgradedCount += 1;
  }
  return downgradedCount;
}

export async function runCommercialProBillingJob(options?: {
  actorUserId?: string;
  trigger?: "cron" | "manual";
}): Promise<CommercialProBillingJobResult> {
  const trigger = options?.trigger ?? "cron";
  const startedAt = new Date();
  const actorUserId = options?.actorUserId ?? (await resolveSystemActorUserId());
  const now = new Date();
  const platformSettings = await getCommercialPlatformSettings();

  const remindersSent = await processRenewalReminders(now);

  const dueCompanies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      commercialNextBillingAt: { lte: now },
      commercialProGrantSource: { not: "ADMIN_GRANT" },
      commercialDowngradeScheduledAt: null,
    },
    select: {
      id: true,
      commercialBillingAccountId: true,
      commercialMonthlyFee: true,
      commercialNextBillingAt: true,
    },
  });

  let billedCount = 0;
  let failedCount = 0;
  let pastDueMarked = 0;
  const failures: CommercialProBillingJobResult["failures"] = [];

  for (const company of dueCompanies) {
    try {
      const outcome = await processDueBilling(company, actorUserId, now);
      if (outcome === "billed") billedCount += 1;
      else if (outcome === "failed") {
        failedCount += 1;
        pastDueMarked += 1;
      }
      // reconciled: success without duplicate notify / billedCount
    } catch (error) {
      failedCount += 1;
      failures.push({ companyId: company.id, error: errorMessage(error) });
    }
  }

  const scheduledDowngradesApplied = await processScheduledDowngrades(actorUserId, now);
  const graceDowngraded = await processGraceDowngrades(
    actorUserId,
    platformSettings.proBillingGracePeriodDays,
    now,
  );
  const adminGrantsExpired = await processExpiredAdminGrants(actorUserId, now);
  const downgradedCount = graceDowngraded + scheduledDowngradesApplied + adminGrantsExpired;

  const completedAt = new Date();
  const result: CommercialProBillingJobResult = {
    ok: failures.length === 0,
    processedCount: dueCompanies.length,
    billedCount,
    failedCount,
    downgradedCount,
    remindersSent,
    pastDueMarked,
    scheduledDowngradesApplied,
    adminGrantsExpired,
    failures,
  };

  const { recordOpsJobRunDetail } = await import("@/server/ops-job-run.service");
  await recordOpsJobRunDetail(
    COMMERCIAL_PRO_BILLING_JOB_KEY,
    COMMERCIAL_PRO_BILLING_JOB_LABEL,
    result.ok ? "SUCCESS" : "FAILED",
    {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: dueCompanies.length,
      successCount: billedCount,
      failureCount: failedCount + failures.length,
      errorSummary: failures[0]?.error ?? null,
      details: {
        trigger,
        remindersSent,
        pastDueMarked,
        scheduledDowngradesApplied,
        adminGrantsExpired,
        downgradedCount,
        failures,
      },
    },
  );

  return result;
}
