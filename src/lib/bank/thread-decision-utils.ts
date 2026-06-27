/** Parent application / review statuses that close the secure deal room with a final decision. */
const TERMINAL_THREAD_DECISION_STATUSES = new Set([
  "approved",
  "partially_approved",
  "denied",
  "cancelled",
]);

export function isTerminalThreadDecisionStatus(status: string): boolean {
  return TERMINAL_THREAD_DECISION_STATUSES.has(status.toLowerCase());
}

export type ThreadDecisionTone = "success" | "danger" | "warning" | "neutral";

export function threadDecisionTone(status: string): ThreadDecisionTone {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "denied") return "danger";
  if (normalized === "partially_approved") return "warning";
  return "neutral";
}

export function threadClosedDecisionMessage(statusLabel: string): string {
  return `This secure deal room is closed. Decision: ${statusLabel}.`;
}
