"use client";

import { useState } from "react";
import type {
  AltaCardBillingSchedulerResult,
  AltaCardSchedulerJobRunRow,
  AltaCardStatementSchedulerResult,
} from "@/lib/bank/alta-card-scheduler-types";
import {
  ALTA_CARD_BILLING_JOB_KEY,
  ALTA_CARD_STATEMENTS_JOB_KEY,
} from "@/lib/bank/alta-card-scheduler-types";
import { getStatementCloseDate } from "@/lib/bank/alta-card-billing-cycle";
import {
  runAltaCardBillingSchedulerManual,
  runAltaCardStatementSchedulerManual,
} from "@/lib/bank/alta-card-scheduler.functions";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatActivityDateTime } from "@/lib/format-datetime";

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function nextMonthEndPlaceholder(): string {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return getStatementCloseDate(nextMonth).toLocaleDateString();
}

function JobRunCard({
  job,
  placeholderSchedule,
}: {
  job: AltaCardSchedulerJobRunRow | undefined;
  placeholderSchedule: string;
}) {
  const lastRun = job?.lastSuccessAt ?? job?.lastFailureAt;
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/30 px-4 py-3 text-[13px]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {job?.label ?? "Job"}
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Last run</dt>
          <dd>{lastRun ? formatActivityDateTime(lastRun) : "Never"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{job?.lastStatus ?? "UNKNOWN"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Processed</dt>
          <dd>{job?.summary?.processedCount ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Execution time</dt>
          <dd>{formatDuration(job?.summary?.durationMs)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Next scheduled run (placeholder)</dt>
          <dd>{placeholderSchedule}</dd>
        </div>
      </dl>
      {job?.summary?.errorSummary ? (
        <p className="mt-2 text-[12px] text-muted-foreground">{job.summary.errorSummary}</p>
      ) : null}
    </div>
  );
}

export function InternalAltaCardSchedulerPanel({
  jobRuns,
  onRefresh,
}: {
  jobRuns: AltaCardSchedulerJobRunRow[];
  onRefresh: () => Promise<void>;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const [statementResult, setStatementResult] = useState<AltaCardStatementSchedulerResult | null>(null);
  const [billingResult, setBillingResult] = useState<AltaCardBillingSchedulerResult | null>(null);

  const statementsJob = jobRuns.find((job) => job.jobKey === ALTA_CARD_STATEMENTS_JOB_KEY);
  const billingJob = jobRuns.find((job) => job.jobKey === ALTA_CARD_BILLING_JOB_KEY);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface-1/80 p-5">
      <div>
        <h3 className="font-serif text-[18px]">Billing schedulers</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Production uses the shared <code className="text-[12px]">/api/cron/scheduled-transfers</code>{" "}
          cron (same as loans and payroll). Buttons below run jobs in isolation for testing.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobRunCard
          job={statementsJob}
          placeholderSchedule={`Daily (month-end only) · next close ${nextMonthEndPlaceholder()}`}
        />
        <JobRunCard
          job={billingJob}
          placeholderSchedule="Daily · overdue, interest, and late fees"
        />
      </div>

      {admin ? (
        <div className="flex flex-wrap gap-2">
          <BankReviewButton
            label="Run statement generation"
            variant="primary"
            onAction={async () => {
              const result = await runAltaCardStatementSchedulerManual();
              setStatementResult(result);
              await onRefresh();
            }}
          />
          <BankReviewButton
            label="Run billing processing"
            onAction={async () => {
              const result = await runAltaCardBillingSchedulerManual();
              setBillingResult(result);
              await onRefresh();
            }}
          />
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Only admins can manually execute billing jobs.
        </p>
      )}

      {statementResult ? (
        <p className="text-[12px] text-muted-foreground">
          Statements: {statementResult.skipped ? `skipped (${statementResult.skipReason})` : `${statementResult.statementsGenerated} generated`} ·{" "}
          {statementResult.failureCount} failed · {formatDuration(statementResult.durationMs)}
        </p>
      ) : null}
      {billingResult ? (
        <p className="text-[12px] text-muted-foreground">
          Billing: {billingResult.overdueStatementsMarked} overdue · {billingResult.interestApplied}{" "}
          interest · {billingResult.lateFeesApplied} fees · {billingResult.failureCount} skipped ·{" "}
          {formatDuration(billingResult.durationMs)}
        </p>
      ) : null}
    </section>
  );
}
