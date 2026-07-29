/**
 * Shared UI Lab mutation gating for internal ops.
 * Prefer disabling controls in the UI; server functions must still reject mutations.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";

export function useUiLabMutationGate(): {
  uiLab: boolean;
  mutationsAllowed: boolean;
  unavailableLabel: (action: string) => string;
  bannerCopy: string;
} {
  const uiLab = isUiLabMode();
  return {
    uiLab,
    mutationsAllowed: !uiLab,
    unavailableLabel: (action: string) => `${action} · Unavailable in UI Lab`,
    bannerCopy:
      "UI Lab is demonstration-only. Preview and navigation work; posting and other mutations are disabled.",
  };
}

/** Server-side: throw a consistent BAD_REQUEST when UI Lab tries to mutate. */
export function assertNotUiLabMutation(operation: string): void {
  if (isUiLabMode()) {
    throw new Error(`BAD_REQUEST:${operation} is disabled in UI Lab.`);
  }
}
