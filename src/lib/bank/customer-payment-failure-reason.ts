const GENERIC_FAILURE = "The payment could not be completed.";

function normalizeRawReason(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^BAD_REQUEST:/, "").replace(/^CONFLICT:/, "").trim();
}

/** Maps internal payment failure messages to customer-safe copy. */
export function toCustomerSafePaymentFailureReason(raw: unknown): string {
  const message = normalizeRawReason(raw);
  if (!message) return GENERIC_FAILURE;

  const lower = message.toLowerCase();

  if (
    lower.includes("insufficient") ||
    lower.includes("not enough") ||
    lower.includes("available balance")
  ) {
    return "Insufficient funds.";
  }

  if (
    lower.includes("account_restricted") ||
    lower.includes("restricted") ||
    lower.includes("frozen") ||
    lower.includes("cannot be used right now") ||
    lower.includes("not available")
  ) {
    return "The selected account cannot be used right now.";
  }

  if (
    lower.includes("merchant not approved") ||
    lower.includes("not approved for autopay") ||
    lower.includes("merchant_not_approved")
  ) {
    return "This merchant is not approved for AutoPay.";
  }

  if (
    lower.includes("monthly autopay limit") ||
    lower.includes("limit exceeded") ||
    lower.includes("limit reached") ||
    lower.includes("exceeds your configured") ||
    lower.includes("exceeds confirmation") ||
    lower.includes("exceeds the maximum")
  ) {
    if (lower.includes("monthly autopay")) {
      return "This payment exceeds your monthly AutoPay limit.";
    }
    return "This payment exceeds your configured limit.";
  }

  if (lower.includes("confirmation threshold") || lower.includes("confirmation required")) {
    return "This payment requires your confirmation.";
  }

  if (lower.includes("not payable") || lower.includes("already paid")) {
    return "This invoice is no longer payable.";
  }

  if (lower.includes("forbidden") || lower.includes("not authorized")) {
    return "You are not authorized to complete this payment.";
  }

  if (message.length > 120 || lower.includes("prisma") || lower.includes("undefined")) {
    return GENERIC_FAILURE;
  }

  return message.endsWith(".") ? message : `${message}.`;
}

/** @deprecated Prefer toCustomerSafePaymentFailureReason */
export function friendlyFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return toCustomerSafePaymentFailureReason(error.message);
  }
  return toCustomerSafePaymentFailureReason(error);
}
