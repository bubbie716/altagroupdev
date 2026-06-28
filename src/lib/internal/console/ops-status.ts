/** Shared ops status tones for the internal console (foundation — products migrate later). */
export type OpsStatusTone = "success" | "danger" | "warning" | "info" | "gold" | "neutral";

export const OPS_STATUS_TONE_STYLES: Record<
  OpsStatusTone,
  { wrap: string; dot: string }
> = {
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

/** Canonical status → tone map for future product migration. */
export const OPS_STATUS_TONE_MAP: Record<string, OpsStatusTone> = {
  active: "success",
  operational: "success",
  open: "success",
  listed: "success",
  cleared: "success",
  verified: "success",
  authorized: "success",
  complete: "success",
  completed: "success",
  approved: "success",
  accepted: "success",
  posted: "success",
  paid_off: "success",
  pending: "warning",
  pending_review: "warning",
  under_review: "warning",
  review: "warning",
  assigned: "warning",
  partial: "warning",
  restricted: "warning",
  degraded: "warning",
  denied: "danger",
  failed: "danger",
  missing: "danger",
  revoked: "danger",
  halted: "danger",
  frozen: "danger",
  suspended: "danger",
  rejected: "danger",
  escalated: "danger",
  flagged: "danger",
  cancelled: "neutral",
  unverified: "neutral",
  resolved: "neutral",
  maintenance: "neutral",
  new: "info",
  deposit: "info",
  withdrawal: "info",
  submitted: "info",
  waiting_on_alta: "gold",
  waiting_on_customer: "warning",
  waiting_on_applicant: "warning",
  needs_info: "warning",
  needs_information: "warning",
  closed: "neutral",
  voided: "neutral",
  success: "success",
  generated: "success",
  executed: "success",
  paused: "warning",
  private_client: "gold",
};

export function resolveOpsStatusTone(status: string, explicit?: OpsStatusTone): OpsStatusTone {
  if (explicit) return explicit;
  const key = status.trim().toLowerCase().replace(/\s+/g, "_");
  return OPS_STATUS_TONE_MAP[key] ?? "neutral";
}
