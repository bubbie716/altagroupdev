import {
  addBillingMonths,
  chargeCommercialProFee,
  downgradeCommercialProToCore,
  isPastGracePeriod,
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
): Promise<"billed" | "failed"> {
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
    const charge = await chargeCommercialProFee({
      companyId: company.id,
      billingAccountId,
      amount,
      description: "Alta Commercial Pro · Monthly subscription",
    });

    const nextBillingAt = addBillingMonths(company.commercialNextBillingAt ?? now, 1);
    await prisma.company.update({
      where: { id: company.id },
      data: {
        billingStatus: "CURRENT",
        commercialPastDueAt: null,
        commercialNextBillingAt: nextBillingAt,
        commercialMonthlyFee: amount,
      },
    });

    await recordCommercialProBillingSucceededAudit({
      actorUserId,
      companyId: company.id,
      billingAccountId,
      amount,
      transactionId: charge.transactionId,
      referenceCode: charge.referenceCode,
      nextBillingAt: nextBillingAt.toISOString(),
      source: "cron",
    });

    await notifyCommercialProBillingSucceeded({
      companyId: company.id,
      amount,
      nextBillingAt: nextBillingAt.toISOString(),
      billingAccountId,
    });

    return "billed";
  } catch (error) {
    const reason = errorMessage(error);
    const pastDueAt = now;

    await prisma.company.update({
      where: { id: company.id },
      data: {
        billingStatus: "PAST_DUE",
        commercialPastDueAt: pastDueAt,
      },
    });

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
    );
    downgradedCount += 1;
  }
  return downgradedCount;
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

  await processRenewalReminders(now);

  const dueCompanies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      commercialNextBillingAt: { lte: now },
      commercialProGrantSource: { not: "ADMIN_GRANT" },
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
  const failures: CommercialProBillingJobResult["failures"] = [];

  for (const company of dueCompanies) {
    try {
      const outcome = await processDueBilling(company, actorUserId, now);
      if (outcome === "billed") billedCount += 1;
      else failedCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push({ companyId: company.id, error: errorMessage(error) });
    }
  }

  const downgradedCount =
    (await processGraceDowngrades(
      actorUserId,
      platformSettings.proBillingGracePeriodDays,
      now,
    )) + (await processExpiredAdminGrants(actorUserId, now));

  const completedAt = new Date();
  const result: CommercialProBillingJobResult = {
    ok: failures.length === 0,
    processedCount: dueCompanies.length,
    billedCount,
    failedCount,
    downgradedCount,
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
      details: { trigger, downgradedCount, failures },
    },
  );

  return result;
}
