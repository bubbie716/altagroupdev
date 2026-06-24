import { cn } from "@/lib/utils";

/**
 * Institutional status badge.
 * Tone is derived from the status string, with an optional indicator dot
 * so badges feel like a financial terminal rather than a generic pill.
 */
type Tone = "success" | "danger" | "warning" | "info" | "gold" | "neutral";

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  success: {
    wrap: "bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/20",
    dot: "bg-[var(--success)]",
  },
  danger: {
    wrap: "bg-[var(--destructive)]/10 text-[var(--destructive)] ring-1 ring-inset ring-[var(--destructive)]/25",
    dot: "bg-[var(--destructive)]",
  },
  warning: {
    wrap: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    wrap: "bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  gold: {
    wrap: "bg-gold/12 text-gold ring-1 ring-inset ring-gold/30",
    dot: "bg-gold",
  },
  neutral: {
    wrap: "bg-surface-2 text-muted-foreground ring-1 ring-inset ring-border-strong/60",
    dot: "bg-muted-foreground/60",
  },
};

const statusTone: Record<string, Tone> = {
  // success
  Active: "success",
  Operational: "success",
  Open: "success",
  Listed: "success",
  Cleared: "success",
  Verified: "success",
  Authorized: "success",
  Complete: "success",
  Completed: "success",
  Approved: "success",
  Posted: "success",
  "Paid Off": "success",
  "Auto-pay enabled": "success",
  // gold (premium / preview / queued action)
  "Private Client": "gold",
  Private: "gold",
  Preview: "gold",
  Working: "gold",
  Planned: "gold",
  // warning (action required, in-flight)
  Pending: "warning",
  "Pending Review": "warning",
  "Under Review": "warning",
  Review: "warning",
  Assigned: "warning",
  Partial: "warning",
  Restricted: "warning",
  Degraded: "warning",
  // info (kind/category)
  New: "info",
  Deposit: "info",
  Withdrawal: "info",
  // danger
  Denied: "danger",
  Failed: "danger",
  Missing: "danger",
  Revoked: "danger",
  Halted: "danger",
  Frozen: "danger",
  Suspended: "danger",
  Rejected: "danger",
  Escalated: "danger",
  Flagged: "danger",
  // neutral
  Cancelled: "neutral",
  Unverified: "neutral",
  "Not Required": "neutral",
  None: "neutral",
  "Needs Info": "neutral",
  Resolved: "neutral",
  Maintenance: "neutral",
  "Auto-pay disabled": "neutral",
};

export function StatusBadge({
  status,
  tone,
  dot = true,
  className,
}: {
  status: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const t = tone ?? statusTone[status] ?? "neutral";
  const s = toneStyles[t];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] whitespace-nowrap",
        s.wrap,
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden /> : null}
      {status}
    </span>
  );
}
