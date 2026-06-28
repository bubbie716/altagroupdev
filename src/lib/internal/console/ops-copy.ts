/** Canonical operator-facing labels for the internal console. */
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  operational: "Operational",
  open: "Open",
  closed: "Closed",
  listed: "Listed",
  cleared: "Cleared",
  verified: "Verified",
  authorized: "Authorized",
  complete: "Complete",
  completed: "Completed",
  approved: "Approved",
  accepted: "Accepted",
  posted: "Posted",
  paid_off: "Paid Off",
  pending: "Pending",
  pending_review: "Pending Review",
  under_review: "Under Review",
  waiting_on_alta: "Waiting on Alta",
  waiting_on_alta_staff: "Waiting on Alta",
  waiting_on_customer: "Waiting on Customer",
  waiting_on_applicant: "Waiting on Customer",
  waiting_on_you: "Waiting on Customer",
  review: "Pending Review",
  assigned: "Assigned",
  partial: "Partial",
  restricted: "Restricted",
  degraded: "Degraded",
  denied: "Denied",
  failed: "Failed",
  missing: "Missing",
  revoked: "Revoked",
  halted: "Halted",
  frozen: "Frozen",
  suspended: "Suspended",
  rejected: "Rejected",
  escalated: "Escalated",
  flagged: "Flagged",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  unverified: "Unverified",
  resolved: "Resolved",
  maintenance: "Maintenance",
  new: "New",
  submitted: "Submitted",
  needs_info: "Needs Information",
  needs_information: "Needs Information",
  success: "Success",
  unknown: "Unknown",
  generated: "Generated",
  voided: "Voided",
  executed: "Executed",
  paused: "Paused",
  private_client: "Private Client",
};

/** Normalize raw status strings to consistent operator copy. */
export function formatOpsStatusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) return "Unknown";
  const key = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  // Title-case fallback for ALL_CAPS or snake_case
  if (trimmed === trimmed.toUpperCase() && trimmed.includes("_")) {
    return trimmed
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  }
  return trimmed;
}

/** Shared vocabulary — use these terms in internal UI copy. */
export const OPS_COPY = {
  operator: "Operator",
  administrator: "Administrator",
  adminRequired: "Admin permission required.",
  noResults: "No records match the current filters.",
  loading: "Loading…",
  actionFailed: "Action could not be completed. Try again or contact an administrator.",
  lendingBeginReviewDescription:
    "Marks the application Waiting on Alta and notifies the applicant in the Secure Deal Room.",
} as const;
