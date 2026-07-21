export class NccApiError extends Error {
  readonly retryAfterMs?: number;

  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
    options?: { retryAfterMs?: number },
  ) {
    super(message);
    this.name = "NccApiError";
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export const NCC_API_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Authentication failed.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INSUFFICIENT_SCOPE: "The credential lacks the required scope.",
  INVALID_REQUEST: "The request is invalid.",
  VALIDATION_ERROR: "One or more fields failed validation.",
  NOT_FOUND: "The requested resource was not found.",
  IDEMPOTENCY_KEY_REQUIRED: "Idempotency-Key header is required.",
  IDEMPOTENCY_CONFLICT: "Idempotency key was reused with a different payload.",
  RATE_LIMITED: "Rate limit exceeded. Retry after the indicated delay.",
  INSTITUTION_INACTIVE: "The institution is not eligible for API operations.",
  INSTITUTION_NOT_PARTICIPANT: "The institution is not an NCC participant.",
  ENVIRONMENT_MISMATCH: "Credential environment does not allow this operation.",
  UNSUPPORTED_CURRENCY: "The currency is not supported.",
  INVALID_AMOUNT: "Amount must be a positive decimal string.",
  INVALID_ROUTING: "Receiving routing number is invalid or unusable.",
  ROUTING_NUMBER_UNAVAILABLE: "The routing number is unavailable.",
  SELF_SETTLEMENT_DENIED: "Self-settlement is not permitted.",
  CANCEL_TOO_LATE: "Cancellation is no longer permitted for this settlement.",
  REVERSAL_REASON_REQUIRED: "A non-empty reversal reason is required.",
  REVERSAL_PENDING_REVIEW: "Reversal request submitted for NCC operations review.",
  INSUFFICIENT_FUNDS: "The sending settlement account has insufficient available funds.",
  SOURCE_ADAPTER_UNAVAILABLE: "The sending institution adapter is unavailable.",
  DESTINATION_ADAPTER_UNAVAILABLE: "The receiving institution adapter is unavailable.",
  INVALID_PAYMENT_ADDRESS: "The payment address is invalid.",
  ACCOUNT_UNAVAILABLE: "The account is unavailable for this settlement.",
  ACCOUNT_NOT_DEBITABLE: "The source account cannot be debited.",
  ACCOUNT_NOT_CREDITABLE: "The destination account cannot be credited.",
  WEBHOOK_URL_REJECTED: "Webhook URL failed security validation.",
  INTERNAL_ERROR: "An internal error occurred.",
  SERVICE_UNAVAILABLE: "NCC is temporarily unavailable.",
};

export function messageForNccApiCode(code: string, fallback?: string): string {
  return NCC_API_ERROR_MESSAGES[code] ?? fallback ?? NCC_API_ERROR_MESSAGES.INTERNAL_ERROR;
}

export function mapSettlementErrorToApi(error: unknown): NccApiError {
  const code =
    error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : error instanceof Error
        ? error.message
        : "INTERNAL_ERROR";

  const known: Record<string, number> = {
    IDEMPOTENCY_CONFLICT: 409,
    IDEMPOTENCY_KEY_REQUIRED: 400,
    INSUFFICIENT_FUNDS: 422,
    SELF_SETTLEMENT_DENIED: 422,
    ROUTING_NUMBER_UNUSABLE: 422,
    ROUTING_NUMBER_UNAVAILABLE: 422,
    INVALID_ROUTING: 422,
    INVALID_PAYMENT_ADDRESS: 422,
    ACCOUNT_UNAVAILABLE: 422,
    ACCOUNT_NOT_DEBITABLE: 422,
    ACCOUNT_NOT_CREDITABLE: 422,
    UNSUPPORTED_CURRENCY: 422,
    INSTITUTION_CANNOT_ORIGINATE: 403,
    INSTITUTION_CANNOT_RECEIVE: 403,
    INSTITUTION_NOT_NCC_PARTICIPANT: 403,
    CANCEL_AFTER_SETTLEMENT_DENIED: 409,
    CANCEL_WHILE_SETTLING_DENIED: 409,
    CANCEL_AFTER_PREPARATION_DENIED: 409,
    SOURCE_ADAPTER_UNAVAILABLE: 503,
    DESTINATION_ADAPTER_UNAVAILABLE: 503,
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    REVERSAL_REASON_REQUIRED: 400,
    REVERSAL_REQUIRES_SETTLED: 409,
    ALREADY_REVERSED: 409,
  };

  const httpStatus = known[code] ?? 422;
  return new NccApiError(code, messageForNccApiCode(code, code), httpStatus);
}
