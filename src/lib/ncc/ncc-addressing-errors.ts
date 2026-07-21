/** Sanitized public / settlement error codes for payment addressing (Sprint 4A). */
export const NCC_ADDRESSING_ERROR = {
  INVALID_PAYMENT_ADDRESS: "INVALID_PAYMENT_ADDRESS",
  ACCOUNT_UNAVAILABLE: "ACCOUNT_UNAVAILABLE",
  ACCOUNT_NOT_DEBITABLE: "ACCOUNT_NOT_DEBITABLE",
  ACCOUNT_NOT_CREDITABLE: "ACCOUNT_NOT_CREDITABLE",
  UNSUPPORTED_CURRENCY: "UNSUPPORTED_CURRENCY",
  ROUTING_NUMBER_UNAVAILABLE: "ROUTING_NUMBER_UNAVAILABLE",
  SOURCE_ADAPTER_UNAVAILABLE: "SOURCE_ADAPTER_UNAVAILABLE",
  DESTINATION_ADAPTER_UNAVAILABLE: "DESTINATION_ADAPTER_UNAVAILABLE",
} as const;

export type NccAddressingErrorCode =
  (typeof NCC_ADDRESSING_ERROR)[keyof typeof NCC_ADDRESSING_ERROR];

/** Collapse adapter-internal detail into non-enumerating public codes. */
export function sanitizeAddressingFailureCode(code: string | null | undefined): NccAddressingErrorCode {
  switch (code) {
    case "INVALID_PAYMENT_ADDRESS":
    case "INVALID_ACCOUNT_REF":
    case "INTERNAL_ID_REJECTED":
      return NCC_ADDRESSING_ERROR.INVALID_PAYMENT_ADDRESS;
    case "ACCOUNT_NOT_DEBITABLE":
    case "ACCOUNT_RESTRICTED_DEBIT":
      return NCC_ADDRESSING_ERROR.ACCOUNT_NOT_DEBITABLE;
    case "ACCOUNT_NOT_CREDITABLE":
    case "ACCOUNT_RESTRICTED_CREDIT":
      return NCC_ADDRESSING_ERROR.ACCOUNT_NOT_CREDITABLE;
    case "UNSUPPORTED_CURRENCY":
    case "CURRENCY_MISMATCH":
      return NCC_ADDRESSING_ERROR.UNSUPPORTED_CURRENCY;
    case "ROUTING_NUMBER_UNAVAILABLE":
    case "ROUTING_NUMBER_UNUSABLE":
    case "INVALID_ROUTING":
      return NCC_ADDRESSING_ERROR.ROUTING_NUMBER_UNAVAILABLE;
    case "SOURCE_ADAPTER_UNAVAILABLE":
      return NCC_ADDRESSING_ERROR.SOURCE_ADAPTER_UNAVAILABLE;
    case "DESTINATION_ADAPTER_UNAVAILABLE":
      return NCC_ADDRESSING_ERROR.DESTINATION_ADAPTER_UNAVAILABLE;
    default:
      // Unknown, closed, frozen, not found — same external surface.
      return NCC_ADDRESSING_ERROR.ACCOUNT_UNAVAILABLE;
  }
}

export function addressingErrorMessage(code: NccAddressingErrorCode): string {
  switch (code) {
    case "INVALID_PAYMENT_ADDRESS":
      return "The payment address is invalid.";
    case "ACCOUNT_UNAVAILABLE":
      return "The account is unavailable for this settlement.";
    case "ACCOUNT_NOT_DEBITABLE":
      return "The source account cannot be debited.";
    case "ACCOUNT_NOT_CREDITABLE":
      return "The destination account cannot be credited.";
    case "UNSUPPORTED_CURRENCY":
      return "The currency is not supported for this account.";
    case "ROUTING_NUMBER_UNAVAILABLE":
      return "The routing number is unavailable.";
    case "SOURCE_ADAPTER_UNAVAILABLE":
      return "The sending institution adapter is unavailable.";
    case "DESTINATION_ADAPTER_UNAVAILABLE":
      return "The receiving institution adapter is unavailable.";
    default:
      return "The payment address is unavailable.";
  }
}
