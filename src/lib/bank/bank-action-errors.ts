import { formatBankActionError, type BankMoneyAction } from "@/lib/bank/account-status-copy";
import { BANK_SUBMISSION_ERROR_FALLBACK } from "@/lib/bank/bank-shared-copy";

export type CustomerSubmissionAction =
  | BankMoneyAction
  | "loan_payment"
  | "lending_apply"
  | "card_apply"
  | "card_payment"
  | "card_review"
  | "statement_generate"
  | "scheduled_transfer";

const GENERIC_SERVER_FALLBACKS = new Set([
  "Payment failed",
  "Payment failed.",
  "Request failed",
  "Application failed",
  "Submission failed.",
  "Submission failed",
  "Generation failed.",
  "Generation failed",
  "Unable to complete transfer.",
  "Upload failed.",
  "Failed to send.",
  "Operation failed.",
  "Something went wrong.",
]);

const ACTION_FALLBACK: Record<CustomerSubmissionAction, string> = {
  deposit: "This deposit could not be submitted. Please review your details and try again.",
  withdraw: "This withdrawal could not be submitted. Please review your details and try again.",
  transfer: "This transfer could not be completed. Please review your accounts and try again.",
  pay: "This Alta Pay payment could not be sent. Please review the amount and recipient, then try again.",
  loan_payment: "This loan payment could not be processed. Please verify your account and try again.",
  lending_apply: "Your lending application could not be submitted. Please review the form and try again.",
  card_apply: "Your Alta Card application could not be submitted. Please review the form and try again.",
  card_payment: "This Alta Card payment could not be processed. Please verify your details and try again.",
  card_review: "Your review request could not be submitted. Please review the form and try again.",
  statement_generate: "Your statement could not be generated. Please verify the account and period, then try again.",
  scheduled_transfer: "This transfer schedule could not be saved. Please review your details and try again.",
};

function extractRawMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/^BAD_REQUEST:/, "").trim();
  if (typeof err === "string") return err.replace(/^BAD_REQUEST:/, "").trim();
  return "";
}

function bankActionFor(action: CustomerSubmissionAction): BankMoneyAction | undefined {
  if (action === "deposit" || action === "withdraw" || action === "transfer" || action === "pay") {
    return action;
  }
  if (action === "loan_payment" || action === "card_payment") return "pay";
  return undefined;
}

/** Maps server and generic errors to customer-safe, actionable copy. */
export function formatCustomerActionError(
  err: unknown,
  action: CustomerSubmissionAction,
  context?: { accountId?: string },
): string {
  const raw = extractRawMessage(err);
  const bankAction = bankActionFor(action);

  if (bankAction && raw) {
    const mapped = formatBankActionError(raw, { action: bankAction, accountId: context?.accountId });
    if (mapped.message !== raw || !GENERIC_SERVER_FALLBACKS.has(raw)) {
      if (mapped.message && !GENERIC_SERVER_FALLBACKS.has(mapped.message)) {
        return mapped.message;
      }
    }
  }

  if (raw && !GENERIC_SERVER_FALLBACKS.has(raw)) {
    if (bankAction) {
      const mapped = formatBankActionError(raw, { action: bankAction, accountId: context?.accountId });
      return mapped.message;
    }
    return raw;
  }

  if (action === "deposit" || action === "withdraw") {
    return BANK_SUBMISSION_ERROR_FALLBACK;
  }

  return ACTION_FALLBACK[action];
}
