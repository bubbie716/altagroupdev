import { formatActivityDateTime, formatDueDate } from "@/lib/format-datetime";

export type QueueAgeSeverity = "normal" | "warning" | "critical";

/** Milliseconds elapsed since an ISO or YYYY-MM-DD date string. */
export function queueAgeMs(isoOrDate: string): number {
  const parsed = new Date(isoOrDate.includes("T") ? isoOrDate : `${isoOrDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Date.now() - parsed.getTime());
}

/** Age in days from an ISO or YYYY-MM-DD date string. */
export function queueAgeDays(isoOrDate: string): number {
  return Math.floor(queueAgeMs(isoOrDate) / 86_400_000);
}

/** Age in hours (fractional). */
export function queueAgeHours(isoOrDate: string): number {
  return queueAgeMs(isoOrDate) / 3_600_000;
}

/** Visual severity: warning at 2+ days, critical at 5+ days. */
export function queueAgeSeverity(isoOrDate: string): QueueAgeSeverity {
  const hours = queueAgeHours(isoOrDate);
  if (hours >= 120) return "critical";
  if (hours >= 48) return "warning";
  return "normal";
}

/** Human-readable age with optional severity prefix. */
export function formatQueueAgeDisplay(isoOrDate: string): string {
  const ms = queueAgeMs(isoOrDate);
  const hours = ms / 3_600_000;
  const days = Math.floor(hours / 24);

  if (hours < 1) return "< 1 hour";
  if (hours < 24) {
    const h = Math.floor(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (days < 2) {
    const h = Math.floor(hours);
    return `${h} hours`;
  }
  if (days < 5) return `⚠ ${days} day${days === 1 ? "" : "s"}`;
  return `🚨 ${days} days`;
}

/** @deprecated Use formatQueueAgeDisplay for queues. */
export function formatQueueAge(isoOrDate: string): string {
  return formatQueueAgeDisplay(isoOrDate);
}

export function formatQueueDate(isoOrDate: string): string {
  if (isoOrDate.includes("T")) return formatActivityDateTime(isoOrDate);
  return formatDueDate(isoOrDate);
}

export const QUEUE_BREADCRUMB_ROOT = { label: "Queues", to: "/internal/queues/deposits" } as const;

export function queueBreadcrumbs(label: string) {
  return [
    { label: "Dashboard", to: "/internal" },
    { label: "Queues", to: "/internal/queues/deposits" },
    { label },
  ];
}
