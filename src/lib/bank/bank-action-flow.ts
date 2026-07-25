/**
 * Explicit state model for Bank transactional overlays:
 *   selection → details → review → submitting → success
 *                                    ↘ error
 */

export type BankActionPhase =
  | "selection"
  | "details"
  | "review"
  | "submitting"
  | "success"
  | "error";

export type BankActionPresentation = "page" | "overlay";

export function canDismissBankAction(phase: BankActionPhase): boolean {
  return phase !== "submitting";
}

export function canGoBackBankAction(phase: BankActionPhase): boolean {
  return phase === "details" || phase === "review" || phase === "error";
}

export function bankActionPhaseAfterBack(phase: BankActionPhase): BankActionPhase {
  if (phase === "review" || phase === "error") return "details";
  if (phase === "details") return "selection";
  return phase;
}

/** Stable idempotency key for one submission attempt; cleared after success. */
export function ensureIdempotencyKey(ref: { current: string | null }): string {
  if (!ref.current) {
    ref.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return ref.current;
}
