import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import type { ScheduledPaymentStatusCode } from "@/lib/bank/business-banking-types";

/**
 * Operator-facing transfer list filters.
 * Status filters and `scheduled` (transfer type) are separate concepts.
 */
export const TRANSFER_LIST_FILTERS = [
  "all",
  "pending",
  "active",
  "failed",
  "completed",
  "paused",
  "cancelled",
  "scheduled",
] as const;

export type TransferListFilter = (typeof TRANSFER_LIST_FILTERS)[number];

export const TRANSFER_LIST_FILTER_LABELS: Record<TransferListFilter, string> = {
  all: "All",
  pending: "Pending",
  active: "Active",
  failed: "Failed",
  completed: "Completed",
  paused: "Paused",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
};

const FILTER_STATUSES: Partial<Record<TransferListFilter, ScheduledPaymentStatusCode[]>> = {
  pending: ["pending_review"],
  active: ["approved"],
  completed: ["executed"],
  failed: ["failed", "rejected"],
  paused: ["paused"],
  cancelled: ["cancelled"],
};

export function parseTransferListFilter(raw: string | undefined | null): TransferListFilter {
  if (raw && (TRANSFER_LIST_FILTERS as readonly string[]).includes(raw)) {
    return raw as TransferListFilter;
  }
  return "all";
}

function isScheduledOrRecurringType(row: Pick<InternalScheduledTransferRow, "paymentType">): boolean {
  const type = row.paymentType.toLowerCase();
  return (
    type.includes("recurring") ||
    type === "recurring" ||
    type.includes("one") ||
    type === "one_time" ||
    type === "once" ||
    type.includes("scheduled")
  );
}

export function transferMatchesListFilter(
  row: Pick<InternalScheduledTransferRow, "status" | "paymentType">,
  filter: TransferListFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") return isScheduledOrRecurringType(row);
  const statuses = FILTER_STATUSES[filter];
  if (!statuses) return true;
  return statuses.includes(row.status);
}

export function plainTransferTypeTitle(row: Pick<InternalScheduledTransferRow, "paymentType" | "transferScope">): string {
  const scope = row.transferScope.toLowerCase();
  if (scope.includes("interbank")) return "Interbank (unavailable)";
  const type = row.paymentType.toLowerCase();
  if (type.includes("recurring") || type === "recurring") return "Recurring transfer";
  if (type.includes("one") || type === "one_time" || type === "once") return "Scheduled transfer";
  return "Intrabank transfer";
}

export function plainTransferStatusLabel(status: string, statusLabel?: string | null): string {
  if (statusLabel && statusLabel.trim()) return statusLabel;
  const s = status.toLowerCase();
  if (s === "approved") return "Active";
  if (s === "pending_review") return "Pending review";
  if (s === "executed") return "Completed";
  if (s === "paused") return "Paused";
  if (s === "failed") return "Failed";
  if (s === "cancelled") return "Cancelled";
  if (s === "rejected") return "Rejected";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type TransferLifecycleStage = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming" | "skipped";
  at?: string | null;
  detail?: string | null;
};

export function buildTransferLifecycle(
  row: Pick<
    InternalScheduledTransferRow,
    | "status"
    | "createdAt"
    | "nextRunAt"
    | "lastRunAt"
    | "lastFailureReason"
    | "lastExecutionStatus"
    | "lastExecutionStatusLabel"
  >,
): TransferLifecycleStage[] {
  const status = row.status;
  const created: TransferLifecycleStage = {
    id: "created",
    label: "Created",
    state: "complete",
    at: row.createdAt,
  };

  const scheduled: TransferLifecycleStage = {
    id: "scheduled",
    label: "Scheduled",
    state:
      status === "pending_review"
        ? "current"
        : status === "cancelled" || status === "rejected"
          ? "skipped"
          : "complete",
    at: row.nextRunAt,
  };

  const processing: TransferLifecycleStage = {
    id: "processing",
    label: "Processing",
    state:
      status === "approved" || status === "paused"
        ? "current"
        : status === "executed" || status === "failed"
          ? "complete"
          : status === "cancelled" || status === "rejected"
            ? "skipped"
            : "upcoming",
    at: row.lastRunAt,
    detail:
      status === "paused"
        ? "Paused by operator"
        : status === "failed"
          ? null
          : row.lastExecutionStatusLabel &&
              !/^failed$/i.test(row.lastExecutionStatusLabel)
            ? row.lastExecutionStatusLabel
            : null,
  };

  const terminalLabel =
    status === "failed"
      ? "Execution stopped"
      : status === "cancelled" || status === "rejected"
        ? "Cancelled"
        : "Completed";
  const terminal: TransferLifecycleStage = {
    id: status === "failed" ? "failed" : status === "cancelled" || status === "rejected" ? "cancelled" : "completed",
    label: terminalLabel,
    state:
      status === "executed" || status === "failed" || status === "cancelled" || status === "rejected"
        ? "complete"
        : "upcoming",
    at: status === "executed" || status === "failed" ? row.lastRunAt : null,
    detail: status === "failed" ? row.lastFailureReason : null,
  };

  return [created, scheduled, processing, terminal];
}

export function transferNeedsAttention(
  row: Pick<InternalScheduledTransferRow, "status" | "consecutiveFailures" | "lastFailureReason">,
): boolean {
  return row.status === "failed" || row.status === "pending_review" || row.consecutiveFailures > 0;
}

/** Short attention title — avoid repeating the header status word. */
export function transferAttentionLabel(
  row: Pick<InternalScheduledTransferRow, "status" | "consecutiveFailures">,
): string | null {
  if (row.status === "failed") return "Action needed";
  if (row.status === "pending_review") return "Awaiting review";
  if (row.consecutiveFailures > 0) return "Retry needed";
  return null;
}

export function transferAttentionCopy(
  row: Pick<
    InternalScheduledTransferRow,
    "status" | "consecutiveFailures" | "lastFailureReason" | "statusLabel"
  >,
): string | null {
  if (row.status === "failed") {
    return row.lastFailureReason
      ? `Last run could not complete — ${row.lastFailureReason}`
      : "Last run could not complete. Review the funding account or cancel the transfer.";
  }
  if (row.status === "pending_review") {
    return "This transfer is waiting for review before it can run.";
  }
  if (row.consecutiveFailures > 0) {
    return row.lastFailureReason
      ? `${row.consecutiveFailures} recent run issue(s): ${row.lastFailureReason}`
      : `${row.consecutiveFailures} recent run issue(s). Review before the next attempt.`;
  }
  return null;
}

export type TransferActionKind = "pause" | "resume" | "cancel" | "run_now";

export const TRANSFER_ACTION_LABELS: Record<TransferActionKind, string> = {
  pause: "Pause transfer",
  resume: "Resume transfer",
  cancel: "Cancel transfer",
  run_now: "Run transfer now",
};

/** Primary resolution actions for the attention panel (failed / pending / stalled). */
export function primaryTransferAttentionActions(
  row: Pick<InternalScheduledTransferRow, "status" | "consecutiveFailures">,
): TransferActionKind[] {
  if (row.status === "failed") return ["run_now", "cancel"];
  if (row.status === "pending_review") return ["cancel"];
  if (row.status === "paused" && row.consecutiveFailures > 0) return ["resume", "run_now"];
  if (row.consecutiveFailures > 0 && row.status === "approved") return ["run_now"];
  return [];
}

export function availableTransferActions(
  row: Pick<InternalScheduledTransferRow, "status">,
): TransferActionKind[] {
  const actions: TransferActionKind[] = [];
  if (row.status === "approved") actions.push("pause", "run_now", "cancel");
  if (row.status === "paused") actions.push("resume", "run_now", "cancel");
  if (row.status === "pending_review") actions.push("cancel");
  if (row.status === "failed") actions.push("run_now", "cancel");
  return actions;
}

export function transferReviewCta(
  row: Pick<InternalScheduledTransferRow, "status" | "consecutiveFailures">,
): string {
  if (row.status === "failed" || row.consecutiveFailures > 0) return "Review failed transfer";
  if (row.status === "pending_review") return "Review transfer";
  return "Review transfer";
}
