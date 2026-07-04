/** Server-side enforcement for operator/admin action reasons. Never trust the UI. */

export function requireOperatorReason(
  reason: string | undefined | null,
  actionLabel = "Reason",
): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`BAD_REQUEST:${actionLabel} is required.`);
  }
  return trimmed;
}

export function isBadRequestError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("BAD_REQUEST:");
}

export function badRequestMessage(error: unknown): string {
  if (!isBadRequestError(error)) return "Request could not be completed.";
  return error.message.replace(/^BAD_REQUEST:/, "");
}
