"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { AdminOnly } from "@/components/internal/admin-only";
import { runManualOpsJobRecord } from "@/lib/internal/ops-jobs.functions";
import type { OpsJobRow } from "@/server/ops-jobs.service";
import { formatActivityDateTime } from "@/lib/format-datetime";

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

function ManualRunAction({ job }: { job: OpsJobRow }) {
  const runJob = useServerFn(runManualOpsJobRecord);
  const [lastResult, setLastResult] = useState<string | null>(null);

  if (!job.manualRunKey) return null;

  return (
    <AdminOnly
      fallback={<span className="text-[10px] text-muted-foreground">Admin only</span>}
    >
      <div className="flex flex-col items-end gap-1">
        <OpsAction
          label="Run"
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
        {lastResult ? (
          <span className="max-w-[220px] text-right text-[10px] text-muted-foreground">{lastResult}</span>
        ) : null}
      </div>
    </AdminOnly>
  );
}

export function InternalJobsTable({ jobs }: { jobs: OpsJobRow[] }) {
  const columns: OpsTableColumn<OpsJobRow>[] = [
    {
      key: "label",
      header: "Job",
      cell: (j) => (
        <div>
          <div className="font-medium text-[12px]">{j.label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{j.description}</div>
        </div>
      ),
    },
    {
      key: "lastRun",
      header: "Last run",
      cell: (j) => (
        <span className="font-mono text-[11px]">
          {j.lastRunAt ? formatActivityDateTime(j.lastRunAt) : "Never"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (j) => (
        <OpsStatusBadge
          status={j.lastStatus ?? "UNKNOWN"}
          tone={jobStatusTone(j.lastStatus)}
        />
      ),
    },
    {
      key: "duration",
      header: "Duration",
      cell: (j) => <span className="font-mono text-[11px]">{formatDuration(j.durationMs)}</span>,
    },
    {
      key: "counts",
      header: "Processed / OK / Failed",
      cell: (j) => (
        <span className="font-mono text-[11px] tabular-nums">
          {j.processedCount ?? "—"} / {j.successCount ?? "—"} / {j.failureCount ?? "—"}
        </span>
      ),
    },
    {
      key: "next",
      header: "Next run",
      cell: (j) => <span className="text-[11px] text-muted-foreground">{j.nextScheduledRun}</span>,
    },
    {
      key: "detail",
      header: "Summary",
      cell: (j) => (
        <span className="max-w-[240px] text-[11px] text-muted-foreground">{j.detailSummary}</span>
      ),
    },
    {
      key: "error",
      header: "Latest error",
      cell: (j) => (
        <span className="max-w-[180px] text-[11px] text-destructive/80">{j.latestError ?? "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "Manual",
      cell: (j) => <ManualRunAction job={j} />,
    },
  ];

  return (
    <OpsTable
      columns={columns}
      rows={jobs}
      rowKey={(j) => j.jobKey}
      emptyMessage="No jobs registered."
    />
  );
}

export function InternalJobsPageIntro() {
  return (
    <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
      Canonical view of scheduled jobs, cron runs, and admin manual batch actions. Product hubs link here
      instead of duplicating scheduler dashboards. Manual runs require admin permission, confirmation, and
      reason — each is written to the{" "}
      <Link to="/internal/audit" search={{ action: "OPS_JOB_MANUAL_RUN" }} className="text-gold hover:underline">
        audit log
      </Link>
      .
    </p>
  );
}
