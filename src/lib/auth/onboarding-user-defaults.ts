import type { AltaUser } from "@/lib/auth/types";

/** Default onboarding/Minecraft verification fields for tests and fixtures. */
export const DEFAULT_ONBOARDING_USER_FIELDS = {
  minecraftUuid: null,
  minecraftVerifiedAt: null,
  eligibilityConfirmedAt: null,
  coreOnboardingCompletedAt: null,
  onboardingCompletedAt: null,
} as const satisfies Partial<AltaUser>;

/** Merge defaults so legacy fixtures remain valid without implying verification. */
export function withOnboardingDefaults<T extends Partial<AltaUser>>(user: T): T & typeof DEFAULT_ONBOARDING_USER_FIELDS {
  return {
    ...DEFAULT_ONBOARDING_USER_FIELDS,
    ...user,
  };
}
