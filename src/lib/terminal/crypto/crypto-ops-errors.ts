/**
 * Customer-safe errors for Alta Terminal crypto operations (Phase 4).
 * Never leak raw database/Prisma messages to clients.
 */

export type CryptoOpsErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "VERSION_CONFLICT"
  | "INVALID_TRANSITION"
  | "READINESS_BLOCKED"
  | "CIRCULATION_NOT_ZERO"
  | "ACTIVITY_PRESENT"
  | "INSUFFICIENT_REVENUE"
  | "DESTINATION_NOT_CONFIGURED"
  | "DESTINATION_INVALID"
  | "NEGATIVE_AMOUNT"
  | "UI_LAB_BLOCKED"
  | "INTERNAL_FAILURE";

const CUSTOMER_MESSAGES: Record<CryptoOpsErrorCode, string> = {
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "That crypto market could not be found.",
  VALIDATION_FAILED: "That request could not be validated.",
  CONFIRMATION_REQUIRED: "Explicit confirmation is required.",
  IDEMPOTENCY_CONFLICT: "This request conflicts with a previous operation.",
  VERSION_CONFLICT: "Market state changed. Refresh and try again.",
  INVALID_TRANSITION: "That status change is not allowed.",
  READINESS_BLOCKED: "Activation readiness checks have not all passed.",
  CIRCULATION_NOT_ZERO: "Circulation must be zero before closing this asset.",
  ACTIVITY_PRESENT: "This asset has trading or wallet activity and cannot be closed from draft.",
  INSUFFICIENT_REVENUE: "Accrued revenue is less than the requested sweep amount.",
  DESTINATION_NOT_CONFIGURED:
    "Revenue sweep destination is not configured. Set TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID.",
  DESTINATION_INVALID: "Revenue sweep destination portfolio is missing or not active.",
  NEGATIVE_AMOUNT: "Amount must be a positive florin value.",
  UI_LAB_BLOCKED: "This action is disabled in UI Lab.",
  INTERNAL_FAILURE: "Something went wrong. Try again later.",
};

export function cryptoOpsCustomerMessage(code: CryptoOpsErrorCode): string {
  return CUSTOMER_MESSAGES[code];
}

export class CryptoOpsError extends Error {
  readonly code: CryptoOpsErrorCode;
  readonly customerMessage: string;
  readonly details?: Record<string, string>;

  constructor(
    code: CryptoOpsErrorCode,
    message?: string,
    details?: Record<string, string>,
  ) {
    super(message ?? CUSTOMER_MESSAGES[code]);
    this.name = "CryptoOpsError";
    this.code = code;
    this.customerMessage = CUSTOMER_MESSAGES[code];
    this.details = details;
  }
}

export function requireNonemptyReason(reason: unknown): string {
  if (typeof reason !== "string" || !reason.trim()) {
    throw new CryptoOpsError("VALIDATION_FAILED", "A nonempty operator reason is required.");
  }
  return reason.trim();
}

export function requireConfirmation(confirmed: unknown): void {
  if (confirmed !== true) {
    throw new CryptoOpsError("CONFIRMATION_REQUIRED");
  }
}

export function requireIdempotencyKey(key: unknown): string {
  if (typeof key !== "string" || key.trim().length < 8) {
    throw new CryptoOpsError(
      "VALIDATION_FAILED",
      "Idempotency key must be at least 8 characters.",
    );
  }
  return key.trim();
}
