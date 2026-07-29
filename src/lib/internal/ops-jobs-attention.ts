/** Attention ranking and compact display helpers for System Jobs. */

import type { OpsJobRow } from "@/server/ops-jobs.service";
import { formatInboxAge } from "@/lib/internal/inbox-normalize";

export type JobAttentionKind =
  | "failed"
  | "partial"
  | "stale"
  | "unknown"
  | "overdue"
  | "missing";

export type JobAttentionItem = {
  job: OpsJobRow;
  kind: JobAttentionKind;
  problem: string;
};

function statusRank(status: string | null): number {
  if (status === "FAILED") return 0;
  if (status === "RUNNING" || status === "PENDING") return 1;
  if (!status || status === "UNKNOWN") return 2;
  if (status === "SUCCESS") return 4;
  return 3;
}

function isDailyLike(job: OpsJobRow): boolean {
  const s = `${job.nextScheduledRun} ${job.description}`.toLowerCase();
  return /\bdaily\b|\bevery day\b|\bcron\b/.test(s);
}

function isHourlyLike(job: OpsJobRow): boolean {
  const s = `${job.nextScheduledRun} ${job.description}`.toLowerCase();
  return /\bhourly\b|\bevery hour\b/.test(s);
}

function staleThresholdMs(job: OpsJobRow): number | null {
  if (isHourlyLike(job)) return 3 * 60 * 60 * 1000;
  if (isDailyLike(job)) return 36 * 60 * 60 * 1000;
  return null;
}

/** Plain-language problem when a job needs operator attention. */
export function describeJobAttention(job: OpsJobRow, now = Date.now()): JobAttentionItem | null {
  const failures = job.failureCount ?? 0;
  const processed = job.processedCount ?? 0;
  const status = job.lastStatus;

  if (status === "FAILED") {
    return {
      job,
      kind: "failed",
      problem: job.latestError?.trim()
        ? `Last run needs review — ${job.latestError.trim().slice(0, 120)}`
        : "Last run needs review before the next schedule.",
    };
  }

  if (failures > 0 && (status === "SUCCESS" || processed > failures)) {
    return {
      job,
      kind: "partial",
      problem: `Partial run issues — ${failures} of ${processed || failures} items need follow-up`,
    };
  }

  if (!job.lastRunAt && (!status || status === "UNKNOWN")) {
    return {
      job,
      kind: "missing",
      problem: "No recorded run yet",
    };
  }

  if ((!status || status === "UNKNOWN") && job.lastRunAt) {
    return {
      job,
      kind: "unknown",
      problem: "Last run status unknown",
    };
  }

  const threshold = staleThresholdMs(job);
  if (threshold != null && job.lastRunAt && status === "SUCCESS") {
    const age = now - Date.parse(job.lastRunAt);
    if (Number.isFinite(age) && age > threshold) {
      return {
        job,
        kind: "stale",
        problem: `Last successful run was ${formatInboxAge(age)} ago — may be overdue`,
      };
    }
  }

  if (threshold != null && job.lastRunAt && status !== "SUCCESS" && status !== "FAILED") {
    const age = now - Date.parse(job.lastRunAt);
    if (Number.isFinite(age) && age > threshold) {
      return {
        job,
        kind: "overdue",
        problem: `No successful run in ${formatInboxAge(age)}`,
      };
    }
  }

  return null;
}

export function jobsNeedingAttention(jobs: OpsJobRow[], now = Date.now()): JobAttentionItem[] {
  const kindRank: Record<JobAttentionKind, number> = {
    failed: 0,
    overdue: 1,
    stale: 2,
    partial: 3,
    missing: 4,
    unknown: 5,
  };
  return jobs
    .map((j) => describeJobAttention(j, now))
    .filter((x): x is JobAttentionItem => Boolean(x))
    .sort(
      (a, b) =>
        kindRank[a.kind] - kindRank[b.kind] || a.job.label.localeCompare(b.job.label),
    );
}

/** Failed/unhealthy first, then running/unknown, then successful. */
export function sortOpsJobs(jobs: OpsJobRow[]): OpsJobRow[] {
  return [...jobs].sort((a, b) => {
    const ar = statusRank(a.lastStatus);
    const br = statusRank(b.lastStatus);
    if (ar !== br) return ar - br;
    const af = a.failureCount ?? 0;
    const bf = b.failureCount ?? 0;
    if (af !== bf) return bf - af;
    return a.label.localeCompare(b.label);
  });
}

export function formatJobShortResult(job: OpsJobRow): string | null {
  const failed = job.failureCount ?? 0;
  const ok = job.successCount ?? 0;
  if (failed > 0) return `${failed} failed`;
  if (ok > 0) return `${ok} succeeded`;
  if (job.processedCount != null && job.processedCount > 0) {
    return `${job.processedCount} processed`;
  }
  return null;
}

export function formatJobRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const ageMs = Math.max(0, now - Date.parse(iso));
  if (!Number.isFinite(ageMs)) return "—";
  if (ageMs < 60_000) return "Just now";
  return `${formatInboxAge(ageMs)} ago`;
}

export function formatJobStatusLabel(status: string | null): string {
  if (!status) return "Unknown";
  if (status === "SUCCESS") return "Healthy";
  if (status === "FAILED") return "Failed";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
