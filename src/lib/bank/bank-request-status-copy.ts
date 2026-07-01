import type { BankTransactionStatusCode } from "@/lib/bank/backend-types";

/** Customer-facing labels for deposit/withdrawal requests on the deposit and withdraw pages. */
export type BankRequestDisplayStatus = "Pending" | "Approved" | "Waiting on You" | "Under Review" | "Denied";

export function formatBankRequestDisplayStatus(status: BankTransactionStatusCode): BankRequestDisplayStatus {
  if (status === "denied") return "Denied";
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  return "Under Review";
}

/** Customer-safe denial copy — never exposes internal operator notes. */
export function formatBankRequestDenialMessage(_reviewNote: string | null | undefined): string {
  return "This request was not approved.";
}
