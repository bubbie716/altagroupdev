import { isLastCalendarDayOfMonth } from "@/lib/bank/alta-card-billing-cycle";
import {
  ALTA_CARD_BILLING_JOB_KEY,
  ALTA_CARD_STATEMENTS_JOB_KEY,
  type AltaCardBillingSchedulerResult,
  type AltaCardSchedulerJobFailure,
  type AltaCardSchedulerJobRunRow,
  type AltaCardStatementSchedulerResult,
} from "@/lib/bank/alta-card-scheduler-types";
import { processAltaCardBilling } from "@/server/alta-card-billing.service";
import { generateStatement } from "@/server/alta-card-statement.service";
import { writeAuditLog } from "@/server/audit.service";
import { prisma } from "@/server/db";
import {
  getOpsJobRun,
  recordOpsJobRunDetail,
  type OpsJobRunSummary,
} from "@/server/ops-job-run.service";

const STATEMENTS_JOB_LABEL = "Alta Card statement generation";
const BILLING_JOB_LABEL = "Alta Card billing processing";

type SchedulerTrigger = "cron" | "manual";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logSchedulerEvent(event: string, payload: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      scope: "alta-card-scheduler",
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
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
    entityType: "ALTA_CARD",
    entityId: "scheduler",
    description,
    metadata: { actorUserId, ...metadata },
  });
}

async function recordJobSummary(
  jobKey: string,
  label: string,
  status: "SUCCESS" | "FAILED",
  summary: OpsJobRunSummary,
): Promise<void> {
  await recordOpsJobRunDetail(jobKey, label, status, summary);
}

function parseJobSummary(lastMessage: string | null | undefined): AltaCardSchedulerJobRunRow["summary"] {
  if (!lastMessage) return null;
  try {
    const parsed = JSON.parse(lastMessage) as OpsJobRunSummary;
    return {
      startedAt: parsed.startedAt,
      completedAt: parsed.completedAt,
      durationMs: parsed.durationMs,
      processedCount: parsed.processedCount,
      successCount: parsed.successCount,
      failureCount: parsed.failureCount,
      errorSummary: parsed.errorSummary ?? null,
    };
  } catch {
    return null;
  }
}

export async function listAltaCardSchedulerJobRuns(): Promise<AltaCardSchedulerJobRunRow[]> {
  const definitions = [
    { jobKey: ALTA_CARD_STATEMENTS_JOB_KEY, label: STATEMENTS_JOB_LABEL },
    { jobKey: ALTA_CARD_BILLING_JOB_KEY, label: BILLING_JOB_LABEL },
  ];
  const rows = await Promise.all(definitions.map((def) => getOpsJobRun(def.jobKey)));
  return definitions.map((def, index) => {
    const row = rows[index];
    if (!row) {
      return {
        jobKey: def.jobKey,
        label: def.label,
        lastStatus: "UNKNOWN",
        lastSuccessAt: null,
        lastFailureAt: null,
        lastMessage: null,
        summary: null,
      };
    }
    return {
      jobKey: row.jobKey,
      label: row.label,
      lastStatus: row.lastStatus,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
      lastMessage: row.lastMessage,
      summary: parseJobSummary(row.lastMessage),
    };
  });
}

export async function runAltaCardStatementSchedulerJob(options?: {
  force?: boolean;
  actorUserId?: string;
  trigger?: SchedulerTrigger;
}): Promise<AltaCardStatementSchedulerResult> {
  const trigger = options?.trigger ?? "cron";
  const force = options?.force ?? false;
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const actorUserId = await resolveActorUserId(options?.actorUserId);

  logSchedulerEvent("statement_job_started", { trigger, force, startedAt: startedAtIso });
  await writeSchedulerAudit(actorUserId, "ALTA_CARD_STATEMENT_JOB_STARTED", "Alta Card statement job started", {
    trigger,
    force,
    startedAt: startedAtIso,
  });

  if (!force && !isLastCalendarDayOfMonth(startedAt)) {
    const completedAt = new Date();
    const result: AltaCardStatementSchedulerResult = {
      ok: true,
      trigger,
      skipped: true,
      skipReason: "Not the last calendar day of the month",
      startedAt: startedAtIso,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      cardsProcessed: 0,
      statementsGenerated: 0,
      successCount: 0,
      failureCount: 0,
      generatedCardIds: [],
      failures: [],
    };

    logSchedulerEvent("statement_job_skipped", { trigger, reason: result.skipReason });
    await recordJobSummary(ALTA_CARD_STATEMENTS_JOB_KEY, STATEMENTS_JOB_LABEL, "SUCCESS", {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      errorSummary: result.skipReason,
      details: { skipped: true, trigger },
    });
    await writeSchedulerAudit(
      actorUserId,
      "ALTA_CARD_STATEMENT_JOB_COMPLETED",
      "Alta Card statement job skipped (not month-end)",
      { trigger, skipped: true, ...result },
    );
    return result;
  }

  const cards = await prisma.altaCard.findMany({
    where: {
      status: "ACTIVE",
      nextStatementDate: { lte: startedAt },
      currentStatementId: { not: null },
    },
    select: { id: true },
  });

  const generatedCardIds: string[] = [];
  const failures: AltaCardSchedulerJobFailure[] = [];

  for (const card of cards) {
    try {
      await generateStatement(actorUserId, card.id);
      generatedCardIds.push(card.id);
    } catch (error) {
      failures.push({ cardId: card.id, error: errorMessage(error) });
      logSchedulerEvent("statement_card_failed", { cardId: card.id, error: errorMessage(error) });
    }
  }

  const completedAt = new Date();
  const result: AltaCardStatementSchedulerResult = {
    ok: failures.length === 0,
    trigger,
    skipped: false,
    skipReason: null,
    startedAt: startedAtIso,
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    cardsProcessed: cards.length,
    statementsGenerated: generatedCardIds.length,
    successCount: generatedCardIds.length,
    failureCount: failures.length,
    generatedCardIds,
    failures,
  };

  logSchedulerEvent("statement_job_completed", {
    trigger,
    cardsProcessed: result.cardsProcessed,
    statementsGenerated: result.statementsGenerated,
    failureCount: result.failureCount,
    durationMs: result.durationMs,
  });

  await recordJobSummary(
    ALTA_CARD_STATEMENTS_JOB_KEY,
    STATEMENTS_JOB_LABEL,
    result.failureCount > 0 ? "FAILED" : "SUCCESS",
    {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      processedCount: result.cardsProcessed,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errorSummary: failures[0]?.error ?? null,
      details: {
        trigger,
        statementsGenerated: result.statementsGenerated,
        generatedCardIds: result.generatedCardIds,
        failures: result.failures,
      },
    },
  );

  await writeSchedulerAudit(
    actorUserId,
    "ALTA_CARD_STATEMENT_JOB_COMPLETED",
    `Alta Card statement job completed · ${result.statementsGenerated} generated · ${result.failureCount} failed`,
    { trigger, ...result },
  );

  return result;
}

export async function runAltaCardBillingSchedulerJob(options?: {
  actorUserId?: string;
  trigger?: SchedulerTrigger;
}): Promise<AltaCardBillingSchedulerResult> {
  const trigger = options?.trigger ?? "cron";
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const actorUserId = await resolveActorUserId(options?.actorUserId);

  logSchedulerEvent("billing_job_started", { trigger, startedAt: startedAtIso });
  await writeSchedulerAudit(actorUserId, "ALTA_CARD_BILLING_JOB_STARTED", "Alta Card billing job started", {
    trigger,
    startedAt: startedAtIso,
  });

  const failures: AltaCardSchedulerJobFailure[] = [];

  try {
    const billing = await processAltaCardBilling(actorUserId);

    const interestFailures = billing.interest.skipped.map((row) => ({
      statementId: row.statementId,
      error: row.reason,
    }));
    const feeFailures = billing.lateFees.skipped.map((row) => ({
      statementId: row.statementId,
      error: row.reason,
    }));
    failures.push(...interestFailures, ...feeFailures);

    const touchedStatementIds = [
      ...billing.overdueMarked,
      ...billing.interest.applied.map((row) => row.statementId),
      ...billing.lateFees.charged.map((row) => row.statementId),
    ];
    const uniqueStatementIds = [...new Set(touchedStatementIds)];
    const touchedStatements =
      uniqueStatementIds.length > 0
        ? await prisma.altaCardStatement.findMany({
            where: { id: { in: uniqueStatementIds } },
            select: { altaCardId: true },
          })
        : [];
    const cardsProcessed = new Set([
      ...touchedStatements.map((row) => row.altaCardId),
      ...(billing.autopay.dueCount > 0 ? ["autopay"] : []),
    ]).size;

    const completedAt = new Date();
    const result: AltaCardBillingSchedulerResult = {
      ok: failures.length === 0,
      trigger,
      startedAt: startedAtIso,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      cardsProcessed,
      overdueStatementsMarked: billing.overdueMarked.length,
      autopayDue: billing.autopay.dueCount,
      autopaySucceeded: billing.autopay.successCount,
      autopayFailed: billing.autopay.failedCount,
      autopaySkipped: billing.autopay.skippedCount,
      interestApplied: billing.interest.applied.length,
      lateFeesApplied: billing.lateFees.charged.length,
      successCount:
        billing.autopay.successCount +
        billing.overdueMarked.length +
        billing.interest.applied.length +
        billing.lateFees.charged.length,
      failureCount: failures.length,
      failures,
      overdueMarked: billing.overdueMarked,
      interest: billing.interest.applied,
      lateFees: billing.lateFees.charged,
    };

    logSchedulerEvent("billing_job_completed", {
      trigger,
      cardsProcessed: result.cardsProcessed,
      overdueStatementsMarked: result.overdueStatementsMarked,
      interestApplied: result.interestApplied,
      lateFeesApplied: result.lateFeesApplied,
      failureCount: result.failureCount,
      durationMs: result.durationMs,
    });

    await recordJobSummary(
      ALTA_CARD_BILLING_JOB_KEY,
      BILLING_JOB_LABEL,
      result.failureCount > 0 ? "FAILED" : "SUCCESS",
      {
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        durationMs: result.durationMs,
        processedCount: result.cardsProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errorSummary: failures[0]?.error ?? null,
        details: {
          trigger,
          overdueStatementsMarked: result.overdueStatementsMarked,
          autopayDue: result.autopayDue,
          autopaySucceeded: result.autopaySucceeded,
          autopayFailed: result.autopayFailed,
          autopaySkipped: result.autopaySkipped,
          interestApplied: result.interestApplied,
          lateFeesApplied: result.lateFeesApplied,
          failures: result.failures,
        },
      },
    );

    await writeSchedulerAudit(
      actorUserId,
      "ALTA_CARD_BILLING_JOB_COMPLETED",
      `Alta Card billing job completed · ${result.interestApplied} interest · ${result.lateFeesApplied} fees · ${result.failureCount} skipped`,
      { trigger, ...result },
    );

    return result;
  } catch (error) {
    const completedAt = new Date();
    const message = errorMessage(error);

    logSchedulerEvent("billing_job_failed", { trigger, error: message });

    await recordJobSummary(ALTA_CARD_BILLING_JOB_KEY, BILLING_JOB_LABEL, "FAILED", {
      startedAt: startedAtIso,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
      errorSummary: message,
      details: { trigger },
    });

    await writeSchedulerAudit(actorUserId, "ALTA_CARD_BILLING_JOB_FAILED", "Alta Card billing job failed", {
      trigger,
      error: message,
    });

    throw error;
  }
}
