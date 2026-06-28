import type { BankTransactionStatusCode } from "@/lib/bank/backend-types";

/** Customer-facing labels for deposit/withdrawal requests in progress. */
export type BankRequestDisplayStatus = "Waiting on Alta" | "Waiting on You" | "Under Review" | "Denied";

export function formatBankRequestDisplayStatus(status: BankTransactionStatusCode): BankRequestDisplayStatus {
  if (status === "denied") return "Denied";
  if (status === "pending") return "Waiting on Alta";
  return "Under Review";
}

/** Customer-safe denial copy — never exposes internal operator notes beyond the submitted reason. */
export function formatBankRequestDenialMessage(reviewNote: string | null | undefined): string {
  const trimmed = reviewNote?.trim();
  if (trimmed) return trimmed;
  return "This request was not approved.";
}
