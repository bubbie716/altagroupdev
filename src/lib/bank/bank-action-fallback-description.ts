import type { BankActionPhase } from "@/lib/bank/bank-action-flow";

/**
 * Phase-aware fallback DialogDescription for ResponsiveBankAction when a flow
 * does not supply an explicit description. Prevents contradictory copy such as
 * "Transfer completed. Complete the steps, then confirm."
 */
export function bankActionFallbackDescription(
  phase: BankActionPhase,
  options?: { pendingSuccess?: boolean },
): string {
  switch (phase) {
    case "selection":
      return "Choose an option to continue.";
    case "details":
      return "Enter the required details.";
    case "review":
      return "Review the details before confirming.";
    case "submitting":
      return "Your request is being processed.";
    case "success":
      return options?.pendingSuccess
        ? "The request was submitted for review."
        : "The request completed successfully.";
    case "error":
      return "The request could not be completed. Your entries were preserved.";
    default:
      return "Complete the steps, then confirm.";
  }
}
