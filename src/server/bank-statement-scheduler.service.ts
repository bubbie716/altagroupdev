import {
  BANK_ACCOUNT_STATEMENTS_JOB_KEY,
  type BankStatementSchedulerFailure,
  type BankStatementSchedulerJobRunRow,
  type BankStatementSchedulerResult,
} from "@/lib/bank/bank-statement-scheduler-types";
import {
  generateStatementForAccount,
  previousMonthPeriodDates,
} from "@/server/statement.service";
import { writeAuditLog } from "@/server/audit.service";
import { prisma } from "@/server/db";
import {
  getOpsJobRun,
  recordOpsJobRunDetail,
  type OpsJobRunSummary,
} from "@/server/ops-job-run.service";

const JOB_LABEL = "Bank account monthly statements";

type SchedulerTrigger = "cron" | "manual";
type SchedulerSource = "CRON" | "ADMIN_MANUAL";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logSchedulerEvent(event: string, payload: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      scope: "bank-statement-scheduler",
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}

export function isFirstCalendarDayOfMonth(date = new Date()): boolean {
  return date.getUTCDate() === 1;
}

async function resolveActorUserId(actorUserId?: string): Promise<string> {
  if (actorUserId) return actorUserId;
  const { resolveSystemActorUserId } = await import("@/server/system-actor.service");
  return resolveSystemActorUserId();
}

async function writeSchedulerAudit(
  actorUserId: string,
  action: string,
  description: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "STATEMENT",
    entityId: "bank-statement-cron",
    description,
    metadata: { actorUserId, ...metadata },
  });
}

function parseJobSummary(lastMessage: string | null | undefined): BankStatementSchedulerJobRunRow["summary"] {
  if (!lastMessage) return null;
  try {
    const parsed = JSON.parse(lastMessage) as OpsJobRunSummary & {
      details?: { periodStart?: string; periodEnd?: string };
    };
    return {
      startedAt: parsed.startedAt,
      completedAt: parsed.completedAt,
      durationMs: parsed.durationMs,
      processedCount: parsed.processedCount,
      successCount: parsed.successCount,
      skippedCount: parsed.details?.skippedCount as number | undefined,
      failureCount: parsed.failureCount,
      periodStart: parsed.details?.periodStart,
      periodEnd: parsed.details?.periodEnd,
      errorSummary: parsed.errorSummary ?? null,
    };
  } catch {
    return null;
  }
}

export async function getBankStatementSchedulerJobRun(): Promise<BankStatementSchedulerJobRunRow> {
  const row = await getOpsJobRun(BANK_ACCOUNT_STATEMENTS_JOB_KEY);
  if (!row) {
    return {
      jobKey: BANK_ACCOUNT_STATEMENTS_JOB_KEY,
      label: JOB_LABEL,
      lastStatus: "UNKNOWN",
      lastSuccessAt: null,
      lastFailureAt: null,
      summary: null,
    };
  }
  return {
    jobKey: row.jobKey,
    label: row.label,
    lastStatus: row.lastStatus,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    summary: parseJobSummary(row.lastMessage),
  };
}

async function listEligibleAccountIds(
  periodStart: Date,
  periodEnd: Date,
): Promise<string[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: { in: ["ACTIVE", "FROZEN", "CLOSED"] },
    },
    select: { id: true, status: true },
  });

  const eligible: string[] = [];

  for (const account of accounts) {
    if (account.status === "ACTIVE") {
      eligible.push(account.id);
      continue;
    }

    const transactionCount = await prisma.bankTransaction.count({
      where: {
        bankAccountId: account.id,
        status: "APPROVED",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });
    if (transactionCount > 0) {
      eligible.push(account.id);
    }
  }

  return eligible;
}

export async function runBankAccountStatementSchedulerJob(options?: {
  force?: boolean;
  actorUserId?: string;
  trigger?: SchedulerTrigger;
}): Promise<BankStatementSchedulerResult> {
  const trigger = options?.trigger ?? "cron";
  const force = options?.force ?? false;
  const source: SchedulerSource = trigger === "manual" ? "ADMIN_MANUAL" : "CRON";
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const actorUserId = await resolveActorUserId(options?.actorUserId);
  const { periodStart, periodEnd } = previousMonthPeriodDates(startedAt);

  logSchedulerEvent("job_started", { trigger, force, startedAt: startedAtIso, source });
  await writeSchedulerAudit(actorUserId, "BANK_STATEMENT_CRON_STARTED", "Bank statement cron started", {
    trigger,
    source,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    startedAt: startedAtIso,
  });

  if (!force && !isFirstCalendarDayOfMonth(startedAt)) {
    const completedAt = new Date();
    const result: BankStatementSchedulerResult = {
      ok: true,
      trigger,
      skipped: true,
      skipReason: "Not statement day (first day of month)",
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      startedAt: startedAtIso,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      eligibleAccounts: 0,
      statementsGenerated: 0,
      skippedExisting: 0,
      failed: 0,
      failures: [],
    };

    logSchedulerEvent("job_skipped", { trigger, reason: result.skipReason });
    await recordOpsJobRunDetail(BANK_ACCOUNT_STATEMENTS_JOB_KEY, JOB_LABEL, "SUCCESS", {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      errorSummary: result.skipReason,
      details: {
        skipped: true,
        skippedCount: 0,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        trigger,
        source,
      },
    });
    await writeSchedulerAudit(
      actorUserId,
      "BANK_STATEMENT_CRON_COMPLETED",
      "Bank statement cron skipped (not first day of month)",
      { trigger, source, ...result },
    );
    return result;
  }

  const accountIds = await listEligibleAccountIds(periodStart, periodEnd);
  const failures: BankStatementSchedulerFailure[] = [];
  let statementsGenerated = 0;
  let skippedExisting = 0;

  for (const accountId of accountIds) {
    try {
      const existing = await prisma.bankStatement.findFirst({
        where: {
          bankAccountId: accountId,
          periodStart,
          periodEnd,
          status: { not: "VOID" },
        },
        select: { id: true },
      });
      if (existing) {
        skippedExisting++;
        continue;
      }
      await generateStatementForAccount(accountId, periodStart, periodEnd);
      statementsGenerated++;
    } catch (error) {
      failures.push({ accountId, error: errorMessage(error) });
      logSchedulerEvent("account_failed", { accountId, error: errorMessage(error) });
    }
  }

  const completedAt = new Date();
  const result: BankStatementSchedulerResult = {
    ok: failures.length === 0,
    trigger,
    skipped: false,
    skipReason: null,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    startedAt: startedAtIso,
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    eligibleAccounts: accountIds.length,
    statementsGenerated,
    skippedExisting,
    failed: failures.length,
    failures,
  };

  logSchedulerEvent("job_completed", {
    trigger,
    eligibleAccounts: result.eligibleAccounts,
    statementsGenerated: result.statementsGenerated,
    skippedExisting: result.skippedExisting,
    failed: result.failed,
    durationMs: result.durationMs,
  });

  await recordOpsJobRunDetail(
    BANK_ACCOUNT_STATEMENTS_JOB_KEY,
    JOB_LABEL,
    result.failed > 0 ? "FAILED" : "SUCCESS",
    {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      processedCount: result.eligibleAccounts,
      successCount: result.statementsGenerated,
      failureCount: result.failed,
      errorSummary: failures[0]?.error ?? null,
      details: {
        skippedCount: result.skippedExisting,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        trigger,
        source,
        statementsGenerated: result.statementsGenerated,
        failures: result.failures,
      },
    },
  );

  await writeSchedulerAudit(
    actorUserId,
    "BANK_STATEMENT_CRON_COMPLETED",
    `Bank statements generated · ${result.statementsGenerated} created · ${result.skippedExisting} skipped · ${result.failed} failed`,
    {
      trigger,
      source,
      generatedCount: result.statementsGenerated,
      skippedCount: result.skippedExisting,
      failedCount: result.failed,
      ...result,
    },
  );

  if (result.statementsGenerated > 0) {
    await writeSchedulerAudit(
      actorUserId,
      "BANK_STATEMENTS_BATCH_GENERATED",
      `Batch generated ${result.statementsGenerated} bank statement(s) for ${result.periodStart.slice(0, 10)} – ${result.periodEnd.slice(0, 10)}`,
      {
        trigger,
        source,
        generatedCount: result.statementsGenerated,
        skippedCount: result.skippedExisting,
        failedCount: result.failed,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
      },
    );
  }

  return result;
}

export async function runBankAccountStatementSchedulerJobSafe(options?: {
  force?: boolean;
  actorUserId?: string;
  trigger?: SchedulerTrigger;
}): Promise<BankStatementSchedulerResult> {
  try {
    return await runBankAccountStatementSchedulerJob(options);
  } catch (error) {
    const message = errorMessage(error);
    const startedAt = new Date().toISOString();
    const completedAt = new Date().toISOString();
    const actorUserId = await resolveActorUserId(options?.actorUserId).catch(() => "unknown");

    logSchedulerEvent("job_failed", { error: message });

    await recordOpsJobRunDetail(BANK_ACCOUNT_STATEMENTS_JOB_KEY, JOB_LABEL, "FAILED", {
      startedAt,
      completedAt,
      durationMs: 0,
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: message,
      details: { trigger: options?.trigger ?? "cron" },
    }).catch(() => undefined);

    if (actorUserId !== "unknown") {
      await writeSchedulerAudit(actorUserId, "BANK_STATEMENT_CRON_FAILED", "Bank statement cron failed", {
        error: message,
        source: options?.trigger === "manual" ? "ADMIN_MANUAL" : "CRON",
      }).catch(() => undefined);
    }

    throw error;
  }
}
