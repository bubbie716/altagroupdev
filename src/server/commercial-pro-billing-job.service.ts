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

export async function runCommercialProBillingJob(options?: {
  actorUserId?: string;
  trigger?: "cron" | "manual";
}): Promise<CommercialProBillingJobResult> {
  const trigger = options?.trigger ?? "cron";
  const startedAt = new Date();
  const actorUserId = options?.actorUserId ?? (await resolveSystemActorUserId());
  const now = new Date();
  const platformSettings = await getCommercialPlatformSettings();

  const dueCompanies = await prisma.company.findMany({
    where: {
      commercialPlan: "PRO",
      planStatus: "ACTIVE",
      commercialNextBillingAt: { lte: now },
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

  const downgradedCount = await processGraceDowngrades(
    actorUserId,
    platformSettings.proBillingGracePeriodDays,
    now,
  );

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
