import type { AltaUser } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";
import type { OnboardingStepId } from "@/lib/onboarding/onboarding-steps";
import type { SafeReturnDestination } from "@/lib/onboarding/safe-return";

export type CoreOnboardingSubmitInput = {
  eligibilityConfirmed: boolean;
  termsAndAupAgreed: boolean;
  privacyAndElectronicConsented: boolean;
  sourceSite: SiteKey;
  returnPath?: string | null;
  returnOrigin?: string | null;
};

export type CoreOnboardingSubmitResult = {
  user: AltaUser;
  step: OnboardingStepId;
  destination: SafeReturnDestination;
  alreadyComplete: boolean;
};

export type OnboardingLoaderState = {
  step: OnboardingStepId;
  user: Pick<
    AltaUser,
    | "id"
    | "discordUsername"
    | "avatarUrl"
    | "minecraftUsername"
    | "minecraftUuid"
    | "minecraftVerifiedAt"
    | "eligibilityConfirmedAt"
    | "coreOnboardingCompletedAt"
    | "onboardingCompletedAt"
  >;
  coreDocuments: Array<{
    documentId: string;
    title: string;
    label: string;
    version: string;
    publicPath: string;
    acceptanceType: string;
  }>;
  destination: SafeReturnDestination;
  meetsRequirement: boolean;
  minecraftChallenge: {
    id: string;
    claimedUsername: string;
    targetWorld: string;
    targetX: number;
    targetZ: number;
    status: string;
    expiresAt: string;
    attemptCount: number;
    regenerationCount: number;
    lastCheckedAt: string | null;
    verifiedAt: string | null;
    secondsRemaining: number;
    canRegenerate: boolean;
    regenerateCooldownSeconds: number;
  } | null;
};

export type CustomerOnboardingSummary = {
  coreOnboardingComplete: boolean;
  eligibilityConfirmedAt: string | null;
  coreOnboardingCompletedAt: string | null;
  onboardingCompletedAt: string | null;
  minecraftStatus: string;
  minecraftUsername: string | null;
  minecraftUuid: string | null;
  minecraftVerifiedAt: string | null;
  legalBundleStatus: string;
  acceptedDocuments: Array<{
    documentId: string;
    title: string;
    version: string;
    acceptanceType: string;
    acceptedAt: string;
  }>;
  productConsentScopes?: Array<{
    scope: string;
    label: string;
    status: string;
    currentVersions: string[];
    acceptedVersions: string[];
    acceptedAt: string | null;
    acceptanceSemantics: string[];
    sourceSite: string | null;
    companyId: string | null;
    companyName: string | null;
  }>;
  commercialActingFor?: Array<{
    scope: string;
    label: string;
    status: string;
    companyId: string | null;
    companyName: string | null;
    acceptedAt: string | null;
    sourceSite: string | null;
  }>;
  challenge: {
    status: string;
    claimedUsername: string | null;
    targetX: number | null;
    targetZ: number | null;
    expiresAt: string | null;
    attemptCount: number;
    regenerationCount: number;
  } | null;
};
