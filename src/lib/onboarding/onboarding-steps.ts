/**
 * Unified onboarding step resolver.
 *
 * Phase 1 steps: welcome → legal → confirmation (complete for gate purposes).
 * Phase 2 inserts minecraft between legal and confirmation.
 *
 * Architecture note: `onboardingCompletedAt` is set only after Minecraft verification.
 * Phase 2 gate requires core + minecraftVerifiedAt + onboardingCompletedAt.
 */
import type { AltaUser } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";

export const ONBOARDING_PATH = "/onboarding" as const;

export type OnboardingStepId =
  | "welcome"
  | "legal"
  | "minecraft" // Phase 2 extension point — not active in Phase 1
  | "confirmation"
  | "complete";

export type OnboardingPhaseConfig = {
  /** When true, Minecraft verification is required before gate clearance. */
  requireMinecraftVerification: boolean;
};

/** Phase 2: core legal + Minecraft verification required for gate clearance. */
export const ONBOARDING_PHASE_CONFIG: OnboardingPhaseConfig = {
  requireMinecraftVerification: true,
};

export type OnboardingUserState = Pick<
  AltaUser,
  | "eligibilityConfirmedAt"
  | "coreOnboardingCompletedAt"
  | "onboardingCompletedAt"
  | "minecraftVerifiedAt"
  | "minecraftUsername"
  | "minecraftUuid"
>;

export function hasCoreOnboarding(user: OnboardingUserState): boolean {
  return Boolean(user.coreOnboardingCompletedAt);
}

export function hasMinecraftVerification(user: OnboardingUserState): boolean {
  // Explicit verification timestamp only — never infer from minecraftUsername.
  return Boolean(user.minecraftVerifiedAt);
}

export function hasFullOnboarding(user: OnboardingUserState): boolean {
  return Boolean(user.onboardingCompletedAt);
}

/**
 * Whether the user satisfies the currently enforced onboarding requirement.
 * Phase 2: core + minecraftVerifiedAt + onboardingCompletedAt.
 */
export function meetsCurrentOnboardingRequirement(
  user: OnboardingUserState,
  config: OnboardingPhaseConfig = ONBOARDING_PHASE_CONFIG,
): boolean {
  if (!hasCoreOnboarding(user)) return false;
  if (config.requireMinecraftVerification) {
    if (!hasMinecraftVerification(user)) return false;
    if (!hasFullOnboarding(user)) return false;
  }
  return true;
}

/**
 * Authoritative next step from server state.
 * Does not use localStorage.
 */
export function resolveOnboardingStep(
  user: OnboardingUserState,
  config: OnboardingPhaseConfig = ONBOARDING_PHASE_CONFIG,
): OnboardingStepId {
  if (!hasCoreOnboarding(user)) {
    if (user.eligibilityConfirmedAt) return "legal";
    return "welcome";
  }

  if (config.requireMinecraftVerification && !hasMinecraftVerification(user)) {
    return "minecraft";
  }

  // Core (+ Minecraft when required) complete — show confirmation / allow Continue.
  if (meetsCurrentOnboardingRequirement(user, config)) {
    return "confirmation";
  }

  // Core + Minecraft verified but onboardingCompletedAt not yet set (should be rare).
  return "confirmation";
}

/**
 * Progress for the active phase (Phase 1 excludes Minecraft).
 * Returns 1-based current step index and total visible steps.
 */
export function resolveOnboardingProgress(
  step: OnboardingStepId,
  config: OnboardingPhaseConfig = ONBOARDING_PHASE_CONFIG,
): { current: number; total: number; label: string } {
  const steps: OnboardingStepId[] = config.requireMinecraftVerification
    ? ["welcome", "legal", "minecraft", "confirmation"]
    : ["welcome", "legal", "confirmation"];

  const index = steps.indexOf(step === "complete" ? "confirmation" : step);
  const current = index >= 0 ? index + 1 : 1;
  return {
    current,
    total: steps.length,
    label: `Step ${current} of ${steps.length}`,
  };
}

export function continueButtonLabel(siteKey: SiteKey): string {
  switch (siteKey) {
    case "bank":
      return "Continue to Alta Bank";
    case "terminal":
      return "Continue to Alta Terminal";
    case "exchange":
      return "Continue to Alta Terminal";
    case "accounting":
      return "Continue to Alta Accounting";
    case "corporate":
    default:
      return "Continue to Alta Group";
  }
}

/** Existing users missing formal consent — treat like new for legal step. */
export function isExistingUserMissingCoreConsent(user: OnboardingUserState & { createdAt: string }): boolean {
  if (hasCoreOnboarding(user)) return false;
  // Any authenticated user without core onboarding needs it (new or existing).
  return true;
}

/**
 * Minecraft display status for internal/admin UI.
 * Username alone never implies verified.
 */
export function minecraftVerificationStatusLabel(user: OnboardingUserState): string {
  if (user.minecraftVerifiedAt) return "Verified";
  return "Not verified";
}
