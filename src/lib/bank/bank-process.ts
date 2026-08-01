/**
 * Shared Bank process-state language:
 * Details → Review → Processing → Success | Pending | Error
 *
 * Motion tokens stay restrained; respect prefers-reduced-motion.
 */

export const BANK_PROCESS_MOTION = {
  /** Step content fade/translate */
  stepMs: 180,
  /** Minimum processing visibility to avoid flash */
  minProcessingMs: 400,
  /** Success check draw */
  successMs: 420,
  /** Pending pulse period */
  pendingPulseMs: 1600,
} as const;

export type BankProcessOutcomeKind = "success" | "pending" | "error";

export type BankProcessSummaryRow = {
  label: string;
  value: string;
  secondary?: string;
  mono?: boolean;
  /**
   * When set, `value` is treated as a shortened display form and a copy control
   * copies this full unmodified string (e.g. order reference).
   */
  copyValue?: string;
};

export async function waitBankProcessMin(
  startedAt: number,
  minMs: number = BANK_PROCESS_MOTION.minProcessingMs,
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minMs) return;
  await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
}

/** Progress step index (1-based) for Details / Review / terminal. */
export function bankProcessProgressStep(
  phase: "details" | "review" | "submitting" | "success" | "error" | "selection" | string,
): { step: number; total: number; label: string } | null {
  if (phase === "details") return { step: 1, total: 3, label: "Details" };
  if (phase === "review") return { step: 2, total: 3, label: "Review" };
  if (phase === "submitting") return { step: 3, total: 3, label: "Processing" };
  return null;
}
