/**
 * UI Lab onboarding scenarios — demonstration only.
 * Never writes production LegalAcceptance rows, challenges, or user timestamps.
 */
import type { AltaUser } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";
import { UI_LAB_MOCK_USER, isUiLabMode } from "@/lib/auth/ui-lab";
import {
  CORE_CONSENT_BUNDLE,
  resolveConsentBundleDocuments,
} from "@/lib/legal/legal-consent-bundle";
import {
  continueButtonLabel,
  meetsCurrentOnboardingRequirement,
  resolveOnboardingStep,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import {
  resolveSafeReturnDestination,
  sanitizeOnboardingReturnOrigin,
  sanitizeOnboardingReturnPath,
} from "@/lib/onboarding/safe-return";
import type {
  CoreOnboardingSubmitInput,
  CoreOnboardingSubmitResult,
  CustomerOnboardingSummary,
  OnboardingLoaderState,
} from "@/lib/onboarding/onboarding-types";
import { MINECRAFT_VERIFICATION_ZONE } from "@/lib/onboarding/minecraft-verification-zone";

export type UiLabOnboardingScenario =
  | "welcome"
  | "legal"
  | "existing_missing_consent"
  | "core_completed"
  | "fully_verified"
  | "legal_server_error"
  | "reacceptance_required"
  | "ineligible"
  | "redirect_bank"
  | "redirect_terminal"
  | "redirect_external_rejected"
  | "minecraft_unverified"
  | "minecraft_offline"
  | "minecraft_exact_success"
  | "minecraft_adjacent_fail"
  | "minecraft_round_fail"
  | "minecraft_wrong_z"
  | "minecraft_wrong_x"
  | "minecraft_foreign"
  | "minecraft_wrong_username"
  | "minecraft_elsewhere"
  | "minecraft_duplicate_uuid"
  | "minecraft_expired"
  | "minecraft_regen_cooldown"
  | "minecraft_feed_timeout"
  | "minecraft_malformed_json"
  | "minecraft_malformed_player"
  | "minecraft_server_error"
  | "minecraft_concurrent"
  | "existing_unverified_prefills";

const SCENARIO_STORAGE_KEY = "alta.onboarding.uiLabScenario";

const ALL_SCENARIOS: UiLabOnboardingScenario[] = [
  "welcome",
  "legal",
  "existing_missing_consent",
  "core_completed",
  "fully_verified",
  "legal_server_error",
  "reacceptance_required",
  "ineligible",
  "redirect_bank",
  "redirect_terminal",
  "redirect_external_rejected",
  "minecraft_unverified",
  "minecraft_offline",
  "minecraft_exact_success",
  "minecraft_adjacent_fail",
  "minecraft_round_fail",
  "minecraft_wrong_z",
  "minecraft_wrong_x",
  "minecraft_foreign",
  "minecraft_wrong_username",
  "minecraft_elsewhere",
  "minecraft_duplicate_uuid",
  "minecraft_expired",
  "minecraft_regen_cooldown",
  "minecraft_feed_timeout",
  "minecraft_malformed_json",
  "minecraft_malformed_player",
  "minecraft_server_error",
  "minecraft_concurrent",
  "existing_unverified_prefills",
];

export function isUiLabOnboardingScenario(
  value: string | null | undefined,
): value is UiLabOnboardingScenario {
  return Boolean(value && (ALL_SCENARIOS as string[]).includes(value));
}

export function getUiLabOnboardingScenario(): UiLabOnboardingScenario {
  if (!isUiLabMode()) return "fully_verified";
  if (typeof window !== "undefined") {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("uiLabScenario");
      if (isUiLabOnboardingScenario(fromUrl)) return fromUrl;
    } catch {
      /* ignore */
    }
    try {
      const raw = window.sessionStorage.getItem(SCENARIO_STORAGE_KEY);
      if (isUiLabOnboardingScenario(raw)) return raw;
    } catch {
      /* ignore */
    }
  }
  return "fully_verified";
}

export function setUiLabOnboardingScenario(scenario: UiLabOnboardingScenario): void {
  if (!isUiLabMode() || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SCENARIO_STORAGE_KEY, scenario);
  } catch {
    /* ignore */
  }
}

export const UI_LAB_ONBOARDING_SCENARIO_OPTIONS: Array<{
  value: UiLabOnboardingScenario;
  label: string;
}> = [
  { value: "fully_verified", label: "Fully verified (skip onboarding)" },
  { value: "core_completed", label: "Core done — Minecraft required" },
  { value: "existing_unverified_prefills", label: "Existing username — unverified" },
  { value: "welcome", label: "New user — Welcome" },
  { value: "legal", label: "Legal consent" },
  { value: "existing_missing_consent", label: "Existing — missing consent" },
  { value: "legal_server_error", label: "Legal recording error" },
  { value: "reacceptance_required", label: "Reacceptance required" },
  { value: "ineligible", label: "Ineligible path" },
  { value: "redirect_bank", label: "Safe Bank redirect" },
  { value: "redirect_terminal", label: "Safe Terminal redirect" },
  { value: "redirect_external_rejected", label: "External redirect rejected" },
  { value: "minecraft_unverified", label: "Minecraft unverified" },
  { value: "minecraft_offline", label: "MC — player offline" },
  { value: "minecraft_exact_success", label: "MC — exact block success" },
  { value: "minecraft_adjacent_fail", label: "MC — adjacent block fail" },
  { value: "minecraft_round_fail", label: "MC — round≠floor fail" },
  { value: "minecraft_wrong_z", label: "MC — wrong Z" },
  { value: "minecraft_wrong_x", label: "MC — wrong X" },
  { value: "minecraft_foreign", label: "MC — foreign world" },
  { value: "minecraft_wrong_username", label: "MC — wrong username at target" },
  { value: "minecraft_elsewhere", label: "MC — online elsewhere" },
  { value: "minecraft_duplicate_uuid", label: "MC — duplicate UUID" },
  { value: "minecraft_expired", label: "MC — expired challenge" },
  { value: "minecraft_regen_cooldown", label: "MC — regen cooldown" },
  { value: "minecraft_feed_timeout", label: "MC — feed timeout" },
  { value: "minecraft_malformed_json", label: "MC — malformed JSON" },
  { value: "minecraft_malformed_player", label: "MC — malformed player" },
  { value: "minecraft_server_error", label: "MC — server error" },
  { value: "minecraft_concurrent", label: "MC — concurrent confirmation" },
];

function baseUser(overrides: Partial<AltaUser> = {}): AltaUser {
  return {
    ...UI_LAB_MOCK_USER,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
    minecraftUsername: UI_LAB_MOCK_USER.minecraftUsername,
    ...overrides,
  };
}

function isMinecraftScenario(scenario: UiLabOnboardingScenario): boolean {
  return (
    scenario === "core_completed" ||
    scenario === "minecraft_unverified" ||
    scenario === "existing_unverified_prefills" ||
    scenario.startsWith("minecraft_")
  );
}

export function getUiLabOnboardingUser(
  scenario: UiLabOnboardingScenario = "fully_verified",
): AltaUser {
  if (scenario === "fully_verified") {
    return baseUser({
      eligibilityConfirmedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      coreOnboardingCompletedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      minecraftUsername: "carter",
      minecraftUuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
      minecraftVerifiedAt: new Date("2026-07-02T00:00:00.000Z").toISOString(),
      onboardingCompletedAt: new Date("2026-07-02T00:00:00.000Z").toISOString(),
    });
  }

  if (isMinecraftScenario(scenario)) {
    return baseUser({
      eligibilityConfirmedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      coreOnboardingCompletedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      minecraftUsername:
        scenario === "existing_unverified_prefills" || scenario === "minecraft_unverified"
          ? "carter"
          : "carter",
      minecraftVerifiedAt: null,
      minecraftUuid: null,
      onboardingCompletedAt: null,
    });
  }

  switch (scenario) {
    case "welcome":
    case "legal":
    case "existing_missing_consent":
    case "legal_server_error":
    case "reacceptance_required":
    case "ineligible":
    case "redirect_bank":
    case "redirect_terminal":
    case "redirect_external_rejected":
      return baseUser({
        createdAt:
          scenario === "existing_missing_consent"
            ? new Date("2024-06-01T00:00:00.000Z").toISOString()
            : UI_LAB_MOCK_USER.createdAt,
      });
    default:
      return baseUser();
  }
}

function coreDocumentsForLab() {
  return resolveConsentBundleDocuments(CORE_CONSENT_BUNDLE).map((d) => ({
    documentId: d.documentId,
    title: d.title,
    label: d.label,
    version: d.version,
    publicPath: d.publicPath,
    acceptanceType: d.acceptanceType,
  }));
}

function resolveScenarioStep(scenario: UiLabOnboardingScenario, user: AltaUser): OnboardingStepId {
  if (
    scenario === "legal" ||
    scenario === "existing_missing_consent" ||
    scenario === "reacceptance_required" ||
    scenario === "legal_server_error" ||
    scenario === "ineligible"
  ) {
    return "legal";
  }
  if (
    scenario === "welcome" ||
    scenario === "redirect_bank" ||
    scenario === "redirect_terminal" ||
    scenario === "redirect_external_rejected"
  ) {
    return "welcome";
  }
  if (scenario === "fully_verified") {
    return "confirmation";
  }
  return resolveOnboardingStep(user);
}

function labChallengeForScenario(
  scenario: UiLabOnboardingScenario,
  user: AltaUser,
): OnboardingLoaderState["minecraftChallenge"] {
  if (!isMinecraftScenario(scenario) || scenario === "minecraft_expired") {
    return null;
  }
  if (resolveOnboardingStep(user) !== "minecraft") return null;

  const pending = scenario !== "minecraft_regen_cooldown";
  return {
    id: "ui-lab-challenge",
    claimedUsername: user.minecraftUsername ?? "carter",
    targetWorld: MINECRAFT_VERIFICATION_ZONE.world,
    targetX: 493,
    targetZ: 209,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    attemptCount: 0,
    regenerationCount: 0,
    lastCheckedAt: null,
    verifiedAt: null,
    secondsRemaining: 15 * 60,
    canRegenerate: pending,
    regenerateCooldownSeconds: pending ? 0 : 25,
  };
}

export function getUiLabOnboardingState(input: {
  scenario?: string;
  sourceSite: SiteKey;
  returnPath?: string | null;
  returnOrigin?: string | null;
}): OnboardingLoaderState {
  const scenario = isUiLabOnboardingScenario(input.scenario)
    ? input.scenario
    : getUiLabOnboardingScenario();
  const user = getUiLabOnboardingUser(scenario);

  let returnPath = input.returnPath;
  let returnOrigin = input.returnOrigin;

  if (scenario === "redirect_bank") {
    returnPath = "/bank";
    returnOrigin = "https://bank.altagroup.dev";
  } else if (scenario === "redirect_terminal") {
    returnPath = "/terminal";
    returnOrigin = "https://terminal.altagroup.dev";
  } else if (scenario === "redirect_external_rejected") {
    returnPath = "https://evil.example/phish";
    returnOrigin = "https://evil.example";
  }

  const destination = resolveSafeReturnDestination({
    returnPath,
    returnOrigin,
    currentSiteKey: input.sourceSite,
  });

  if (scenario === "redirect_external_rejected") {
    void sanitizeOnboardingReturnPath("https://evil.example/phish", "/home");
    void sanitizeOnboardingReturnOrigin("https://evil.example");
  }

  const step = resolveScenarioStep(scenario, user);
  let minecraftChallenge = labChallengeForScenario(scenario, user);

  // Resume: prefer session-stored challenge when present (client-side UI Lab).
  if (typeof window !== "undefined" && step === "minecraft") {
    try {
      const raw = window.sessionStorage.getItem("alta.onboarding.uiLabMinecraftChallenge");
      if (raw) {
        minecraftChallenge = JSON.parse(raw) as NonNullable<typeof minecraftChallenge>;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    step,
    user: {
      id: user.id,
      discordUsername: user.discordUsername,
      avatarUrl: user.avatarUrl,
      minecraftUsername: user.minecraftUsername,
      minecraftUuid: user.minecraftUuid,
      minecraftVerifiedAt: user.minecraftVerifiedAt,
      eligibilityConfirmedAt: user.eligibilityConfirmedAt,
      coreOnboardingCompletedAt: user.coreOnboardingCompletedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
    },
    coreDocuments: coreDocumentsForLab(),
    destination,
    meetsRequirement: meetsCurrentOnboardingRequirement(user),
    minecraftChallenge,
  };
}

export function mockUiLabCoreOnboardingSubmit(
  input: CoreOnboardingSubmitInput,
  scenarioRaw?: string,
): CoreOnboardingSubmitResult {
  const scenario = isUiLabOnboardingScenario(scenarioRaw)
    ? scenarioRaw
    : getUiLabOnboardingScenario();

  if (scenario === "legal_server_error") {
    throw new Error("ONBOARDING_SERVER_ERROR");
  }
  if (scenario === "ineligible" || !input.eligibilityConfirmed) {
    throw new Error("ONBOARDING_ELIGIBILITY_REQUIRED");
  }
  if (!input.termsAndAupAgreed) {
    throw new Error("ONBOARDING_TERMS_REQUIRED");
  }
  if (!input.privacyAndElectronicConsented) {
    throw new Error("ONBOARDING_PRIVACY_REQUIRED");
  }

  const now = new Date().toISOString();
  const user = baseUser({
    eligibilityConfirmedAt: now,
    coreOnboardingCompletedAt: now,
    onboardingCompletedAt: null,
    minecraftVerifiedAt: null,
  });

  const destination = resolveSafeReturnDestination({
    returnPath: input.returnPath,
    returnOrigin: input.returnOrigin,
    currentSiteKey: input.sourceSite,
  });

  return {
    user,
    step: "minecraft",
    destination,
    alreadyComplete: false,
  };
}

export function getUiLabCustomerOnboardingSummary(_userId: string): CustomerOnboardingSummary {
  const user = getUiLabOnboardingUser(getUiLabOnboardingScenario());
  const docs = coreDocumentsForLab();
  const coreComplete = Boolean(user.coreOnboardingCompletedAt);
  const verified = Boolean(user.minecraftVerifiedAt);

  return {
    coreOnboardingComplete: coreComplete,
    eligibilityConfirmedAt: user.eligibilityConfirmedAt,
    coreOnboardingCompletedAt: user.coreOnboardingCompletedAt,
    onboardingCompletedAt: user.onboardingCompletedAt,
    minecraftStatus: verified ? "Verified" : "Not verified",
    minecraftUsername: user.minecraftUsername,
    minecraftUuid: user.minecraftUuid,
    minecraftVerifiedAt: user.minecraftVerifiedAt,
    legalBundleStatus: coreComplete ? "Current" : "Missing",
    acceptedDocuments: coreComplete
      ? docs.map((d) => ({
          documentId: d.documentId,
          title: d.title,
          version: d.version,
          acceptanceType: d.acceptanceType,
          acceptedAt: user.coreOnboardingCompletedAt!,
        }))
      : [],
    challenge:
      coreComplete && !verified
        ? {
            status: "PENDING",
            claimedUsername: user.minecraftUsername,
            targetX: 493,
            targetZ: 209,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            attemptCount: 1,
            regenerationCount: 0,
          }
        : null,
  };
}

export { continueButtonLabel };
