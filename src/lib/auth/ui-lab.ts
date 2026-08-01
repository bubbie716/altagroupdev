/**
 * UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
 *
 * Enabled by setting `VITE_UI_LAB_MODE=true`. When active, auth guards
 * are bypassed and a fixed mock user is injected so Lovable's UI Lab
 * can preview authenticated/protected pages without Discord OAuth,
 * database sessions, or real login flows.
 *
 * This file MUST be a no-op when the flag is unset. Never import or
 * use the mock user from production code paths.
 */
import type { AltaUser, EnrichedCompanyMembership } from "@/lib/auth/types";

export function isUiLabMode(): boolean {
  // Vite inlines import.meta.env on client/SSR builds; Node unit tests fall back to process.env.
  try {
    const fromImportMeta = import.meta.env?.VITE_UI_LAB_MODE;
    const flag =
      typeof fromImportMeta === "string" ? fromImportMeta : process.env.VITE_UI_LAB_MODE;
    const enabled = flag === "true";
    const isProd =
      import.meta.env?.PROD === true || process.env.NODE_ENV === "production";
    if (enabled && isProd) {
      console.error(
        "[ui-lab] VITE_UI_LAB_MODE is set in a production build — auth bypass disabled.",
      );
      return false;
    }
    return enabled;
  } catch {
    return process.env.VITE_UI_LAB_MODE === "true" && process.env.NODE_ENV !== "production";
  }
}

const MOCK_MEMBERSHIPS: EnrichedCompanyMembership[] = [
  {
    userId: "ui-lab-user",
    companyId: "CO-ALTG",
    role: "owner",
    companyName: "Alta Group N.V.",
    companyType: "Holding Company",
    companyTicker: "ALTG",
    companyStatus: "Listed",
    companyVerificationStatus: "Verified",
  },
  {
    userId: "ui-lab-user",
    companyId: "CO-NPC",
    role: "owner",
    companyName: "Newport Petroleum Corp.",
    companyType: "Listed Company",
    companyTicker: "NPC",
    companyStatus: "Listed",
    companyVerificationStatus: "Verified",
  },
];

const ONBOARDING_SCENARIO_KEY = "alta.onboarding.uiLabScenario";

/** Scenarios that clear all onboarding (welcome/legal path). */
const NO_ONBOARDING_SCENARIOS = new Set([
  "welcome",
  "legal",
  "existing_missing_consent",
  "legal_server_error",
  "reacceptance_required",
  "ineligible",
  "redirect_bank",
  "redirect_terminal",
  "redirect_external_rejected",
]);

/** Core legal done but Minecraft verification still required. */
const CORE_ONLY_ONBOARDING_SCENARIOS = new Set([
  "core_completed",
  "minecraft_unverified",
  "existing_unverified_prefills",
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
]);

function readOnboardingScenario(): string {
  if (typeof window === "undefined") return "fully_verified";
  try {
    return window.sessionStorage.getItem(ONBOARDING_SCENARIO_KEY) ?? "fully_verified";
  } catch {
    return "fully_verified";
  }
}

/** UI LAB ONLY — DO NOT ENABLE IN PRODUCTION */
export const UI_LAB_MOCK_USER: AltaUser = {
  id: "ui-lab-user",
  discordId: "000000000000000000",
  discordUsername: "carter",
  avatarUrl: null,
  email: "carter.townshend@ui-lab.local",
  minecraftUsername: "carter",
  minecraftUuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
  minecraftVerifiedAt: new Date("2026-07-02T00:00:00.000Z").toISOString(),
  // Default: fully onboarded so existing UI Lab product previews keep working under Phase 2.
  eligibilityConfirmedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
  coreOnboardingCompletedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
  onboardingCompletedAt: new Date("2026-07-02T00:00:00.000Z").toISOString(),
  tags: ["corporate_admin"],
  accountStatus: "active",
  internalAccess: true,
  companyMemberships: MOCK_MEMBERSHIPS,
  createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
  lastLoginAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
};

function applyOnboardingScenario(user: AltaUser): AltaUser {
  let scenario = readOnboardingScenario();
  // Prefer URL search param when present (works for SSR/loaders).
  if (typeof window !== "undefined") {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("uiLabScenario");
      if (fromUrl) scenario = fromUrl;
    } catch {
      /* ignore */
    }
  }

  if (NO_ONBOARDING_SCENARIOS.has(scenario)) {
    return {
      ...user,
      eligibilityConfirmedAt: null,
      coreOnboardingCompletedAt: null,
      onboardingCompletedAt: null,
      minecraftUuid: null,
      minecraftVerifiedAt: null,
      createdAt:
        scenario === "existing_missing_consent"
          ? new Date("2024-06-01T00:00:00.000Z").toISOString()
          : user.createdAt,
    };
  }

  if (CORE_ONLY_ONBOARDING_SCENARIOS.has(scenario)) {
    return {
      ...user,
      eligibilityConfirmedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      coreOnboardingCompletedAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      onboardingCompletedAt: null,
      minecraftUuid: null,
      minecraftVerifiedAt: null,
      minecraftUsername: user.minecraftUsername ?? "carter",
    };
  }

  // fully_verified / unknown: keep full completion so product previews are not gated.
  return user;
}

/** UI LAB ONLY — returns the mock user when the flag is on, else null. */
export function getUiLabUserIfEnabled(): AltaUser | null {
  if (!isUiLabMode()) return null;
  return applyOnboardingScenario(UI_LAB_MOCK_USER);
}
