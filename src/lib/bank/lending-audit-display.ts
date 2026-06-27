/** User-facing labels for lending audit/timeline entries (backend action codes unchanged). */

const ACTION_TITLES: Record<string, string> = {
  LOAN_APPROVED: "Accepted",
  LOAN_DENIED: "Denied",
  LOAN_THREAD_CREATED: "Secure Deal Room opened",
  LOAN_THREAD_MESSAGE_SENT: "Secure Deal Room message",
  LOAN_THREAD_STATUS_CHANGED: "Application review status updated",
  LOAN_THREAD_CLOSED: "Secure Deal Room closed",
  LOAN_THREAD_REOPENED: "Secure Deal Room reopened",
  LOAN_THREAD_ASSIGNED: "Secure Deal Room updated",
};

const DESCRIPTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/approved loan application/i, "accepted loan application"],
  [/denied loan application/i, "denied loan application"],
  [/Staff assigned to application thread/i, "Secure Deal Room updated"],
  [/Staff unassigned from application thread/i, "Secure Deal Room updated"],
  [/application thread/i, "Secure Deal Room"],
  [/deal room/i, "Secure Deal Room"],
];

export function formatLendingAuditActionTitle(action: string): string {
  return ACTION_TITLES[action] ?? action.replace(/_/g, " ");
}

export function formatLendingAuditDescription(description: string): string {
  let text = description;
  for (const [pattern, replacement] of DESCRIPTION_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function isLendingAuditAction(action: string): boolean {
  return action.startsWith("LOAN_");
}
