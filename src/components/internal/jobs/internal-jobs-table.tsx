"use client";

import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { AdminOnly } from "@/components/internal/admin-only";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { runManualOpsJobRecord } from "@/lib/internal/ops-jobs.functions";
import type { OpsJobRow } from "@/server/ops-jobs.service";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  formatJobRelativeTime,
  formatJobShortResult,
  formatJobStatusLabel,
  jobsNeedingAttention,
  sortOpsJobs,
} from "@/lib/internal/ops-jobs-attention";
import { cn } from "@/lib/utils";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function jobStatusTone(status: string | null): "success" | "warning" | "neutral" | "danger" {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status) return "warning";
  return "neutral";
}

function ManualRunControl({ job }: { job: OpsJobRow }) {
  const runJob = useServerFn(runManualOpsJobRecord);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { uiLab, unavailableLabel, bannerCopy } = useUiLabMutationGate();

  if (!job.manualRunKey) {
    return <p className="text-[12px] text-muted-foreground">This job does not support manual runs.</p>;
  }

  return (
    <AdminOnly fallback={<p className="text-[12px] text-muted-foreground">Admin only</p>}>
      <div className="space-y-2">
        {uiLab ? (
          <>
            <button
              type="button"
              disabled
              className="rounded border border-border px-3 py-2 text-[12px] text-muted-foreground disabled:opacity-60"
            >
              {unavailableLabel("Run")}
            </button>
            <p className="text-[12px] text-muted-foreground">
              {bannerCopy} Manual job execution is unavailable in UI Lab.
            </p>
          </>
        ) : (
          <OpsAction
            label="Run job"
            variant="primary"
            title={`Run ${job.label}`}
            description="Manual batch execution is logged to the audit trail."
            impact={job.manualImpact}
            confirmLabel="Run job"
            onConfirm={async (reason) => {
              const result = await runJob({ data: { jobKey: job.manualRunKey!, reason } });
              setLastResult(result.summary);
            }}
          />
        )}
        {lastResult ? <p className="text-[12px] text-muted-foreground">{lastResult}</p> : null}
      </div>
    </AdminOnly>
  );
}

function JobDetailsBody({ job }: { job: OpsJobRow }) {
  const site = useSiteContext();
  return (
    <div className="space-y-4 text-[13px]">
      <p className="text-muted-foreground">{job.description}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Status">
          <span className="inline-flex items-center gap-2">
            <OpsStatusBadge status={formatJobStatusLabel(job.lastStatus)} tone={jobStatusTone(job.lastStatus)} />
            <span className="sr-only">{formatJobStatusLabel(job.lastStatus)}</span>
          </span>
        </Detail>
        <Detail label="Last run">
          {job.lastRunAt
            ? `${formatActivityDateTime(job.lastRunAt)} (${formatJobRelativeTime(job.lastRunAt)})`
            : "Never"}
        </Detail>
        <Detail label="Duration">{formatDuration(job.durationMs)}</Detail>
        <Detail label="Next expected run">{job.nextScheduledRun}</Detail>
        <Detail label="Processed">{job.processedCount ?? "—"}</Detail>
        <Detail label="Succeeded">{job.successCount ?? "—"}</Detail>
        <Detail label="Errors">{job.failureCount ?? "—"}</Detail>
        <Detail label="Schedule / source">{job.cronEndpoint ?? "Catalog schedule"}</Detail>
      </dl>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Summary</div>
        <p className="mt-1 text-muted-foreground">{job.detailSummary || "—"}</p>
      </div>
      {job.latestError ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive">Latest error</div>
          <p className="mt-1 text-destructive/90">{job.latestError}</p>
        </div>
      ) : null}
      <p className="text-[12px] text-muted-foreground">
        Related audit:{" "}
        <Link
          to="/internal/audit"
          search={withInternalSiteSearch({ action: "OPS_JOB_MANUAL_RUN" }, site.key)}
          className="text-gold hover:underline"
        >
          Manual job runs
        </Link>
      </p>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Manual run
        </div>
        <ManualRunControl job={job} />
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export function InternalJobsPanel({ jobs }: { jobs: OpsJobRow[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const sorted = sortOpsJobs(jobs);
  const attention = jobsNeedingAttention(jobs);
  const selected = sorted.find((j) => j.jobKey === selectedKey) ?? null;
  const titleId = useId();

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${titleId}-attention`}>
        <h2 id={`${titleId}-attention`} className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2.5 text-[13px] text-muted-foreground">
            All jobs look healthy
          </div>
        ) : (
          <ul className="space-y-2">
            {attention.map(({ job, problem }) => (
              <li
                key={job.jobKey}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/[0.04] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[13px]">{job.label}</div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{problem}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Last run {formatJobRelativeTime(job.lastRunAt)}
                    {job.nextScheduledRun ? ` · Next ${job.nextScheduledRun}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKey(job.jobKey)}
                  className="shrink-0 rounded border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-[12px] font-medium text-gold"
                >
                  Review job
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${titleId}-list`}>
        <h2 id={`${titleId}-list`} className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          All jobs ({jobs.length})
        </h2>

        {/* Desktop compact table */}
        <div className="hidden overflow-hidden rounded-md border border-border/60 md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border/60 bg-surface-1/40">
              <tr>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Job
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Last run
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Next expected
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => {
                const short = formatJobShortResult(job);
                return (
                  <tr
                    key={job.jobKey}
                    className={cn(
                      "cursor-pointer border-b border-border/40 last:border-0 hover:bg-surface-1/50",
                      job.lastStatus === "FAILED" && "bg-destructive/[0.03]",
                    )}
                    onClick={() => setSelectedKey(job.jobKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedKey(job.jobKey);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for ${job.label}`}
                  >
                    <td className="px-3 py-2.5 font-medium">{job.label}</td>
                    <td className="px-3 py-2.5">
                      <OpsStatusBadge
                        status={formatJobStatusLabel(job.lastStatus)}
                        tone={jobStatusTone(job.lastStatus)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatJobRelativeTime(job.lastRunAt)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{job.nextScheduledRun}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{short ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="space-y-2 md:hidden">
          {sorted.map((job) => {
            const short = formatJobShortResult(job);
            return (
              <li key={job.jobKey}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(job.jobKey)}
                  className={cn(
                    "w-full rounded-md border border-border/60 bg-surface-1/40 px-3 py-3 text-left",
                    job.lastStatus === "FAILED" && "border-destructive/30",
                  )}
                  aria-label={`Open details for ${job.label}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium text-[13px]">{job.label}</div>
                    <OpsStatusBadge
                      status={formatJobStatusLabel(job.lastStatus)}
                      tone={jobStatusTone(job.lastStatus)}
                    />
                  </div>
                  <div className="mt-2 grid gap-1 text-[12px] text-muted-foreground">
                    <div>Last run · {formatJobRelativeTime(job.lastRunAt)}</div>
                    <div>Next · {job.nextScheduledRun}</div>
                    {short ? <div>{short}</div> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedKey(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          style={{
            maxHeight: "calc(100dvh - var(--ui-lab-banner-height, 0px))",
            top: "var(--ui-lab-banner-height, 0px)",
          }}
        >
          {selected ? (
            <>
              <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
                <SheetTitle className="text-left text-[15px]">{selected.label}</SheetTitle>
                <SheetDescription className="text-left text-[12px]">
                  {formatJobStatusLabel(selected.lastStatus)} ·{" "}
                  {formatJobRelativeTime(selected.lastRunAt)}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <JobDetailsBody job={selected} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function InternalJobsPageIntro() {
  const site = useSiteContext();
  return (
    <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
      Problems first, details on demand. Manual runs require admin permission, confirmation, and reason —
      each is written to the{" "}
      <Link
        to="/internal/audit"
        search={withInternalSiteSearch({ action: "OPS_JOB_MANUAL_RUN" }, site.key)}
        className="text-gold hover:underline"
      >
        audit log
      </Link>
      .
    </p>
  );
}

/** @deprecated Prefer InternalJobsPanel — kept for any leftover imports. */
export function InternalJobsTable({ jobs }: { jobs: OpsJobRow[] }) {
  return <InternalJobsPanel jobs={jobs} />;
}
