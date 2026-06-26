"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateMonthlyStatementsBatch, fetchPreviousStatementPeriod } from "@/lib/bank/statement.functions";
import type { BankStatementSchedulerJobRunRow } from "@/lib/bank/bank-statement-scheduler-types";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatActivityDateTime } from "@/lib/format-datetime";

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function nextStatementRunPlaceholder(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${next.toLocaleDateString()} (first of month · daily cron no-ops until then)`;
}

export function InternalStatementSchedulerPanel({
  schedulerJob,
}: {
  schedulerJob: BankStatementSchedulerJobRunRow;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const router = useRouter();
  const runBatch = useServerFn(generateMonthlyStatementsBatch);
  const loadPeriod = useServerFn(fetchPreviousStatementPeriod);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const lastRun = schedulerJob.lastSuccessAt ?? schedulerJob.lastFailureAt;
  const summary = schedulerJob.summary;

  async function handleGenerate() {
    const period = await loadPeriod();
    const confirmed = window.confirm(
      `Generate previous-month statements for ${period.periodStart} through ${period.periodEnd}?\n\nExisting statements for that period will be skipped.`,
    );
    if (!confirmed) return;

    setPending(true);
    setResult(null);
    try {
      const batch = await runBatch();
      setResult(
        `Generated ${batch.created} · skipped ${batch.skipped} existing · ${batch.failed} failed · ${batch.eligibleAccounts} eligible`,
      );
      await router.invalidate();
    } catch {
      setResult("Batch generation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-surface-2/30 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Automatic monthly generation
        </p>
        <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Last run</dt>
            <dd>{lastRun ? formatActivityDateTime(lastRun) : "Never"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{schedulerJob.lastStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last period</dt>
            <dd>
              {summary?.periodStart && summary?.periodEnd
                ? `${summary.periodStart.slice(0, 10)} – ${summary.periodEnd.slice(0, 10)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Statements generated</dt>
            <dd>{summary?.successCount ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Failures (last run)</dt>
            <dd>{summary?.failureCount ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Execution time</dt>
            <dd>{formatDuration(summary?.durationMs)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Next scheduled run (placeholder)</dt>
            <dd>{nextStatementRunPlaceholder()}</dd>
          </div>
        </dl>
        {summary?.errorSummary ? (
          <p className="mt-2 text-[12px] text-muted-foreground">{summary.errorSummary}</p>
        ) : null}
        <p className="mt-3 text-[12px] text-muted-foreground">
          Production: included in the shared <span className="font-mono">/api/cron/scheduled-transfers</span>{" "}
          daily cron (no-ops until the 1st of the month). Standalone{" "}
          <span className="font-mono">/api/cron/bank-statements</span> is optional for testing.
        </p>
      </div>

      {admin ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleGenerate()}
            className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate previous month statements"}
          </button>
          {result ? <p className="text-[13px] text-muted-foreground">{result}</p> : null}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Only admins can run batch statement generation.
        </p>
      )}
    </div>
  );
}
