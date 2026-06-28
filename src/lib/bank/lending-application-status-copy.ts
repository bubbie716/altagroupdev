import type { LoanApplicationStatusCode } from "@/lib/bank/lending-types";
import type { LoanApplicationThreadStatusCode } from "@/lib/bank/loan-application-thread-types";

/** User-facing application review statuses (standardized). */
export type StandardLoanApplicationDisplayStatus =
  | "Waiting on Alta"
  | "Waiting on You"
  | "Accepted"
  | "Denied";

export const LOAN_APPLICATION_STATUS_DEFINITIONS: Record<
  StandardLoanApplicationDisplayStatus,
  string
> = {
  "Waiting on Alta":
    "Alta is currently reviewing your application or preparing the next step.",
  "Waiting on You":
    "Alta requires additional information, documents, or another action from you before review can continue.",
  Accepted: "Your application has been accepted.",
  Denied: "Your application was not approved.",
};

export { LOAN_APPLICATION_SUBMITTED_MESSAGE } from "@/lib/bank/secure-deal-room-system-copy";

export const LOAN_APPLICATION_WHAT_HAPPENS_NEXT = [
  "You submit · your application enters review.",
  "A Secure Deal Room opens for asynchronous communication with Alta.",
  "If Alta needs more information, you'll be notified to respond in your Secure Deal Room.",
] as const;

export const LOAN_PRIVATE_CLIENT_LENDING_NOTE =
  "Alta Private clients may receive relationship-based pricing, negotiated lending terms, and dedicated banker support. Approval is never guaranteed.";

export function formatTerminalApplicationStatus(
  status: LoanApplicationStatusCode,
): StandardLoanApplicationDisplayStatus | null {
  if (status === "approved") return "Accepted";
  if (status === "denied" || status === "cancelled") return "Denied";
  return null;
}

export function formatApplicationStatusLabel(status: LoanApplicationStatusCode): string {
  const terminal = formatTerminalApplicationStatus(status);
  if (terminal) return terminal;
  if (status === "pending" || status === "under_review") return "Waiting on Alta";
  return status;
}

export function threadStatusToDisplayLabel(
  threadStatus: LoanApplicationThreadStatusCode | null,
  variant: "user" | "internal" = "user",
): StandardLoanApplicationDisplayStatus {
  const code = threadStatus ?? "waiting_on_alta";
  if (code === "waiting_on_applicant") return "Waiting on You";
  return "Waiting on Alta";
}

export function applicationListStatusLabel(
  row: {
    status: string;
    statusLabel: string;
    threadStatus: LoanApplicationThreadStatusCode | null;
  },
  variant: "user" | "internal" = "user",
): string {
  const terminal = formatTerminalApplicationStatus(row.status as LoanApplicationStatusCode);
  if (terminal) return terminal;
  if (row.status === "pending" || row.status === "under_review") {
    return threadStatusToDisplayLabel(row.threadStatus, variant);
  }
  return row.statusLabel;
}
